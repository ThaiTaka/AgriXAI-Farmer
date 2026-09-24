import React from 'react';
import {ActivityIndicator, Image, Modal, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import {videoPlayerHtml} from '../domain/careGuide';
import type {MediaRef} from '../domain/media';
import {useMediaSource} from '../media/useMediaSource';
import {colors, space, text} from '../theme';
import {IconButton} from './buttons';
import {CloseIcon} from './icons';

/**
 * Full-screen view of one photo or video. Videos play in a WebView's own
 * <video> player — the same WebView the care-guide videos use, so the app
 * carries one native player rather than two.
 */
export function MediaViewer({media, onClose}: {media: MediaRef | null; onClose: () => void}) {
  return (
    <Modal visible={media != null} animationType="fade" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Đóng" onPress={onClose}>
            <CloseIcon color={colors.white} />
          </IconButton>
        </View>
        {media ? <Body media={media} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

function Body({media}: {media: MediaRef}) {
  const source = useMediaSource(media);
  if (source.state === 'loading') {
    return <ActivityIndicator style={styles.fill} color={colors.white} />;
  }
  if (!source.uri) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={[text('body', colors.white), styles.message]}>
          {source.state === 'waiting'
            ? 'Ảnh/video này được chụp trên máy khác và chưa tải lên máy chủ.'
            : 'Cần có mạng để xem ảnh/video này.'}
        </Text>
      </View>
    );
  }
  if (media.kind === 'image') {
    return <Image source={{uri: source.uri}} style={styles.fill} resizeMode="contain" accessibilityLabel="Ảnh" />;
  }
  return (
    <WebView
      style={styles.fill}
      source={{html: videoPlayerHtml(source.uri), baseUrl: source.state === 'local' ? 'file:///' : undefined}}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      testID="media-video"
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space.sm,
  },
  fill: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  message: {
    textAlign: 'center',
  },
});
