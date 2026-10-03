import {NavigationContext} from '@react-navigation/native';
import React, {useContext, useEffect, useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Image, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import WebView from 'react-native-webview';

import {youtubeEmbedHtml, youtubeThumbnailUrl, youtubeWatchUrl} from '../domain/careGuide';
import {useSync} from '../sync/SyncContext';
import {colors, radius, space, text} from '../theme';
import {GhostButton} from './buttons';
import {PlayIcon, VideoIcon} from './icons';

interface Props {
  videoId: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The guide's YouTube video, played inside the app — the farmer never lands
 * on YouTube's home page among unrelated videos. Out of signal the frame says
 * so plainly instead of a grey box; "Mở bằng YouTube" stays as a way out when
 * the embed itself is refused (some uploaders disable embedding).
 *
 * The page is served from YouTube's own origin (baseUrl) so the player gets a
 * proper referrer; without one YouTube shows "Error 153" instead of the video.
 *
 * Why a poster first: the embed is a whole web app (megabytes of script).
 * Mounted as the screen opened, it loaded during the push animation and the
 * first scroll — the stutter farmers saw — and stayed alive for every guide
 * passed through. Now the frame shows only YouTube's thumbnail until the
 * farmer taps play; the player is created then, with autoplay so that tap is
 * the only one, and dropped when the screen loses focus, which also stops the
 * sound. On Android the WebView draws on a hardware layer: video in a
 * software layer inside a ScrollView drops frames.
 */
export function YouTubePlayer({videoId, title, style}: Props) {
  const {state} = useSync();
  const navigation = useContext(NavigationContext);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const offline = state === 'offline';
  const label = title ? `Video: ${title}` : 'Video hướng dẫn';

  useEffect(() => {
    if (!navigation) return undefined;
    return navigation.addListener('blur', () => setPlaying(false));
  }, [navigation]);

  useEffect(() => {
    if (offline) setPlaying(false);
  }, [offline]);

  return (
    <View style={style}>
      <View style={styles.frame}>
        {offline || failed ? (
          <View style={styles.fallback} testID="youtube-fallback">
            <VideoIcon size={32} color={colors.white} />
            <Text style={[text('bodySm', colors.white), styles.fallbackText]}>
              {offline ? 'Cần có mạng để xem video. Phần hướng dẫn bên dưới vẫn đọc được.' : 'Không mở được video trong ứng dụng.'}
            </Text>
          </View>
        ) : playing ? (
          <WebView
            testID="youtube-player"
            source={{html: youtubeEmbedHtml(videoId, {autoplay: true}), baseUrl: 'https://www.youtube-nocookie.com'}}
            style={styles.web}
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            // The tap on the poster is the farmer's gesture; without this the
            // video would wait for a second tap inside the player.
            mediaPlaybackRequiresUserAction={false}
            androidLayerType="hardware"
            setSupportMultipleWindows={false}
            onError={() => setFailed(true)}
            accessibilityLabel={label}
          />
        ) : (
          <Pressable
            testID="youtube-poster"
            accessibilityRole="button"
            accessibilityLabel={`Phát ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
            onPress={() => setPlaying(true)}
            style={({pressed}) => [styles.poster, pressed && styles.posterPressed]}>
            {posterFailed ? null : (
              <Image
                source={{uri: youtubeThumbnailUrl(videoId)}}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={() => setPosterFailed(true)}
              />
            )}
            <View style={styles.playButton}>
              <PlayIcon size={28} />
            </View>
          </Pressable>
        )}
      </View>
      <GhostButton
        small
        label="Mở bằng YouTube"
        onPress={() => Linking.openURL(youtubeWatchUrl(videoId)).catch(() => {})}
        style={styles.external}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  web: {
    flex: 1,
    backgroundColor: '#000',
  },
  poster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPressed: {
    opacity: 0.85,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    // The triangle's visual centre sits left of its box.
    paddingLeft: 4,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.sm,
  },
  fallbackText: {
    textAlign: 'center',
  },
  external: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    marginLeft: -space.md,
  },
});
