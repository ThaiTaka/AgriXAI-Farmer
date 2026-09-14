/**
 * Stock arithmetic — the phone-side twin of backend/app/services/ledger_service.py.
 * Same rules, same numbers; both are tested against the same mock farm.
 *
 *     stock          = Σ(in) − Σ(out)                       [kg]
 *     average price  = Σ(in_kg × unit_price) / Σ(in_kg)     [đ/kg]
 *     stock value    = stock × average price                [đ]
 *     issue cost     = FIFO — oldest purchase lots first
 *
 * Inputs are plain objects, not WatermelonDB models, so this file has no
 * native dependency and runs under jest as-is.
 */

export type StockUnit = 'kg' | 'tan';

export const KG_PER_TAN = 1000;

export function toKg(quantity: number, unit: StockUnit): number {
  return unit === 'tan' ? quantity * KG_PER_TAN : quantity;
}

export interface InRow {
  id?: string;
  fertilizerId: string;
  fertilizerName: string;
  category?: string | null;
  quantityKg: number;
  unitPrice: number;
  occurredAt: number;
  createdAt?: number;
}

export interface OutRow {
  id?: string;
  fertilizerId: string;
  fertilizerName: string;
  category?: string | null;
  quantityKg: number;
  unitPrice: number;
  totalCost: number;
  occurredAt: number;
  createdAt?: number;
}

export interface FifoResult {
  unitPrice: number;
  totalCost: number;
  consumedKg: number;
  shortfallKg: number;
}

interface Lot {
  unitPrice: number;
  remainingKg: number;
}

const byTime = <T extends {occurredAt: number; createdAt?: number}>(a: T, b: T) =>
  a.occurredAt - b.occurredAt || (a.createdAt ?? 0) - (b.createdAt ?? 0);

function consume(lots: Lot[], quantityKg: number): {taken: number; cost: number} {
  let need = quantityKg;
  let cost = 0;
  let taken = 0;
  for (const lot of lots) {
    if (need <= 0) break;
    if (lot.remainingKg <= 0) continue;
    const take = Math.min(lot.remainingKg, need);
    lot.remainingKg -= take;
    need -= take;
    taken += take;
    cost += take * lot.unitPrice;
  }
  return {taken, cost};
}

/**
 * Cost of issuing `quantityKg` of one fertiliser on `occurredAt`. Earlier
 * issues are replayed first so already-consumed lots are not counted twice;
 * purchases dated after the issue are ignored.
 */
export function fifoCost(
  ins: readonly InRow[],
  outs: readonly Pick<OutRow, 'fertilizerId' | 'quantityKg' | 'occurredAt' | 'createdAt'>[],
  fertilizerId: string,
  quantityKg: number,
  occurredAt: number,
): FifoResult {
  const lots: Lot[] = ins
    .filter(r => r.fertilizerId === fertilizerId && r.occurredAt <= occurredAt)
    .sort(byTime)
    .map(r => ({unitPrice: r.unitPrice, remainingKg: r.quantityKg}));

  const earlier = outs
    .filter(r => r.fertilizerId === fertilizerId && r.occurredAt <= occurredAt)
    .sort(byTime);
  for (const prior of earlier) consume(lots, prior.quantityKg);

  const {taken, cost} = consume(lots, quantityKg);
  return {
    unitPrice: taken > 0 ? cost / taken : 0,
    totalCost: cost,
    consumedKg: taken,
    shortfallKg: Math.max(0, quantityKg - taken),
  };
}

export interface StockLine {
  fertilizerId: string;
  fertilizerName: string;
  category: string | null;
  inKg: number;
  outKg: number;
  stockKg: number;
  inValue: number;
  avgPrice: number;
  stockValue: number;
  latestUnitPrice: number | null;
}

export function stockSummary(ins: readonly InRow[], outs: readonly OutRow[]): StockLine[] {
  const lines = new Map<string, StockLine & {latestAt: number | null}>();
  const line = (id: string, name: string, category?: string | null) => {
    let current = lines.get(id);
    if (!current) {
      current = {
        fertilizerId: id,
        fertilizerName: name,
        category: category ?? null,
        inKg: 0,
        outKg: 0,
        stockKg: 0,
        inValue: 0,
        avgPrice: 0,
        stockValue: 0,
        latestUnitPrice: null,
        latestAt: null,
      };
      lines.set(id, current);
    }
    return current;
  };

  for (const row of ins) {
    const l = line(row.fertilizerId, row.fertilizerName, row.category);
    l.inKg += row.quantityKg;
    l.inValue += row.quantityKg * row.unitPrice;
    if (l.latestAt === null || row.occurredAt >= l.latestAt) {
      l.latestAt = row.occurredAt;
      l.latestUnitPrice = row.unitPrice;
    }
  }
  for (const row of outs) {
    const l = line(row.fertilizerId, row.fertilizerName, row.category);
    l.outKg += row.quantityKg;
  }

  return [...lines.values()]
    .map(l => {
      const stockKg = round3(l.inKg - l.outKg);
      const avgPrice = l.inKg > 0 ? l.inValue / l.inKg : 0;
      const rest: StockLine = {
        fertilizerId: l.fertilizerId,
        fertilizerName: l.fertilizerName,
        category: l.category,
        inKg: l.inKg,
        outKg: l.outKg,
        stockKg,
        inValue: l.inValue,
        avgPrice,
        stockValue: stockKg * avgPrice,
        latestUnitPrice: l.latestUnitPrice,
      };
      return rest;
    })
    .sort((a, b) => a.fertilizerName.localeCompare(b.fertilizerName, 'vi'));
}

