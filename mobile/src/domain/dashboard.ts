/**
 * The three dashboard figures, computed from local rows — the phone-side
 * twin of backend/app/services/dashboard_service.py:
 *
 *     stock value   = Σ (stock_kg × average price) over fertilisers in stock
 *     month profit  = Σ thu − Σ chi in the calendar month
 *     pending tasks = tasks of each active plot's CURRENT protocol stage
 *                     that have no "done" row in tasks_history
 */

import type {CareProtocol} from './careProtocol';
import {currentStage, protocolsFor} from './careProtocol';
import {financialReport, type LedgerEntry} from './finance';
import type {StockLine} from './warehouse';

export interface StockOverview {
  value: number;
  kg: number;
  kinds: number;
}

export function stockOverview(lines: readonly StockLine[]): StockOverview {
  const inStock = lines.filter(l => l.stockKg > 0);
  return {
    value: inStock.reduce((s, l) => s + l.stockValue, 0),
    kg: inStock.reduce((s, l) => s + l.stockKg, 0),
    kinds: inStock.length,
  };
}

export interface MonthOverview {
  income: number;
  expense: number;
  profit: number;
}

export function monthOverview(
  incomes: readonly LedgerEntry[],
  expenses: readonly LedgerEntry[],
  year: number,
  month: number,
): MonthOverview {
  const report = financialReport(incomes, expenses, {kind: 'month', year, month});
  return {income: report.totalIncome, expense: report.totalExpense, profit: report.profit};
}

/** What the dashboard needs to know about a plot. */
export interface PlotLike {
  id: string;
  name: string;
  cropType: string;
  cropName: string | null;
  categoryId: string | null;
  plantedAt: number | null;
  status: string;
}

export interface DoneTaskRef {
  plotId: string | null;
  protocolId: string;
  stageCode: string;
  taskKey: string;
}

export interface PendingGroup {
  plotId: string;
  plotName: string;
  cropName: string;
  stageName: string;
  pending: number;
}

export function currentStageOf(protocol: CareProtocol, plantedAt: number | null, now: number) {
  return currentStage(protocol, {plantedAt, now}) ?? null;
}

export function pendingTasks(
  plots: readonly PlotLike[],
  done: readonly DoneTaskRef[],
  now: number,
): PendingGroup[] {
  const doneKeys = new Set(done.map(d => `${d.plotId ?? ''}|${d.protocolId}|${d.stageCode}|${d.taskKey}`));
  const groups: PendingGroup[] = [];
  for (const plot of plots) {
    if (plot.status !== 'active') continue;
    const protocol = protocolsFor(plot.cropType, plot.categoryId)[0];
    if (!protocol) continue;
    const stage = currentStageOf(protocol, plot.plantedAt, now);
    if (!stage) continue;
    const pending = stage.tasks.filter(
      t => !doneKeys.has(`${plot.id}|${protocol.id}|${stage.stage_code}|${t.key}`),
    ).length;
    if (pending > 0) {
      groups.push({
        plotId: plot.id,
        plotName: plot.name,
        cropName: plot.cropName ?? protocol.crop_name,
        stageName: stage.stage_name_vi,
        pending,
      });
    }
  }
  return groups;
}

/** "Cà chua · Thúc lần 2: 3; Ớt · Vun gốc: 3" — at most three groups, then "+n". */
export function pendingSubtext(groups: readonly PendingGroup[]): string {
  if (groups.length === 0) return 'Không có việc nào chờ ở giai đoạn hiện tại';
  // "Cà chua · Thúc lần 2: 3" — crop, stage, count. Stage names read
  // "Thúc lần 2 — vun luống, làm giàn"; the caption keeps the part before the
  // dash (or a parenthesis) so it stays on two lines.
  const shown = groups.slice(0, 3).map(g => `${g.cropName} · ${g.stageName.split(/ \(| — /)[0]}: ${g.pending}`);
  const rest = groups.length - shown.length;
  return shown.join('; ') + (rest > 0 ? `; +${rest} lô` : '');
}

export const pendingTotal = (groups: readonly PendingGroup[]): number =>
  groups.reduce((s, g) => s + g.pending, 0);
