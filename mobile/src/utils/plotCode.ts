/**
 * Mã vùng trồng (`PUC-YYMM-XXXX`).
 *
 * Mã do bên quản lý đất cấp kèm theo lô khi giao cho nông hộ. Ứng dụng KHÔNG
 * tự sinh mã: nông hộ không lập lô mới, nên ở đây chỉ còn phép kiểm tra dạng
 * mã, dùng khi nông hộ sửa lại mã của một lô đã được giao.
 */

const CODE_PATTERN = /^PUC-\d{4}-[0-9A-Z]{4}$/;

export function isWellFormedPlotCode(code: string): boolean {
  return CODE_PATTERN.test(code.trim().toUpperCase());
}
