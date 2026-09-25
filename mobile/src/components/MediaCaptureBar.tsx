import React, {useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';

import type {MediaRef} from '../domain/media';
import type {CaptureSource} from '../media/mediaStore';
import {captureMedia, MAX_VIDEO_SECONDS} from '../media/mediaStore';
import {colors, radius, size, space, text} from '../theme';
import {CameraIcon, GalleryIcon, VideoIcon} from './icons';

interface Props {
  onAdd: (refs: MediaRef[]) => void;
  style?: StyleProp<ViewStyle>;
  /** Hide the video button (a harvest photo does not need one). */
  photosOnly?: boolean;
}

/**
 * Three big buttons — Chụp ảnh / Quay video / Chọn trong máy. Labelled with
 * words, not just icons: a camera glyph alone does not say "photo or video?".
 */
export function MediaCaptureBar({onAdd, style, photosOnly = false}: Props) {
  const [busy, setBusy] = useState<CaptureSource | null>(null);

  const run = async (source: CaptureSource) => {
    if (busy) return;
    setBusy(source);
    try {
      const refs = await captureMedia(source);
      if (refs.length) onAdd(refs);
    } catch (error) {
      Alert.alert('Không lấy được ảnh/video', error instanceof Error ? error.message : 'Thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const buttons: {source: CaptureSource; label: string; icon: React.ReactNode}[] = [
    {source: 'photo', label: 'Chụp ảnh', icon: <CameraIcon />},
    ...(photosOnly ? [] : [{source: 'video' as const, label: 'Quay video', icon: <VideoIcon />}]),
    {source: 'library', label: 'Chọn trong máy', icon: <GalleryIcon />},
  ];

  return (
    <View style={[styles.row, style]}>
      {buttons.map(b => (
        <Pressable
          key={b.source}
          testID={`capture-${b.source}`}
          accessibilityRole="button"
          accessibilityLabel={b.source === 'video' ? `Quay video, tối đa ${MAX_VIDEO_SECONDS} giây` : b.label}
          accessibilityState={{busy: busy === b.source}}
          onPress={() => run(b.source)}
          style={({pressed}) => [styles.button, pressed && styles.pressed, busy === b.source && styles.busy]}>
          {b.icon}
          <Text style={text('caption', colors.primary.default)} numberOfLines={1}>
            {b.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  button: {
    flex: 1,
    minHeight: size.minTouchTarget + 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.xs,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  busy: {
    opacity: 0.6,
  },
});
