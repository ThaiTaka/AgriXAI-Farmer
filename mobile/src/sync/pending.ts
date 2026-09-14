/**
 * How much of each table is still waiting to reach the server, read from
 * WatermelonDB's own `_status` bookkeeping (`created` / `updated` rows are
 * unsent; `synced` rows are on the server). Deleted-but-unsent rows are
 * counted through `database.adapter` bookkeeping only at push time, so they
 * are not in this number — the banner still says "offline" for them.
 */

import {Q} from '@nozbe/watermelondb';

import {database} from '../db';
import {SYNC_TABLES} from '../db/schema';
import type {TableSyncInfo} from '../domain/syncStatus';
import {TABLE_LABELS} from '../domain/syncStatus';

export async function pendingByTable(): Promise<TableSyncInfo[]> {
  const infos: TableSyncInfo[] = [];
  for (const table of SYNC_TABLES) {
    let pending = 0;
    let oldest: number | null = null;
    try {
      const rows = await database.get(table).query(Q.where('_status', Q.notEq('synced'))).fetch();
      pending = rows.length;
      for (const row of rows) {
        const at = (row._raw as unknown as {updated_at?: number}).updated_at ?? null;
        if (at !== null && (oldest === null || at < oldest)) oldest = at;
      }
    } catch (error) {
      console.warn('[sync] pending count failed for', table, error);
    }
    infos.push({table, label: TABLE_LABELS[table] ?? table, pending, oldestPendingAt: oldest});
  }
  return infos;
}

export const totalPending = (infos: readonly TableSyncInfo[]): number => infos.reduce((s, i) => s + i.pending, 0);
