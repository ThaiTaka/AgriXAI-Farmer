import {Q} from '@nozbe/watermelondb';

import {collections, database} from '..';
import type AppNotification from '../models/AppNotification';
import type NotificationRead from '../models/NotificationRead';
import type {NoticeLike} from '../../domain/notifications';

/**
 * Every notification on this phone, newest first. The server only sends this
 * account's own messages and the broadcasts, so no owner filter is needed.
 */
export function observeNotifications() {
  return collections.notifications
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['updated_at', 'title', 'body', 'level', 'expires_at']);
}

export function observeReads(ownerId: string) {
  return collections.notificationReads.query(Q.where('owner_id', ownerId)).observeWithColumns(['read_at']);
}

export async function findNotification(id: string): Promise<AppNotification | null> {
  try {
    return await collections.notifications.find(id);
  } catch {
    return null;
  }
}

export const toNotice = (n: AppNotification): NoticeLike => ({
  id: n.id,
  kind: n.kind,
  level: n.level,
  title: n.title,
  body: n.body,
  link: n.link,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
  expiresAt: n.expiresAt,
});

/**
 * Marks notifications as read by this account — one row per notification,
 * moved forward when it is read again after an edit. Stamped no earlier than
 * the message's own `updated_at`, so a phone clock running behind the server
 * cannot leave a just-read message looking unread.
 */
export async function markRead(
  ownerId: string,
  notices: readonly Pick<NoticeLike, 'id' | 'updatedAt'>[],
  now: number = Date.now(),
): Promise<void> {
  if (notices.length === 0) return;
  const existing = await collections.notificationReads
    .query(Q.where('owner_id', ownerId), Q.where('notification_id', Q.oneOf(notices.map(n => n.id))))
    .fetch();
  const byNotice = new Map<string, NotificationRead>(existing.map(r => [r.notificationId, r]));

  await database.write(async () => {
    const ops = [];
    for (const notice of notices) {
      const stamp = Math.max(now, notice.updatedAt);
      const row = byNotice.get(notice.id);
      if (row) {
        if (row.readAt < notice.updatedAt) {
          ops.push(
            row.prepareUpdate(r => {
              r.readAt = stamp;
            }),
          );
        }
      } else {
        ops.push(
          collections.notificationReads.prepareCreate(r => {
            r.notificationId = notice.id;
            r.readAt = stamp;
            r.ownerId = ownerId;
          }),
        );
      }
    }
    if (ops.length > 0) await database.batch(...ops);
  });
}
