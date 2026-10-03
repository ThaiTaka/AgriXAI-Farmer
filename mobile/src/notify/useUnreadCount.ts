import {useMemo} from 'react';

import type AppNotification from '../db/models/AppNotification';
import type NotificationRead from '../db/models/NotificationRead';
import {observeNotifications, observeReads, toNotice} from '../db/repositories/notificationRepository';
import {useObservable} from '../db/useObservable';
import {lastReads, unreadCount} from '../domain/notifications';

/** The number on the bell: unread messages that are still current. */
export function useUnreadCount(userId: string): number {
  const notices = useObservable<AppNotification[]>(() => observeNotifications(), [], []);
  const reads = useObservable<NotificationRead[]>(() => observeReads(userId), [userId], []);
  return useMemo(() => unreadCount(notices.map(toNotice), lastReads(reads), Date.now()), [notices, reads]);
}
