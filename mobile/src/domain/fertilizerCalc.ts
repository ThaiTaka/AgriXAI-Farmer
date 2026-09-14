/**
 * F1 — how much of each fertiliser for a given area.
 *
 *     amount = amount_in_protocol × (area_m2 / reference_area_m2)
 *
 * Protocols quoted in pure nutrients (N, P₂O₅, K₂O) are converted to a
 * commercial product first, exactly as their source instructs:
 *
 *     commercial_kg = nutrient_kg × 100 / nutrient_pct_of_product
 *
 * Prices come from the fertiliser catalogue by product id. A line whose item
 * has no catalogue product (phân chuồng, vôi, SA, calcium nitrat…) is listed
 * with "chưa có giá" and left OUT of the total — the total says so.
 */

import type {CareProtocol, ConversionFactor, Nutrient, Scenario} from './careProtocol';

export interface PriceSource {
  id: string;
  name: string;
  price_per_kg_avg: number | null;
}

export interface CalcLine {
  key: string;
  /** What the farmer buys — the commercial product name. */
  name: string;
  /** The item as named in the source (differs only for nutrient-basis rows). */
  sourceName: string;
  fertilizerCategory: string;
  unit: 'kg' | 'tấn';
  min: number;
  max: number;
  nutrient: Nutrient | null;
  nutrientMin: number | null;
  nutrientMax: number | null;
  conversionPct: number | null;
  priceProductId: string | null;
  priceProductName: string | null;
  pricePerKg: number | null;
  costMin: number | null;
  costMax: number | null;
  note: string | null;
}

export interface CalcResult {
  protocolId: string;
  scenarioId: string;
  areaM2: number;
  /** area_m2 / reference m². */
  factor: number;
  lines: CalcLine[];
  costMin: number;
  costMax: number;
  /** Names of lines that could not be priced (so the UI can say what the total omits). */
  unpriced: string[];
}

export interface CalcOptions {
  protocol: CareProtocol;
  scenario: Scenario;
  areaM2: number;
  factors?: Record<Nutrient, ConversionFactor>;
  findProduct: (id: string) => PriceSource | undefined;
}

const KG_PER_TAN = 1000;

export function calculate({protocol, scenario, areaM2, factors, findProduct}: CalcOptions): CalcResult {
  if (!(areaM2 > 0)) throw new Error('Diện tích phải lớn hơn 0');
  const factor = areaM2 / protocol.reference_area.m2;

  const lines: CalcLine[] = [];
  for (const item of scenario.items) {
    // "-" in the source: the item is not applied in this scenario.
    if (item.max <= 0) continue;

    let name = item.name;
    let min = item.min * factor;
    let max = item.max * factor;
    let nutrientMin: number | null = null;
    let nutrientMax: number | null = null;
    let conversionPct: number | null = null;
    let priceProductId = item.price_product_id;
    let fertilizerCategory = item.fertilizer_category;

    if (protocol.basis === 'nutrient' && item.nutrient) {
      const conv = factors?.[item.nutrient];
      if (!conv) throw new Error(`Thiếu hệ số quy đổi cho ${item.nutrient}`);
      nutrientMin = min;
      nutrientMax = max;
      conversionPct = conv.pct;
      min = (min * 100) / conv.pct;
      max = (max * 100) / conv.pct;
      name = conv.product_name;
      fertilizerCategory = conv.fertilizer_category;
      priceProductId = priceProductId ?? conv.price_product_id;
    }

    const product = priceProductId ? findProduct(priceProductId) : undefined;
    const pricePerKg = product?.price_per_kg_avg ?? null;
    const kgMultiplier = item.unit === 'tấn' ? KG_PER_TAN : 1;

    lines.push({
      key: item.key,
      name,
      sourceName: item.name,
      fertilizerCategory,
      unit: item.unit,
      min,
      max,
      nutrient: item.nutrient ?? null,
      nutrientMin,
      nutrientMax,
      conversionPct,
      priceProductId: product ? product.id : null,
      priceProductName: product ? product.name : null,
      pricePerKg,
      costMin: pricePerKg === null ? null : min * kgMultiplier * pricePerKg,
      costMax: pricePerKg === null ? null : max * kgMultiplier * pricePerKg,
      note: item.note ?? null,
    });
  }

  const priced = lines.filter(l => l.costMin !== null && l.costMax !== null);
  return {
    protocolId: protocol.id,
    scenarioId: scenario.id,
    areaM2,
    factor,
    lines,
    costMin: priced.reduce((sum, l) => sum + (l.costMin ?? 0), 0),
    costMax: priced.reduce((sum, l) => sum + (l.costMax ?? 0), 0),
    unpriced: lines.filter(l => l.costMin === null).map(l => l.name),
  };
}

/**
 * Sensible display precision: whole kilograms above 100, one decimal above
 * 10, two below — 2,25 kg of urê for 300 m² should not read "2".
 */
export function formatQuantity(value: number): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: digits}).format(value);
}

/** "140–150" or "150" when the source gives a single figure. */
export function formatRange(min: number, max: number): string {
  const a = formatQuantity(min);
  const b = formatQuantity(max);
  return a === b ? a : `${a}–${b}`;
}
