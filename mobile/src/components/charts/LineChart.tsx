import React, {useMemo, useState} from 'react';
import type {GestureResponderEvent, LayoutChangeEvent} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Path, Rect, Text as SvgText} from 'react-native-svg';

import {colors, radius, space, text} from '../../theme';
import {CHART} from './palette';

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  points: SeriesPoint[];
}

interface Props {
  series: Series[];
  height?: number;
  formatY: (value: number) => string;
  formatX: (value: number) => string;
  /** Step between points: 'linear' for a running level, 'step' for stock that jumps on each movement. */
  interpolation?: 'linear' | 'step';
  emptyText?: string;
  testID?: string;
}

const PAD = {top: 12, right: 12, bottom: 24, left: 8};

/**
 * Time-series line chart: 2px lines, ≥8px markers with a 2px surface ring,
 * three recessive gridlines, one axis. Touching the plot snaps a crosshair
 * to the nearest x and lists every series' value in the readout above the
 * plot, so the reader aims at a date, not at a line. Legend appears only
 * for ≥2 series — a single series is named by the card title.
 */
export function LineChart({series, height = 180, formatY, formatX, interpolation = 'linear', emptyText, testID}: Props) {
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);

  const xs = useMemo(() => {
    const all = new Set<number>();
    for (const s of series) for (const p of s.points) all.add(p.x);
    return [...all].sort((a, b) => a - b);
  }, [series]);

  const yMax = useMemo(() => Math.max(0, ...series.flatMap(s => s.points.map(p => p.y))), [series]);
  const yMin = useMemo(() => Math.min(0, ...series.flatMap(s => s.points.map(p => p.y))), [series]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);
  const xMin = xs[0] ?? 0;
  const xMax = xs[xs.length - 1] ?? 1;
  const spanX = Math.max(1, xMax - xMin);
  const spanY = Math.max(1, yMax - yMin);

  const sx = (x: number) => PAD.left + (xs.length === 1 ? plotW / 2 : ((x - xMin) / spanX) * plotW);
  const sy = (y: number) => PAD.top + plotH - ((y - yMin) / spanY) * plotH;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pick = (e: GestureResponderEvent) => {
    if (xs.length === 0 || plotW === 0) return;
    const px = e.nativeEvent.locationX;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    xs.forEach((x, i) => {
      const d = Math.abs(sx(x) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setFocus(best);
  };

  const focusX = focus !== null ? xs[focus] : null;
  const gridValues = [yMin, yMin + spanY / 2, yMax];

  if (xs.length === 0) {
    return (
      <View style={[styles.empty, {height}]} testID={testID}>
        <Text style={text('bodySm', colors.text.muted)}>{emptyText ?? 'Chưa có số liệu để vẽ.'}</Text>
      </View>
    );
  }

  return (
    <View testID={testID}>
      {/* Readout: every series at the focused x. Values lead, labels follow. */}
      <View style={styles.readout}>
        <Text style={text('caption', colors.text.muted)}>
          {focusX !== null ? formatX(focusX) : `${formatX(xMin)} → ${formatX(xMax)}`}
        </Text>
        <View style={styles.readoutValues}>
          {series.map(s => {
            const point = focusX !== null ? s.points.find(p => p.x === focusX) : s.points[s.points.length - 1];
            return (
              <View key={s.key} style={styles.readoutItem}>
                <View style={[styles.key, {backgroundColor: s.color}]} />
                <Text style={text('bodyStrong')}>{point ? formatY(point.y) : '—'}</Text>
                {series.length > 1 ? <Text style={text('caption', colors.text.muted)}>{s.label}</Text> : null}
              </View>
            );
          })}
        </View>
      </View>

      <View
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setFocus(null)}
        style={{height}}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {gridValues.map((v, i) => (
              <Line key={i} x1={PAD.left} x2={PAD.left + plotW} y1={sy(v)} y2={sy(v)} stroke={CHART.grid} strokeWidth={1} />
            ))}
            {gridValues.map((v, i) => (
              <SvgText key={`t${i}`} x={PAD.left + plotW} y={sy(v) - 4} fontSize={10} fill={CHART.label} textAnchor="end">
                {formatY(v)}
              </SvgText>
            ))}
            <SvgText x={PAD.left} y={height - 6} fontSize={10} fill={CHART.label}>
              {formatX(xMin)}
            </SvgText>
            {xs.length > 1 ? (
              <SvgText x={PAD.left + plotW} y={height - 6} fontSize={10} fill={CHART.label} textAnchor="end">
                {formatX(xMax)}
              </SvgText>
            ) : null}

            {focusX !== null ? (
              <Line x1={sx(focusX)} x2={sx(focusX)} y1={PAD.top} y2={PAD.top + plotH} stroke={CHART.crosshair} strokeWidth={1} strokeDasharray="3 3" />
            ) : null}

            {series.map(s => {
              const pts = [...s.points].sort((a, b) => a.x - b.x);
              if (pts.length === 0) return null;
              let d = `M ${sx(pts[0].x)} ${sy(pts[0].y)}`;
              for (let i = 1; i < pts.length; i += 1) {
                if (interpolation === 'step') d += ` H ${sx(pts[i].x)} V ${sy(pts[i].y)}`;
                else d += ` L ${sx(pts[i].x)} ${sy(pts[i].y)}`;
              }
              const showMarkers = pts.length <= 16;
              return (
                <React.Fragment key={s.key}>
                  <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  {showMarkers
                    ? pts.map(p => (
                        <Circle
                          key={p.x}
                          cx={sx(p.x)}
                          cy={sy(p.y)}
                          r={p.x === focusX ? 6 : 4}
                          fill={s.color}
                          stroke={CHART.surface}
                          strokeWidth={2}
                        />
                      ))
                    : null}
                </React.Fragment>
              );
            })}
            <Rect x={0} y={0} width={width} height={height} fill="transparent" />
          </Svg>
        ) : null}
      </View>

      {series.length > 1 ? (
        <View style={styles.legend}>
          {series.map(s => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.key, {backgroundColor: s.color}]} />
              <Text style={text('caption', colors.text.secondary)}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface.subtle,
  },
  readout: {
    marginBottom: space.sm,
    gap: 2,
  },
  readoutValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
  },
  readoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  key: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    marginTop: space.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
});
