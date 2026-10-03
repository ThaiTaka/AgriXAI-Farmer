/**
 * What one sync pass moved, in the farmer's terms — "đã gửi 3 thay đổi lên
 * máy chủ", "đã nhận 2 cập nhật" — counted from the change sets themselves.
 *
 * Two kinds of row are left out of both counts because they would make the
 * numbers lie: the audit trail (change_logs — one per edit, so every edit
 * would count twice) and the farmer's own "đã xem" marks. A row the server
 * sends back that this account wrote itself (the echo of an edit pushed on
 * the previous pass) is not "received" either.
 */

export interface TableChanges {
  created?: Record<string, unknown>[];
  updated?: Record<string, unknown>[];
  deleted?: string[];
}

export type ChangeSet = Record<string, TableChanges | undefined>;

export interface SyncSummary {
  /** The farmer's own changes the server accepted this pass. */
  sent: number;
  /** Changes made elsewhere (admin, another phone) that arrived this pass. */
  received: number;
  /** Notifications that arrived for the first time this pass. */
  newNotifications: Record<string, unknown>[];
  /** Notifications the admin took back — their shade entries go too. */
  retractedNotifications?: string[];
  /** The phone's first pull: everything arrives at once and is not news. */
  firstSync: boolean;
}

export const EMPTY_SUMMARY: SyncSummary = {sent: 0, received: 0, newNotifications: [], firstSync: false};

const QUIET_TABLES = new Set(['change_logs', 'notification_reads']);

/** Rows pushed, minus the ones the server refused or kept its own copy of. */
export function countSent(changes: ChangeSet, refused: readonly {table: string}[] = []): number {
  let total = 0;
  for (const [table, set] of Object.entries(changes)) {
    if (!set || QUIET_TABLES.has(table)) continue;
    total += (set.created?.length ?? 0) + (set.updated?.length ?? 0) + (set.deleted?.length ?? 0);
  }
  const lost = refused.filter(r => !QUIET_TABLES.has(r.table)).length;
  return Math.max(0, total - lost);
}

/** Rows pulled that someone other than `userId` wrote. Deletions are not
 * counted: the pull cannot say who deleted, and most are the farmer's own. */
export function countReceived(changes: ChangeSet, userId: string | null): number {
  let total = 0;
  for (const [table, set] of Object.entries(changes)) {
    if (!set || QUIET_TABLES.has(table)) continue;
    for (const row of [...(set.created ?? []), ...(set.updated ?? [])]) {
      const author = (row.updated_by ?? row.created_by ?? null) as string | null;
      if (!userId || author !== userId) total += 1;
    }
  }
  return total;
}

export function pulledNotifications(changes: ChangeSet): Record<string, unknown>[] {
  return changes.notifications?.created ?? [];
}

export function retractedNotifications(changes: ChangeSet): string[] {
  return changes.notifications?.deleted ?? [];
}

/** The line the sync banner shows after a pass, or null for the plain "Cập nhật lúc …". */
export function summaryLine(summary: SyncSummary | null): string | null {
  if (!summary) return null;
  if (summary.firstSync) return summary.received > 0 ? 'Đã tải dữ liệu của bạn về máy' : null;
  const {sent, received} = summary;
  if (sent > 0 && received > 0) return `Đã gửi ${sent} thay đổi lên máy chủ, nhận ${received} cập nhật`;
  if (sent > 0) return `Đã gửi ${sent} thay đổi lên máy chủ — dữ liệu đã an toàn`;
  if (received > 0) return `Đã nhận ${received} cập nhật từ máy chủ`;
  return null;
}
