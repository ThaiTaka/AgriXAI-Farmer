/**
 * V2.1 — lịch sử trồng trọt, phía điện thoại. Cùng con số với
 * backend/tests/test_v21_cultivation.py: hai bản tính phải ra một kết quả.
 */

import type {CycleLike} from '../src/domain/cultivation';
import {
  costPerKg,
  cycleSeason,
  nextSeason,
  plotCosts,
  productivity,
  recommendCrops,
  seasonLabel,
  seasonOf,
  suggestCycleName,
  vnNumber,
  yearOf,
} from '../src/domain/cultivation';
import {cropNameOf} from '../src/utils/staticData';

/** 08:00 Hà Nội time on a given day, as epoch ms. */
const ms = (day: string, time = '08:00') => Date.parse(`${day}T${time}:00+07:00`);

let n = 0;
function cycle(cropType: string, start: string, end: string | null, yieldKg: number | null, areaM2 = 1000, extra: Partial<CycleLike> = {}): CycleLike {
  n += 1;
  return {
    id: `c${n}`,
    name: `${cropType} ${start}`,
    cropType,
    startedAt: ms(start),
    endedAt: end ? ms(end) : null,
    yieldKg,
    areaM2,
    ...extra,
  };
}

describe('seasons', () => {
  test('follow the sowing month in Vietnam time', () => {
    expect(seasonOf(ms('2025-01-01'))).toBe('spring');
    expect(seasonOf(ms('2025-03-31'))).toBe('spring');
    expect(seasonOf(ms('2025-04-01'))).toBe('summer');
    expect(seasonOf(ms('2025-09-30'))).toBe('autumn');
    expect(seasonOf(ms('2025-12-31'))).toBe('winter');
    // 00:30 on 1 April in Hà Nội is still 31 March in UTC.
    expect(seasonOf(ms('2025-04-01', '00:30'))).toBe('summer');
    expect(yearOf(ms('2026-01-01', '00:30'))).toBe(2026);
  });

  test('labels and the season that comes next', () => {
    expect(seasonLabel('spring', 2025)).toBe('Vụ Xuân 2025');
    expect(seasonLabel('winter')).toBe('Vụ Đông');
    expect(seasonLabel('???')).toBe('Vụ');
    expect(nextSeason(ms('2026-09-24'))).toBe('winter');
    expect(nextSeason(ms('2026-11-01'))).toBe('spring');
  });

  test('a stored season wins over the month; a junk one does not', () => {
    expect(cycleSeason(cycle('tomato', '2025-09-28', null, null, 1, {season: 'winter'}))).toBe('winter');
    expect(cycleSeason(cycle('tomato', '2025-09-28', null, null, 1, {season: 'mua mua'}))).toBe('autumn');
  });

  test('suggested cycle name', () => {
    expect(suggestCycleName('spring', ms('2026-02-03'), 'Cà chua')).toBe('Vụ Xuân 2026 — Cà chua');
  });
});

describe('productivity', () => {
  test('is kg per 1.000 m²', () => {
    expect(productivity(1380, 300)).toBe(4600);
    expect(productivity(80, 1000)).toBe(80);
    expect(productivity(null, 300)).toBeNull();
    expect(productivity(100, 0)).toBeNull();
    expect(productivity(0, 300)).toBeNull();
  });

  test('Vietnamese number format', () => {
    expect(vnNumber(4600)).toBe('4.600');
    expect(vnNumber(82.5)).toBe('82,5');
    expect(vnNumber(1234567)).toBe('1.234.567');
    expect(vnNumber(-1500)).toBe('-1.500');
  });
});

