import React from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {Platform, StyleSheet, Text} from 'react-native';

import {colors} from '../theme';

interface Props {
  children: React.ReactNode;
  /** `xl`/`lg` for the headline figure of a card, `md` for row values, `sm` for captions. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}

/**
 * Figures the farmer reads at a glance — quantities and money — set in a
 * monospace face so digits line up down a column, bold, in the brand green.
 */
export function NumberText({children, size = 'md', color = colors.primary.default, style, numberOfLines, testID}: Props) {
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[styles.base, styles[size], {color}, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Platform.select({ios: 'Courier-Bold', android: 'monospace', default: 'monospace'}),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sm: {
    fontSize: 13,
    lineHeight: 18,
  },
  md: {
    fontSize: 16,
    lineHeight: 22,
  },
  lg: {
    fontSize: 24,
    lineHeight: 30,
  },
  xl: {
    fontSize: 28,
    lineHeight: 34,
  },
});
