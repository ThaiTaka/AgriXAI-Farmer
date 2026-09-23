import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

import {colors, radius, space, text} from '../theme';

export type BadgeTone = 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';

const TONES: Record<BadgeTone, {bg: string; fg: string}> = {
  gray: {bg: colors.badge.grayBg, fg: colors.badge.grayFg},
  green: {bg: colors.badge.greenBg, fg: colors.badge.greenFg},
  yellow: {bg: colors.badge.yellowBg, fg: colors.badge.yellowFg},
  red: {bg: colors.badge.redBg, fg: colors.badge.redFg},
  blue: {bg: colors.badge.blueBg, fg: colors.badge.blueFg},
  purple: {bg: colors.badge.purpleBg, fg: colors.badge.purpleFg},
};

interface Props {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  /**
   * 'outline' (mặc định) — pill có viền mảnh, dùng cho trạng thái.
   * 'quiet'   — không viền, nền xám phẳng: dùng cho NHÃN đọc-để-biết đứng
   *             cạnh một nút bấm. Viền + bo góc làm nhãn trông y như nút,
   *             bà con bấm mãi không thấy gì xảy ra.
   */
  variant?: 'outline' | 'quiet';
  style?: StyleProp<ViewStyle>;
}

/** Small soft-coloured pill for status words. Pastel fill, dark text of the same hue. */
export function Badge({label, tone = 'gray', icon, variant = 'outline', style}: Props) {
  const t = TONES[tone];
  const quiet = variant === 'quiet';
  return (
    <View
      accessibilityRole="text"
      style={[
        styles.badge,
        {backgroundColor: t.bg, borderColor: t.fg},
        quiet && styles.quiet,
        style,
      ]}>
      {icon}
      <Text style={text('badge', t.fg)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    // A hairline of the text colour at 1pt: enough to define the pill on a
    // white card without turning the soft fill into a loud chip.
    borderWidth: 1,
    maxWidth: '100%',
  },
  quiet: {
    borderWidth: 0,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
  },
});
