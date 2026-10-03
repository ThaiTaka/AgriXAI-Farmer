/**
 * Thông báo — messages from the admin, weather warnings and price changes.
 *
 * Read from the local database, so the inbox opens without signal. Tapping a
 * message opens it (and marks it read on this account — the mark syncs, so a
 * second phone agrees and web-admin can count how many farms saw it);
 * "Đọc hết" clears the badge in one go. Expired warnings move to "Đã qua".
 */

import notifee, {AuthorizationStatus} from '@notifee/react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, SectionList, StyleSheet, Text, View} from 'react-native';

import {useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {GhostButton} from '../../components/buttons';
import {EmptyState} from '../../components/EmptyState';
import {AlertIcon, BellIcon, ChevronRight, CoinsIcon, ThermometerIcon} from '../../components/icons';
import {Screen} from '../../components/Screen';
import {SourceLink} from '../../components/SourceLink';
import {WeatherGlyph} from '../../components/WeatherGlyph';
import type AppNotification from '../../db/models/AppNotification';
import type NotificationRead from '../../db/models/NotificationRead';
import {markRead, observeNotifications, observeReads, toNotice} from '../../db/repositories/notificationRepository';
import {useObservableReady} from '../../db/useObservable';
import type {NoticeLike} from '../../domain/notifications';
import {inboxSections, isExpired, isUnread, lastReads, targetOf, timeAgo} from '../../domain/notifications';
import type {RootStackParamList} from '../../navigation/types';
import {dismissNotice} from '../../notify/notifier';
import {colors, radius, size, space, text} from '../../theme';
import {fertilizerProduct} from '../../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Notifications'>;

const LEVEL_TONE: Record<string, {bg: string; fg: string}> = {
  danger: {bg: colors.badge.redBg, fg: colors.badge.redFg},
  warning: {bg: colors.badge.yellowBg, fg: colors.badge.yellowFg},
  info: {bg: colors.primary.soft, fg: colors.primary.default},
};

const KIND_LABEL: Record<string, string> = {
  weather: 'Thời tiết',
  price: 'Giá phân bón',
  announcement: 'Ban quản lý',
};

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const notices = useObservableReady<AppNotification[]>(() => observeNotifications(), [], []);
  const reads = useObservableReady<NotificationRead[]>(() => observeReads(user.id), [user.id], []);
  const [openId, setOpenId] = useState<string | null>(params?.focusId ?? null);
  const [blocked, setBlocked] = useState(false);
  const now = Date.now();

  const readMap = useMemo(() => lastReads(reads.value), [reads.value]);
  const sections = useMemo(
    () => inboxSections(notices.value.map(toNotice), readMap, now),
    // `now` moves every render; the list only needs to follow the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notices.value, readMap],
  );
  const unread = useMemo(() => sections.find(s => s.key === 'unread')?.data ?? [], [sections]);

  useEffect(() => {
    notifee
      .getNotificationSettings()
      .then(s => setBlocked(s.authorizationStatus === AuthorizationStatus.DENIED))
      .catch(() => {});
  }, []);

  // Opened from a system notification: that one is read now.
  useEffect(() => {
    if (!params?.focusId) return;
    const target = notices.value.find(n => n.id === params.focusId);
    if (target) {
      markRead(user.id, [{id: target.id, updatedAt: target.updatedAt}]).catch(() => {});
      setOpenId(target.id);
    }
  }, [params?.focusId, notices.value, user.id]);

  const toggle = useCallback(
    (notice: NoticeLike) => {
      setOpenId(prev => (prev === notice.id ? null : notice.id));
      if (isUnread(notice, readMap)) {
        markRead(user.id, [notice]).catch(error => console.warn('[notify] mark read failed', error));
        dismissNotice(notice.id);
      }
    },
    [readMap, user.id],
  );

  const readAll = useCallback(() => {
    markRead(user.id, unread).catch(error => console.warn('[notify] mark all failed', error));
    unread.forEach(n => dismissNotice(n.id));
  }, [unread, user.id]);

  const follow = useCallback(
    (notice: NoticeLike) => {
      const target = targetOf(notice.link);
      if (!target) return;
      if (target.screen === 'Weather') navigation.navigate('Weather');
      else if (target.screen === 'CareGuide') navigation.navigate('CareGuide', {guideId: target.guideId});
      else {
        const product = target.productId ? fertilizerProduct(target.productId) : undefined;
        if (product) navigation.navigate('FertilizerProducts', {categoryCode: product.category});
        else navigation.navigate('FertilizerGroups');
      }
    },
    [navigation],
  );

  return (
    <Screen>
      <AppHeader
        eyebrow="Hộp thư"
        title="Thông báo"
        onBack={() => navigation.goBack()}
        action={unread.length > 0 ? {label: 'Đọc hết', onPress: readAll} : undefined}
      />
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          blocked ? (
            <View style={styles.blocked}>
              <AlertIcon size={18} color={colors.badge.yellowFg} />
              <Text style={[text('bodySm', colors.badge.yellowFg), styles.flex]}>
                Thông báo của ứng dụng đang bị tắt — bạn sẽ không nhận cảnh báo mưa to khi không mở ứng dụng.
              </Text>
              <GhostButton small label="Bật" onPress={() => notifee.openNotificationSettings().catch(() => {})} />
            </View>
          ) : null
        }
        renderSectionHeader={({section}) => (
          <Text style={[text('eyebrow', colors.text.secondary), styles.sectionTitle]}>
            {section.title}
            {section.key === 'unread' ? ` · ${section.data.length}` : ''}
          </Text>
        )}
        renderItem={({item, section}) => (
          <NoticeCard
            notice={item}
            unread={section.key === 'unread'}
            past={section.key === 'past' || isExpired(item, now)}
            open={openId === item.id}
            now={now}
            source={notices.value.find(n => n.id === item.id) ?? null}
            onPress={() => toggle(item)}
            onFollow={() => follow(item)}
          />
        )}
        ListEmptyComponent={
          notices.ready ? (
            <EmptyState
              icon={<BellIcon size={26} color={colors.text.secondary} />}
              title="Chưa có thông báo nào"
              body="Tin của ban quản lý, cảnh báo mưa to hay rét hại và giá phân mới sẽ hiện ở đây — xem được cả khi mất mạng."
            />
          ) : null
        }
      />
    </Screen>
  );
}

