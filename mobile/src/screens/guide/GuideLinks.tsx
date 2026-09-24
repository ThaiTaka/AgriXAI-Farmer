import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {Card} from '../../components/Card';
import {ChevronRight, VideoIcon} from '../../components/icons';
import type CareGuide from '../../db/models/CareGuide';
import {observeCareGuides} from '../../db/repositories/careGuideRepository';
import {useObservable} from '../../db/useObservable';
import {isYoutubeId} from '../../domain/careGuide';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "Hướng dẫn có video" for one crop — shown on the plot's care tab and the
 * protocol screen. Renders nothing until an admin has published a guide for
 * the crop, so no empty box sits in the way.
 */
export function GuideLinks({cropType, limit = 3}: {cropType: string; limit?: number}) {
  const navigation = useNavigation<Nav>();
  const guides = useObservable<CareGuide[]>(() => observeCareGuides(cropType), [cropType], []);
  if (guides.length === 0) return null;

  return (
    <View style={styles.root} testID="guide-links">
      <Text style={[text('eyebrow', colors.text.muted), styles.label]}>Hướng dẫn có hình, video</Text>
      <Card flush style={styles.card}>
        {guides.slice(0, limit).map((g, i) => (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            onPress={() => navigation.navigate('CareGuide', {guideId: g.id})}
            style={({pressed}) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
            <VideoIcon />
            <View style={styles.body}>
              <Text style={text('bodyStrong')} numberOfLines={2}>
                {g.title}
              </Text>
              <Text style={text('caption', colors.text.muted)}>
                {isYoutubeId(g.youtubeId) ? 'Có video · xem ngay trong ứng dụng' : 'Ảnh và các bước'}
              </Text>
            </View>
            <ChevronRight />
          </Pressable>
        ))}
        {guides.length > limit ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('CareGuides', {cropType})}
            style={({pressed}) => [styles.row, styles.divider, pressed && styles.pressed]}>
            <Text style={[text('bodyStrong', colors.primary.default), styles.body]}>Xem tất cả {guides.length} hướng dẫn</Text>
            <ChevronRight />
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: space.md,
  },
  label: {
    marginBottom: space.sm,
  },
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
