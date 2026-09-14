/** ScreenErrorBoundary with the database and the log API mocked out. */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// `mock`-prefixed names are the ones jest lets a hoisted factory close over.
const mockPostLogs = jest.fn(async (): Promise<string[]> => ['log-1']);
const mockMarkReported = jest.fn(async () => {});
const mockMarkUploaded = jest.fn(async () => {});
const mockRecordError = jest.fn(async () => ({id: 'log-1'}));

jest.mock('../src/db', () => ({database: {}, collections: {}}));
jest.mock('../src/db/repositories/errorLogRepository', () => ({
  recordError: (...args: unknown[]) => mockRecordError(...(args as [])),
  markReported: () => mockMarkReported(),
  markUploaded: () => mockMarkUploaded(),
}));
jest.mock('../src/api/logs', () => ({postLogs: (...args: unknown[]) => mockPostLogs(...(args as []))}));

import {ScreenErrorBoundary} from '../src/components/ScreenErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('Thiếu hệ số quy đổi cho N');
  return React.createElement('Text', null, 'ok');
}

beforeEach(() => {
  shouldThrow = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('a throwing screen shows the Oops card with the message; "Thử lại" remounts it', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ScreenErrorBoundary route="FertilizerCalculator" userId="u1" token={null}>
        <Bomb />
      </ScreenErrorBoundary>,
    );
  });
  let json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Oops, điều gì đó sai rồi');
  expect(json).toContain('Thiếu hệ số quy đổi cho N');
  expect(json).toContain('FertilizerCalculator');
  expect(mockRecordError).toHaveBeenCalledWith(
    expect.objectContaining({action: 'FertilizerCalculator', message: 'Thiếu hệ số quy đổi cho N'}),
    'u1',
  );

  shouldThrow = false;
  const retry = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'boundary-retry')[0];
  await ReactTestRenderer.act(async () => {
    retry.props.onClick?.();
    retry.props.onPress?.();
  });
  json = JSON.stringify(tree.toJSON());
  expect(json).not.toContain('Oops');
  expect(json).toContain('ok');
});

test('"Báo lỗi" posts the queued record and reports it as sent', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ScreenErrorBoundary route="Warehouse" userId="u1" token="t">
        <Bomb />
      </ScreenErrorBoundary>,
    );
  });
  const report = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'boundary-report')[0];
  await ReactTestRenderer.act(async () => {
    report.props.onClick?.();
    await report.props.onPress?.();
  });
  expect(mockMarkReported).toHaveBeenCalled();
  expect(mockPostLogs).toHaveBeenCalledWith('t', [expect.objectContaining({id: 'log-1'})]);
  expect(mockMarkUploaded).toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Đã gửi báo lỗi');
});

test('offline "Báo lỗi" keeps the record queued', async () => {
  mockPostLogs.mockRejectedValueOnce(new Error('Network request failed'));
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ScreenErrorBoundary route="Finance" userId="u1" token="t">
        <Bomb />
      </ScreenErrorBoundary>,
    );
  });
  const report = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'boundary-report')[0];
  await ReactTestRenderer.act(async () => {
    report.props.onClick?.();
    await report.props.onPress?.();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Đã lưu, sẽ gửi khi có mạng');
});
