/**
 * Thu – Chi arithmetic, phone side (twin of the backend's financial_report).
 *
 *     lãi/lỗ = Σ thu − Σ chi   over the chosen month or quarter
 *
 * Dates are grouped in the device's local time (Vietnam has one zone).
 */

import {csvLine, inPeriod, periodLabel, startOfDay, type PeriodFilter} from './warehouse';

export type IncomeKind = 'product' | 'service' | 'other';
export type ExpenseKind = 'seed' | 'fertilizer' | 'labor' | 'utilities' | 'other';

export const INCOME_KINDS: readonly {code: IncomeKind; label: string}[] = [
  {code: 'product', label: 'Sản phẩm'},
  {code: 'service', label: 'Dịch vụ'},
  {code: 'other', label: 'Khác'},
];

export const EXPENSE_KINDS: readonly {code: ExpenseKind; label: string}[] = [
  {code: 'seed', label: 'Giống cây'},
  {code: 'fertilizer', label: 'Phân bón'},
  {code: 'labor', label: 'Công nhân'},
  {code: 'utilities', label: 'Điện nước'},
  {code: 'other', label: 'Khác'},
];

export const incomeKindLabel = (kind: string): string =>
  INCOME_KINDS.find(k => k.code === kind)?.label ?? kind;
export const expenseKindLabel = (kind: string): string =>
  EXPENSE_KINDS.find(k => k.code === kind)?.label ?? kind;

export interface LedgerEntry {
  id?: string;
  kind: string;
  description: string;
  amount: number;
  occurredAt: number;
  note?: string | null;
  checked?: boolean;
}

export interface DailyPoint {
  day: number;
  income: number;
  expense: number;
}

export interface FinancialReport {
  period: PeriodFilter;
  label: string;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  incomeByKind: {kind: string; amount: number}[];
  expenseByKind: {kind: string; amount: number}[];
  daily: DailyPoint[];
  incomes: LedgerEntry[];
  expenses: LedgerEntry[];
}

export function financialReport(
  incomes: readonly LedgerEntry[],
  expenses: readonly LedgerEntry[],
  period: PeriodFilter,
): FinancialReport {
  const inc = incomes.filter(r => inPeriod(r.occurredAt, period)).sort((a, b) => a.occurredAt - b.occurredAt);
  const exp = expenses.filter(r => inPeriod(r.occurredAt, period)).sort((a, b) => a.occurredAt - b.occurredAt);

  const days = new Map<number, DailyPoint>();
  const bump = (at: number, field: 'income' | 'expense', amount: number) => {
    const day = startOfDay(at);
    const point = days.get(day) ?? {day, income: 0, expense: 0};
    point[field] += amount;
    days.set(day, point);
  };
  for (const r of inc) bump(r.occurredAt, 'income', r.amount);
  for (const r of exp) bump(r.occurredAt, 'expense', r.amount);

  const totalIncome = inc.reduce((s, r) => s + r.amount, 0);
  const totalExpense = exp.reduce((s, r) => s + r.amount, 0);

  return {
    period,
    label: periodLabel(period),
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    incomeByKind: groupByKind(inc),
    expenseByKind: groupByKind(exp),
    daily: [...days.values()].sort((a, b) => a.day - b.day),
    incomes: inc,
    expenses: exp,
  };
}

function groupByKind(rows: readonly LedgerEntry[]): {kind: string; amount: number}[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.kind, (totals.get(r.kind) ?? 0) + r.amount);
  return [...totals.entries()].map(([kind, amount]) => ({kind, amount})).sort((a, b) => b.amount - a.amount);
}

/**
 * CSV in the layout the brief asks for:
 *   line 1  period · line 2  Thu / Chi / Lãi lỗ · details · totals.
 */
export function financialCsv(
  report: FinancialReport,
  formatVnd: (v: number) => string,
  formatDay: (at: number) => string,
): string {
  const rows: string[][] = [
    [report.label],
    ['Thu', formatVnd(report.totalIncome), 'Chi', formatVnd(report.totalExpense), 'Lãi lỗ', formatVnd(report.profit)],
    [],
    ['Loại', 'Ngày', 'Nhóm', 'Mô tả', 'Số tiền', 'Ghi chú', 'Đã kiểm tra'],
    ...report.incomes.map(r => ['Thu', formatDay(r.occurredAt), incomeKindLabel(r.kind), r.description, formatVnd(r.amount), r.note ?? '', r.checked ? 'x' : '']),
    ...report.expenses.map(r => ['Chi', formatDay(r.occurredAt), expenseKindLabel(r.kind), r.description, formatVnd(r.amount), r.note ?? '', r.checked ? 'x' : '']),
    [],
    ['Tổng', '', '', '', `Thu ${formatVnd(report.totalIncome)}`, `Chi ${formatVnd(report.totalExpense)}`, `Lãi lỗ ${formatVnd(report.profit)}`],
  ];
  return rows.map(csvLine).join('\n') + '\n';
}
