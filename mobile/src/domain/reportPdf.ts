/**
 * The monthly / quarterly report as self-contained HTML, rendered to an A4
 * PDF on the device by react-native-html-to-pdf. Same sections and the same
 * note rules as backend/app/services/report_pdf.py, so a farmer's PDF and
 * the one web-admin downloads say the same thing.
 *
 * Fonts: the WebView that prints the HTML uses the system sans font, which
 * on Android and iOS covers Vietnamese and "₫"; Helvetica is named only as
 * the fallback the brief asks for.
 */

import type {FinancialReport, LedgerEntry} from './finance';
import type {PeriodFilter, StockLine} from './warehouse';
import {periodBounds} from './warehouse';

export const SUPPORT_EMAIL = 'support@agrilog.vn';
export const APP_NAME = 'AgriLog v2';

export interface ReportNotes {
  fertilizerLines: {description: string; amount: number}[];
  fertilizerTotal: number;
  stockKg: number;
  stockValue: number;
  stockKinds: number;
  /** Average fertiliser spend per month over the 3 months ending with the period; null without history. */
  avgMonthlyFertilizer: number | null;
}

/** Three calendar months ending with the report's last month, as [start, end) ms. */
export function trailingWindow(period: PeriodFilter): [number, number] | null {
  if (period.kind === 'all') return null;
  const lastMonth = period.kind === 'month' ? period.month : period.quarter * 3;
  const end = new Date(period.year, lastMonth, 1).getTime();
  const start = new Date(period.year, lastMonth - 3, 1).getTime();
  return [start, end];
}

export function reportNotes(
  report: FinancialReport,
  stock: readonly StockLine[],
  allExpenses: readonly LedgerEntry[],
): ReportNotes {
  const fertilizerLines = report.expenses
    .filter(e => e.kind === 'fertilizer')
    .map(e => ({description: e.description, amount: e.amount}));
  const inStock = stock.filter(l => l.stockKg > 0);

  const window = trailingWindow(report.period);
  let avg: number | null = null;
  if (window) {
    const inWindow = allExpenses.filter(
      e => e.kind === 'fertilizer' && e.occurredAt >= window[0] && e.occurredAt < window[1],
    );
    if (inWindow.length > 0) avg = inWindow.reduce((s, e) => s + e.amount, 0) / 3;
  }

  return {
    fertilizerLines,
    fertilizerTotal: fertilizerLines.reduce((s, l) => s + l.amount, 0),
    stockKg: inStock.reduce((s, l) => s + l.stockKg, 0),
    stockValue: inStock.reduce((s, l) => s + l.stockValue, 0),
    stockKinds: inStock.length,
    avgMonthlyFertilizer: avg,
  };
}

export function noteLines(notes: ReportNotes, formatVnd: (v: number) => string): string[] {
  const lines: string[] = [];
  if (notes.fertilizerLines.length > 0) {
    lines.push(
      `Chi phí phân bón: ${notes.fertilizerLines.map(l => formatVnd(l.amount)).join(' + ')} = ${formatVnd(notes.fertilizerTotal)}`,
    );
  } else {
    lines.push('Chi phí phân bón: không có khoản chi phân bón trong kỳ');
  }
  if (notes.stockKinds > 0) {
    lines.push(
      `Còn dư phân bón: ${formatKg(notes.stockKg)} kg (${notes.stockKinds} loại, ≈ ${formatVnd(Math.round(notes.stockValue))} theo giá nhập bình quân)`,
    );
  } else {
    lines.push('Còn dư phân bón: kho trống');
  }
  if (notes.avgMonthlyFertilizer !== null && notes.avgMonthlyFertilizer > 0) {
    const avg = formatVnd(Math.round(notes.avgMonthlyFertilizer));
    lines.push(
      `Khuyến nghị: chi phân bón trung bình ${avg}/tháng (tính trên 3 tháng gần nhất) — nên giữ dự phòng khoảng ${avg} mỗi tháng`,
    );
  } else {
    lines.push('Khuyến nghị: chưa đủ lịch sử chi phân bón để gợi ý mức dự phòng');
  }
  return lines;
}

function formatKg(value: number): string {
  return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 2}).format(value);
}

export function signedVnd(value: number, formatVnd: (v: number) => string): string {
  return (value >= 0 ? '+' : '−') + formatVnd(Math.abs(value));
}

