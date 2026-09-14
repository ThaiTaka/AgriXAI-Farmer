/**
 * Kho — nhập / xuất / tồn, FIFO, kiểm kho (F4). Same mock farm and same
 * expected figures as backend/tests/test_ledger_service.py.
 */

import {
  checkStock,
  fifoCost,
  inPeriod,
  periodLabel,
  stockCsv,
  stockSummary,
  stockTimeline,
  toKg,
  type InRow,
  type OutRow,
} from '../src/domain/warehouse';
import {formatVnd} from '../src/utils/format';

const day = (iso: string) => new Date(`${iso}T08:00:00+07:00`).getTime();

const INS: InRow[] = [
  {fertilizerId: 'ure_ca_mau', fertilizerName: 'Urê Cà Mau', category: 'dam', quantityKg: 50, unitPrice: 13_600, occurredAt: day('2026-09-10'), createdAt: 1},
  {fertilizerId: 'ure_ca_mau', fertilizerName: 'Urê Cà Mau', category: 'dam', quantityKg: 50, unitPrice: 14_000, occurredAt: day('2026-09-12'), createdAt: 2},
  {fertilizerId: 'dap_han_quoc', fertilizerName: 'DAP Hàn Quốc (nhập khẩu)', category: 'lan', quantityKg: 50, unitPrice: 22_000, occurredAt: day('2026-09-10'), createdAt: 3},
];

test('tấn → kg', () => {
  expect(toKg(0.05, 'tan')).toBe(50);
  expect(toKg(20, 'kg')).toBe(20);
});

describe('FIFO', () => {
  test('oldest lot first', () => {
    const r = fifoCost(INS, [], 'ure_ca_mau', 30, day('2026-09-15'));
    expect(r).toEqual({unitPrice: 13_600, totalCost: 30 * 13_600, consumedKg: 30, shortfallKg: 0});
  });

  test('weighted across two lots', () => {
    const r = fifoCost(INS, [], 'ure_ca_mau', 60, day('2026-09-15'));
    expect(r.totalCost).toBe(50 * 13_600 + 10 * 14_000);
    expect(r.unitPrice).toBeCloseTo((50 * 13_600 + 10 * 14_000) / 60);
  });

  test('earlier issues are replayed first', () => {
    const outs = [{fertilizerId: 'ure_ca_mau', quantityKg: 40, occurredAt: day('2026-09-13'), createdAt: 1}];
    const r = fifoCost(INS, outs, 'ure_ca_mau', 20, day('2026-09-15'));
    expect(r.unitPrice).toBe(13_800);
  });

  test('purchases dated after the issue do not count', () => {
    const r = fifoCost(INS, [], 'ure_ca_mau', 60, day('2026-09-11'));
    expect(r.consumedKg).toBe(50);
    expect(r.shortfallKg).toBe(10);
  });

  test('unknown fertiliser is a full shortfall at price 0', () => {
    const r = fifoCost(INS, [], 'kali_bot_ca_mau', 5, day('2026-09-15'));
    expect(r).toEqual({unitPrice: 0, totalCost: 0, consumedKg: 0, shortfallKg: 5});
  });
});

describe('stock summary', () => {
  const OUTS: OutRow[] = [
    {fertilizerId: 'ure_ca_mau', fertilizerName: 'Urê Cà Mau', category: 'dam', quantityKg: 30, unitPrice: 13_600, totalCost: 30 * 13_600, occurredAt: day('2026-09-13')},
  ];

  test('tồn = nhập − xuất; giá TB = Σ(kg×giá)/Σkg; tổng tiền = tồn × giá TB', () => {
    const lines = Object.fromEntries(stockSummary(INS, OUTS).map(l => [l.fertilizerId, l]));
    expect(lines.ure_ca_mau.inKg).toBe(100);
    expect(lines.ure_ca_mau.outKg).toBe(30);
    expect(lines.ure_ca_mau.stockKg).toBe(70);
    expect(lines.ure_ca_mau.avgPrice).toBe(13_800);
    expect(lines.ure_ca_mau.stockValue).toBe(70 * 13_800);
    expect(lines.ure_ca_mau.latestUnitPrice).toBe(14_000);
    expect(lines.dap_han_quoc.stockKg).toBe(50);
    expect(lines.dap_han_quoc.stockValue).toBe(1_100_000);
  });

  test('is sorted by name (vi)', () => {
    expect(stockSummary(INS, OUTS).map(l => l.fertilizerName)).toEqual(['DAP Hàn Quốc (nhập khẩu)', 'Urê Cà Mau']);
  });

  test('F4 check: đủ / thiếu', () => {
    expect(checkStock(INS, OUTS, 'ure_ca_mau', 30)).toEqual({stockKg: 70, neededKg: 30, remainingKg: 40, shortfallKg: 0, enough: true});
    expect(checkStock(INS, OUTS, 'ure_ca_mau', 100)).toEqual({stockKg: 70, neededKg: 100, remainingKg: 0, shortfallKg: 30, enough: false});
    expect(checkStock(INS, OUTS, 'kali_bot_ca_mau', 10).enough).toBe(false);
  });

  test('timeline: one point per day, running level', () => {
    const points = stockTimeline(INS, OUTS, 'ure_ca_mau');
    expect(points.map(p => p.stockKg)).toEqual([50, 100, 70]);
    expect(points[0].day).toBeLessThan(points[1].day);
    const all = stockTimeline(INS, OUTS);
    expect(all.map(p => p.stockKg)).toEqual([100, 150, 120]);
  });

  test('CSV has header, one line per fertiliser and a totals row', () => {
    const lines = stockCsv(stockSummary(INS, OUTS), formatVnd).trimEnd().split('\n');
    expect(lines[0]).toBe('Phân bón,Nhập (kg),Xuất (kg),Tồn (kg),Giá trung bình (đ/kg),Tổng tiền tồn');
    expect(lines[1]).toBe('DAP Hàn Quốc (nhập khẩu),50,0,50,22.000₫,1.100.000₫');
    expect(lines[2]).toBe('Urê Cà Mau,100,30,70,13.800₫,966.000₫');
    expect(lines[3]).toBe('Tổng,,,120,,2.066.000₫');
  });
});

describe('period filter', () => {
  test('month and quarter bounds, local time', () => {
    expect(inPeriod(day('2026-09-01'), {kind: 'month', year: 2026, month: 9})).toBe(true);
    expect(inPeriod(day('2026-08-31'), {kind: 'month', year: 2026, month: 9})).toBe(false);
    expect(inPeriod(day('2026-10-01'), {kind: 'month', year: 2026, month: 9})).toBe(false);
    expect(inPeriod(day('2026-07-01'), {kind: 'quarter', year: 2026, quarter: 3})).toBe(true);
    expect(inPeriod(day('2026-10-01'), {kind: 'quarter', year: 2026, quarter: 3})).toBe(false);
    expect(inPeriod(0, {kind: 'all'})).toBe(true);
    expect(periodLabel({kind: 'month', year: 2026, month: 9})).toBe('Tháng 9, Năm 2026');
    expect(periodLabel({kind: 'quarter', year: 2026, quarter: 3})).toBe('Quý 3, Năm 2026');
  });
});
