import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, motion, radius, shadows, size, space, text} from '../theme';
import {ArrowRight} from './icons';

/**
 * Three button weights, told apart by fill rather than colour:
 *   Primary   — solid green, one per screen.
 *   Secondary — white with a gray hairline, for the alternative action.
 *   Ghost     — transparent, green text, for inline / low-stakes actions.
 * Danger is a soft red variant of Secondary; it never shouts.
 *
 * All of them respect the field minimums (48 pt targets) and show the pressed
 * state as a quieter fill instead of a colour change, plus the same 0.98 dip
 * the cards use so a tap is felt as well as seen.
 */

interface BaseProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Compact height (44) for rows and headers. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  small = false,
  style,
  testID,
  withArrow = false,
}: BaseProps & {withArrow?: boolean}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: inactive, busy: loading}}
      style={({pressed}) => [
        styles.base,
        small && styles.small,
        styles.primary,
        pressed && styles.primaryPressed,
        pressed && styles.dip,
        inactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.primary.onPrimary} />
      ) : (
        <>
          {icon}
          <Text style={text('bodyStrong', colors.primary.onPrimary)}>{label}</Text>
          {withArrow ? (
            <View style={styles.arrow}>
              <ArrowRight size={18} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  small = false,
  style,
  testID,
}: BaseProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: inactive, busy: loading}}
      style={({pressed}) => [
        styles.base,
        small && styles.small,
        styles.secondary,
        pressed && styles.secondaryPressed,
        pressed && styles.dip,
        inactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text.primary} />
      ) : (
        <>
          {icon}
          <Text style={text('bodyStrong', colors.text.primary)}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  disabled = false,
  small = false,
  style,
  testID,
}: BaseProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      style={({pressed}) => [
        styles.base,
        small && styles.small,
        styles.ghost,
        pressed && styles.ghostPressed,
        pressed && styles.dip,
        disabled && styles.inactive,
        style,
      ]}>
      {icon}
      <Text style={text('bodyStrong', colors.primary.default)}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({label, onPress, style, testID}: BaseProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({pressed}) => [styles.base, styles.danger, pressed && styles.dangerPressed, pressed && styles.dip, style]}>
      <Text style={text('bodyStrong', colors.badge.redFg)}>{label}</Text>
    </Pressable>
  );
}

interface IconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 44×44 transparent square — back arrow, close, edit pencil. */
export function IconButton({onPress, children, accessibilityLabel, style, testID}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({pressed}) => [styles.iconButton, pressed && styles.iconButtonPressed, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.buttonMinHeight,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  small: {
    minHeight: size.buttonMinHeightSm,
    paddingHorizontal: space.md,
  },
  inactive: {
    opacity: 0.5,
  },
  /** Shared press dip — the same 0.98 the cards use, so every tap feels alike. */
  dip: {
    transform: [{scale: 0.98}],
  },
  primary: {
    backgroundColor: colors.primary.default,
    ...shadows.sm,
  },
  primaryPressed: {
    backgroundColor: colors.primary.pressed,
    ...shadows.md,
  },
  arrow: {
    marginLeft: space.xs,
  },
  secondary: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  secondaryPressed: {
    backgroundColor: colors.surface.pressed,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: colors.primary.soft,
  },
  danger: {
    backgroundColor: colors.badge.redBg,
  },
  dangerPressed: {
    opacity: motion.pressOpacity,
  },
  iconButton: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconButtonPressed: {
    backgroundColor: colors.surface.pressed,
  },
});
