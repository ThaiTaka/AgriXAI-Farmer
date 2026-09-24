/**
 * Cultivation history, phone side — twin of backend/app/services/cultivation.py.
 *
 *     năng suất (kg / 1.000 m²) = sản lượng kg ÷ diện tích m² lúc trồng × 1.000
 *
 * Everything here runs offline on the rows already in SQLite. The crop
 * suggestion only ranks crops this plot has actually grown, by the average
 * productivity it reached, preferring harvests of the season asked about. It
 * never proposes a crop the farmer has not grown and never claims rotation or
 * companion-planting advice — the app has no sourced data for either.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS: readonly {code: Season; label: string; months: string}[] = [
  {code: 'spring', label: 'Vụ Xuân', months: 'tháng 1–3'},
  {code: 'summer', label: 'Vụ Hè', months: 'tháng 4–6'},
  {code: 'autumn', label: 'Vụ Thu', months: 'tháng 7–9'},
  {code: 'winter', label: 'Vụ Đông', months: 'tháng 10–12'},
];

const VN_OFFSET_MS = 7 * 3_600_000;

/** Month (1–12) and year of an instant in Vietnam time, whatever the phone's zone. */
function vnParts(ms: number): {month: number; year: number} {
  const d = new Date(ms + VN_OFFSET_MS);
  return {month: d.getUTCMonth() + 1, year: d.getUTCFullYear()};
}

/** Default season from the sowing month: Xuân 1–3, Hè 4–6, Thu 7–9, Đông 10–12. */
export function seasonOf(startedAt: number): Season {
  return SEASONS[Math.floor((vnParts(startedAt).month - 1) / 3)].code;
}

export function yearOf(ms: number): number {
  return vnParts(ms).year;
}

export function seasonLabel(season: string | null | undefined, year?: number): string {
  const name = SEASONS.find(s => s.code === season)?.label ?? 'Vụ';
  return year ? `${name} ${year}` : name;
}

/** The season that comes after the current one — what "vụ tới" means. */
export function nextSeason(now: number = Date.now()): Season {
  const index = SEASONS.findIndex(s => s.code === seasonOf(now));
  return SEASONS[(index + 1) % SEASONS.length].code;
}

/** kg per 1.000 m², one decimal; null when yield or area is missing. */
export function productivity(yieldKg: number | null | undefined, areaM2: number | null | undefined): number | null {
  if (!yieldKg || !areaM2 || yieldKg <= 0 || areaM2 <= 0) return null;
  return Math.round((yieldKg / areaM2) * 1000 * 10) / 10;
}

/** 4600 → "4.600", 82.5 → "82,5" — how the farmer writes it. */
export function vnNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const whole = Math.trunc(rounded);
  const text = String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimal = Math.round(Math.abs(rounded - whole) * 10);
  return `${rounded < 0 ? '-' : ''}${text}${decimal ? `,${decimal}` : ''}`;
}

/** What the arithmetic needs from a crop cycle (the model, or a test row). */
export interface CycleLike {
  id: string;
  name: string;
  cropType: string;
  cropName?: string | null;
  season?: string | null;
  startedAt: number;
  endedAt: number | null;
  areaM2?: number | null;
  yieldKg: number | null;
}

export function cycleSeason(cycle: CycleLike): Season {
  return (SEASONS.some(s => s.code === cycle.season) ? cycle.season : seasonOf(cycle.startedAt)) as Season;
}

export interface SuggestionPoint {
  cycleId: string;
  name: string;
  season: Season;
  year: number;
  productivity: number;
}

export interface CropSuggestion {
  cropType: string;
  cropName: string;
  avgProductivity: number;
  bestProductivity: number;
  bestCycleName: string;
  cycles: number;
  /** same_season = from harvests of the season asked about; all_seasons = none existed. */
  basis: 'same_season' | 'all_seasons';
  reason: string;
  history: SuggestionPoint[];
}

/**
 * Crops ranked by the average productivity they reached on this plot.
 * Only finished cycles with both a yield and an area count.
 */
