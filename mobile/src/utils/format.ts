/** Vietnamese-facing formatting helpers. */

const VN_MONTHS_MS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

export function formatArea(area: number, unit: string): string {
  if (!Number.isFinite(area) || area <= 0) return '—';
  if (unit === 'ha') {
    return `${formatNumber(area)} ha`;
  }
  return `${formatNumber(area)} m²`;
}

export function formatNumber(value: number): string {
  // vi-VN groups thousands with a dot: 1.200
  return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 2}).format(value);
}

export function formatDate(value: number | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(value: number | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "hôm nay", "3 ngày trước", "12/08" — matches the wording used in the design. */
export function formatRelative(value: number | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const diff = Date.now() - d.getTime();
  if (diff < 0) return formatDate(d);
  if (diff < VN_MONTHS_MS.minute) return 'vừa xong';
  if (diff < VN_MONTHS_MS.hour) return `${Math.floor(diff / VN_MONTHS_MS.minute)} phút trước`;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - d.getTime()) / VN_MONTHS_MS.day) + 1;

  if (d.getTime() >= startOfToday.getTime()) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  return formatDate(d);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function formatWeekdayDate(d: Date = new Date()): string {
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}
