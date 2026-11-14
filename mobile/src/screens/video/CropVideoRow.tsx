import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

import {Card} from '../../components/Card';
import {ChevronRight} from '../../components/icons';
import {videoFor} from '../../domain/cropVideo';
import {formatDuration} from '../../domain/youtube';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {canonicalCropType, cropTypeById} from '../../utils/staticData';
import {VideoThumb} from './VideoThumb';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  cropTypeId: string;
  /** The plot's or picker's category, for a category grown differently (ớt cay, cà phê chè). */
  categoryId?: string | null;
  /** The stored crop name, so a farmer-typed "Ớt" still finds the catalogue's video. */
  cropName?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Video cách trồng" as one compact row — the video's still and length, its
 * title and channel. Tapping opens the video screen, which starts playing:
 * the screens this row sits in (picker, plot, protocol) never carry a player
 * of their own, so they scroll as lightly as before. Renders nothing for a
 * crop the farmer added — there is no video in the catalogue for it.
 */
export function CropVideoRow({cropTypeId, categoryId, cropName, style}: Props) {
  const navigation = useNavigation<Nav>();
  const crop = cropTypeById(canonicalCropType(cropTypeId, cropName));
  const video = videoFor(crop, categoryId);
  if (!crop || !video) return null;

  return (
    <Card
      flush
      testID={`crop-video-${crop.id}`}
      accessibilityLabel={`Xem video cách trồng ${crop.name}, dài ${formatDuration(video.duration_s)}`}
      onPress={() => navigation.navigate('CropVideo', {cropTypeId: crop.id, categoryId: categoryId ?? null})}
      style={[styles.card, style]}>
      <View style={styles.row}>
        <VideoThumb videoId={video.youtube_id} durationS={video.duration_s} />
        <View style={styles.body}>
          <Text style={text('eyebrow', colors.primary.default)}>Video cách trồng</Text>
          <Text style={text('bodyStrong')} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
            {video.channel}
          </Text>
        </View>
        <ChevronRight />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
