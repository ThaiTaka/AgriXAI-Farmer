/** Formatting helpers, growth-stage inference and the chart/banner edge cases. */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {DonutChart} from '../src/components/charts/DonutChart';
import {LineChart} from '../src/components/charts/LineChart';
import {EXPENSE_KIND_COLOR, SERIES} from '../src/components/charts/palette';
import {
  formatArea,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatVnd,
  formatVndRange,
  formatWeekdayDate,
} from '../src/utils/format';
import {daysSince, inferGrowthStage} from '../src/utils/growthStage';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

describe('format', () => {
  test('numbers, money and ranges', () => {
    expect(formatNumber(1200)).toBe('1.200');
    expect(formatNumber(2.345)).toBe('2,35');
    expect(formatVnd(125_500)).toBe('125.500₫');
    expect(formatVndRange(610_000, 690_000)).toBe('610.000 – 690.000₫');
    expect(formatVndRange(500, 500)).toBe('500₫');
    expect(formatArea(1200, 'm2')).toBe('1.200 m²');
    expect(formatArea(1.5, 'ha')).toBe('1,5 ha');
    expect(formatArea(0, 'm2')).toBe('—');
  });

  test('dates', () => {
    const d = new Date(2026, 8, 14, 9, 5);
    expect(formatDate(d)).toBe('14/09/2026');
    expect(formatDate(d.getTime())).toBe('14/09/2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDate(Number.NaN)).toBe('—');
    expect(formatDateTime(d)).toBe('14/09/2026 09:05');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatWeekdayDate(new Date(2026, 8, 14))).toBe('Thứ Hai, 14/09');
  });

  test('relative dates', () => {
    const now = Date.now();
    expect(formatRelative(null)).toBe('—');
    expect(formatRelative(now + 60_000)).toBe(formatDate(now + 60_000));
    expect(formatRelative(now - 10_000)).toBe('vừa xong');
    expect(formatRelative(now - 5 * 60_000)).toBe('5 phút trước');
    // Noon timestamps: the helper counts calendar days, so midnight edges are avoided here.
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(formatRelative(noon.getTime() - 86_400_000 * 3)).toBe('3 ngày trước');
    expect(formatRelative(noon.getTime() - 86_400_000 * 10)).toBe('1 tuần trước');
    expect(formatRelative(noon.getTime() - 86_400_000 * 45)).toBe(formatDate(noon.getTime() - 86_400_000 * 45));
  });
});

describe('growth stage', () => {
  const now = new Date(2026, 8, 14).getTime();
  test('day thresholds of the MV1 cycle', () => {
    expect(inferGrowthStage(null, now)).toBeNull();
    expect(inferGrowthStage(now - 5 * 86_400_000, now)?.stage).toBe('seedling');
    expect(inferGrowthStage(now - 25 * 86_400_000, now)?.stage).toBe('vegetative');
    expect(inferGrowthStage(now - 50 * 86_400_000, now)?.stage).toBe('flowering');
    expect(inferGrowthStage(now - 70 * 86_400_000, now)?.stage).toBe('fruiting');
    expect(inferGrowthStage(now - 120 * 86_400_000, now)).toEqual({stage: 'harvesting', inferred: true, dayCount: 120});
    expect(daysSince(now + 1000, now)).toBe(0);
  });
});

describe('charts', () => {
  test('palette assigns expense kinds fixed slots', () => {
    expect(EXPENSE_KIND_COLOR.fertilizer).toBe(SERIES[0]);
    expect(EXPENSE_KIND_COLOR.other).toBe(SERIES[3]);
  });

  test('DonutChart with no data draws the empty ring and dashes', () => {
    const tree = render(<DonutChart slices={[{key: 'a', label: 'Phân bón', value: 0, color: SERIES[0]}]} formatValue={formatVnd} centerValue="0" centerLabel="khoản chi" />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('khoản chi');
    expect(json).toContain('—');
  });

  test('LineChart lays out once it has a width and snaps the crosshair on touch', () => {
    const tree = render(
      <LineChart
        series={[{key: 's', label: 'Tồn', color: SERIES[0], points: [{x: 1, y: 100}, {x: 2, y: 80}, {x: 3, y: 60}]}]}
        formatY={v => `${v} kg`}
        formatX={String}
        interpolation="step"
      />,
    );
    const plot = tree.root.findAll(n => typeof n.type === 'string' && typeof n.props.onLayout === 'function')[0];
    ReactTestRenderer.act(() => {
      plot.props.onLayout({nativeEvent: {layout: {width: 300, height: 180}}});
    });
    ReactTestRenderer.act(() => {
      plot.props.onResponderGrant({nativeEvent: {locationX: 150}});
    });
    let json = JSON.stringify(tree.toJSON());
    expect(json).toContain('80 kg');
    ReactTestRenderer.act(() => {
      plot.props.onResponderRelease();
    });
    json = JSON.stringify(tree.toJSON());
    expect(json).toContain('1 → 3');
    expect(json).toContain('60 kg');
  });
});
