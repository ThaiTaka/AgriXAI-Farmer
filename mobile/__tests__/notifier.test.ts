/**
 * V2.2 — system notifications through Notifee (jest stand-in in
 * __mocks__/@notifee/react-native.js): reminders scheduled at 07:00 and kept
 * in step, new messages raised once, a quiet note when offline work reaches
 * the server in the background.
 */

import notifee from '@notifee/react-native';
import {AppState} from 'react-native';

jest.mock('../src/live/prices', () => ({refreshPrices: jest.fn(async () => true)}));
jest.mock('../src/live/weather', () => ({refreshForecast: jest.fn(async () => true)}));

import {afterSync} from '../src/notify/afterSync';
import {scheduleReminders, showNotice} from '../src/notify/notifier';
import {refreshPrices} from '../src/live/prices';
import {refreshForecast} from '../src/live/weather';

const mock = notifee as unknown as {
  __triggers: Map<string, {notification: {title: string; body: string; android: {channelId: string}}; trigger: {timestamp: number}}>;
  __displayed: {id: string; title: string; android: {channelId: string}}[];
  __reset: () => void;
};

const day = (d: number, h = 0) => new Date(2026, 9, d, h).getTime();
const NOW = day(3, 10);

beforeEach(() => {
  mock.__reset();
  jest.clearAllMocks();
});

const reminder = (id: string, remindAt: number | null, done = false) => ({
  id,
  taskTitle: `Việc ${id}`,
  remindAt,
  done,
  plotId: 'plot-1',
  protocolId: 'chrysanthemum_lam_dong',
});

test('each open reminder rings at 07:00 on its day; done or past ones do not', async () => {
  const count = await scheduleReminders([reminder('a', day(5, 16)), reminder('b', day(6), true), reminder('c', day(1))], NOW);
  expect(count).toBe(1);
  expect([...mock.__triggers.keys()]).toEqual(['remind-a']);
  const a = mock.__triggers.get('remind-a')!;
  expect(a.trigger.timestamp).toBe(day(5, 7));
  expect(a.notification.body).toBe('Việc a');
  expect(a.notification.android.channelId).toBe('reminders');
});

test('a reminder cleared on this or another phone is cancelled; a moved one is rescheduled', async () => {
  await scheduleReminders([reminder('a', day(5)), reminder('b', day(6))], NOW);
  await scheduleReminders([reminder('b', day(8))], NOW);
  expect([...mock.__triggers.keys()]).toEqual(['remind-b']);
  expect(mock.__triggers.get('remind-b')!.trigger.timestamp).toBe(day(8, 7));
});

test('a warning rings on the loud channel, news on the quiet one', async () => {
  await showNotice({id: 'w', kind: 'weather', level: 'warning', title: 'Dự báo mưa to ngày 04/10', body: '…', link: 'weather'});
  await showNotice({id: 'p', kind: 'price', level: 'info', title: 'Giá Urê Cà Mau mới cập nhật', body: '…', link: 'prices'});
  expect(mock.__displayed.map(n => [n.id, n.android.channelId])).toEqual([
    ['notice-w', 'alerts'],
    ['notice-p', 'news'],
  ]);
});

describe('after a sync', () => {
  const row = (id: string, fields: Record<string, unknown> = {}) => ({
    id,
    kind: 'announcement',
    level: 'info',
    title: `Tin ${id}`,
    body: '',
    link: null,
    created_at: Date.now() - 60_000,
    updated_at: Date.now() - 60_000,
    expires_at: null,
    ...fields,
  });

  test('new messages ring once; old or expired ones stay in the inbox only', async () => {
    await afterSync(
      {
        ok: true,
        summary: {
          sent: 0,
          received: 3,
          firstSync: false,
          newNotifications: [row('fresh'), row('expired', {expires_at: Date.now() - 1}), row('old', {created_at: Date.now() - 10 * 86_400_000})],
        },
      },
      'token',
    );
    expect(mock.__displayed.map(n => n.id)).toEqual(['notice-fresh']);
  });

  test('the first sync rings nothing', async () => {
    await afterSync({ok: true, summary: {sent: 0, received: 50, firstSync: true, newNotifications: [row('a'), row('b')]}}, 'token');
    expect(mock.__displayed).toHaveLength(0);
  });

  test('offline work sent while the app is in the background gets a quiet note', async () => {
    const original = AppState.currentState;
    Object.defineProperty(AppState, 'currentState', {value: 'background', configurable: true});
    try {
      await afterSync({ok: true, summary: {sent: 4, received: 0, firstSync: false, newNotifications: []}}, 'token');
    } finally {
      Object.defineProperty(AppState, 'currentState', {value: original, configurable: true});
    }
    expect(mock.__displayed.map(n => [n.title, n.android.channelId])).toEqual([['Đã đồng bộ dữ liệu', 'sync']]);
  });

  test('a price or weather message refreshes that data at once', async () => {
    await afterSync({ok: true, summary: {sent: 0, received: 1, firstSync: false, newNotifications: [row('p', {kind: 'price'})]}}, 'token');
    expect(refreshPrices).toHaveBeenCalledWith('token', {force: true});
    expect(refreshForecast).toHaveBeenCalledWith('token', {force: false});
  });
});

test('a message the admin took back leaves the shade too', async () => {
  const cancel = (notifee as unknown as {cancelDisplayedNotification: jest.Mock}).cancelDisplayedNotification;
  await afterSync(
    {ok: true, summary: {sent: 0, received: 0, firstSync: false, newNotifications: [], retractedNotifications: ['n9']}},
    'token',
  );
  expect(cancel).toHaveBeenCalledWith('notice-n9');
});
