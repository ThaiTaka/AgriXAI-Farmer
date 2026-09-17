import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, size, space, text} from '../theme';
import {CheckIcon} from './icons';

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Label + box. The whole row is the target, not just the 22pt box, so it
 * clears the 48pt field minimum with muddy hands (§3.4).
 */
export function Checkbox({label, checked, onChange, disabled = false, style, testID}: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{checked, disabled}}
      accessibilityLabel={label}
      style={({pressed}) => [styles.row, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <CheckIcon size={14} color={colors.primary.onPrimary} /> : null}
      </View>
      <Text style={text('bodySm', colors.text.secondary)} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.minTouchTarget,
    borderRadius: radius.xs,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  disabled: {
    opacity: 0.5,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
});
