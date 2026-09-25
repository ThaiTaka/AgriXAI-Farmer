import React, {useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Linking, StyleSheet, Text, View} from 'react-native';
import WebView from 'react-native-webview';

import {youtubeEmbedHtml, youtubeWatchUrl} from '../domain/careGuide';
import {useSync} from '../sync/SyncContext';
import {colors, radius, space, text} from '../theme';
import {GhostButton} from './buttons';
import {VideoIcon} from './icons';

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
 */
export function YouTubePlayer({videoId, title, style}: Props) {
  const {state} = useSync();
  const [failed, setFailed] = useState(false);
  const offline = state === 'offline';

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
        ) : (
          <WebView
            testID="youtube-player"
            source={{html: youtubeEmbedHtml(videoId), baseUrl: 'https://www.youtube-nocookie.com'}}
            style={styles.web}
            originWhitelist={['*']}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction
            setSupportMultipleWindows={false}
            onError={() => setFailed(true)}
            accessibilityLabel={title ? `Video: ${title}` : 'Video hướng dẫn'}
          />
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
