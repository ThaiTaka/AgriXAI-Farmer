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
 * White card, 1px gray hairline, shadow-sm, 12pt radius.
 * Selected = green border + soft green ground. No heavy shadows.
 *
 * A pressable card answers the touch the way the dashboard cards do: down to
 * 0.98 and up to shadow-md. The transform is static rather than animated —
 * these render in lists, and one Animated.Value per row buys nothing the eye
 * can catch in 150ms.
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
      style={({pressed}) => [base, pressed && styles.lifted, pressed && !selected && styles.pressed]}>
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
  lifted: {
    ...shadows.md,
    transform: [{scale: 0.98}],
  },
});
