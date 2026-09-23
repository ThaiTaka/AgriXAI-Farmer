/**
 * Dựng đường cho biểu đồ đường. Mọi hàm ở đây nhận điểm ĐÃ ở toạ độ màn hình
 * (x tăng dần, y đã lật xuống), nên chúng thuần tuý là hình học — kiểm thử
 * được mà không cần dựng SVG.
 */

export interface Point {
  x: number;
  y: number;
}

/** Làm tròn 2 số lẻ: chuỗi path ngắn lại mà mắt không thấy khác. */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Nối thẳng từng điểm. */
export function linearPath(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${r(points[i].x)} ${r(points[i].y)}`;
  }
  return d;
}

/** Bậc thang: giữ nguyên mức rồi nhảy — đúng với tồn kho biến động theo phiếu. */
export function stepPath(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` H ${r(points[i].x)} V ${r(points[i].y)}`;
  }
  return d;
}

/**
 * Bezier bậc ba với tiếp tuyến ngang tại mỗi mốc.
 *
 * Mỗi đoạn có hai điểm điều khiển đặt ở 1/3 và 2/3 bề ngang, giữ nguyên
 * chiều cao của hai đầu đoạn. Hai hệ quả:
 *
 *  - Đường KHÔNG vọt quá dữ liệu. Bao lồi của bốn điểm điều khiển nằm gọn
 *    giữa hai mốc, nên khúc giữa không bao giờ cao hơn mốc cao hơn hay thấp
 *    hơn mốc thấp hơn — biểu đồ tồn kho không vẽ ra số âm trong khi kho
 *    chưa bao giờ âm.
 *  - Đường đi ngang đúng ngay tại mỗi mốc rồi mới chuyển hướng. Với số liệu
 *    ghi theo phiếu (tồn kho, thu chi từng ngày) đó là cách đọc đúng: mức
 *    giữ nguyên tới lúc có phiếu kế tiếp, chỉ là bo tròn chỗ chuyển thay vì
 *    gãy vuông góc.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${r(points[0].x)} ${r(points[0].y)}`;

  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const third = (to.x - from.x) / 3;
    d +=
      ` C ${r(from.x + third)} ${r(from.y)}` +
      ` ${r(to.x - third)} ${r(to.y)}` +
      ` ${r(to.x)} ${r(to.y)}`;
  }
  return d;
}

export type Interpolation = 'linear' | 'step' | 'smooth';

export function linePath(points: Point[], interpolation: Interpolation): string {
  if (interpolation === 'step') return stepPath(points);
  if (interpolation === 'smooth') return smoothPath(points);
  return linearPath(points);
}

/** Khép đường thành mảng tô: thả xuống đáy, chạy ngược về đầu, đóng lại. */
export function areaPath(line: string, points: Point[], baselineY: number): string {
  if (!line || points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${r(last.x)} ${r(baselineY)} L ${r(first.x)} ${r(baselineY)} Z`;
}

/** '#2E6F40' + 0.18 → 'rgba(46,111,64,0.18)'. Chuỗi lạ thì trả lại nguyên. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return color;
  const body = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
  const value = parseInt(body, 16);
  // eslint-disable-next-line no-bitwise
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
