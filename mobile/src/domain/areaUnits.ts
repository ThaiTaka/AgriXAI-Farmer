/**
 * Area units a farmer might type in. Everything is normalised to m² before
 * any arithmetic; the regional units are shown with their m² value next to
 * them because "sào" and "mẫu" mean different things in the north, centre
 * and south of the country.
 *
 * Values: sào Bắc Bộ 360 m², sào Trung Bộ ≈ 500 m² (497 m² by the old
 * definition), công Nam Bộ 1.000 m², mẫu Bắc Bộ 3.600 m², ha 10.000 m².
 * Source: Wikipedia tiếng Việt, "Đơn vị đo diện tích cổ của Việt Nam".
 */

export type AreaUnit = 'm2' | 'sao_bac' | 'sao_trung' | 'cong_nam' | 'mau_bac' | 'ha';

export interface AreaUnitInfo {
  code: AreaUnit;
  label: string;
  short: string;
  m2: number;
}

export const AREA_UNITS: readonly AreaUnitInfo[] = [
  {code: 'm2', label: 'Mét vuông', short: 'm²', m2: 1},
  {code: 'sao_bac', label: 'Sào Bắc Bộ (360 m²)', short: 'sào BB', m2: 360},
  {code: 'sao_trung', label: 'Sào Trung Bộ (500 m²)', short: 'sào TB', m2: 500},
  {code: 'cong_nam', label: 'Công Nam Bộ (1.000 m²)', short: 'công', m2: 1000},
  {code: 'mau_bac', label: 'Mẫu Bắc Bộ (3.600 m²)', short: 'mẫu BB', m2: 3600},
  {code: 'ha', label: 'Héc-ta (10.000 m²)', short: 'ha', m2: 10000},
] as const;

export function areaUnitInfo(code: string): AreaUnitInfo {
  return AREA_UNITS.find(u => u.code === code) ?? AREA_UNITS[0];
}

export function toSquareMetres(value: number, unit: string): number {
  return value * areaUnitInfo(unit).m2;
}

/** Plot rows store 'm2' or 'ha'; map those onto the calculator's unit list. */
export function plotAreaUnit(unit: string): AreaUnit {
  return unit === 'ha' ? 'ha' : 'm2';
}
