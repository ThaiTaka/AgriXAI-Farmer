/**
 * Area units a farmer might type in. Everything is normalised to m² before
 * any arithmetic, and a non-m² unit is shown with its m² value next to it
 * because "sào" means different things in different parts of the country.
 *
 * The app serves Lâm Đồng, so the calculator offers m², the sào farmers there
 * use and ha. Sào Lâm Đồng = 1.000 m², as Đà Lạt growers count it:
 *   - Báo Nhân Dân, 06/01/2019, "Giá hoa cúc 'chạm đáy', nhà nông Đà Lạt
 *     ngậm ngùi nhổ bỏ": "canh tác một sào (1.000m2) hoa cúc".
 *   - TTXVN (VietnamPlus), 18/09/2026, "Nông dân Đà Lạt 'nhàn nhã' nhờ ứng
 *     dụng nông nghiệp thông minh": "hơn 6 sào (1.000 m2/sào) nhà kính".
 *
 * The other regional units were offered before the app moved to Lâm Đồng.
 * Plans saved with them must still read back, so they stay resolvable but are
 * no longer offered. Values: sào Bắc Bộ 360 m², sào Trung Bộ ≈ 500 m² (497 m²
 * by the old definition), công Nam Bộ 1.000 m², mẫu Bắc Bộ 3.600 m².
 * Source: Wikipedia tiếng Việt, "Đơn vị đo diện tích cổ của Việt Nam".
 */

export type AreaUnit = 'm2' | 'sao_lam_dong' | 'ha' | 'sao_bac' | 'sao_trung' | 'cong_nam' | 'mau_bac';

export interface AreaUnitInfo {
  code: AreaUnit;
  label: string;
  short: string;
  m2: number;
}

/** The units the calculator offers. */
export const AREA_UNITS: readonly AreaUnitInfo[] = [
  {code: 'm2', label: 'Mét vuông', short: 'm²', m2: 1},
  {code: 'sao_lam_dong', label: 'Sào Lâm Đồng (1.000 m²)', short: 'sào', m2: 1000},
  {code: 'ha', label: 'Héc-ta (10.000 m²)', short: 'ha', m2: 10000},
] as const;

const LEGACY_AREA_UNITS: readonly AreaUnitInfo[] = [
  {code: 'sao_bac', label: 'Sào Bắc Bộ (360 m²)', short: 'sào BB', m2: 360},
  {code: 'sao_trung', label: 'Sào Trung Bộ (500 m²)', short: 'sào TB', m2: 500},
  {code: 'cong_nam', label: 'Công Nam Bộ (1.000 m²)', short: 'công', m2: 1000},
  {code: 'mau_bac', label: 'Mẫu Bắc Bộ (3.600 m²)', short: 'mẫu BB', m2: 3600},
] as const;

export function areaUnitInfo(code: string): AreaUnitInfo {
  return AREA_UNITS.find(u => u.code === code) ?? LEGACY_AREA_UNITS.find(u => u.code === code) ?? AREA_UNITS[0];
}

export function toSquareMetres(value: number, unit: string): number {
  return value * areaUnitInfo(unit).m2;
}

/** Plot rows store 'm2' or 'ha'; map those onto the calculator's unit list. */
export function plotAreaUnit(unit: string): AreaUnit {
  return unit === 'ha' ? 'ha' : 'm2';
}