function NoticeIcon({notice}: {notice: NoticeLike}) {
  const tone = LEVEL_TONE[notice.level] ?? LEVEL_TONE.info;
  let glyph: React.ReactNode = <BellIcon size={20} color={tone.fg} />;
  if (notice.kind === 'weather') {
    glyph = notice.title.includes('rét') ? <ThermometerIcon size={22} color={tone.fg} /> : <WeatherGlyph icon="rain" size={28} />;
  }
  else if (notice.kind === 'price') glyph = <CoinsIcon size={20} color={tone.fg} />;
  else if (notice.level !== 'info') glyph = <AlertIcon size={20} color={tone.fg} />;
  return <View style={[styles.icon, {backgroundColor: tone.bg}]}>{glyph}</View>;
}

function NoticeCard({
  notice,
  unread,
  past,
  open,
  now,
  source,
  onPress,
  onFollow,
}: {
  notice: NoticeLike;
  unread: boolean;
  past: boolean;
  open: boolean;
  now: number;
  source: AppNotification | null;
  onPress: () => void;
  onFollow: () => void;
}) {
  const target = targetOf(notice.link);
  const followLabel = target?.screen === 'Weather' ? 'Xem dự báo 7 ngày' : target?.screen === 'Prices' ? 'Xem bảng giá' : target ? 'Xem hướng dẫn' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{expanded: open}}
      accessibilityLabel={`${unread ? 'Chưa xem. ' : ''}${notice.title}`}
      onPress={onPress}
      testID={`notice-${notice.id}`}
      style={({pressed}) => [styles.card, unread && styles.cardUnread, past && styles.cardPast, pressed && styles.pressed]}>
      <View style={styles.row}>
        <NoticeIcon notice={notice} />
        <View style={styles.flex}>
          <View style={styles.metaRow}>
            <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
              {KIND_LABEL[notice.kind] ?? 'Thông báo'} · {timeAgo(notice.createdAt, now)}
            </Text>
            {unread ? <View style={styles.dot} accessibilityElementsHidden /> : null}
          </View>
          <Text style={text(unread ? 'cardTitle' : 'bodyStrong', past ? colors.text.muted : colors.text.primary)} numberOfLines={open ? undefined : 2}>
            {notice.title}
          </Text>
          {notice.body ? (
            <Text style={[text('bodySm', colors.text.secondary), styles.body]} numberOfLines={open ? undefined : 2}>
              {notice.body}
            </Text>
          ) : null}
        </View>
        <View style={open ? styles.chevronOpen : undefined}>
          <ChevronRight color={colors.text.muted} />
        </View>
      </View>

      {open && (past || source?.sourceName || followLabel) ? (
        <View style={styles.more}>
          {past ? <Text style={text('caption', colors.text.muted)}>Đã qua thời hạn của thông báo này.</Text> : null}
          {source?.sourceName ? (
            source.sourceUrl ? (
              <SourceLink url={source.sourceUrl} citation={source.sourceName} label="Mở bản tin chính thức" />
            ) : (
              <Text style={text('caption', colors.text.muted)}>Nguồn: {source.sourceName}</Text>
            )
          ) : null}
          {followLabel ? <GhostButton small label={followLabel} onPress={onFollow} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
    flexGrow: 1,
  },
  sectionTitle: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
  blocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.badge.yellowBg,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: space.md,
    marginBottom: space.sm,
    minHeight: size.minTouchTarget,
  },
  cardUnread: {
    borderColor: colors.primary.softStrong,
    backgroundColor: colors.green['050'],
  },
  cardPast: {
    backgroundColor: colors.surface.subtle,
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.semantic.error,
  },
  body: {
    marginTop: 2,
  },
  chevronOpen: {
    transform: [{rotate: '90deg'}],
  },
  more: {
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    gap: space.sm,
    alignItems: 'flex-start',
  },
});
