import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StatusBar, StyleSheet, View} from 'react-native';
import type {Edge} from 'react-native-safe-area-context';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors} from '../theme';
import {SoftGradient} from './SoftGradient';
import {useTopEdge} from './TopInset';

interface Props {
  children: React.ReactNode;
  /**
   * `page` = gray-50 (lists, forms); `card` = pure white (login, pickers);
   * `gradient` = the one sanctioned ground tint (gray-50 → gray-100), for the
   * screens a farmer stares at longest so the white cards have something to
   * sit on instead of dissolving into the page.
   */
  ground?: 'page' | 'card' | 'gradient';
  edges?: Edge[];
  /**
   * Màu chữ/biểu tượng của thanh trạng thái hệ thống. `light` cho màn hình tự
   * phủ một dải tối lên tận mép trên (trang chủ) — để `dark` thì đồng hồ, pin,
   * sóng màu đen chìm nghỉm trong dải xanh đậm.
   */
  statusBar?: 'dark' | 'light';
  /**
   * Nền thanh trạng thái trên Android dưới 15. Từ Android 15 hệ điều hành ép
   * edge-to-edge và bỏ qua giá trị này — lúc đó chính dải màu của màn hình vẽ
   * lên dưới thanh trạng thái, nên chỉ còn `statusBar` có tác dụng.
   */
  statusBarColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** The screen shell: a ground, safe-area padding, one status-bar declaration. */
export function Screen({
  children,
  ground = 'page',
  edges = ['top'],
  statusBar = 'dark',
  statusBarColor,
  style,
}: Props) {
  const backgroundColor =
    ground === 'card'
      ? colors.surface.card
      : ground === 'gradient'
        ? colors.gradient.groundFrom
        : colors.surface.page;

  // Dải đồng bộ phía trên đã bù tai thỏ thì màn hình không bù lần thứ hai.
  const topEdge = useTopEdge();
  const safeEdges = topEdge ? edges : edges.filter(edge => edge !== 'top');

  const body = (
    <SafeAreaView style={[styles.root, style]} edges={safeEdges}>
      {children}
    </SafeAreaView>
  );

  return (
    <View style={[styles.root, {backgroundColor}]}>
      <StatusBar
        barStyle={statusBar === 'light' ? 'light-content' : 'dark-content'}
        backgroundColor={statusBarColor ?? backgroundColor}
      />
      {ground === 'gradient' ? <SoftGradient>{body}</SoftGradient> : body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
