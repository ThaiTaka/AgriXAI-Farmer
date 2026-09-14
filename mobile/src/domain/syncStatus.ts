/**
 * What the offline banner and the per-table sync rows say, as pure
 * functions of the sync state — so the wording is testable without rendering.
 */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface BannerMessage {
  kind: 'offline' | 'syncing' | 'synced' | 'error';
  text: string;
  /** Auto-hide after this many ms; null = stays until the state changes. */
  hideAfterMs: number | null;
}

export const OFFLINE_HIDE_MS = 8_000;
export const SYNCED_HIDE_MS = 3_000;

export function clockLabel(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function bannerFor(state: SyncState, lastSyncedAt: number | null): BannerMessage | null {
  switch (state) {
    case 'offline':
      return {kind: 'offline', text: 'Chế độ offline — thay đổi sẽ lưu khi online', hideAfterMs: OFFLINE_HIDE_MS};
    case 'syncing':
      return {kind: 'syncing', text: 'Đang đồng bộ…', hideAfterMs: null};
    case 'error':
      return {kind: 'error', text: 'Đồng bộ gặp lỗi — sẽ thử lại', hideAfterMs: OFFLINE_HIDE_MS};
    case 'idle':
      return lastSyncedAt ? {kind: 'synced', text: `Cập nhật lúc ${clockLabel(lastSyncedAt)}`, hideAfterMs: SYNCED_HIDE_MS} : null;
    default:
      return null;
  }
}

/** "3 giờ", "25 phút", "2 ngày" — how long a table has had unsent changes. */
export function ageLabel(sinceMs: number, now: number): string {
  const diff = Math.max(0, now - sinceMs);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

/** The shape POST /sync returns for a refused row (see api/sync.ts). */
export interface ConflictLike {
  table: string;
  id: string;
  server: Record<string, unknown>;
}

export const TABLE_NAMES_VI: Record<string, string> = {
  plots: 'lô đất',
  crop_varieties: 'giống cây',
  crop_cycles: 'chu kỳ canh tác',
  change_logs: 'nhật ký thay đổi',
  plans: 'kế hoạch bón',
  warehouse_in: 'phiếu nhập kho',
  warehouse_out: 'phiếu xuất kho',
  income: 'khoản thu',
  expense: 'khoản chi',
  tasks_history: 'công việc',
};

/** A short label for a conflicting record, from whatever naming column it has. */
export function conflictTitle(conflict: ConflictLike): string {
  const s = conflict.server;
  const label =
    (s.name as string | undefined) ??
    (s.description as string | undefined) ??
    (s.scenario_name as string | undefined) ??
    (s.fertilizer_name as string | undefined) ??
    (s.task_title as string | undefined) ??
    conflict.id;
  return `${TABLE_NAMES_VI[conflict.table] ?? conflict.table}: ${label}`;
}

export interface TableSyncInfo {
  table: string;
  label: string;
  /** Local rows not yet accepted by the server. */
  pending: number;
  /** Oldest unsent change, epoch ms — null when nothing pending. */
  oldestPendingAt: number | null;
}

export const TABLE_LABELS: Record<string, string> = {
  plots: 'Lô đất',
  crop_varieties: 'Giống tự thêm',
  crop_cycles: 'Chu kỳ canh tác',
  change_logs: 'Nhật ký thay đổi',
  plans: 'Kế hoạch bón',
  warehouse_in: 'Phiếu nhập kho',
  warehouse_out: 'Phiếu xuất kho',
  income: 'Khoản thu',
  expense: 'Khoản chi',
  tasks_history: 'Công việc đã làm',
};

/**
 * One line per table for the settings screen:
 *   "Đã lưu trên server 14/09 14:35"  — nothing pending, last sync known
 *   "Offline 3 giờ · 2 thay đổi chờ"  — unsent rows since `oldestPendingAt`
 */
export function tableStatusLine(
  info: TableSyncInfo,
  lastSyncedAt: number | null,
  now: number,
  formatDateTime: (at: number) => string,
): string {
  if (info.pending > 0) {
    const age = info.oldestPendingAt ? ageLabel(info.oldestPendingAt, now) : 'vừa xong';
    return `Offline ${age} · ${info.pending} thay đổi chờ đồng bộ`;
  }
  return lastSyncedAt ? `Đã lưu trên server ${formatDateTime(lastSyncedAt)}` : 'Chưa đồng bộ lần nào';
}
