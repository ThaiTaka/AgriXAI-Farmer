/**
 * Two accounts on one phone. The local database holds one farm and one
 * `lastPulledAt`, so switching accounts must either start the database over or,
 * when the previous account still has unsent changes, refuse — never sync one
 * farm's rows under another farm's token.
 */

type Row = {owner_id?: string; _status: string};

const mockState: {
  storage: Record<string, unknown>;
  tables: Record<string, Row[]>;
  deleted: Record<string, string[]>;
  resets: number;
} = {storage: {}, tables: {}, deleted: {}, resets: 0};

jest.mock('../src/db', () => {
  const hasStatusClause = (clauses: unknown[]) =>
    clauses.some(c => (c as {left?: string}).left === '_status');
  return {
    database: {
      localStorage: {
        get: async (key: string) => mockState.storage[key],
        set: async (key: string, value: unknown) => {
          mockState.storage[key] = value;
        },
      },
      get: (table: string) => ({
        query: (...clauses: unknown[]) => {
          const rows = mockState.tables[table] ?? [];
          const matching = hasStatusClause(clauses) ? rows.filter(r => r._status !== 'synced') : rows;
          return {
            fetch: async () => matching.slice(0, 1).map(r => ({_raw: r})),
            fetchCount: async () => matching.length,
          };
        },
      }),
      adapter: {getDeletedRecords: async (table: string) => mockState.deleted[table] ?? []},
      write: async (work: () => Promise<void>) => work(),
      unsafeResetDatabase: async () => {
        mockState.resets += 1;
        mockState.tables = {};
        mockState.deleted = {};
      },
    },
  };
});

import {DeviceInUseError, decideDevice, prepareDeviceFor} from '../src/auth/deviceOwner';

const A = {id: 'user-a', username: 'nguyenvananh'};
const B = {id: 'user-b', username: 'nguyenvanhai'};

beforeEach(() => {
  mockState.storage = {};
  mockState.tables = {};
  mockState.deleted = {};
  mockState.resets = 0;
});

describe('decideDevice', () => {
  it('claims an untagged database, keeps the same account', () => {
    expect(decideDevice(null, 'a', 3)).toBe('claim');
    expect(decideDevice({id: 'a', username: 'a'}, 'a', 3)).toBe('keep');
  });

  it('resets for another account only when nothing is unsent', () => {
    expect(decideDevice({id: 'a', username: 'a'}, 'b', 0)).toBe('reset');
    expect(decideDevice({id: 'a', username: 'a'}, 'b', 1)).toBe('blocked');
  });
});

describe('prepareDeviceFor', () => {
  it('signing in again as the same account keeps the local data', async () => {
    await prepareDeviceFor(A);
    mockState.tables.plots = [{owner_id: A.id, _status: 'created'}];
    await prepareDeviceFor(A);
    expect(mockState.resets).toBe(0);
    expect(mockState.tables.plots).toHaveLength(1);
  });

  it('another account starts from an empty database once everything is sent', async () => {
    await prepareDeviceFor(A);
    mockState.tables.plots = [{owner_id: A.id, _status: 'synced'}];
    await prepareDeviceFor(B);
    expect(mockState.resets).toBe(1);
    expect(mockState.storage.agrilog_device_owner).toEqual({id: B.id, username: B.username});
  });

  it('refuses another account while the previous one has unsent rows', async () => {
    await prepareDeviceFor(A);
    mockState.tables.expense = [{owner_id: A.id, _status: 'created'}];
    mockState.tables.income = [{owner_id: A.id, _status: 'updated'}];

    const attempt = prepareDeviceFor(B);
    await expect(attempt).rejects.toBeInstanceOf(DeviceInUseError);
    await expect(prepareDeviceFor(B)).rejects.toThrow('còn 2 thay đổi chưa gửi');
    await expect(prepareDeviceFor(B)).rejects.toThrow('"nguyenvananh"');
    expect(mockState.resets).toBe(0);
    // Still A's phone: A can sign back in and send the rows.
    expect(mockState.storage.agrilog_device_owner).toEqual({id: A.id, username: A.username});
  });

  it('counts deletions that have not reached the server', async () => {
    await prepareDeviceFor(A);
    mockState.deleted.warehouse_in = ['w1'];
    await expect(prepareDeviceFor(B)).rejects.toThrow('còn 1 thay đổi');
  });

  it('recognises the owner of a database written before owners were recorded', async () => {
    mockState.tables.plots = [{owner_id: A.id, _status: 'created'}];
    await expect(prepareDeviceFor(B)).rejects.toThrow('tài khoản trước');

    mockState.tables.plots = [{owner_id: A.id, _status: 'synced'}];
    await prepareDeviceFor(B);
    expect(mockState.resets).toBe(1);
  });
});

describe('signOutMessage', () => {
  const {signOutMessage} = require('../src/domain/syncStatus');
  const info = (pending: number) => ({table: 'income', label: 'Thu', pending, oldestPendingAt: null});

  it('is the plain question when everything is sent', () => {
    expect(signOutMessage([info(0), info(0)])).toBe('Bạn có chắc muốn đăng xuất khỏi ứng dụng?');
  });

  it('says how many changes would wait on the phone', () => {
    expect(signOutMessage([info(2), info(1)])).toContain('Còn 3 thay đổi chưa gửi');
  });
});
