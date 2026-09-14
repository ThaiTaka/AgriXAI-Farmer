/**
 * Resolving a sync conflict on the device.
 *
 * The server keeps the newer copy and tells us which rows it refused. The
 * farmer chooses per conflict:
 *   - "Lấy bản mới"     — overwrite the local row with the server copy
 *   - "Giữ bản của tôi" — touch the local row so it carries a fresh
 *                         `updated_at` and wins on the next push
 * Either way the record ends up identical on both devices after the next
 * sync; nothing is left silently diverged.
 */

import type {Model} from '@nozbe/watermelondb';

import type {SyncConflict} from '../api/sync';
import {database} from '../db';
import {SYNC_TABLES} from '../db/schema';

// Column names the server owns or WatermelonDB manages; never copied into a row.
const SKIP = new Set(['id', 'created_at', 'updated_at', 'owner_id', '_status', '_changed']);

export {conflictTitle, TABLE_NAMES_VI} from '../domain/syncStatus';

function isSyncTable(name: string): name is (typeof SYNC_TABLES)[number] {
  return (SYNC_TABLES as readonly string[]).includes(name);
}

async function findLocal(conflict: SyncConflict): Promise<Model | null> {
  if (!isSyncTable(conflict.table)) return null;
  try {
    return await database.get(conflict.table).find(conflict.id);
  } catch {
    return null;
  }
}

/** Overwrite the local row with the server copy. */
export async function takeServerVersion(conflict: SyncConflict): Promise<boolean> {
  const record = await findLocal(conflict);
  if (!record) return false;
  await database.write(async () => {
    await database.batch(
      record.prepareUpdate(() => {
        for (const [column, value] of Object.entries(conflict.server)) {
          if (SKIP.has(column)) continue;
          // Raw column write: the server speaks schema column names, not
          // model property names, and every synced column is a plain field.
          (record._raw as unknown as Record<string, unknown>)[column] = value;
        }
      }),
    );
  });
  return true;
}

/** Keep the local row: bump its timestamp so the next push wins. */
export async function keepLocalVersion(conflict: SyncConflict, updatedBy: string): Promise<boolean> {
  const record = await findLocal(conflict);
  if (!record) return false;
  await database.write(async () => {
    await database.batch(
      record.prepareUpdate(() => {
        const raw = record._raw as unknown as Record<string, unknown>;
        if ('updated_by' in raw) raw.updated_by = updatedBy;
      }),
    );
  });
  return true;
}
