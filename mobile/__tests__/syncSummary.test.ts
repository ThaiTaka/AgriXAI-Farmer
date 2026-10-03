/**
 * V2.2 — "Thêm thông báo khi dữ liệu được đồng bộ": what a sync pass moved,
 * counted so the numbers mean what the farmer thinks they mean.
 */

import {bannerFor, SYNCED_DETAIL_HIDE_MS} from '../src/domain/syncStatus';
import type {SyncSummary} from '../src/domain/syncSummary';
import {countReceived, countSent, pulledNotifications, retractedNotifications, summaryLine} from '../src/domain/syncSummary';

const row = (id: string, author: string | null) => ({id, updated_by: author});

describe('sent', () => {
  test('counts the farmer’s rows, not the audit trail or read marks', () => {
    const changes = {
      income: {created: [row('i1', 'me')], updated: [row('i2', 'me')], deleted: []},
      expense: {created: [], updated: [], deleted: ['e1']},
      change_logs: {created: [row('l1', 'me'), row('l2', 'me')], updated: [], deleted: []},
      notification_reads: {created: [row('r1', 'me')], updated: [], deleted: []},
    };
    expect(countSent(changes)).toBe(3);
  });

  test('rows the server refused or kept its own copy of are not counted', () => {
    const changes = {plots: {created: [row('p1', 'me')], updated: [row('p2', 'me'), row('p3', 'me')], deleted: []}};
    expect(countSent(changes, [{table: 'plots'}])).toBe(2);
    expect(countSent(changes, [{table: 'plots'}, {table: 'plots'}, {table: 'plots'}, {table: 'plots'}])).toBe(0);
    // A refused read mark does not take away a real row.
    expect(countSent(changes, [{table: 'notification_reads'}])).toBe(3);
  });
});

describe('received', () => {
  test('counts what someone else wrote, not the echo of the farmer’s own edit', () => {
    const changes = {
      plots: {created: [row('p1', 'admin')], updated: [row('p2', 'me')], deleted: ['p3']},
      care_guides: {created: [{id: 'g1', updated_by: null, created_by: 'admin'}], updated: [], deleted: []},
      notifications: {created: [{id: 'n1', created_by: null}], updated: [], deleted: []},
      change_logs: {created: [row('l1', 'admin')], updated: [], deleted: []},
    };
    expect(countReceived(changes, 'me')).toBe(3);
    expect(pulledNotifications(changes).map(n => n.id)).toEqual(['n1']);
  });
});

describe('the banner sentence', () => {
  const summary = (fields: Partial<SyncSummary>): SyncSummary => ({sent: 0, received: 0, newNotifications: [], firstSync: false, ...fields});

  test.each([
    [{sent: 3}, 'Đã gửi 3 thay đổi lên máy chủ — dữ liệu đã an toàn'],
    [{received: 2}, 'Đã nhận 2 cập nhật từ máy chủ'],
    [{sent: 1, received: 4}, 'Đã gửi 1 thay đổi lên máy chủ, nhận 4 cập nhật'],
    [{firstSync: true, received: 120}, 'Đã tải dữ liệu của bạn về máy'],
    [{}, null],
  ])('%p -> %p', (fields, line) => {
    expect(summaryLine(summary(fields))).toBe(line);
  });

  test('a pass that moved something says so, with the time', () => {
    const at = new Date(2026, 9, 3, 14, 35).getTime();
    expect(bannerFor('idle', at, 'Đã gửi 3 thay đổi lên máy chủ — dữ liệu đã an toàn')).toEqual({
      kind: 'synced',
      text: 'Đã gửi 3 thay đổi lên máy chủ — dữ liệu đã an toàn · 14:35',
      hideAfterMs: SYNCED_DETAIL_HIDE_MS,
    });
    // Nothing moved: the plain time, as before.
    expect(bannerFor('idle', at, null)?.text).toBe('Cập nhật lúc 14:35');
    expect(summaryLine(null)).toBeNull();
  });
});

test('retracted notifications are listed by id', () => {
  expect(retractedNotifications({notifications: {created: [], updated: [], deleted: ['n1', 'n2']}})).toEqual(['n1', 'n2']);
  expect(retractedNotifications({})).toEqual([]);
});
