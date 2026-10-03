/**
 * System notifications — Notifee, entirely on the phone.
 *
 * Messages from the admin and the server (weather warnings, price changes)
 * arrive with the sync: while the app is open, and every ~15 minutes while it
 * is closed (notify/background.ts). The phone then raises them itself. A true
 * server push (Firebase Cloud Messaging) would also wake a phone that has
 * been idle for hours, but needs the owner's own Firebase project — see
 * docs/adr/0010-giong-noi-thong-bao-thoi-tiet.md.
 *
 * Four channels, so the farmer can mute one in Android settings and keep the
 * rest: weather warnings ring loud, news quietly, sync is silent, reminders
 * ring at 07:00 on the day the farmer picked.
 */

import notifee, {
  AndroidImportance,
  AndroidStyle,
  AuthorizationStatus,
  EventType,
  TriggerType,
} from '@notifee/react-native';
import type {Event, Notification} from '@notifee/react-native';

import type {NoticeChannel, NoticeLike} from '../domain/notifications';
import {channelFor, ringAt} from '../domain/notifications';
import {colors} from '../theme';

export type ChannelId = NoticeChannel | 'sync' | 'reminders';

const CHANNELS: {id: ChannelId; name: string; description: string; importance: AndroidImportance}[] = [
  {id: 'alerts', name: 'Cảnh báo thời tiết', description: 'Mưa to, rét hại theo dự báo, tin khẩn của ban quản lý', importance: AndroidImportance.HIGH},
  {id: 'news', name: 'Tin từ ban quản lý', description: 'Thông báo chung, giá phân bón mới', importance: AndroidImportance.DEFAULT},
  {id: 'reminders', name: 'Nhắc việc', description: 'Việc chăm sóc bạn đã đặt nhắc', importance: AndroidImportance.DEFAULT},
  {id: 'sync', name: 'Đồng bộ dữ liệu', description: 'Báo khi dữ liệu ghi lúc mất mạng đã lên máy chủ', importance: AndroidImportance.LOW},
];

const SMALL_ICON = 'ic_stat_agrilog';
const REMINDER_PREFIX = 'remind-';

let channelsReady: Promise<void> | null = null;

export function ensureChannels(): Promise<void> {
  if (!channelsReady) {
    channelsReady = Promise.all(CHANNELS.map(c => notifee.createChannel({...c, vibration: c.importance !== AndroidImportance.LOW})))
      .then(() => undefined)
      .catch(error => {
        channelsReady = null;
        console.warn('[notify] channels failed', error);
      });
  }
  return channelsReady;
}

/** Android 13+ shows the system prompt once; later calls just report the answer. */
export async function askPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch (error) {
    console.warn('[notify] permission failed', error);
    return false;
  }
}

function base(channelId: ChannelId, text: string): Notification['android'] {
  return {
    channelId,
    smallIcon: SMALL_ICON,
    color: colors.primary.default,
    // Tapping opens the app; the press handler then routes by `data`.
    pressAction: {id: 'default'},
    style: {type: AndroidStyle.BIGTEXT, text},
  };
}

/** A message from the admin or the server, raised as it arrives. */
export async function showNotice(n: Pick<NoticeLike, 'id' | 'kind' | 'level' | 'title' | 'body' | 'link'>): Promise<void> {
  await ensureChannels();
  const data = {type: 'notice', id: n.id, kind: n.kind, link: n.link ?? ''};
  await notifee.displayNotification({
    id: `notice-${n.id}`,
    title: n.title,
    body: n.body,
    data,
    android: base(channelFor(n), n.body),
  });
}

/** "Đã gửi 5 thay đổi…" when offline work reaches the server while the app is in the background. */
export async function showSynced(text: string): Promise<void> {
  await ensureChannels();
  const data = {type: 'sync'};
  await notifee.displayNotification({
    id: 'sync-done',
    title: 'Đã đồng bộ dữ liệu',
    body: text,
    data,
    android: {...base('sync', text), onlyAlertOnce: true},
  });
}

export interface ReminderLike {
  id: string;
  taskTitle: string;
  remindAt: number | null;
  done: boolean;
  plotId: string | null;
  protocolId: string;
}

/**
 * Makes the scheduled reminders match the farmer's: each open task with a
 * reminder rings at 07:00 on its day; ticked or cleared ones are cancelled.
 * Runs whenever the reminder list changes, including rows another phone of
 * the same account set (they arrive with the sync).
 */
export async function scheduleReminders(rows: readonly ReminderLike[], now: number = Date.now()): Promise<number> {
  await ensureChannels();
  const wanted = new Map<string, {row: ReminderLike; at: number}>();
  for (const row of rows) {
    if (row.done || row.remindAt == null) continue;
    const at = ringAt(row.remindAt, now);
    if (at != null) wanted.set(`${REMINDER_PREFIX}${row.id}`, {row, at});
  }

  const existing = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(REMINDER_PREFIX));
  await Promise.all(existing.filter(id => !wanted.has(id)).map(id => notifee.cancelTriggerNotification(id)));

  for (const [id, {row, at}] of wanted) {
    const data = {type: 'reminder', protocolId: row.protocolId, plotId: row.plotId ?? ''};
    // Same id replaces the earlier trigger, so changing the date just moves it.
    await notifee.createTriggerNotification(
      {
        id,
        title: 'Nhắc việc hôm nay',
        body: row.taskTitle,
        data,
        android: base('reminders', row.taskTitle),
      },
      {type: TriggerType.TIMESTAMP, timestamp: at},
    );
  }
  return wanted.size;
}

export type OpenedNotification = Record<string, string>;

function dataOf(event: Event): OpenedNotification | null {
  if (event.type !== EventType.PRESS) return null;
  return (event.detail.notification?.data as OpenedNotification | undefined) ?? null;
}

/** Taps on a notification while the app is open. */
export function onOpened(handler: (data: OpenedNotification) => void): () => void {
  return notifee.onForegroundEvent(event => {
    const data = dataOf(event);
    if (data) handler(data);
  });
}

/** The notification that launched the app, if one did. */
export async function openedAtLaunch(): Promise<OpenedNotification | null> {
  try {
    const initial = await notifee.getInitialNotification();
    return (initial?.notification.data as OpenedNotification | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Clears the shade entry for a message the farmer has now read in the app. */
export function dismissNotice(id: string): Promise<void> {
  return notifee.cancelDisplayedNotification(`notice-${id}`).catch(() => undefined);
}
