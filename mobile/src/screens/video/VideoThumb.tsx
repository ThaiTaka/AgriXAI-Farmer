import React, {useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Image, StyleSheet, Text, View} from 'react-native';

import {PlayIcon, VideoIcon} from '../../components/icons';
import {formatDuration, youtubeThumbnailUrl} from '../../domain/youtube';
import {colors, radius, space, text} from '../../theme';

interface Props {
  videoId: string;
  durationS: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A video's still at list size: YouTube's 320×180 picture (already 16:9, ~15
 * KB), decoded at the size it is drawn, with a play mark and the length in the
 * corner. Without a signal the picture cannot load, so a dark box with the
 * video icon takes its place — never an empty white hole.
 */
export function VideoThumb({videoId, durationS, width = 112, style}: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.frame, {width, height: Math.round((width * 9) / 16)}, style]}>
      {failed ? (
        <VideoIcon size={22} color={colors.white} />
      ) : (
        <>
          <Image
            source={{uri: youtubeThumbnailUrl(videoId, 'mq')}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            resizeMethod="resize"
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.play}>
            <View style={styles.playIcon}>
              <PlayIcon size={14} />
            </View>
          </View>
        </>
      )}
      <View style={styles.duration}>
        <Text style={text('caption', colors.white)}>{formatDuration(durationS)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.gray['800'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    paddingLeft: 2,
  },
  duration: {
    position: 'absolute',
    right: space.xs,
    bottom: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
});
