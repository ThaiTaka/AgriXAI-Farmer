/** Thu – Chi: totals, profit/loss, grouping and the CSV layout. */

import {financialCsv, financialReport, type LedgerEntry} from '../src/domain/finance';
import {formatDate, formatVnd} from '../src/utils/format';

const day = (iso: string) => new Date(`${iso}T08:00:00+07:00`).getTime();

const INCOMES: LedgerEntry[] = [
  {kind: 'product', description: 'Bán cà chua MV1 50kg', amount: 1_500_000, occurredAt: day('2026-09-01'), note: 'Bán cho cửa hàng Kim Hạnh', checked: true},
];
const EXPENSES: LedgerEntry[] = [
  {kind: 'labor', description: 'Công bón phân (3 công)', amount: 300_000, occurredAt: day('2026-09-05')},
  {kind: 'utilities', description: 'Điện nước', amount: 120_000, occurredAt: day('2026-09-10')},
  {kind: 'fertilizer', description: 'Mua Urê Cà Mau 50 kg', amount: 680_000, occurredAt: day('2026-09-10'), note: 'Mua ở sfarm Hà Nội'},
  {kind: 'fertilizer', description: 'Mua DAP 50 kg', amount: 1_100_000, occurredAt: day('2026-09-10'), note: 'East-West hạt giống'},
  {kind: 'other', description: 'Ngoài kỳ', amount: 999, occurredAt: day('2026-08-30')},
];

test('tháng 9/2026: thu 1,5 triệu, chi 2,2 triệu, lỗ 700 nghìn', () => {
  const report = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 9});
  expect(report.label).toBe('Tháng 9, Năm 2026');
  expect(report.totalIncome).toBe(1_500_000);
  expect(report.totalExpense).toBe(2_200_000);
  expect(report.profit).toBe(-700_000);
  expect(report.expenses).toHaveLength(4);
  expect(report.expenseByKind).toEqual([
    {kind: 'fertilizer', amount: 1_780_000},
    {kind: 'labor', amount: 300_000},
    {kind: 'utilities', amount: 120_000},
  ]);
  expect(report.daily.map(d => [d.income, d.expense])).toEqual([
    [1_500_000, 0],
    [0, 300_000],
    [0, 1_900_000],
  ]);
});

test('quý 3 includes August, month 8 alone has only the stray expense', () => {
  const q3 = financialReport(INCOMES, EXPENSES, {kind: 'quarter', year: 2026, quarter: 3});
  expect(q3.totalExpense).toBe(2_200_999);
  const aug = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 8});
  expect(aug.totalIncome).toBe(0);
  expect(aug.totalExpense).toBe(999);
  expect(aug.profit).toBe(-999);
});

test('CSV: line 1 period, line 2 Thu/Chi/Lãi lỗ, details, totals', () => {
  const report = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 9});
  const lines = financialCsv(report, formatVnd, formatDate).trimEnd().split('\n');
  expect(lines[0]).toBe('"Tháng 9, Năm 2026"');
  expect(lines[1]).toBe('Thu,1.500.000₫,Chi,2.200.000₫,Lãi lỗ,-700.000₫');
  expect(lines[3]).toBe('Loại,Ngày,Nhóm,Mô tả,Số tiền,Ghi chú,Đã kiểm tra');
  expect(lines).toContain('Thu,01/09/2026,Sản phẩm,Bán cà chua MV1 50kg,1.500.000₫,Bán cho cửa hàng Kim Hạnh,x');
  expect(lines).toContain('Chi,05/09/2026,Công nhân,Công bón phân (3 công),300.000₫,,');
  expect(lines[lines.length - 1]).toBe('Tổng,,,,Thu 1.500.000₫,Chi 2.200.000₫,Lãi lỗ -700.000₫');
});
