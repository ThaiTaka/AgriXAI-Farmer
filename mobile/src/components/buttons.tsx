import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {colors, glass, gradients, radius, shadows, size, spacing, text} from '../theme';
import {ArrowRight} from './icons';

const PRIMARY_COLORS = [...gradients.primaryAction.colors] as string[];
const CONTROL_COLORS = [...glass.control.gradientColors] as string[];

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** The design's pill-with-circular-arrow variant used for the main action. */
  withArrow?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  withArrow = false,
  icon,
  loading = false,
  disabled = false,
  style,
}: PrimaryButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: inactive, busy: loading}}
      style={({pressed}) => [pressed && styles.pressed, inactive && styles.inactive, style]}>
      <LinearGradient
        colors={PRIMARY_COLORS}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[withArrow ? styles.primaryWithArrow : styles.primary, shadows.primaryButton]}>
        {loading ? (
          <ActivityIndicator color={colors.neutral.white} />
        ) : (
          <>
            <Text
              style={[
                text('cardTitle', colors.neutral.white),
                withArrow ? styles.primaryLabelLeft : styles.primaryLabelCenter,
              ]}>
              {label}
            </Text>
            {withArrow ? (
              <View style={styles.arrowCircle}>{icon ?? <ArrowRight />}</View>
            ) : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

interface GhostButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/** The translucent pill used for secondary actions ("Huỷ", "Chụp lại"...). */
export function GhostButton({label, onPress, icon, style, disabled = false}: GhostButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      style={({pressed}) => [pressed && styles.pressed, disabled && styles.inactive, style]}>
      <LinearGradient
        colors={CONTROL_COLORS}
        start={glass.control.gradientStart}
        end={glass.control.gradientEnd}
        style={styles.ghost}>
        {icon}
        <Text style={text('bodySm', colors.text.primary)}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

interface IconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** 44×44 rounded glass square — back arrow, edit pencil, share. */
export function IconButton({onPress, children, accessibilityLabel, style}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({pressed}) => [pressed && styles.pressed, style]}>
      <LinearGradient
        colors={CONTROL_COLORS}
        start={glass.control.gradientStart}
        end={glass.control.gradientEnd}
        style={styles.iconButton}>
        {children}
      </LinearGradient>
    </Pressable>
  );
}

interface DangerButtonProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** The amber "Xoá lô đất" pill from screen 08. */
export function DangerButton({label, onPress, style}: DangerButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({pressed}) => [pressed && styles.pressed, style]}>
      <LinearGradient
        colors={['rgba(250,204,128,0.62)', 'rgba(242,161,4,0.34)']}
        start={{x: 0.18, y: 0}}
        end={{x: 0.82, y: 1}}
        style={styles.danger}>
        <Text style={text('bodySm', '#5C3A00')}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
  },
  inactive: {
    opacity: 0.55,
  },
  primary: {
    minHeight: size.buttonMinHeight,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['14'],
  },
  primaryWithArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['8'],
    borderRadius: radius.pill,
    paddingLeft: spacing['14'],
    paddingRight: spacing['2'],
    paddingVertical: spacing['2'],
    minHeight: 60,
  },
  primaryLabelCenter: {
    textAlign: 'center',
  },
  primaryLabelLeft: {
    flex: 1,
    textAlign: 'left',
  },
  arrowCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.green['075'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    minHeight: size.minTouchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.control.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['6'],
    paddingHorizontal: spacing['11'],
  },
  iconButton: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: glass.control.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    minHeight: size.minTouchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(242,161,4,.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