export function stockOf(ins: readonly InRow[], outs: readonly OutRow[], fertilizerId: string): number {
  return round3(
    ins.filter(r => r.fertilizerId === fertilizerId).reduce((s, r) => s + r.quantityKg, 0) -
      outs.filter(r => r.fertilizerId === fertilizerId).reduce((s, r) => s + r.quantityKg, 0),
  );
}

export interface StockCheck {
  stockKg: number;
  neededKg: number;
  remainingKg: number;
  shortfallKg: number;
  enough: boolean;
}

/** F4 — enough in the shed for a planned application? */
export function checkStock(
  ins: readonly InRow[],
  outs: readonly OutRow[],
  fertilizerId: string,
  neededKg: number,
): StockCheck {
  const stockKg = stockOf(ins, outs, fertilizerId);
  const remaining = round3(stockKg - neededKg);
  return {
    stockKg,
    neededKg,
    remainingKg: Math.max(0, remaining),
    shortfallKg: Math.max(0, -remaining),
    enough: remaining >= 0,
  };
}

export interface TimelinePoint {
  /** Start of day, epoch ms (local). */
  day: number;
  stockKg: number;
}

/**
 * Running stock per day for the line chart. One point per day on which
 * something moved, plus the opening level, so a flat week draws as a flat
 * line rather than a gap.
 */
export function stockTimeline(
  ins: readonly InRow[],
  outs: readonly OutRow[],
  fertilizerId?: string,
): TimelinePoint[] {
  const events = [
    ...ins.filter(r => !fertilizerId || r.fertilizerId === fertilizerId).map(r => ({at: r.occurredAt, delta: r.quantityKg})),
    ...outs.filter(r => !fertilizerId || r.fertilizerId === fertilizerId).map(r => ({at: r.occurredAt, delta: -r.quantityKg})),
  ].sort((a, b) => a.at - b.at);

  const points: TimelinePoint[] = [];
  let level = 0;
  for (const event of events) {
    level = round3(level + event.delta);
    const day = startOfDay(event.at);
    const last = points[points.length - 1];
    if (last && last.day === day) last.stockKg = level;
    else points.push({day, stockKg: level});
  }
  return points;
}

export type PeriodFilter = {kind: 'all'} | {kind: 'month'; year: number; month: number} | {kind: 'quarter'; year: number; quarter: number};

export function periodBounds(filter: PeriodFilter): [number, number] | null {
  if (filter.kind === 'all') return null;
  if (filter.kind === 'month') {
    return [new Date(filter.year, filter.month - 1, 1).getTime(), new Date(filter.year, filter.month, 1).getTime()];
  }
  const first = (filter.quarter - 1) * 3;
  return [new Date(filter.year, first, 1).getTime(), new Date(filter.year, first + 3, 1).getTime()];
}

export function inPeriod(occurredAt: number, filter: PeriodFilter): boolean {
  const bounds = periodBounds(filter);
  return bounds === null || (occurredAt >= bounds[0] && occurredAt < bounds[1]);
}

export function periodLabel(filter: PeriodFilter): string {
  if (filter.kind === 'all') return 'Toàn bộ';
  if (filter.kind === 'month') return `Tháng ${filter.month}, Năm ${filter.year}`;
  return `Quý ${filter.quarter}, Năm ${filter.year}`;
}

export function stockCsv(lines: readonly StockLine[], formatVnd: (v: number) => string): string {
  const rows: string[][] = [
    ['Phân bón', 'Nhập (kg)', 'Xuất (kg)', 'Tồn (kg)', 'Giá trung bình (đ/kg)', 'Tổng tiền tồn'],
    ...lines.map(l => [l.fertilizerName, num(l.inKg), num(l.outKg), num(l.stockKg), formatVnd(l.avgPrice), formatVnd(l.stockValue)]),
    ['Tổng', '', '', num(lines.reduce((s, l) => s + l.stockKg, 0)), '', formatVnd(lines.reduce((s, l) => s + l.stockValue, 0))],
  ];
  return rows.map(csvLine).join('\n') + '\n';
}

export function csvLine(cells: readonly string[]): string {
  return cells.map(c => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');
}

function num(value: number): string {
  return String(Number(value.toFixed(3)));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
