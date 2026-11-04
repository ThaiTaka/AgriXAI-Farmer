/**
 * Định dạng dùng chung cho các trang quản trị: tên cây, trạng thái lô, số tiền
 * rút gọn, ngày giờ theo giờ Việt Nam.
 */

export const CROP_LABELS: Record<string, string> = {
  tomato: "Cà chua",
  coffee: "Cà phê",
  cucumber: "Dưa leo",
  chili: "Ớt",
  carrot: "Cà rốt",
  water_spinach: "Rau muống",
  cabbage: "Bắp cải",
  corn: "Ngô",
  rice: "Lúa",
};

export const cropLabel = (cropType: string, cropName?: string | null): string =>
  cropName || CROP_LABELS[cropType] || cropType;

export const PLOT_STATUS: Record<string, {label: string; tone: "green" | "amber" | "gray"}> = {
  active: {label: "Đang canh tác", tone: "green"},
  harvested: {label: "Đã thu hoạch", tone: "gray"},
  fallow: {label: "Để hoang", tone: "amber"},
};

/** m² → "300 m²" or "0,5 ha" once it passes 1 ha. */
export const formatArea = (m2: number): string => {
  if (m2 >= 10_000) return `${new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 2}).format(m2 / 10_000)} ha`;
  return `${new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(m2)} m²`;
};

/** Diện tích của một hàng lô đất (m2 hoặc ha) quy về m². */
export const plotAreaM2 = (area: number, unit: string): number => area * (unit === "ha" ? 10_000 : 1);

/**
 * 12.345.678 → "12,3 tr" (trục biểu đồ) hoặc "12,3 triệu" (thẻ số liệu, `long`);
 * 1.234 → "1.234".
 */
export const compactVnd = (value: number, long = false): string => {
  const abs = Math.abs(value);
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 1}).format(n);
  if (abs >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000)} ${long ? "triệu" : "tr"}`;
  if (abs >= 1_000) return `${fmt(value / 1_000)} nghìn`;
  return fmt(value);
};

export const formatDateTime = (ms: number): string =>
  new Date(ms).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Bỏ dấu và hạ chữ thường — để tìm "ha" ra "Hà", "dalat" ra "Đà Lạt". */
export const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/** Mã lô theo dạng của ứng dụng: PUC-YYMM-XXXX (xem mobile/src/utils/plotCode.ts). */
export const PLOT_CODE_PATTERN = /^PUC-\d{4}-[0-9A-Z]{4}$/;

export const suggestPlotCode = (date: Date, suffix: string): string => {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `PUC-${yy}${mm}-${suffix.toUpperCase()}`;
};

/** "Trại Mát, phường Xuân Trường - Đà Lạt, Lâm Đồng" → "phường Xuân Trường - Đà Lạt" (đơn vị cấp xã). */
export const areaOf = (region: string | null | undefined): string => {
  if (!region) return "Chưa có địa chỉ";
  const parts = region.split(",").map(p => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
};
