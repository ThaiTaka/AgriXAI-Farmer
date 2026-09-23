/**
 * Mã định danh cây trồng, dựng từ tên bà con gõ vào.
 *
 * Mã phải là ASCII để chạy được qua URL, tên cột và khoá đồng bộ, nên nó mất
 * dấu tiếng Việt — "Sầu riêng" thành `sau_rieng`. Mã KHÔNG phải là nhãn: chỗ
 * nào hiện lên màn hình thì dùng tên đã lưu, và chỉ khi không còn gì khác mới
 * dựng tạm chữ đọc được từ mã (xem humanizeCropSlug).
 */

// U+0300–U+036F: the combining marks NFD splits off Vietnamese letters. Built
// from char codes so the source stays plain ASCII.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

/** 'Sầu riêng Ri6' -> 'sau_rieng_ri6' — a stable crop id for a farmer-added crop. */
export function slugifyCropName(name: string): string {
  const stripped = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return stripped || 'khac';
}

/**
 * `sau_rieng` -> 'Sau rieng'. Lối thoát cuối cùng khi một bản ghi không có
 * tên nào để hiện — dấu tiếng Việt đã mất từ lúc dựng mã, không khôi phục
 * được, nhưng ít nhất bà con không phải đọc gạch dưới.
 */
export function humanizeCropSlug(slug: string): string {
  const words = slug.replace(/_+/g, ' ').trim();
  if (!words) return 'Chưa rõ cây trồng';
  return words.charAt(0).toUpperCase() + words.slice(1);
}
