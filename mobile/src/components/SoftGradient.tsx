import React, {useMemo} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';

import {colors} from '../theme';

/**
 * The one sanctioned gradient in the system (v6 `color.gradient`), used as the
 * login ground.
 *
 * It is drawn as N stacked bands of interpolated colour rather than with
 * `react-native-linear-gradient`: that native module was removed in v5 and
 * re-adding it for one background would mean a native rebuild for every
 * developer. The two stops are one step apart on the gray ramp (#F8F9FA ->
 * #F0F4F8), so even at 12 bands the steps are well under one perceptible
 * shade and the result reads as a flat tint, not a gradient.
 */

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** "#F8F9FA" -> [248, 249, 250]. Throws on anything else so a bad token is loud. */
export function parseHex(value: string): [number, number, number] {
  const m = HEX.exec(value.trim());
  if (!m) throw new Error(`SoftGradient expects #RRGGBB, got: ${value}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Colour `ratio` of the way from `from` to `to` (0 = from, 1 = to). */
export function mixHex(from: string, to: string, ratio: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const clamped = Math.min(1, Math.max(0, ratio));
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * clamped);
  return (
    '#' +
    [channel(0), channel(1), channel(2)]
      .map(n => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** The band colours, top to bottom. Exported so a test can assert the ramp. */
export function bandColors(from: string, to: string, bands: number): string[] {
  const count = Math.max(1, Math.floor(bands));
  if (count === 1) return [from];
  return Array.from({length: count}, (_, i) => mixHex(from, to, i / (count - 1)));
}

interface Props {
  children?: React.ReactNode;
  from?: string;
  to?: string;
  bands?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SoftGradient({
  children,
  from = colors.gradient.groundFrom,
  to = colors.gradient.groundTo,
  bands = 12,
  style,
  testID,
}: Props) {
  const ramp = useMemo(() => bandColors(from, to, bands), [from, to, bands]);

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ramp.map((color, index) => (
          <View key={`${color}-${index}`} style={[styles.band, {backgroundColor: color}]} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  band: {
    flex: 1,
  },
});
