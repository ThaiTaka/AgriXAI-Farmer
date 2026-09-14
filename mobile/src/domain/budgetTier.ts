/**
 * F3 — budget tiers.
 *
 *     price_per_kg = pack price / pack kg
 *     ≤ 12.300 đ/kg  → Bình dân
 *     ≤ 14.500 đ/kg  → Trung bình
 *     otherwise      → Cao cấp
 *
 * The two thresholds are read from `budget_tiers` in the data file (they are
 * percentile bands of that catalogue), never hard-coded here, so re-pricing
 * the catalogue moves the bands with it.
 */

export type BudgetTierCode = 'binh_dan' | 'trung_binh' | 'cao_cap';

export interface BudgetTier {
  code: BudgetTierCode;
  name: string;
  max_price_per_kg: number | null;
}

export function pricePerKg(packPrice: number, packKg: number): number {
  if (!(packKg > 0)) throw new Error('Khối lượng bao phải lớn hơn 0');
  return Math.round(packPrice / packKg);
}

export function tierFor(perKg: number, tiers: readonly BudgetTier[]): BudgetTierCode {
  for (const tier of tiers) {
    if (tier.max_price_per_kg === null || perKg <= tier.max_price_per_kg) return tier.code;
  }
  return tiers[tiers.length - 1].code;
}

/** Human description of a band: "≤ 12.300₫/kg", "12.300 – 14.500₫/kg", "> 14.500₫/kg". */
export function tierBandLabel(
  tier: BudgetTier,
  tiers: readonly BudgetTier[],
  formatVnd: (value: number) => string,
): string {
  const index = tiers.findIndex(t => t.code === tier.code);
  const lower = index > 0 ? tiers[index - 1].max_price_per_kg : null;
  if (tier.max_price_per_kg === null) {
    return lower === null ? 'Mọi mức giá' : `> ${formatVnd(lower)}/kg`;
  }
  if (lower === null) return `≤ ${formatVnd(tier.max_price_per_kg)}/kg`;
  return `${formatVnd(lower)} – ${formatVnd(tier.max_price_per_kg)}/kg`;
}
