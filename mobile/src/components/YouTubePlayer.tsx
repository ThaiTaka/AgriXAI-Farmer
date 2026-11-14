import {NavigationContext} from '@react-navigation/native';
import React, {useCallback, useContext, useEffect, useReducer, useRef, useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, Animated, AppState, Image, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import WebView from 'react-native-webview';
import type {ShouldStartLoadRequest, WebViewMessageEvent} from 'react-native-webview/lib/WebViewTypes';

import {
  isPlayerNavigation,
  isRetryableError,
  PAUSE_PLAYER_SCRIPT,
  parsePlayerMessage,
  PLAYER_STATE,
  playerErrorMessage,
  YOUTUBE_EMBED_ORIGIN,
  youtubePlayerHtml,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from '../domain/youtube';
import {useSync} from '../sync/SyncContext';
import {colors, radius, space, text} from '../theme';
import {GhostButton} from './buttons';
import {PlayIcon, VideoIcon} from './icons';

interface Props {
  videoId: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Start loading straight away instead of waiting for a tap on the poster —
   * for the video screen, which the farmer opened by tapping "play" already.
   * It may turn true later (after the screen's slide-in), which starts it then.
   */
  autoPlay?: boolean;
}

/**
 * poster  — YouTube's still and a play button; no player loaded yet.
 * loading — the player boots behind the still, which shows a spinner.
 * shown   — the still has faded out over the running player.
 * failed  — a sentence about what went wrong, and a way out.
 */
type Phase = 'poster' | 'loading' | 'shown' | 'failed';

/** Nothing from the player in this long means a signal too weak to play. */
const LOAD_TIMEOUT_MS = 15000;
/** Ready but not yet playing (slow start, autoplay refused): uncover the player's own controls. */
const REVEAL_AFTER_READY_MS = 2500;

// One video at a time: starting a player stops whichever one was playing, so
// two soundtracks never overlap and two WebViews never decode at once.
let stopPlaying: (() => void) | null = null;

interface PlayerState {
  videoId: string;
  phase: Phase;
  errorCode: number | string | null;
  /** One per player page created — the WebView's key and the token its messages carry. */
  attempt: number;
  /**
   * The still over the frame. It fades out on the native driver, and under
   * the new architecture a native-driven value is not reliably put back by
   * setValue(1) — so every time the still has to cover the frame again it
   * gets a fresh value and a fresh view (keyed by `key`).
   */
  cover: {key: number; opacity: Animated.Value};
}

const freshCover = (previous?: PlayerState['cover']) => ({
  key: (previous?.key ?? -1) + 1,
  opacity: new Animated.Value(1),
});

type PlayerAction =
  | {type: 'play'}
  | {type: 'stop'}
  | {type: 'reveal'}
  | {type: 'fail'; code: number | string}
  | {type: 'video'; videoId: string; autoPlay: boolean};

function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'play':
      return {...s, phase: 'loading', errorCode: null, attempt: s.attempt + 1, cover: freshCover(s.cover)};
    case 'stop':
      return s.phase === 'loading' || s.phase === 'shown' ? {...s, phase: 'poster', cover: freshCover(s.cover)} : s;
    case 'reveal':
      return s.phase === 'loading' ? {...s, phase: 'shown'} : s;
    case 'fail':
      return {...s, phase: 'failed', errorCode: a.code, cover: freshCover(s.cover)};
    case 'video':
      return {
        videoId: a.videoId,
        phase: a.autoPlay ? 'loading' : 'poster',
        errorCode: null,
        attempt: s.attempt + 1,
        cover: freshCover(s.cover),
      };
  }
}

/**
 * A YouTube video played inside the app — the farmer never lands on YouTube's
 * home page among unrelated videos. Out of signal the frame says so plainly;
 * "Mở bằng YouTube" stays as a way out when the embed itself is refused.
 *
 * Why it stays smooth:
 * - The poster comes first: the player is a whole web app (megabytes of
 *   script), created only when the farmer taps play, with autoplay so that
 *   tap is the only one, and dropped when the screen loses focus.
 * - The still stays over the player, with a spinner, until the player reports
 *   the video playing (YouTube's IFrame API, domain/youtube.ts), then fades
 *   out on the native driver — no black box while the player boots. A player
 *   ready but not started after 2.5 s is uncovered so its own play button
 *   can be tapped.
 * - The app going to the background pauses the video where it is.
 * - The WebView draws on a hardware layer and never scrolls or zooms itself,
 *   so it does not fight the screen's scroll for the gesture.
 * - A tap on YouTube's logo or title opens the YouTube app instead of loading
 *   the whole site inside this 16:9 box.
 */
export function YouTubePlayer({videoId, title, style, autoPlay = false}: Props) {
  const {state: sync} = useSync();
  const navigation = useContext(NavigationContext);
  const [state, dispatch] = useReducer(playerReducer, null, () => ({
    videoId,
    phase: autoPlay ? ('loading' as const) : ('poster' as const),
    errorCode: null,
    attempt: 0,
    cover: freshCover(),
  }));
  // A different video in the same frame starts over — decided during render,
  // so not one frame of the old player (or a bare black box) shows in between.
  if (state.videoId !== videoId) dispatch({type: 'video', videoId, autoPlay});
  const {phase, errorCode, attempt} = state;
  const [posterFailed, setPosterFailed] = useState(false);
  const offline = sync === 'offline';
  const label = title ? `Video: ${title}` : 'Video hướng dẫn';
  const active = phase === 'loading' || phase === 'shown';

  const cover = state.cover.opacity;
  useEffect(() => {
    if (phase !== 'shown') return undefined;
    const fade = Animated.timing(cover, {toValue: 0, duration: 200, useNativeDriver: true});
    fade.start();
    return () => fade.stop();
  }, [phase, cover]);

  const stop = useCallback(() => dispatch({type: 'stop'}), []);
  const fail = useCallback((code: number | string) => dispatch({type: 'fail', code}), []);
  const play = useCallback(() => dispatch({type: 'play'}), []);

  useEffect(() => {
    setPosterFailed(false);
  }, [videoId]);

  useEffect(() => {
    if (autoPlay && phase === 'poster') play();
    // Only when autoPlay turns on (the video screen finished sliding in).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  useEffect(() => {
    if (!navigation) return undefined;
    return navigation.addListener('blur', stop);
  }, [navigation, stop]);

  useEffect(() => {
    if (offline) stop();
  }, [offline, stop]);

  useEffect(() => {
    if (!active) return undefined;
    if (stopPlaying && stopPlaying !== stop) stopPlaying();
    stopPlaying = stop;
    return () => {
      if (stopPlaying === stop) stopPlaying = null;
    };
  }, [active, stop]);

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    const timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, attempt, fail]);

  // Pause (not drop) the video when the app leaves the screen for another
  // app or the lock screen: Android's WebView keeps playing otherwise.
  // WebView<{}>: the declared default (props & undefined) would type the ref's props as never.
  const web = useRef<WebView<{}>>(null);
  useEffect(() => {
    if (!active) return undefined;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') web.current?.injectJavaScript(PAUSE_PLAYER_SCRIPT);
    });
    return () => subscription.remove();
  }, [active]);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parsePlayerMessage(event.nativeEvent.data);
      // A message still in flight from a page this frame has already
      // replaced (another video, a retry) says nothing about this one.
      if (!message || message.session !== attempt) return;
      if (message.type === 'error') {
        fail(message.code);
      } else if (message.type === 'ready') {
        if (revealTimer.current) clearTimeout(revealTimer.current);
        revealTimer.current = setTimeout(() => dispatch({type: 'reveal'}), REVEAL_AFTER_READY_MS);
      } else if (message.state !== PLAYER_STATE.unstarted && message.state !== PLAYER_STATE.buffering) {
        dispatch({type: 'reveal'});
      }
    },
    [attempt, fail],
  );

  const onNavigate = useCallback(
    (request: ShouldStartLoadRequest) => {
      if (request.isTopFrame === false || isPlayerNavigation(request.url)) return true;
      if (/^https:\/\/((www|m)\.)?youtube\.com\/|^https:\/\/youtu\.be\//.test(request.url)) {
        Linking.openURL(youtubeWatchUrl(videoId)).catch(() => {});
      }
      return false;
    },
    [videoId],
  );

  const openYouTube = () => Linking.openURL(youtubeWatchUrl(videoId)).catch(() => {});

  return (
    <View style={style}>
      <View style={styles.frame}>
        {offline ? (
          <View style={styles.fallback} testID="youtube-fallback">
            <VideoIcon size={32} color={colors.white} />
            <Text style={[text('bodySm', colors.white), styles.fallbackText]}>
              Cần có mạng để xem video. Phần chữ bên dưới vẫn đọc được.
            </Text>
          </View>
        ) : phase === 'failed' ? (
          <View style={styles.fallback} testID="youtube-error">
            <VideoIcon size={32} color={colors.white} />
            <Text style={[text('bodySm', colors.white), styles.fallbackText]}>
              {playerErrorMessage(errorCode ?? 'unknown')}
            </Text>
            {isRetryableError(errorCode ?? 'unknown') ? (
              <Pressable
                testID="youtube-retry"
                accessibilityRole="button"
                onPress={play}
                style={({pressed}) => [styles.retry, pressed && styles.posterPressed]}>
                <Text style={text('bodyStrong', colors.white)}>Thử lại</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {active ? (
              <WebView
                key={`player-${attempt}`}
                ref={web}
                testID="youtube-player"
                source={{
                  html: youtubePlayerHtml(videoId, {autoplay: true, session: attempt}),
                  baseUrl: YOUTUBE_EMBED_ORIGIN,
                }}
                style={styles.web}
                originWhitelist={['*']}
                onMessage={onMessage}
                onShouldStartLoadWithRequest={onNavigate}
                onError={() => fail('api')}
                allowsInlineMediaPlayback
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                // The farmer's tap (on the poster, or on the row that opened
                // the video screen) is the gesture; no second tap inside.
                mediaPlaybackRequiresUserAction={false}
                androidLayerType="hardware"
                setSupportMultipleWindows={false}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                nestedScrollEnabled={false}
                setBuiltInZoomControls={false}
                textZoom={100}
                accessibilityLabel={label}
              />
            ) : null}
            <Animated.View
              key={`cover-${state.cover.key}`}
              pointerEvents={phase === 'shown' ? 'none' : 'auto'}
              style={[StyleSheet.absoluteFill, {opacity: cover}]}>
              <Pressable
                testID="youtube-poster"
                accessibilityRole="button"
                accessibilityLabel={`Phát ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
                accessibilityState={{busy: phase === 'loading'}}
                disabled={phase !== 'poster'}
                onPress={play}
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
                  {phase === 'loading' ? (
                    <ActivityIndicator testID="youtube-loading" color={colors.white} accessibilityLabel="Đang tải video" />
                  ) : (
                    <View style={styles.playIcon}>
                      <PlayIcon size={28} />
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
      <GhostButton small label="Mở bằng YouTube" onPress={openYouTube} style={styles.external} />
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
    backgroundColor: '#000',
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
  },
  playIcon: {
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
  retry: {
    minHeight: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  external: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    marginLeft: -space.md,
  },
});
