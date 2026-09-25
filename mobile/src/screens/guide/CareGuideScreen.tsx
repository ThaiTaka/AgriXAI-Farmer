/**
 * V2.1 — Hướng dẫn chăm sóc (video + ảnh từng bước).
 *
 * The admin's how-to for one crop: the YouTube video plays inside the app,
 * then a strip of pictures, then numbered steps each with its own picture.
 * Text and steps are in the local database (synced), so they read with no
 * signal; the video and pictures need a connection the first time.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Image, ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {Screen} from '../../components/Screen';
import {SourceLink} from '../../components/SourceLink';
import {YouTubePlayer} from '../../components/YouTubePlayer';
import type CareGuide from '../../db/models/CareGuide';
import {observeCareGuide} from '../../db/repositories/careGuideRepository';
import {useObservableReady} from '../../db/useObservable';
import {isYoutubeId, parseImageIds, parseSteps} from '../../domain/careGuide';
import {publicMediaUri} from '../../media/useMediaSource';
import type {RootStackParamList} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {cropNameOf, STAGE_LABELS} from '../../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CareGuide'>;

export function CareGuideScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {value: guide, ready} = useObservableReady<CareGuide | null>(
    () => observeCareGuide(params.guideId),
    [params.guideId],
    null,
  );
  const steps = useMemo(() => parseSteps(guide?.stepsJson), [guide?.stepsJson]);
  const images = useMemo(() => parseImageIds(guide?.imagesJson), [guide?.imagesJson]);

  if (!guide) {
    return (
      <Screen>
        <AppHeader title="Hướng dẫn" onBack={() => navigation.goBack()} />
        <View style={styles.scroll}>
          {ready ? (
            <EmptyState title="Không tìm thấy hướng dẫn" body="Hướng dẫn này có thể đã được quản trị viên gỡ xuống." />
          ) : (
            <ActivityIndicator color={colors.primary.default} />
          )}
        </View>
      </Screen>
    );
  }

  const stageLabel = guide.stageCode ? STAGE_LABELS[guide.stageCode as keyof typeof STAGE_LABELS] : null;

  return (
    <Screen>
      <AppHeader eyebrow={cropNameOf(guide.cropType)} title={guide.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {stageLabel ? <Badge label={`Giai đoạn: ${stageLabel}`} tone="green" style={styles.badge} /> : null}

        {isYoutubeId(guide.youtubeId) ? (
          <YouTubePlayer videoId={guide.youtubeId} title={guide.title} style={styles.block} />
        ) : null}

        {guide.summary ? <Text style={[text('body', colors.text.secondary), styles.block]}>{guide.summary}</Text> : null}

        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.block}>
            {images.map(id => (
              <GuideImage key={id} id={id} style={styles.stripImage} />
            ))}
          </ScrollView>
        ) : null}

        {steps.length > 0 ? (
          <>
            <Text style={[text('eyebrow', colors.text.muted), styles.section]}>Từng bước</Text>
            {steps.map((step, index) => (
              <Card key={`${index}-${step.title}`} style={styles.step} testID={`guide-step-${index + 1}`}>
                <View style={styles.stepHead}>
                  <View style={styles.stepNumber}>
                    <Text style={text('cardTitle', colors.primary.default)}>{index + 1}</Text>
                  </View>
                  <Text style={[text('cardTitle'), styles.flex]}>{step.title}</Text>
                </View>
                {step.body ? <Text style={[text('body', colors.text.secondary), styles.stepBody]}>{step.body}</Text> : null}
                {step.imageId ? <GuideImage id={step.imageId} style={styles.stepImage} /> : null}
              </Card>
            ))}
          </>
        ) : null}

        {guide.sourceUrl ? (
          <SourceLink url={guide.sourceUrl} citation={guide.sourceName ?? undefined} label="Xem nguồn" style={styles.block} />
        ) : guide.sourceName ? (
          <Text style={[text('bodySm', colors.text.muted), styles.block]}>Nguồn: {guide.sourceName}</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** A public guide picture; a grey box with a word when it cannot load. */
function GuideImage({id, style}: {id: string; style: object}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[style, styles.imageFallback]}>
        <Text style={text('caption', colors.text.muted)}>Cần mạng để xem ảnh</Text>
      </View>
    );
  }
  return (
    <Image
      source={{uri: publicMediaUri(id)}}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel="Ảnh minh hoạ"
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: space.md,
  },
  block: {
    marginBottom: space.lg,
  },
  strip: {
    gap: space.sm,
  },
  stripImage: {
    width: 220,
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surface.subtle,
  },
  section: {
    marginBottom: space.sm,
  },
  step: {
    marginBottom: space.md,
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  stepBody: {
    marginTop: space.sm,
  },
  stepImage: {
    marginTop: space.md,
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.subtle,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
