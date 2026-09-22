import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';

import {colors, radius} from '../theme';

export type TileTone = 'green' | 'lime' | 'coral' | 'amber';

/** Soft ground per tone. The glyph colour is the caller's business. */
const TONES: Record<TileTone, string> = {
  green: colors.primary.soft,
  lime: colors.accent.limeSoft,
  coral: colors.accent.coralSoft,
  amber: colors.badge.yellowBg,
};

/** The matching glyph colour, for callers that just want the pair. */
export const TILE_ICON_COLOR: Record<TileTone, string> = {
  green: colors.primary.default,
  lime: colors.green['800'],
  coral: colors.semantic.error,
  amber: colors.badge.yellowFg,
};

interface Props {
  children: React.ReactNode;
  tone?: TileTone;
  /** 48 on a summary card, 40 in a list row. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A rounded, tinted square that carries an icon as its own element rather than
 * inline with the text.
 *
 * The lime and coral grounds exist to break up a wall of green — one card in a
 * column of three reads faster than three identical ones. The glyph itself
 * never uses the raw accent: neither #C3D24A nor #FF6B6B clears AA on white,
 * so `TILE_ICON_COLOR` pairs each soft ground with a dark enough ink.
 */
export function IconTile({children, tone = 'green', size = 48, style, testID}: Props) {
  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        {width: size, height: size, backgroundColor: TONES[tone]},
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
