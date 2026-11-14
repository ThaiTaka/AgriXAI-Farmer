/**
 * Video cách trồng — one crop's how-to-grow video, playing.
 *
 * Opened from a "Video cách trồng" row, so the farmer has already asked to
 * play: the player starts on its own, but only once the screen has finished
 * sliding in — a WebView created mid-animation is what made the old guide
 * screen stutter. Below the player: what the video is, whose channel, how far
 * to trust it, and — for a crop whose categories are grown differently (ớt
 * ngọt / ớt cay, cà phê vối / chè) — the other video to switch to.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {InteractionManager, ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import type {BadgeTone} from '../../components/Badge';
import {Badge} from '../../components/Badge';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {CheckIcon, VideoIcon} from '../../components/icons';
import {ListRow} from '../../components/ListRow';
import {Screen} from '../../components/Screen';
import {SourceLink} from '../../components/SourceLink';
import {YouTubePlayer} from '../../components/YouTubePlayer';
import type {VideoSourceKind} from '../../domain/cropVideo';
import {
  formatIsoDate,
  SOURCE_KIND_LABELS,
  VIDEO_DISCLAIMER,
  videoChoices,
  videoFor,
  videoMeta,
} from '../../domain/cropVideo';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {cropTypeById} from '../../utils/staticData';
import {VideoThumb} from './VideoThumb';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CropVideo'>;

const SOURCE_TONE: Record<VideoSourceKind, BadgeTone> = {
  lam_dong: 'green',
  official: 'blue',
  community: 'gray',
};

export function CropVideoScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const crop = cropTypeById(params.cropTypeId);
  const choices = useMemo(() => (crop ? videoChoices(crop) : []), [crop]);
  const [selectedId, setSelectedId] = useState(() => videoFor(crop, params.categoryId)?.youtube_id);
  const selected = choices.find(c => c.video.youtube_id === selectedId) ?? choices[0];

  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setSettled(true));
    return () => task.cancel();
  }, []);

  if (!crop || !selected) {
    return (
      <Screen>
        <AppHeader title="Video cách trồng" onBack={() => navigation.goBack()} />
        <View style={styles.scroll}>
          <EmptyState
            icon={<VideoIcon size={28} />}
            title="Chưa có video"
            body="Cây này không có trong danh mục của ứng dụng nên chưa có video cách trồng."
          />
        </View>
      </Screen>
    );
  }

  const video = selected.video;
  return (
    <Screen>
      <AppHeader eyebrow={crop.name} title="Video cách trồng" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <YouTubePlayer videoId={video.youtube_id} title={video.title} autoPlay={settled} />

        <Text style={[text('subheading'), styles.title]} testID="crop-video-title">
          {video.title}
        </Text>
        <Text style={text('bodySm', colors.text.secondary)}>
          {videoMeta(video)} · đăng ngày {formatIsoDate(video.published_at)}
        </Text>
        <Badge label={SOURCE_KIND_LABELS[video.source_kind]} tone={SOURCE_TONE[video.source_kind]} style={styles.badge} />

        {choices.length > 1 ? (
          <View style={styles.section}>
            <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Video theo loại {crop.name.toLowerCase()}</Text>
            <Card flush style={styles.group}>
              {choices.map((choice, index) => {
                const current = choice.video.youtube_id === video.youtube_id;
                return (
                  <ListRow
                    key={choice.video.youtube_id}
                    testID={`crop-video-choice-${index}`}
                    title={choice.label}
                    subtitle={choice.video.title}
                    leading={<VideoThumb videoId={choice.video.youtube_id} durationS={choice.video.duration_s} width={96} />}
                    trailing={current ? <CheckIcon /> : undefined}
                    last={index === choices.length - 1}
                    onPress={current ? undefined : () => setSelectedId(choice.video.youtube_id)}
                  />
                );
              })}
            </Card>
          </View>
        ) : null}

        <Text style={[text('bodySm', colors.text.secondary), styles.note]}>{VIDEO_DISCLAIMER}</Text>
        <SourceLink
          url={video.channel_url}
          citation={`Kênh YouTube: ${video.channel}`}
          label="Xem kênh trên YouTube"
          style={styles.source}
        />
        <Text style={text('caption', colors.text.muted)}>
          Đã kiểm tra video còn xem được ngày {formatIsoDate(video.checked_at)}. Cần có mạng để xem.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  title: {
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  badge: {
    marginTop: space.sm,
  },
  section: {
    marginTop: space.xl,
  },
  sectionLabel: {
    marginBottom: space.sm,
  },
  group: {
    overflow: 'hidden',
  },
  note: {
    marginTop: space.xl,
  },
  source: {
    marginTop: space.sm,
  },
});
