/**
 * The photo upload queue processor (Điều 3).
 *
 * A leaf photo taken with no signal is written to `pending_diagnoses` and the
 * farmer carries on immediately. This drains that queue: every tick it takes the
 * oldest waiting photo, uploads it, and on success writes the resulting
 * `diagnoses` row and drops the queue entry.
 *
 * Design notes:
 *
 *  - **One photo per tick.** Uploading the whole backlog at once on a phone that
 *    just reconnected is how you get five simultaneous 30-second requests over
 *    one bar of signal, all of them timing out together.
 *  - **Failures are silent.** Being offline is the normal state this feature
 *    exists for, so it must never produce a toast or a blocking dialog. The
 *    queue count in the UI is the whole of the reporting.
 *  - **Backoff on repeated failure.** A photo the server keeps rejecting (a
 *    corrupt file, say) must not be retried every five seconds forever.
 */

import {analysePhoto} from '../api/diagnoses';
import {NetworkError} from '../api/client';
import type {ChangeAuthor} from '../db/repositories/changeLogRepository';
import type PendingDiagnosis from '../db/models/PendingDiagnosis';
import {
  claimableQueue,
  dropQueueRow,
  markQueueStatus,
  resetQueueRow,
  saveDiagnosis,
} from '../db/repositories/diagnosisRepository';

export const TICK_MS = 5_000;

/** Give up automatic retries after this many failures; the user can retry by hand. */
export const MAX_ATTEMPTS = 8;

/** Seconds to wait after the Nth failure: 5s, 10s, 20s, 40s... capped at 5 min. */
function backoffMs(attempts: number): number {
  return Math.min(TICK_MS * 2 ** Math.max(0, attempts - 1), 300_000);
}

export interface TickResult {
  /** Photos still waiting after this tick. */
  remaining: number;
  uploaded: number;
  /** True when the last failure was "no signal" rather than a real error. */
  offline: boolean;
}

let running = false;

/**
 * Processes at most one queued photo.
 *
 * Re-entrant calls are dropped rather than queued: the timer and a manual
 * "thử lại" tap can land at the same moment, and uploading the same photo twice
 * would produce two diagnoses of one leaf.
 */
export async function processQueueOnce(
  token: string | null,
  author: ChangeAuthor | null,
): Promise<TickResult> {
  if (running || !token || !author) {
    return {remaining: 0, uploaded: 0, offline: false};
  }
  running = true;

  try {
    const queue = await claimableQueue(author.id);
    if (queue.length === 0) return {remaining: 0, uploaded: 0, offline: false};

    const now = Date.now();
    const next = queue.find(row => {
      if (row.attempts === 0) return true;
      if (row.attempts >= MAX_ATTEMPTS) return false;
      return now - row.updatedAt.getTime() >= backoffMs(row.attempts);
    });

    if (!next) return {remaining: queue.length, uploaded: 0, offline: false};

    await markQueueStatus(next, 'uploading');

    try {
      const result = await analysePhoto({
        photoPath: next.photoPath,
        photoMime: next.photoMime,
        plotId: next.plotId,
        clientId: next.id,
        token,
      });

      // The photo was queued precisely because the farmer asked for a diagnosis
      // and then walked away, so the result is saved for them rather than
      // waiting for a tap they will never make.
      const diagnosis = await saveDiagnosis(
        {
          // The queue row id doubles as the diagnosis id: it was already the
          // upload's client id, and reusing it makes the whole path idempotent —
          // a tick that crashes after the upload but before the status write
          // cannot produce a second diagnosis on the retry.
          id: next.id,
          plotId: next.plotId,
          result,
          localPhotoPath: next.photoPath,
          diagnosedAt: next.createdAt.getTime(),
        },
        author,
      );

      await markQueueStatus(next, 'done', {diagnosisId: diagnosis.id, lastError: null});
      await dropQueueRow(next);

      return {remaining: queue.length - 1, uploaded: 1, offline: false};
    } catch (error) {
      const offline = error instanceof NetworkError;
      await markQueueStatus(next, offline ? 'pending' : 'failed', {
        bumpAttempts: true,
        lastError: offline ? null : String((error as Error)?.message ?? error),
      });
      return {remaining: queue.length, uploaded: 0, offline};
    }
  } catch (error) {
    console.warn('[queue] tick failed', error);
    return {remaining: 0, uploaded: 0, offline: false};
  } finally {
    running = false;
  }
}

/**
 * Manual retry.
 *
 * Resets the attempt counter, not just the status — a row that has hit
 * MAX_ATTEMPTS is skipped by the backoff check, so leaving `attempts` alone
 * would make the button do nothing.
 */
export async function retryQueueRow(row: PendingDiagnosis): Promise<void> {
  await resetQueueRow(row);
}
