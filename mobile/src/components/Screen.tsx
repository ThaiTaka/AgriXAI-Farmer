import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StatusBar, StyleSheet, View} from 'react-native';
import type {Edge} from 'react-native-safe-area-context';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors} from '../theme';

interface Props {
  children: React.ReactNode;
  /** `page` = gray-50 (lists, forms); `card` = pure white (login, pickers). */
  ground?: 'page' | 'card';
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

/** The screen shell: a plain ground colour, safe-area padding, dark status icons. */
export function Screen({children, ground = 'page', edges = ['top'], style}: Props) {
  const backgroundColor = ground === 'card' ? colors.surface.card : colors.surface.page;
  return (
    <View style={[styles.root, {backgroundColor}]}>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      <SafeAreaView style={[styles.root, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
