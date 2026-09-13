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
  style?: StyleProp<ViewStyle>;
}

/** Small soft-coloured pill for status words. Pastel fill, dark text of the same hue. */
export function Badge({label, tone = 'gray', icon, style}: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, {backgroundColor: t.bg}, style]}>
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
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
});
