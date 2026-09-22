import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, size, space, text} from '../theme';
import {ExternalLinkIcon} from './icons';

interface Props {
  url: string;
  /** Lời mời bấm. Mặc định: "Xem tài liệu tham khảo". */
  label?: string;
  /** Dòng trên: tên cơ quan ban hành, năm — cái bà con cần để tin nguồn. */
  citation?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Một dòng dẫn tới tài liệu nguồn.
 *
 * Địa chỉ web dán thẳng lên màn ("https://giongcaytrong.org/phan-bon-urea")
 * chiếm hai dòng, không ai đọc, và không nói được nó dẫn đi đâu. Ở đây chỉ
 * còn tên cơ quan ban hành và một câu mời bấm gạch chân; địa chỉ thật nằm
 * trong nhãn trợ năng cho trình đọc màn hình và được mở bằng trình duyệt.
 */
export function SourceLink({url, label = 'Xem tài liệu tham khảo', citation, style, testID}: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={`${label}. Mở ${hostOf(url)} bằng trình duyệt.`}
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({pressed}) => [styles.row, pressed && styles.pressed, style]}>
      <View style={styles.body}>
        {citation ? (
          <Text style={[text('bodySm', colors.text.secondary), styles.citation]} numberOfLines={3}>
            {citation}
          </Text>
        ) : null}
        <Text style={[text('bodySm', colors.primary.default), styles.link]}>{label}</Text>
      </View>
      <ExternalLinkIcon />
    </Pressable>
  );
}

/** "https://giongcaytrong.org/phan-bon-urea" → "giongcaytrong.org". */
export function hostOf(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  return (match?.[1] ?? url.trim()).replace(/^www\./i, '');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.minTouchTarget,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  citation: {
    marginBottom: 2,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
