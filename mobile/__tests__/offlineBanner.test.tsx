/** OfflineBanner against a scripted sync state. */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const scripted = {state: 'offline' as string, lastSyncedAt: null as number | null};
jest.mock('../src/sync/SyncContext', () => ({
  useSync: () => ({state: scripted.state, lastSyncedAt: scripted.lastSyncedAt}),
}));

import {OfflineBanner} from '../src/components/OfflineBanner';

beforeEach(() => {
  jest.useFakeTimers();
  scripted.state = 'offline';
  scripted.lastSyncedAt = null;
});
afterEach(() => jest.useRealTimers());

test('offline: amber line with the brief wording, auto-hides after 8 s', () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<OfflineBanner />);
  });
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Chế độ offline — thay đổi sẽ lưu khi online');
  expect(json).toContain('#F59E0B');
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(8_100);
  });
  expect(tree.toJSON()).toBeNull();
});

test('syncing then synced with the last sync time; dismiss button hides it', () => {
  scripted.state = 'syncing';
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<OfflineBanner />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Đang đồng bộ');

  scripted.state = 'idle';
  scripted.lastSyncedAt = new Date(2026, 8, 14, 14, 35).getTime();
  ReactTestRenderer.act(() => {
    tree.update(<OfflineBanner />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Cập nhật lúc 14:35');
  const close = tree.root.findAll(n => typeof n.type === 'string' && n.props.accessibilityLabel === 'Ẩn thông báo')[0];
  ReactTestRenderer.act(() => {
    close.props.onClick?.();
    close.props.onPress?.();
  });
  expect(tree.toJSON()).toBeNull();
});

test('first idle before any sync shows nothing', () => {
  scripted.state = 'idle';
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<OfflineBanner />);
  });
  expect(tree.toJSON()).toBeNull();
});
