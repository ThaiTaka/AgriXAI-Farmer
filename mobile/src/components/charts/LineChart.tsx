import React, {useMemo, useState} from 'react';
import type {GestureResponderEvent, LayoutChangeEvent} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Path, Rect, Text as SvgText} from 'react-native-svg';

import {colors, radius, space, text} from '../../theme';
import {niceScale} from './axis';
import type {Interpolation} from './curve';
import {areaPath, linePath, withAlpha} from './curve';
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
  /**
   * 'smooth' cho đường xu hướng (Hermite đơn điệu — cong nhưng không vọt quá
   * số liệu), 'step' khi muốn thấy rõ từng cú nhảy, 'linear' là gấp khúc.
   */
  interpolation?: Interpolation;
  /** Tô mảng dưới đường. Mặc định bật khi chỉ có một đường. */
  area?: boolean;
  emptyText?: string;
  testID?: string;
}

const PAD = {top: 14, right: 12, bottom: 26};
const AXIS_FONT = 11;
/** Bề ngang trung bình một ký tự ở cỡ trên — đủ để chừa máng cho trục Y. */
const AXIS_CHAR_W = 0.58;
const TICKS = 5;

/**
 * Time-series chart: a 2px line over a soft fill, ≥8px markers with a 2px
 * surface ring, and a real y-axis gutter — the labels sit beside the plot
 * instead of floating over the line. Touching the plot snaps a crosshair to
 * the nearest x and lists every series' value in the readout above the plot,
 * so the reader aims at a date, not at a line. Legend appears only for ≥2
 * series — a single series is named by the card title.
 */
export function LineChart({
  series,
  height = 200,
  formatY,
  formatX,
  interpolation = 'linear',
  area,
  emptyText,
  testID,
}: Props) {
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);

  const xs = useMemo(() => {
    const all = new Set<number>();
    for (const s of series) for (const p of s.points) all.add(p.x);
    return [...all].sort((a, b) => a - b);
  }, [series]);

  const yMax = useMemo(() => Math.max(0, ...series.flatMap(s => s.points.map(p => p.y))), [series]);
  const yMin = useMemo(() => Math.min(0, ...series.flatMap(s => s.points.map(p => p.y))), [series]);

  const xMin = xs[0] ?? 0;
  const xMax = xs[xs.length - 1] ?? 1;
  const spanX = Math.max(1, xMax - xMin);

  // Thang Y nới ra tới mốc tròn số: đường kẻ trên cùng và dưới cùng đúng bằng
  // mép khung, nhãn ngắn, và phần vẽ không còn bị dồn vào một góc.
  const scale = useMemo(() => niceScale(yMin, yMax, TICKS), [yMin, yMax]);
  const spanY = Math.max(1, scale.max - scale.min);
  const gridValues = scale.ticks;
  const yLabels = gridValues.map(formatY);

  // Máng trục Y rộng đúng bằng nhãn dài nhất: "1.500.000₫" không còn nằm đè
  // lên đường, mà cũng không ăn hết bề ngang trên máy 320pt.
  const longest = Math.max(...yLabels.map(label => label.length));
  const gutter = Math.min(
    Math.max(26, Math.ceil(longest * AXIS_FONT * AXIS_CHAR_W) + 8),
    Math.max(26, width * 0.42),
  );

  const plotW = Math.max(0, width - gutter - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const sx = (x: number) => gutter + (xs.length === 1 ? plotW / 2 : ((x - xMin) / spanX) * plotW);
  const sy = (y: number) => PAD.top + plotH - ((y - scale.min) / spanY) * plotH;

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
  const filled = area ?? series.length === 1;

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
        <Text style={text('bodySm', colors.text.secondary)}>
          {focusX !== null ? formatX(focusX) : `${formatX(xMin)} → ${formatX(xMax)}`}
        </Text>
        <View style={styles.readoutValues}>
          {series.map(s => {
            const point = focusX !== null ? s.points.find(p => p.x === focusX) : s.points[s.points.length - 1];
            return (
              <View key={s.key} style={styles.readoutItem}>
                <View style={[styles.key, {backgroundColor: s.color}]} />
                <Text style={text('bodyStrong')}>{point ? formatY(point.y) : '—'}</Text>
                {series.length > 1 ? <Text style={text('bodySm', colors.text.secondary)}>{s.label}</Text> : null}
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
              <Line key={i} x1={gutter} x2={gutter + plotW} y1={sy(v)} y2={sy(v)} stroke={CHART.grid} strokeWidth={1} />
            ))}
            {/* Nhãn trục Y nằm trong máng bên trái, canh giữa theo đường kẻ. */}
            {gridValues.map((v, i) => (
              <SvgText
                key={`t${i}`}
                x={gutter - 6}
                y={sy(v) + AXIS_FONT / 3}
                fontSize={AXIS_FONT}
                fill={CHART.label}
                textAnchor="end">
                {yLabels[i]}
              </SvgText>
            ))}
            <Line x1={gutter} x2={gutter} y1={PAD.top} y2={PAD.top + plotH} stroke={CHART.axis} strokeWidth={1} />

            <SvgText x={gutter} y={height - 6} fontSize={AXIS_FONT} fill={CHART.label}>
              {formatX(xMin)}
            </SvgText>
            {xs.length > 1 ? (
              <SvgText x={gutter + plotW} y={height - 6} fontSize={AXIS_FONT} fill={CHART.label} textAnchor="end">
                {formatX(xMax)}
              </SvgText>
            ) : null}

            {focusX !== null ? (
              <Line
                x1={sx(focusX)}
                x2={sx(focusX)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke={CHART.crosshair}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}

            {series.map(s => {
              const pts = [...s.points].sort((a, b) => a.x - b.x);
              if (pts.length === 0) return null;
              const screen = pts.map(p => ({x: sx(p.x), y: sy(p.y)}));
              const d = linePath(screen, interpolation);
              const showMarkers = screen.length <= 16;
              return (
                <React.Fragment key={s.key}>
                  {filled ? <Path d={areaPath(d, screen, sy(scale.min))} fill={withAlpha(s.color, 0.16)} /> : null}
                  <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  {showMarkers
                    ? pts.map((p, i) => (
                        <Circle
                          key={p.x}
                          cx={screen[i].x}
                          cy={screen[i].y}
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
              <Text style={text('bodySm', colors.text.secondary)}>{s.label}</Text>
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
