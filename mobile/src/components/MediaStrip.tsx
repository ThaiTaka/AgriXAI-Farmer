import React, {useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {MediaRef} from '../domain/media';
import {useMediaSource} from '../media/useMediaSource';
import {colors, radius, space, text} from '../theme';
import {CloseIcon, PlayIcon} from './icons';
import {MediaViewer} from './MediaViewer';

interface Props {
  refs: readonly MediaRef[];
  /** Composer mode: each tile gets an "×" to drop it before saving. */
  onRemove?: (ref: MediaRef) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A row of photo/video tiles. Tap one to open it full screen. Tiles are 72 pt
 * (above the 48 pt touch minimum) because a thumbnail too small to recognise
 * is a thumbnail nobody taps.
 */
export function MediaStrip({refs, onRemove, size = 72, style, testID}: Props) {
  const [open, setOpen] = useState<MediaRef | null>(null);
  if (refs.length === 0) return null;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={style}
        testID={testID}>
        {refs.map(ref => (
          <MediaTile key={ref.id} media={ref} size={size} onPress={() => setOpen(ref)} onRemove={onRemove} />
        ))}
      </ScrollView>
      <MediaViewer media={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MediaTile({
  media,
  size,
  onPress,
  onRemove,
}: {
  media: MediaRef;
  size: number;
  onPress: () => void;
  onRemove?: (ref: MediaRef) => void;
}) {
  const source = useMediaSource(media);
  const isVideo = media.kind === 'video';
  return (
    <View>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={isVideo ? 'Mở video' : 'Mở ảnh'}
        onPress={onPress}
        style={({pressed}) => [styles.tile, {width: size, height: size}, pressed && styles.pressed]}>
        {source.uri && !isVideo ? (
          <Image source={{uri: source.uri}} style={styles.image} resizeMode="cover" />
        ) : source.state === 'loading' ? (
          <ActivityIndicator color={colors.primary.default} />
        ) : !isVideo ? (
          <Text style={[text('caption', colors.text.muted), styles.placeholder]}>
            {source.state === 'waiting' ? 'Chờ tải lên' : 'Cần mạng'}
          </Text>
        ) : null}
        {isVideo ? (
          <View style={styles.videoBadge}>
            <PlayIcon size={22} />
          </View>
        ) : null}
        {!media.uploaded ? <View style={styles.pendingDot} accessibilityLabel="Chưa tải lên máy chủ" /> : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bỏ ảnh/video này"
          hitSlop={10}
          onPress={() => onRemove(media)}
          style={styles.remove}>
          <CloseIcon size={14} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space.sm,
    paddingVertical: space.xs,
    paddingRight: space.sm,
  },
  tile: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pressed: {
    opacity: 0.8,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    textAlign: 'center',
    paddingHorizontal: space.xs,
  },
  videoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26,26,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  pendingDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.amber['500'],
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray['800'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
