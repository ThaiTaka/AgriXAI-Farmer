/**
 * Chia trục Y thành những mốc tròn số.
 *
 * Chia đều khoảng dữ liệu cho sẵn (0 → 100 thành bốn phần) ra những con số
 * như 33,333 — nhãn dài ngoằng, đọc xong không nhớ nổi, mà lại ăn hết bề
 * ngang dành cho phần vẽ. Ở đây bước nhảy luôn là 1 / 2 / 2,5 / 5 nhân với
 * một luỹ thừa của mười, và hai đầu thang được nới ra cho trùng mốc, nên
 * đường kẻ trên cùng và dưới cùng chính là đỉnh và đáy khung.
 */

const NICE_STEPS = [1, 2, 2.5, 5, 10];

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/** Cắt nhiễu dấu phẩy động sau khi cộng dồn bước nhảy. */
function clean(value: number): number {
  return Number(value.toPrecision(12));
}

export function niceScale(min: number, max: number, count = 5): Scale {
  const target = Math.max(2, Math.round(count));
  const lo = Math.min(min, max);
  let hi = Math.max(min, max);
  // Mọi số liệu bằng nhau (kho trống suốt kỳ): vẫn phải có khung để vẽ.
  if (!(hi > lo)) hi = lo + 1;

  const rawStep = (hi - lo) / (target - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  const step = (NICE_STEPS.find(n => normalised <= n + 1e-9) ?? 10) * magnitude;

  const start = Math.floor(lo / step) * step;
  const steps = Math.max(1, Math.round((Math.ceil(hi / step) * step - start) / step));
  const ticks: number[] = [];
  for (let i = 0; i <= steps; i += 1) ticks.push(clean(start + i * step));

  return {min: ticks[0], max: ticks[ticks.length - 1], ticks};
}
