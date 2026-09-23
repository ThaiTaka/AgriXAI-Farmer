/**
 * Per-row sync state, phrased for the farmer.
 *
 * WatermelonDB stamps every record with `syncStatus`: `synced` once the server
 * has it, `created`/`updated` while the change is still only on this phone.
 * The farmer does not care which of the two it is — only whether the note is
 * safe on the phone (always) and whether the server has seen it yet.
 */

import type {BadgeTone} from '../components/Badge';

export type PlotSyncState = 'synced' | 'pending';

export interface SyncBadge {
  state: PlotSyncState;
  label: string;
  tone: BadgeTone;
}

const SYNCED: SyncBadge = {state: 'synced', label: 'Đã đồng bộ', tone: 'green'};
const PENDING: SyncBadge = {state: 'pending', label: 'Chưa đồng bộ', tone: 'yellow'};

/** `synced` is the only status that means the server has the row. */
export function syncBadgeOf(syncStatus: string | null | undefined): SyncBadge {
  return syncStatus === 'synced' ? SYNCED : PENDING;
}

/** How many of a set of rows are still waiting to reach the server. */
export function pendingCount(rows: ReadonlyArray<{syncStatus?: string | null}>): number {
  return rows.reduce((total, row) => total + (syncBadgeOf(row.syncStatus).state === 'pending' ? 1 : 0), 0);
}

/** One line for the picker header: "3 lô · 1 chưa đồng bộ" / "3 lô · đã đồng bộ đủ". */
export function plotsSummary(rows: ReadonlyArray<{syncStatus?: string | null}>): string {
  if (rows.length === 0) return 'Chưa có lô nào';
  const pending = pendingCount(rows);
  const plural = `${rows.length} lô`;
  return pending > 0 ? `${plural} · ${pending} chưa đồng bộ` : `${plural} · đã đồng bộ đủ`;
}
