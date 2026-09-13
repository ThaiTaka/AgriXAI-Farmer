import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, View} from 'react-native';

import {colors, radius, shadows, space} from '../theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Makes the whole card a touch target; pressed state is a subtle gray fill. */
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Drop the default 16pt padding (for cards that manage their own rows). */
  flush?: boolean;
}

/**
 * White card, 1px gray hairline, shadow-sm, 14pt radius.
 * Selected = green border + soft green ground. No gradients, no heavy shadows.
 */
export function Card({
  children,
  style,
  onPress,
  selected = false,
  accessibilityLabel,
  testID,
  flush = false,
}: Props) {
  const base = [styles.card, !flush && styles.padded, selected && styles.selected, style];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected}}
      style={({pressed}) => [base, pressed && !selected && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm,
  },
  padded: {
    padding: space.lg,
  },
  selected: {
    borderColor: colors.border.selected,
    backgroundColor: colors.surface.selected,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
});
