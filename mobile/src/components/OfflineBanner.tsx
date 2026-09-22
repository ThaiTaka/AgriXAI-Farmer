import React, {useContext, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import type {BannerMessage} from '../domain/syncStatus';
import {bannerFor} from '../domain/syncStatus';
import {useSync} from '../sync/SyncContext';
import {colors, space, text} from '../theme';
import {CheckCircleIcon, CloseIcon, OfflineIcon} from './icons';

/**
 * One line at the top of the app that says where the data stands:
 *   offline  → amber "Chế độ offline — thay đổi sẽ lưu khi online" (auto-hides after 8 s, dismissible)
 *   syncing  → "Đang đồng bộ…"
 *   synced   → "Cập nhật lúc 14:35" (3 s)
 * Never a modal, never blocks a tap: being offline is a normal working state.
 */
export function OfflineBanner() {
  const {state, lastSyncedAt} = useSync();
  // The banner renders above every SafeAreaView, so it pads past the notch
  // itself. Read the context rather than useSafeAreaInsets(), which throws
  // when no provider is mounted.
  const insets = useContext(SafeAreaInsetsContext);
  const [message, setMessage] = useState<BannerMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    // The very first idle (before any sync ran) has nothing to announce.
    if (first.current && state === 'idle' && !lastSyncedAt) {
      first.current = false;
      return;
    }
    first.current = false;
    const next = bannerFor(state, lastSyncedAt);
    setMessage(next);
    if (next?.hideAfterMs) {
      timer.current = setTimeout(() => setMessage(null), next.hideAfterMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, lastSyncedAt]);

  if (!message) return null;

  const tone = TONES[message.kind];
  return (
    <View
      style={[styles.banner, {backgroundColor: tone.bg, paddingTop: space.sm + (insets?.top ?? 0)}]}
      accessibilityLiveRegion="polite"
      testID={`banner-${message.kind}`}>
      {message.kind === 'offline' || message.kind === 'error' ? <OfflineIcon size={16} color={tone.fg} /> : null}
      {message.kind === 'synced' ? <CheckCircleIcon size={16} color={tone.fg} /> : null}
      <Text style={[text('meta', tone.fg), styles.text]} numberOfLines={2}>
        {message.text}
      </Text>
      {message.hideAfterMs ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Ẩn thông báo" hitSlop={8} onPress={() => setMessage(null)}>
          <CloseIcon size={16} color={tone.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const TONES: Record<BannerMessage['kind'], {bg: string; fg: string}> = {
  offline: {bg: colors.banner.offlineBg, fg: colors.banner.offlineFg},
  error: {bg: colors.badge.redBg, fg: colors.badge.redFg},
  syncing: {bg: colors.badge.blueBg, fg: colors.badge.blueFg},
  synced: {bg: colors.badge.greenBg, fg: colors.badge.greenFg},
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: 40,
  },
  text: {
    flex: 1,
  },
});
