import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StatusBar, StyleSheet, View} from 'react-native';
import type {Edge} from 'react-native-safe-area-context';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors} from '../theme';
import {SoftGradient} from './SoftGradient';

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
  style?: StyleProp<ViewStyle>;
}

/** The screen shell: a ground, safe-area padding, dark status icons. */
export function Screen({children, ground = 'page', edges = ['top'], style}: Props) {
  const backgroundColor =
    ground === 'card'
      ? colors.surface.card
      : ground === 'gradient'
        ? colors.gradient.groundFrom
        : colors.surface.page;

  const body = (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );

  return (
    <View style={[styles.root, {backgroundColor}]}>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      {ground === 'gradient' ? <SoftGradient>{body}</SoftGradient> : body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