describe('recommendCrops', () => {
  test("the prompt's case: carrot 80, potato 90 → potato first", () => {
    const cycles = [
      cycle('carrot', '2024-02-01', '2024-05-01', 80),
      cycle('potato', '2025-02-01', '2025-05-01', 90, 1000, {cropName: 'Khoai tây'}),
      cycle('cabbage', '2025-10-01', '2026-01-10', 3000),
    ];
    const spring = recommendCrops(cycles, 'spring', cropNameOf);
    expect(spring.map(s => s.cropType)).toEqual(['potato', 'carrot']);
    expect(spring[0].cropName).toBe('Khoai tây');
    expect(spring[1].cropName).toBe('Cà rốt');
    expect(spring[0].basis).toBe('same_season');
    expect(spring[0].reason.startsWith('Năng suất tốt nhất trên lô này trong vụ xuân: 90 kg/1.000 m²')).toBe(true);

    const summer = recommendCrops(cycles, 'summer', cropNameOf);
    expect(summer[0].cropType).toBe('cabbage');
    expect(new Set(summer.map(s => s.basis))).toEqual(new Set(['all_seasons']));
    expect(summer[0].reason.startsWith('Lô chưa có vụ hè nào ghi sản lượng')).toBe(true);
  });

  test('averages repeat seasons and skips unusable ones', () => {
    const cycles = [
      cycle('tomato', '2025-02-05', '2025-05-25', 1380, 300, {name: 'Xuân 2025 — Cà chua'}),
      cycle('tomato', '2026-02-03', '2026-06-05', 1230, 300, {name: 'Xuân 2026 — Cà chua'}),
      cycle('cucumber', '2024-02-01', '2024-04-01', null, 300),
      cycle('corn', '2026-01-10', null, null, 300), // still growing
      cycle('chili', '2025-01-10', '2025-04-01', 500, 0), // no area
    ];
    const [tomato, ...rest] = recommendCrops(cycles, 'spring', cropNameOf);
    expect(rest).toEqual([]);
    expect(tomato.cycles).toBe(2);
    expect(tomato.avgProductivity).toBe(4350);
    expect(tomato.bestProductivity).toBe(4600);
    expect(tomato.bestCycleName).toBe('Xuân 2025 — Cà chua');
    expect(tomato.history.map(h => h.year)).toEqual([2025, 2026]);
  });

  test('ties go to the crop with more seasons, then the more recent', () => {
    const cycles = [
      cycle('corn', '2022-02-01', '2022-05-01', 100),
      cycle('rice', '2025-02-01', '2025-05-01', 100),
      cycle('rice', '2024-02-01', '2024-05-01', 100),
    ];
    expect(recommendCrops(cycles, null).map(s => s.cropType)).toEqual(['rice', 'corn']);
  });

  test('nothing to learn from yet', () => {
    expect(recommendCrops([], 'spring')).toEqual([]);
  });
});

describe('plotCosts', () => {
  const plot = 'lo-1';
  const expenses = [
    {kind: 'seed', amount: 250_000, occurredAt: ms('2026-09-05'), plotId: plot},
    {kind: 'labor', amount: 300_000, occurredAt: ms('2026-09-05'), plotId: plot},
    {kind: 'utilities', amount: 50_000, occurredAt: ms('2026-09-05'), plotId: plot},
    {kind: 'fertilizer', amount: 100_000, occurredAt: ms('2026-09-05'), plotId: plot},
    // Bought for the shed: counted when issued, not here.
    {kind: 'fertilizer', amount: 680_000, occurredAt: ms('2026-09-01'), plotId: plot, warehouseInId: 'in-1'},
    {kind: 'seed', amount: 999, occurredAt: ms('2026-09-05'), plotId: 'lo-khac'},
  ];
  const issues = [
    {totalCost: 136_000, occurredAt: ms('2026-09-06'), plotId: plot},
    {totalCost: 1, occurredAt: ms('2026-09-06'), plotId: 'lo-khac'},
  ];

  test('is seed + fertiliser (as issued) + labour + other', () => {
    expect(plotCosts(expenses, issues, plot)).toEqual({
      seed: 250_000,
      fertilizer: 236_000,
      labor: 300_000,
      other: 50_000,
      total: 836_000,
    });
  });

  test('respects the window', () => {
    expect(plotCosts(expenses, issues, plot, null, ms('2026-09-04')).total).toBe(0);
    expect(plotCosts(expenses, issues, plot, ms('2026-09-06', '00:00')).fertilizer).toBe(136_000);
  });

  test('cost per kg', () => {
    expect(costPerKg(836_000, 1000)).toBe(836);
    expect(costPerKg(836_000, null)).toBeNull();
    expect(costPerKg(0, 1000)).toBeNull();
  });
});