export function recommendCrops(
  cycles: readonly CycleLike[],
  season: Season | null,
  cropNameOf: (cropType: string, stored?: string | null) => string = (t, s) => s ?? t,
): CropSuggestion[] {
  const usable = cycles.filter(c => c.endedAt && productivity(c.yieldKg, c.areaM2) !== null);
  let pool = usable;
  let basis: CropSuggestion['basis'] = 'all_seasons';
  if (season) {
    const inSeason = usable.filter(c => cycleSeason(c) === season);
    if (inSeason.length > 0) {
      pool = inSeason;
      basis = 'same_season';
    }
  }

  const groups = new Map<string, CycleLike[]>();
  for (const c of pool) groups.set(c.cropType, [...(groups.get(c.cropType) ?? []), c]);

  const out: (CropSuggestion & {latest: number})[] = [];
  for (const [cropType, rows] of groups) {
    const sorted = [...rows].sort((a, b) => a.startedAt - b.startedAt);
    const values = sorted.map(c => productivity(c.yieldKg, c.areaM2) as number);
    const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
    let best = 0;
    values.forEach((v, i) => {
      if (v > values[best]) best = i;
    });
    const stored = sorted.find(c => c.cropName)?.cropName ?? null;
    out.push({
      cropType,
      cropName: cropNameOf(cropType, stored),
      avgProductivity: avg,
      bestProductivity: values[best],
      bestCycleName: sorted[best].name,
      cycles: sorted.length,
      basis,
      reason: '',
      history: sorted.map((c, i) => ({
        cycleId: c.id,
        name: c.name,
        season: cycleSeason(c),
        year: yearOf(c.startedAt),
        productivity: values[i],
      })),
      latest: Math.max(...sorted.map(c => yearOf(c.startedAt))),
    });
  }

  out.sort((a, b) => b.avgProductivity - a.avgProductivity || b.cycles - a.cycles || b.latest - a.latest);
  return out.map(({latest: _latest, ...s}, rank) => ({...s, reason: reasonFor(s, season, rank)}));
}

function reasonFor(s: CropSuggestion, season: Season | null, rank: number): string {
  const where = s.basis === 'same_season' && season ? ` trong ${seasonLabel(season).toLowerCase()}` : '';
  const lead = rank === 0 ? 'Năng suất tốt nhất trên lô này' : 'Năng suất trung bình';
  let text =
    `${lead}${where}: ${vnNumber(s.avgProductivity)} kg/1.000 m² qua ${s.cycles} vụ` +
    ` (cao nhất ${vnNumber(s.bestProductivity)} — ${s.bestCycleName}).`;
  if (s.basis === 'all_seasons' && season) {
    text = `Lô chưa có ${seasonLabel(season).toLowerCase()} nào ghi sản lượng, nên tính trên mọi mùa. ${text}`;
  }
  return text;
}

/* -------------------------------- plot costs -------------------------------- */

export interface ExpenseLike {
  kind: string;
  amount: number;
  occurredAt: number;
  plotId: string | null;
  warehouseInId?: string | null;
}

export interface IssueLike {
  totalCost: number;
  occurredAt: number;
  plotId: string | null;
}

export interface PlotCosts {
  seed: number;
  fertilizer: number;
  labor: number;
  other: number;
  total: number;
}

/**
 * Giống + Phân + Nhân công (+ khác) spent on one plot, optionally in a window.
 *
 * Fertiliser counts when it goes onto the plot (a stock issue, at its FIFO
 * cost), not when it was bought for the shed; the purchase expense a stock
 * entry books (`warehouseInId` set) is skipped so the same bag is never
 * charged twice. Fertiliser bought and spread at once, entered as a plain
 * expense, does count.
 */
export function plotCosts(
  expenses: readonly ExpenseLike[],
  issues: readonly IssueLike[],
  plotId: string,
  start?: number | null,
  end?: number | null,
): PlotCosts {
  const inside = (ms: number) => (start == null || ms >= start) && (end == null || ms <= end);
  const totals = {seed: 0, fertilizer: 0, labor: 0, other: 0};
  for (const row of expenses) {
    if (row.plotId !== plotId || !inside(row.occurredAt)) continue;
    if (row.kind === 'fertilizer' && row.warehouseInId) continue;
    const bucket = row.kind === 'seed' || row.kind === 'fertilizer' || row.kind === 'labor' ? row.kind : 'other';
    totals[bucket] += row.amount;
  }
  for (const row of issues) {
    if (row.plotId === plotId && inside(row.occurredAt)) totals.fertilizer += row.totalCost;
  }
  const rounded = {
    seed: Math.round(totals.seed),
    fertilizer: Math.round(totals.fertilizer),
    labor: Math.round(totals.labor),
    other: Math.round(totals.other),
  };
  return {...rounded, total: rounded.seed + rounded.fertilizer + rounded.labor + rounded.other};
}

/** Cost per kg harvested, or null without a yield. */
export function costPerKg(total: number, yieldKg: number | null | undefined): number | null {
  if (!yieldKg || yieldKg <= 0 || total <= 0) return null;
  return Math.round(total / yieldKg);
}

/** A suggested cycle name the farmer can keep or overwrite: "Vụ Xuân 2026 — Cà chua". */
export function suggestCycleName(season: Season, startedAt: number, cropName: string): string {
  return `${seasonLabel(season, yearOf(startedAt))} — ${cropName}`;
}