export function reportFileName(period: PeriodFilter): string {
  if (period.kind === 'month') return `bao-cao-thu-chi-${period.year}-thang-${period.month}`;
  if (period.kind === 'quarter') return `bao-cao-thu-chi-${period.year}-quy-${period.quarter}`;
  return 'bao-cao-thu-chi';
}

export interface ReportHtmlInput {
  farmerName: string;
  address: string | null;
  report: FinancialReport;
  notes: ReportNotes;
  generatedAt: number;
  formatVnd: (v: number) => string;
  formatDay: (at: number) => string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A4 report: header, summary, thu, chi, ghi chú, footer. Text and numbers only. */
export function reportHtml({farmerName, address, report, notes, generatedAt, formatVnd, formatDay}: ReportHtmlInput): string {
  const verdict = report.profit >= 0 ? 'LÃI' : 'LỖ';
  const rows = (entries: readonly LedgerEntry[]) =>
    entries
      .map(
        e =>
          `<tr><td class="day">${esc(formatDay(e.occurredAt).slice(0, 5))}</td><td>${esc(e.description)}</td><td class="num">${esc(formatVnd(e.amount))}</td></tr>`,
      )
      .join('');
  const empty = (label: string) => `<tr><td colspan="3" class="muted">${label}</td></tr>`;

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: "Open Sans", Roboto, Helvetica, Arial, sans-serif; color: #111827; font-size: 11pt; margin: 0; }
  h1 { font-size: 16pt; color: #2E6F40; text-align: center; margin: 0 0 8pt; letter-spacing: .02em; }
  h2 { font-size: 12pt; margin: 16pt 0 4pt; padding-bottom: 3pt; border-bottom: 1px solid #E5E7EB; }
  .meta { margin: 0; line-height: 1.5; }
  hr { border: 0; border-top: 1px solid #E5E7EB; margin: 8pt 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3pt 2pt; vertical-align: top; }
  td.day { width: 14mm; color: #6B7280; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: 700; border-top: 1px solid #E5E7EB; padding-top: 5pt; }
  .muted { color: #6B7280; }
  .summary td:first-child { width: 70%; }
  .verdict { font-weight: 700; }
  ul { margin: 4pt 0 0 14pt; padding: 0; }
  li { margin-bottom: 3pt; }
  footer { margin-top: 24pt; padding-top: 6pt; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 9pt; text-align: center; }
</style></head><body>
<h1>BÁO CÁO THU – CHI NÔNG HỘ</h1>
<p class="meta">Nông hộ: <strong>${esc(farmerName)}</strong><br>
Địa chỉ: ${esc(address ?? 'Chưa cập nhật')}<br>
Kỳ: ${esc(report.label)} &nbsp;|&nbsp; Ngày xuất: ${esc(formatDay(generatedAt))}</p>
<hr>
<h2>TÓM TẮT</h2>
<table class="summary">
<tr><td>Thu</td><td class="num">${esc(formatVnd(report.totalIncome))}</td></tr>
<tr><td>Chi</td><td class="num">${esc(formatVnd(report.totalExpense))}</td></tr>
<tr class="total"><td class="verdict">Lãi/Lỗ [${verdict}]</td><td class="num">${esc(signedVnd(report.profit, formatVnd))}</td></tr>
</table>
<h2>CHI TIẾT THU</h2>
<table>${report.incomes.length ? rows(report.incomes) + `<tr class="total"><td></td><td>Tổng thu</td><td class="num">${esc(formatVnd(report.totalIncome))}</td></tr>` : empty('Không có khoản thu trong kỳ')}</table>
<h2>CHI TIẾT CHI</h2>
<table>${report.expenses.length ? rows(report.expenses) + `<tr class="total"><td></td><td>Tổng chi</td><td class="num">${esc(formatVnd(report.totalExpense))}</td></tr>` : empty('Không có khoản chi trong kỳ')}</table>
<h2>GHI CHÚ</h2>
<ul>${noteLines(notes, formatVnd)
    .map(l => `<li>${esc(l)}</li>`)
    .join('')}</ul>
<footer>Được tạo bởi: ${APP_NAME} &nbsp;|&nbsp; Hỗ trợ: ${SUPPORT_EMAIL}</footer>
</body></html>`;
}

/** True when the period holds nothing to report — the brief's "Không có dữ liệu tháng này". */
export function isEmptyReport(report: FinancialReport): boolean {
  return report.incomes.length === 0 && report.expenses.length === 0;
}

export const periodStart = (period: PeriodFilter): number | null => periodBounds(period)?.[0] ?? null;
