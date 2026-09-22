import React, {useEffect, useRef, useState} from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text} from 'react-native';

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

interface CountUpProps extends Omit<Props, 'children'> {
  /** Giá trị thật. Số chạy từ 0 lên đây khi màn mở lần đầu. */
  to: number;
  /** Đổi số thành chuỗi hiển thị (formatVnd, formatNumber…). */
  format: (value: number) => string;
}

/**
 * Số chạy từ 0 lên giá trị thật khi mở màn.
 *
 * Tách riêng khỏi màn hình vì mỗi khung hình là một lần setState — để trong
 * HomeScreen thì cả trang vẽ lại 60 lần/giây trên máy yếu. Chỉ chạy khi giá
 * trị đổi thật sự, nên một lần đồng bộ trả về đúng con số cũ sẽ không làm số
 * nhảy lại. Ai bật "giảm chuyển động" thì thấy ngay số cuối.
 */
export function CountUpNumber({to, format, ...rest}: CountUpProps) {
  const progress = useRef(new Animated.Value(to)).current;
  const [shown, setShown] = useState(to);

  useEffect(() => {
    let cancelled = false;
    let listener: string | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (cancelled) return;
      if (reduced) {
        setShown(to);
        return;
      }
      listener = progress.addListener(({value}) => setShown(value));
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: to,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        // Giá trị phải về được JS để định dạng thành chữ, nên không dùng native driver.
        useNativeDriver: false,
      }).start(() => {
        if (!cancelled) setShown(to);
      });
    });

    return () => {
      cancelled = true;
      if (listener) progress.removeListener(listener);
      progress.stopAnimation();
    };
  }, [to, progress]);

  return <NumberText {...rest}>{format(Math.round(shown))}</NumberText>;
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
