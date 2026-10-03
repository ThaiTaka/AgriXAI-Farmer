/** Number and date wording for web-admin — Vietnamese conventions, one place. */

const nf0 = new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0});
const nf1 = new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 1});

export const formatNumber = (value: number): string => nf0.format(value);

/** 4 940 000 -> "4,9 tr"; 2 755 000 000 -> "2,8 tỷ"; 12 000 -> "12 nghìn". */
export function formatVndCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${nf1.format(abs / 1e9)} tỷ`;
  if (abs >= 1e6) return `${sign}${nf1.format(abs / 1e6)} tr`;
  if (abs >= 1e3) return `${sign}${nf0.format(abs / 1e3)} nghìn`;
  return `${sign}${nf0.format(abs)}`;
}

/** Areas in m² are how the server keeps them; large ones read better in ha. */
export function formatArea(m2: number): string {
  if (m2 >= 10_000) return `${nf1.format(m2 / 10_000)} ha`;
  return `${nf0.format(m2)} m²`;
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "hôm qua", "4 ngày trước", else the date. */
export function timeAgo(at: number | null | undefined, now: number = Date.now()): string {
  if (!at) return "—";
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return new Date(at).toLocaleDateString("vi-VN", {day: "2-digit", month: "2-digit", year: "numeric"});
}

export function formatDateTime(at: number | null | undefined): string {
  if (!at) return "—";
  return new Date(at).toLocaleString("vi-VN", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"});
}

export const MONTHS_SHORT = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];

/** "Thứ Bảy, 03/10/2026" */
export function longDate(at: number = Date.now()): string {
  const d = new Date(at);
  const weekday = d.getDay() === 0 ? "Chủ nhật" : `Thứ ${["", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"][d.getDay()]}`;
  return `${weekday}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Ngày của dự báo: "Hôm nay", "Ngày mai", "T5 08/10". */
export function dayLabel(isoDate: string, now: number = Date.now()): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(y, m - 1, d).getTime();
  const t = new Date(now);
  const start = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diff = Math.round((day - start) / 86_400_000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  const wd = new Date(y, m - 1, d).getDay();
  return `${wd === 0 ? "CN" : `T${wd + 1}`} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export const initialOf = (name: string): string => name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? "?";
