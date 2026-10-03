/**
 * WatermelonDB sync adapter (Mục 9).
 *
 * Two-way from the start: `pullChanges` fetches what the server has, and
 * `pushChanges` sends everything the local `_status` bookkeeping marks as
 * unsynced. The sync NEVER blocks a screen — callers fire it and ignore the
 * outcome; a failure just means the next attempt will carry the same rows.
 *
 * Giai đoạn 4: the push reply lists rows the server refused (another device
 * of the same account wrote a newer version). They come back in
 * `SyncOutcome.conflicts` so the app can ask the farmer which copy to keep.
 *
 * V2.2: every pass also reports what it moved (`SyncOutcome.summary`) — how
 * many of the farmer's changes reached the server, how many arrived from
 * elsewhere, and which notifications are new — for the sync banner and the
 * phone's system notifications.
 */

import {synchronize} from '@nozbe/watermelondb/sync';

import {database} from '../db';
import {SCHEMA_VERSION} from '../db/schema';
import type {ChangeSet, SyncSummary} from '../domain/syncSummary';
import {countReceived, countSent, pulledNotifications, retractedNotifications} from '../domain/syncSummary';
import {API_BASE_URL, NetworkError} from './client';

export interface SyncConflict {
  table: string;
  id: string;
  server_updated_at: number;
  server_updated_by: string | null;
  /** The server's current row, column names as in the schema. */
  server: Record<string, unknown>;
}

export interface SyncOutcome {
  ok: boolean;
  reason?: 'offline' | 'unauthorised' | 'error';
  detail?: string;
  conflicts?: SyncConflict[];
  /** What the pass moved — present when `ok`. */
  summary?: SyncSummary;
}

let inFlight: Promise<SyncOutcome> | null = null;

/**
 * Runs one sync pass.
 *
 * Calls are collapsed: if a sync is already running, the caller joins it rather
 * than starting a second one. Two overlapping passes would push the same rows
 * twice and race on `last_pulled_at`.
 */
export async function runSync(token: string, userId: string | null = null): Promise<SyncOutcome> {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<SyncOutcome> => {
    const conflicts: SyncConflict[] = [];
    const summary: SyncSummary = {sent: 0, received: 0, newNotifications: [], firstSync: false};
    try {
      await synchronize({
        database,
        pullChanges: async ({lastPulledAt, schemaVersion, migration}) => {
          // Built by hand: React Native's URLSearchParams polyfill does not
          // implement `set`, so using it here fails only at runtime.
          const params = [`schema_version=${schemaVersion ?? SCHEMA_VERSION}`];
          if (lastPulledAt) params.push(`last_pulled_at=${lastPulledAt}`);
          if (migration) {
            params.push(`migration=${encodeURIComponent(JSON.stringify(migration))}`);
          }

          const response = await fetch(`${API_BASE_URL}/sync?${params.join('&')}`, {
            headers: {Authorization: `Bearer ${token}`},
          });
          if (response.status === 401) throw new UnauthorisedError();
          if (!response.ok) throw new Error(`pull failed: ${response.status}`);

          const body = await response.json();
          const changes = body.changes as ChangeSet;
          summary.firstSync = !lastPulledAt;
          summary.received = countReceived(changes, userId);
          summary.newNotifications = pulledNotifications(changes);
          summary.retractedNotifications = retractedNotifications(changes);
          return {changes: body.changes, timestamp: body.timestamp};
        },
        pushChanges: async ({changes, lastPulledAt}) => {
          const response = await fetch(
            `${API_BASE_URL}/sync?last_pulled_at=${lastPulledAt}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(changes),
            },
          );
          if (response.status === 401) throw new UnauthorisedError();
          if (!response.ok) throw new Error(`push failed: ${response.status}`);
          const body = (await response.json()) as {conflicts?: SyncConflict[]; rejected?: {table: string}[]};
          if (Array.isArray(body.conflicts)) conflicts.push(...body.conflicts);
          summary.sent = countSent(changes as unknown as ChangeSet, [
            ...(body.conflicts ?? []),
            ...(Array.isArray(body.rejected) ? body.rejected : []),
          ]);
        },
        // Migration syncs (V2.1). A phone that pulled rows on the old app
        // version stored them without the columns that version did not have;
        // after upgrading, the first pull names the new tables and columns and
        // the server re-sends those tables whole. 6 is the last schema before
        // the first migration the server knows how to re-send (v7).
        migrationsEnabledAtVersion: 6,
        // Deliberately NOT setting `sendCreatedAsUpdated`: that flag is for
        // servers which cannot tell a create from an update, and WatermelonDB
        // rejects a response containing `created` when it is on. Ours reports
        // the two separately.
        log: __DEV__ ? {} : undefined,
      });

      return {ok: true, conflicts, summary};
    } catch (error) {
      if (error instanceof UnauthorisedError) {
        return {ok: false, reason: 'unauthorised'};
      }
      if (error instanceof NetworkError || isNetworkFailure(error)) {
        // Being offline is the normal case out in a field, not an error worth
        // showing the farmer.
        return {ok: false, reason: 'offline'};
      }
      console.warn('[sync] failed', error);
      return {ok: false, reason: 'error', detail: String(error)};
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

class UnauthorisedError extends Error {
  constructor() {
    super('unauthorised');
    this.name = 'UnauthorisedError';
  }
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError && /network|fetch|connect/i.test(error.message);
}
