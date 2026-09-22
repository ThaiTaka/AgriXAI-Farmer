/** Hình học của biểu đồ: thang trục Y tròn số và các kiểu dựng đường. */

import {niceScale} from '../src/components/charts/axis';
import {areaPath, linePath, linearPath, smoothPath, stepPath, withAlpha} from '../src/components/charts/curve';

describe('niceScale', () => {
  test('nới hai đầu ra mốc tròn số thay vì chia đều số lẻ', () => {
    const scale = niceScale(0, 100, 5);
    expect(scale.ticks).toEqual([0, 25, 50, 75, 100]);
    expect(scale.min).toBe(0);
    expect(scale.max).toBe(100);
  });

  test('bọc lấy dữ liệu: mốc dưới cùng ≤ min, mốc trên cùng ≥ max', () => {
    const scale = niceScale(130, 4_870, 5);
    expect(scale.min).toBeLessThanOrEqual(130);
    expect(scale.max).toBeGreaterThanOrEqual(4_870);
    expect(scale.ticks[0]).toBe(scale.min);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
  });

  test('bước nhảy luôn là 1/2/2,5/5 nhân luỹ thừa mười', () => {
    for (const [min, max] of [[0, 3], [0, 17], [0, 1_500_000], [-40, 40]] as const) {
      const {ticks} = niceScale(min, max, 5);
      const step = ticks[1] - ticks[0];
      const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 2.5, 5]).toContain(Number(mantissa.toPrecision(6)));
      // Mọi bước đều bằng nhau — không có mốc lệch do nhiễu dấu phẩy động.
      ticks.slice(1).forEach((v, i) => expect(Number((v - ticks[i]).toPrecision(10))).toBe(step));
    }
  });

  test('kho trống suốt kỳ vẫn dựng được khung', () => {
    const scale = niceScale(0, 0, 5);
    expect(scale.max).toBeGreaterThan(scale.min);
    expect(scale.ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('dựng đường', () => {
  const pts = [
    {x: 0, y: 100},
    {x: 50, y: 60},
    {x: 100, y: 80},
  ];

  test('linear nối thẳng, step đi bậc thang', () => {
    expect(linearPath(pts)).toBe('M 0 100 L 50 60 L 100 80');
    expect(stepPath(pts)).toBe('M 0 100 H 50 V 60 H 100 V 80');
    expect(linearPath([])).toBe('');
    expect(stepPath([])).toBe('');
  });

  test('linePath chọn đúng kiểu theo tham số', () => {
    expect(linePath(pts, 'step')).toBe(stepPath(pts));
    expect(linePath(pts, 'smooth')).toBe(smoothPath(pts));
    expect(linePath(pts, 'linear')).toBe(linearPath(pts));
  });

  test('smooth dùng Bezier và dưới ba điểm thì rơi về đường thẳng', () => {
    expect(smoothPath(pts)).toContain(' C ');
    expect(smoothPath(pts).startsWith('M 0 100')).toBe(true);
    expect(smoothPath([pts[0], pts[1]])).toBe(linearPath([pts[0], pts[1]]));
    expect(smoothPath([])).toBe('');
  });

  test('smooth không vọt quá dữ liệu — tồn kho không bị vẽ thành số âm', () => {
    // Đáy phẳng rồi vọt lên: đường cong phải nằm gọn giữa hai mốc.
    const stock = [
      {x: 0, y: 200},
      {x: 30, y: 200},
      {x: 60, y: 0},
      {x: 90, y: 0},
    ];
    const ys = sampleCurve(smoothPath(stock));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.001);
    expect(Math.max(...ys)).toBeLessThanOrEqual(200.001);
  });

  test('areaPath khép đường xuống đáy rồi đóng lại', () => {
    const line = linearPath(pts);
    expect(areaPath(line, pts, 174)).toBe(`${line} L 100 174 L 0 174 Z`);
    expect(areaPath('', pts, 174)).toBe('');
    expect(areaPath(line, [], 174)).toBe('');
  });
});

test('withAlpha đổi mã hex thành rgba, chuỗi lạ thì giữ nguyên', () => {
  expect(withAlpha('#2E6F40', 0.16)).toBe('rgba(46,111,64,0.16)');
  expect(withAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)');
  expect(withAlpha('rgba(1,2,3,1)', 0.2)).toBe('rgba(1,2,3,1)');
});

/** Lấy mọi toạ độ y xuất hiện trong path — điểm mốc lẫn điểm điều khiển. */
function sampleCurve(path: string): number[] {
  return path
    .split(/[A-Z]/)
    .flatMap(segment => segment.trim().split(/\s+/).filter(Boolean).map(Number))
    .filter((_, index) => index % 2 === 1);
}
