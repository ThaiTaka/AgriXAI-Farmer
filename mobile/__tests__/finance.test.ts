/** Thu – Chi: totals, profit/loss, grouping and the CSV layout. */

import {
  expenseKindLabel,
  financialCsv,
  financialReport,
  incomeKindLabel,
  type LedgerEntry,
} from '../src/domain/finance';
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

// --- Phase 2: các nhánh của sổ thu-chi mà bộ test cũ chưa chạm tới ----------

test('nhãn loại thu và loại chi dịch đúng, mã lạ thì trả lại chính nó', () => {
  expect(incomeKindLabel('product')).toBe('Sản phẩm');
  expect(incomeKindLabel('service')).toBe('Dịch vụ');
  expect(expenseKindLabel('fertilizer')).toBe('Phân bón');
  expect(expenseKindLabel('labor')).toBe('Công nhân');
  // Một mã chưa biết không được làm vỡ màn hình — hiện nguyên mã là đủ.
  expect(expenseKindLabel('khong-ro')).toBe('khong-ro');
});

test('chi gộp theo loại và xếp loại tốn nhiều nhất lên đầu', () => {
  const report = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 9});
  expect(report.expenseByKind[0]).toEqual({kind: 'fertilizer', amount: 1_780_000});
  expect(report.expenseByKind.map(k => k.kind)).toEqual(['fertilizer', 'labor', 'utilities']);
});

test('nhiều khoản trong cùng một ngày gộp về một điểm của biểu đồ', () => {
  const report = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 9});
  // 10/09 có ba khoản chi: 120k + 680k + 1.100k.
  const tenth = report.daily.find(p => p.expense === 1_900_000);
  expect(tenth).toBeDefined();
  expect(tenth?.income).toBe(0);
  // Mỗi ngày đúng một điểm, và các điểm tăng dần theo thời gian.
  expect(report.daily.map(p => p.day)).toEqual([...report.daily.map(p => p.day)].sort((a, b) => a - b));
});

test('tháng không có khoản nào: mọi số về 0, không phải NaN', () => {
  const report = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 12});
  expect(report.totalIncome).toBe(0);
  expect(report.totalExpense).toBe(0);
  expect(report.profit).toBe(0);
  expect(report.daily).toEqual([]);
  expect(report.incomeByKind).toEqual([]);
});

test('lãi khi thu vượt chi', () => {
  const income: LedgerEntry[] = [
    {kind: 'product', description: 'Bán ớt', amount: 5_400_000, occurredAt: day('2026-09-02')},
  ];
  const report = financialReport(income, EXPENSES, {kind: 'month', year: 2026, month: 9});
  expect(report.profit).toBe(5_400_000 - 2_200_000);
  expect(report.profit).toBeGreaterThan(0);
});

test('khoản đã kiểm và chưa kiểm đều vào báo cáo — "đã kiểm" không phải bộ lọc', () => {
  const report = financialReport(INCOMES, EXPENSES, {kind: 'month', year: 2026, month: 9});
  expect(report.incomes.every(r => r.checked)).toBe(true);
  expect(report.expenses.some(r => !r.checked)).toBe(true);
  expect(report.totalExpense).toBe(2_200_000);
});

test('các khoản trong kỳ được xếp theo ngày dù đưa vào lộn xộn', () => {
  const shuffled = [...EXPENSES].reverse();
  const report = financialReport([], shuffled, {kind: 'month', year: 2026, month: 9});
  const days = report.expenses.map(r => r.occurredAt);
  expect(days).toEqual([...days].sort((a, b) => a - b));
});
