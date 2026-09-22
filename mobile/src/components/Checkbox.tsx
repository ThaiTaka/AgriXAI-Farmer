import React, {useEffect, useRef} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View} from 'react-native';

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
  // Bắt đầu ở trạng thái cuối: lần vẽ đầu (mở lại màn, danh sách cuộn tới) là
  // hiển thị dữ liệu cũ, không phải người dùng vừa tick — nảy lúc đó là nhiễu.
  const pop = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      pop.setValue(checked ? 1 : 0);
      return;
    }
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (cancelled) return;
      if (reduced || !checked) {
        pop.setValue(checked ? 1 : 0);
        return;
      }
      // 0 → 1.4 → 1 trong 400ms: phóng to rồi về, đủ để mắt bắt được cú tick.
      pop.setValue(0);
      Animated.sequence([
        Animated.timing(pop, {toValue: 1.4, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(pop, {toValue: 1, duration: 240, easing: Easing.out(Easing.back(2)), useNativeDriver: true}),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [checked, pop]);

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
        {checked ? (
          <Animated.View style={{transform: [{scale: pop}]}}>
            <CheckIcon size={14} color={colors.primary.onPrimary} />
          </Animated.View>
        ) : null}
      </View>
      {/* Gạch bằng textDecorationLine chứ không phải một View phủ lên: nhãn
          tiếng Việt hay xuống 2 dòng, View phủ chỉ gạch được dòng đầu. */}
      <Text
        style={[text('bodySm', checked ? colors.text.muted : colors.text.secondary), checked && styles.labelDone]}
        numberOfLines={2}>
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
  labelDone: {
    textDecorationLine: 'line-through',
  },
});
