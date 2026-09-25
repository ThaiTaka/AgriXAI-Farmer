/**
 * Hired labour — twin of backend/app/services/labor.py.
 *
 *     theo giờ / theo ngày :  số người × số giờ (ngày) mỗi người × đơn giá
 *     khoán                :  một khoản trọn gói cho cả việc
 *
 * Rounded to whole đồng. The result is stored as the expense `amount`, which
 * every report already sums — labour needs no ledger of its own.
 */

import {formatVnd} from '../utils/format';

export type LaborUnit = 'hour' | 'day' | 'lump';

export const LABOR_UNITS: readonly {code: LaborUnit; label: string; per: string}[] = [
  {code: 'hour', label: 'Theo giờ', per: 'giờ'},
  {code: 'day', label: 'Theo ngày', per: 'ngày'},
  {code: 'lump', label: 'Khoán', per: 'việc'},
];

export function laborAmount(
  unit: LaborUnit,
  workers: number | null | undefined,
  quantity: number | null | undefined,
  unitPrice: number,
): number | null {
  if (!(unitPrice > 0)) return null;
  if (unit === 'lump') return Math.round(unitPrice);
  if (!workers || !quantity || workers <= 0 || quantity <= 0) return null;
  return Math.round(workers * quantity * unitPrice);
}

function plain(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

/** "2 người × 3 giờ × 30.000₫" — the working shown under a labour cost. */
export function describeLabor(row: {
  unit: string | null;
  workers: number | null;
  quantity: number | null;
  unitPrice: number | null;
}): string | null {
  if (!row.unit || row.unitPrice == null) return null;
  if (row.unit === 'lump') return `Khoán trọn gói ${formatVnd(row.unitPrice)}`;
  if (row.workers == null || row.quantity == null) return null;
  const per = LABOR_UNITS.find(u => u.code === row.unit)?.per ?? row.unit;
  return `${plain(row.workers)} người × ${plain(row.quantity)} ${per} × ${formatVnd(row.unitPrice)}`;
}

/** Parses what the farmer typed ("1,5" or "1.5") into a number, or null. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
