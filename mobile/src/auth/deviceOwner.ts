/**
 * Which account the local database belongs to.
 *
 * The local SQLite file holds one farm's records, and WatermelonDB keeps a
 * single `lastPulledAt` for the whole file. Signing in as a second account on
 * the same phone without clearing it goes wrong two ways:
 *
 *   - the new account's first sync is incremental from the *previous* account's
 *     timestamp, so its older records never come down;
 *   - the previous account's unsent rows are pushed with the new account's
 *     token, and the server (rightly) files them under the new account.
 *
 * So the database is tagged with its owner. Signing in as someone else resets
 * it — but only when nothing is waiting to be sent: those rows can only reach
 * the server under the account that wrote them, so the farmer is asked to sign
 * that account back in first instead of losing them.
 */

import {Q} from '@nozbe/watermelondb';

import {database} from '../db';
import {BACKGROUND_TABLES, SYNC_TABLES} from '../db/schema';

export interface DeviceOwner {
  id: string;
  /** Shown in the "sign the other account back in" message; null when unknown. */
  username: string | null;
}

export type DeviceDecision = 'keep' | 'claim' | 'reset' | 'blocked';

const OWNER_KEY = 'agrilog_device_owner';

/** Tables whose rows carry the farm they belong to — used to recognise the
 * owner of a database written before the owner was recorded. */
const OWNED_TABLES = ['plots', 'plans', 'warehouse_in', 'warehouse_out', 'income', 'expense', 'tasks_history'] as const;

export class DeviceInUseError extends Error {
  constructor(
    readonly previous: DeviceOwner,
    readonly pendingCount: number,
  ) {
    const who = previous.username ? `tài khoản "${previous.username}"` : 'tài khoản trước';
    super(
      `Máy này còn ${pendingCount} thay đổi chưa gửi lên máy chủ của ${who}. ` +
        `Hãy đăng nhập lại ${who} khi có mạng để gửi xong, rồi mới đổi tài khoản.`,
    );
    this.name = 'DeviceInUseError';
  }
}

/** Pure rule, kept apart from the database so it can be tested on its own. */
export function decideDevice(previous: DeviceOwner | null, nextUserId: string, pendingCount: number): DeviceDecision {
  if (!previous) return 'claim';
  if (previous.id === nextUserId) return 'keep';
  return pendingCount > 0 ? 'blocked' : 'reset';
}

/**
 * Makes the local database ready for `user`. Throws DeviceInUseError when
 * another account still has unsent changes on this phone.
 */
export async function prepareDeviceFor(user: {id: string; username: string}): Promise<void> {
  const previous = (await readOwner()) ?? (await inferOwnerFromData());
  const pending = previous && previous.id !== user.id ? await countUnsent() : 0;

  switch (decideDevice(previous, user.id, pending)) {
    case 'blocked':
      throw new DeviceInUseError(previous!, pending);
    case 'reset':
      await database.write(() => database.unsafeResetDatabase());
      break;
    case 'keep':
    case 'claim':
      break;
  }
  await database.localStorage.set<DeviceOwner>(OWNER_KEY, {id: user.id, username: user.username});
}

async function readOwner(): Promise<DeviceOwner | null> {
  return (await database.localStorage.get<DeviceOwner>(OWNER_KEY)) ?? null;
}

/** A database from before this file existed: whose rows are in it? */
async function inferOwnerFromData(): Promise<DeviceOwner | null> {
  for (const table of OWNED_TABLES) {
    const rows = await database.get(table).query(Q.take(1)).fetch();
    const ownerId = (rows[0]?._raw as unknown as {owner_id?: string} | undefined)?.owner_id;
    if (ownerId) return {id: ownerId, username: null};
  }
  return null;
}

/** Created/updated rows not yet pushed, plus deletions not yet pushed.
 * "Đã xem" marks do not count: losing one costs a badge, not the farmer's work. */
async function countUnsent(): Promise<number> {
  let total = 0;
  for (const table of SYNC_TABLES) {
    if (BACKGROUND_TABLES.includes(table)) continue;
    total += await database.get(table).query(Q.where('_status', Q.notEq('synced'))).fetchCount();
    total += (await database.adapter.getDeletedRecords(table)).length;
  }
  return total;
}
