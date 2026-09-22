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
 * Cubic Hermite đơn điệu (Fritsch–Carlson, 1980).
 *
 * Cong mượt nhưng KHÔNG vọt quá dữ liệu: giữa hai mốc, đường không bao giờ
 * cao hơn mốc cao hơn hay thấp hơn mốc thấp hơn. Với biểu đồ tồn kho điều đó
 * quan trọng — một đường Bezier thường có thể vẽ ra số tồn âm ở khúc giữa
 * trong khi kho chưa bao giờ âm.
 */
export function smoothPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return linearPath(points);

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1].x - points[i].x;
    dx.push(h);
    slope.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h);
  }

  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] * slope[i] <= 0) {
      // Đổi chiều hoặc đi ngang: tiếp tuyến phẳng, không vẽ bướu.
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d +=
      ` C ${r(points[i].x + h)} ${r(points[i].y + m[i] * h)}` +
      ` ${r(points[i + 1].x - h)} ${r(points[i + 1].y - m[i + 1] * h)}` +
      ` ${r(points[i + 1].x)} ${r(points[i + 1].y)}`;
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
