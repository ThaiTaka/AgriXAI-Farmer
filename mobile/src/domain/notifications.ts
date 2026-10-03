/**
 * Notification rules as pure functions — what counts as unread, which ones
 * deserve a system notification, where tapping one leads, and the reminder
 * time — so they are testable without the database or notifee.
 */

export interface NoticeLike {
  id: string;
  kind: string;
  level: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

export interface ReadLike {
  notificationId: string;
  readAt: number;
}

/** Latest "đã xem" stamp per notification. */
export function lastReads(reads: readonly ReadLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of reads) {
    const prev = map.get(r.notificationId);
    if (prev === undefined || r.readAt > prev) map.set(r.notificationId, r.readAt);
  }
  return map;
}

export const isExpired = (n: NoticeLike, now: number): boolean => n.expiresAt != null && n.expiresAt <= now;

/** Never opened, or changed since it was (a price digest that gained a line).
 * The server applies the same rule (app/services/notification_service.py). */
export function isUnread(n: NoticeLike, reads: Map<string, number>): boolean {
  const at = reads.get(n.id);
  return at === undefined || at < n.updatedAt;
}

/** The bell's number: unread and still current — yesterday's rain warning is history, not news. */
export function unreadCount(notices: readonly NoticeLike[], reads: Map<string, number>, now: number): number {
  return notices.filter(n => !isExpired(n, now) && isUnread(n, reads)).length;
}

export interface InboxSection<T extends NoticeLike> {
  key: 'unread' | 'read' | 'past';
  title: string;
  data: T[];
}

/** Chưa xem · Đã xem · Đã qua (expired warnings), newest first in each. */
export function inboxSections<T extends NoticeLike>(
  notices: readonly T[],
  reads: Map<string, number>,
  now: number,
): InboxSection<T>[] {
  const newest = [...notices].sort((a, b) => b.createdAt - a.createdAt);
  const unread = newest.filter(n => !isExpired(n, now) && isUnread(n, reads));
  const read = newest.filter(n => !isExpired(n, now) && !isUnread(n, reads));
  const past = newest.filter(n => isExpired(n, now));
  const sections: InboxSection<T>[] = [
    {key: 'unread', title: 'Chưa xem', data: unread},
    {key: 'read', title: 'Đã xem', data: read},
    {key: 'past', title: 'Đã qua', data: past},
  ];
  return sections.filter(s => s.data.length > 0);
}

/** How long ago, the way a farmer says it. */
export function timeAgo(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  const d = new Date(at);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Days a notification stays worth a system notification after it was written.
 * A phone offline for a week should not ring for every old message at once. */
export const FRESH_FOR_MS = 3 * 86_400_000;

/** Whether a newly pulled notification should ring the phone. */
export function shouldRing(n: NoticeLike, {firstSync, now}: {firstSync: boolean; now: number}): boolean {
  if (firstSync) return false; // the whole history arrives at once; the inbox has it
  if (isExpired(n, now)) return false;
  return now - n.createdAt <= FRESH_FOR_MS;
}

export type NoticeTarget =
  | {screen: 'Weather'}
  | {screen: 'Prices'; productId?: string}
  | {screen: 'CareGuide'; guideId: string}
  | null;

/** Where tapping a notification leads. Unknown links open nothing but the inbox. */
export function targetOf(link: string | null | undefined): NoticeTarget {
  if (!link) return null;
  if (link === 'weather') return {screen: 'Weather'};
  if (link === 'prices') return {screen: 'Prices'};
  if (link.startsWith('prices:')) return {screen: 'Prices', productId: link.slice('prices:'.length)};
  if (link.startsWith('care_guide:')) return {screen: 'CareGuide', guideId: link.slice('care_guide:'.length)};
  return null;
}

export type NoticeChannel = 'alerts' | 'news';

/** Warnings ring loud (heads-up); everything else quietly. */
export const channelFor = (n: Pick<NoticeLike, 'level'>): NoticeChannel =>
  n.level === 'danger' || n.level === 'warning' ? 'alerts' : 'news';

/** The hour a reminder rings on its day. */
export const REMIND_HOUR = 7;

/**
 * When to ring for a reminder set for the day of `remindAt`: 07:00 that day;
 * a minute from now if the reminder is for today and 07:00 has passed; null
 * once the day is over (a reminder for yesterday is not rung late).
 */
export function ringAt(remindAt: number, now: number): number | null {
  const day = new Date(remindAt);
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), REMIND_HOUR, 0, 0, 0).getTime();
  if (at > now) return at;
  const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  return now < endOfDay ? now + 60_000 : null;
}
