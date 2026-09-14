import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import {colors, space, text} from '../../theme';
import {CHART} from './palette';

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  formatValue: (value: number) => string;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  testID?: string;
}

/**
 * Part-to-whole for a handful of categories (≤ 6). Slices carry a 2px
 * surface gap; identity is never colour-alone — the legend beside the ring
 * lists label, value and share, so every number is readable without touching
 * the chart.
 */
export function DonutChart({slices, formatValue, size = 132, centerLabel, centerValue, testID}: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2;
  const ring = 18;
  const rOuter = r - 2;
  const rInner = rOuter - ring;

  let angle = -Math.PI / 2;
  const paths = slices
    .filter(s => s.value > 0)
    .map(s => {
      const sweep = total > 0 ? (s.value / total) * Math.PI * 2 : 0;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return {key: s.key, color: s.color, d: arcPath(r, r, rOuter, rInner, start, end)};
    });

  return (
    <View style={styles.row} testID={testID}>
      <View style={{width: size, height: size}}>
        <Svg width={size} height={size}>
          {total <= 0 ? <Circle cx={r} cy={r} r={rOuter - ring / 2} stroke={CHART.grid} strokeWidth={ring} fill="none" /> : null}
          {paths.map(p => (
            <Path key={p.key} d={p.d} fill={p.color} stroke={CHART.surface} strokeWidth={2} strokeLinejoin="round" />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          {centerValue ? (
            <Text style={text('meta')} numberOfLines={1}>
              {centerValue}
            </Text>
          ) : null}
          {centerLabel ? (
            <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
              {centerLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map(s => (
          <View key={s.key} style={styles.legendRow}>
            <View style={[styles.swatch, {backgroundColor: s.color}]} />
            <View style={styles.legendBody}>
              <Text style={text('bodySm', colors.text.secondary)} numberOfLines={1}>
                {s.label}
              </Text>
              <View style={styles.legendValue}>
                <Text style={text('bodyStrong')}>{formatValue(s.value)}</Text>
                <Text style={text('caption', colors.text.muted)}>
                  {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
  // A full circle cannot be drawn with one arc: nudge the end back a hair.
  const sweep = end - start;
  const e = sweep >= Math.PI * 2 - 1e-6 ? end - 1e-4 : end;
  const large = e - start > Math.PI ? 1 : 0;
  const x1 = cx + rOuter * Math.cos(start);
  const y1 = cy + rOuter * Math.sin(start);
  const x2 = cx + rOuter * Math.cos(e);
  const y2 = cy + rOuter * Math.sin(e);
  const x3 = cx + rInner * Math.cos(e);
  const y3 = cy + rInner * Math.sin(e);
  const x4 = cx + rInner * Math.cos(start);
  const y4 = cy + rInner * Math.sin(start);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  legend: {
    flex: 1,
    minWidth: 0,
    gap: space.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginTop: 6,
  },
  legendBody: {
    flex: 1,
    minWidth: 0,
  },
  legendValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
});
