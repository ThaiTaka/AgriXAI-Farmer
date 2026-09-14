/**
 * Chart colours. Four categorical slots, validated with the dataviz palette
 * checker on the white card surface (lightness band, chroma floor, CVD
 * separation, normal-vision floor, 3:1 contrast — all pass):
 *
 *   slot 1  #2E6F40  brand green   (thu / tồn kho)
 *   slot 2  #2A78D6  blue
 *   slot 3  #EB6834  orange        (chi)
 *   slot 4  #7C3AED  purple
 *
 * Assigned in fixed order by entity, never cycled — an expense kind keeps its
 * colour whether or not the other kinds are present in the period.
 */

import {colors} from '../../theme';

export const SERIES = [colors.primary.default, '#2A78D6', '#EB6834', '#7C3AED'] as const;

export const CHART = {
  grid: colors.gray['200'],
  axis: colors.gray['300'],
  label: colors.text.muted,
  surface: colors.surface.card,
  crosshair: colors.gray['400'],
} as const;

/** Expense kinds → slot, fixed. */
export const EXPENSE_KIND_COLOR: Record<string, string> = {
  fertilizer: SERIES[0],
  labor: SERIES[1],
  utilities: SERIES[2],
  other: SERIES[3],
};

export const INCOME_COLOR = SERIES[0];
export const EXPENSE_COLOR = SERIES[2];
