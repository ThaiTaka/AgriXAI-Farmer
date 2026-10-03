/**
 * V2.2 — notification rules: unread after an edit, the bell's number, the
 * inbox grouping, which arrivals ring the phone, where a tap leads, and the
 * 07:00 reminder time.
 */

import type {NoticeLike} from '../src/domain/notifications';
import {
  channelFor,
  FRESH_FOR_MS,
  inboxSections,
  isExpired,
  isUnread,
  lastReads,
  ringAt,
  shouldRing,
  targetOf,
  timeAgo,
  unreadCount,
} from '../src/domain/notifications';

const NOW = new Date(2026, 9, 3, 10, 0).getTime();
const HOUR = 3_600_000;

function notice(id: string, fields: Partial<NoticeLike> = {}): NoticeLike {
  return {
    id,
    kind: 'announcement',
    level: 'info',
    title: `Tin ${id}`,
    body: '',
    link: null,
    createdAt: NOW - HOUR,
    updatedAt: NOW - HOUR,
    expiresAt: null,
    ...fields,
  };
}

describe('read state', () => {
  test('the latest mark wins when a notice was read twice', () => {
    const reads = lastReads([
      {notificationId: 'a', readAt: 10},
      {notificationId: 'a', readAt: 30},
      {notificationId: 'a', readAt: 20},
    ]);
    expect(reads.get('a')).toBe(30);
  });

  test('a notice edited after it was read is unread again', () => {
    const n = notice('a', {updatedAt: 100});
    expect(isUnread(n, lastReads([]))).toBe(true);
    expect(isUnread(n, lastReads([{notificationId: 'a', readAt: 100}]))).toBe(false);
    expect(isUnread({...n, updatedAt: 150}, lastReads([{notificationId: 'a', readAt: 100}]))).toBe(true);
  });

  test('the bell counts unread notices that are still current', () => {
    const notices = [
      notice('a'),
      notice('b'),
      notice('c', {expiresAt: NOW - 1}), // yesterday's rain warning
    ];
    const reads = lastReads([{notificationId: 'b', readAt: NOW}]);
    expect(unreadCount(notices, reads, NOW)).toBe(1);
    expect(isExpired(notices[2], NOW)).toBe(true);
  });
});

test('the inbox lists unread, then read, then past — newest first in each', () => {
  const notices = [
    notice('old-read', {createdAt: NOW - 5 * HOUR}),
    notice('new', {createdAt: NOW - HOUR}),
    notice('newer', {createdAt: NOW - HOUR / 2}),
    notice('expired', {expiresAt: NOW - 1}),
  ];
  const reads = lastReads([{notificationId: 'old-read', readAt: NOW}]);
  const sections = inboxSections(notices, reads, NOW);
  expect(sections.map(s => [s.title, s.data.map(n => n.id)])).toEqual([
    ['Chưa xem', ['newer', 'new']],
    ['Đã xem', ['old-read']],
    ['Đã qua', ['expired']],
  ]);
  expect(inboxSections([], reads, NOW)).toEqual([]);
});

test.each([
  [NOW - 20_000, 'vừa xong'],
  [NOW - 5 * 60_000, '5 phút trước'],
  [NOW - 3 * HOUR, '3 giờ trước'],
  [NOW - 30 * HOUR, 'hôm qua'],
  [NOW - 4 * 24 * HOUR, '4 ngày trước'],
  [new Date(2026, 8, 14, 9, 0).getTime(), '14/09/2026'],
])('timeAgo(%p) = %p', (at, label) => {
  expect(timeAgo(at, NOW)).toBe(label);
});

describe('which arrivals ring the phone', () => {
  test('a fresh notice rings', () => {
    expect(shouldRing(notice('a'), {firstSync: false, now: NOW})).toBe(true);
  });
  test('nothing rings on the first sync — the inbox has the history', () => {
    expect(shouldRing(notice('a'), {firstSync: true, now: NOW})).toBe(false);
  });
  test('an expired warning or a message older than three days stays silent', () => {
    expect(shouldRing(notice('a', {expiresAt: NOW - 1}), {firstSync: false, now: NOW})).toBe(false);
    expect(shouldRing(notice('a', {createdAt: NOW - FRESH_FOR_MS - 1}), {firstSync: false, now: NOW})).toBe(false);
  });
  test('warnings ring loud, everything else quietly', () => {
    expect(channelFor({level: 'danger'})).toBe('alerts');
    expect(channelFor({level: 'warning'})).toBe('alerts');
    expect(channelFor({level: 'info'})).toBe('news');
  });
});

test.each([
  ['weather', {screen: 'Weather'}],
  ['prices', {screen: 'Prices'}],
  ['prices:ure_ca_mau', {screen: 'Prices', productId: 'ure_ca_mau'}],
  ['care_guide:g1', {screen: 'CareGuide', guideId: 'g1'}],
  ['somewhere-else', null],
  [null, null],
])('a tap on link %p leads to %p', (link, target) => {
  expect(targetOf(link)).toEqual(target);
});

describe('reminder time', () => {
  const day = (d: number, h = 0, m = 0) => new Date(2026, 9, d, h, m).getTime();

  test('rings at 07:00 on the chosen day', () => {
    expect(ringAt(day(5, 15, 42), day(3, 10))).toBe(day(5, 7));
  });
  test('set for today after 07:00: rings in a minute', () => {
    expect(ringAt(day(3, 15), day(3, 10))).toBe(day(3, 10) + 60_000);
  });
  test('a day already over is not rung late', () => {
    expect(ringAt(day(2, 9), day(3, 10))).toBeNull();
  });
});
