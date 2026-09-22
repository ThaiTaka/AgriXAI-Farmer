import React from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {Badge} from '../../components/Badge';
import {Card} from '../../components/Card';
import {ExternalLinkIcon} from '../../components/icons';
import type {UnavailableEntry} from '../../domain/careProtocol';
import {colors, radius, space, text} from '../../theme';

interface Props {
  cropName: string;
  /** The declared gap, or null for a crop the farmer added themselves. */
  entry: UnavailableEntry | null;
}

/**
 * "Chưa có dữ liệu" — shown instead of a protocol, never a protocol invented
 * to fill the space. Says why, and where an official source might be found.
 */
export function ProtocolUnavailable({cropName, entry}: Props) {
  return (
    <Card>
      <Badge label="Chưa có dữ liệu quy trình" tone="yellow" />
      <Text style={[text('subheading'), styles.title]}>
        {entry ? entry.category_name : cropName}
      </Text>
      <Text style={[text('body', colors.text.secondary), styles.body]}>
        {entry
          ? entry.reason
          : `Chưa có quy trình chăm sóc cho ${cropName}. Đây là cây trồng do bạn tự thêm, chưa có trong danh mục nên ứng dụng không có nguồn quy trình chính thức để hiển thị.`}
      </Text>
      <Text style={[text('bodySm', colors.text.muted), styles.body]}>
        Ứng dụng không tự sinh liều lượng. Vui lòng tham khảo các nguồn chính thức dưới đây hoặc trung
        tâm khuyến nông địa phương.
      </Text>

      {(entry?.suggested_sources ?? []).map(source => (
        <Pressable
          key={source.url}
          accessibilityRole="link"
          accessibilityLabel={source.title}
          onPress={() => Linking.openURL(source.url).catch(() => {})}
          style={({pressed}) => [styles.link, pressed && styles.linkPressed]}>
          <View style={styles.linkBody}>
            <Text style={text('bodyStrong', colors.primary.default)} numberOfLines={2}>
              {source.title}
            </Text>
            <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
              {source.url}
            </Text>
          </View>
          <ExternalLinkIcon />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: space.md,
  },
  body: {
    marginTop: space.sm,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.page,
    minHeight: 56,
  },
  linkPressed: {
    backgroundColor: colors.surface.pressed,
  },
  linkBody: {
    flex: 1,
    minWidth: 0,
  },
});
