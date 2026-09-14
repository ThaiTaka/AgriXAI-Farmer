import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, space, text} from '../theme';

interface Props<K extends string> {
  items: ReadonlyArray<{key: K; label: string; count?: number}>;
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Underline tabs: the active one carries a 2pt green rule and dark bold text,
 * the others gray text and no rule. Used where a screen has 2–3 peer views
 * (Bình dân / Trung bình / Cao cấp, Nhập / Xuất / Tồn, Thu / Chi / Báo cáo).
 */
export function Tabs<K extends string>({items, value, onChange, style}: Props<K>) {
  return (
    <View style={[styles.row, style]} accessibilityRole="tablist">
      {items.map(item => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            testID={`tab-${item.key}`}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            onPress={() => onChange(item.key)}
            style={({pressed}) => [styles.tab, active && styles.tabActive, pressed && !active && styles.tabPressed]}>
            <Text numberOfLines={1} style={text('bodyStrong', active ? colors.text.primary : colors.text.placeholder)}>
              {item.label}
              {item.count !== undefined ? ` (${item.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.primary.default,
  },
  tabPressed: {
    backgroundColor: colors.surface.pressed,
  },
});
