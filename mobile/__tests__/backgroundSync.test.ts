/**
 * V2.2 — the background job: one ordinary sync with the stored session,
 * and Android is always told the job is done (or it kills the app's jobs).
 */

import BackgroundFetch from 'react-native-background-fetch';

jest.mock('../src/auth/tokenStore', () => ({loadSession: jest.fn()}));
jest.mock('../src/api/sync', () => ({runSync: jest.fn(async () => ({ok: true}))}));
jest.mock('../src/notify/afterSync', () => ({afterSync: jest.fn(async () => undefined)}));

import {runSync} from '../src/api/sync';
import {loadSession} from '../src/auth/tokenStore';
import {afterSync} from '../src/notify/afterSync';
import {headlessTask, startBackgroundSync} from '../src/notify/background';

const session = {token: 'jwt', user: {id: 'u1', username: 'thaitaka', fullName: '', role: 'farmer', phone: null, region: null}};
const finish = BackgroundFetch.finish as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test('a pass syncs with the stored session, then rings what arrived', async () => {
  (loadSession as jest.Mock).mockResolvedValueOnce(session);
  await headlessTask({taskId: 't1', timeout: false});
  expect(runSync).toHaveBeenCalledWith('jwt', 'u1');
  expect(afterSync).toHaveBeenCalledWith({ok: true}, 'jwt');
  expect(finish).toHaveBeenCalledWith('t1');
});

test('signed out: nothing to sync, the job still finishes', async () => {
  (loadSession as jest.Mock).mockResolvedValueOnce(null);
  await headlessTask({taskId: 't2', timeout: false});
  expect(runSync).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledWith('t2');
});

test('a failing sync still finishes the job', async () => {
  (loadSession as jest.Mock).mockResolvedValueOnce(session);
  (runSync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await headlessTask({taskId: 't3', timeout: false});
  expect(finish).toHaveBeenCalledWith('t3');
  warn.mockRestore();
});

test('out of time: finish at once', async () => {
  await headlessTask({taskId: 't4', timeout: true});
  expect(loadSession).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledWith('t4');
});

test('configured once, every 15 minutes, surviving app close and reboot', async () => {
  await startBackgroundSync();
  await startBackgroundSync();
  expect(BackgroundFetch.configure).toHaveBeenCalledTimes(1);
  expect((BackgroundFetch.configure as jest.Mock).mock.calls[0][0]).toEqual(
    expect.objectContaining({minimumFetchInterval: 15, stopOnTerminate: false, startOnBoot: true, enableHeadless: true}),
  );
});
