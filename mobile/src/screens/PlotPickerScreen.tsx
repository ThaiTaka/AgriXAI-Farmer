/**
 * Màn hình 02 — Chọn lô (thiết kế v6).
 *
 * Hai tab: "Lô của tôi" liệt kê từng lô kèm nhãn trạng thái đồng bộ và nút
 * "Chọn lô"; "Cài đặt" gom những gì liên quan tới chính danh sách này —
 * trạng thái đồng bộ theo bảng và lối vào phần Cài đặt đầy đủ.
 *
 * Màn này KHÔNG thay PlotDetailScreen (chi tiết một lô, 4 tab): nó là bước
 * chọn trước đó, mở từ trang chủ khi nông hộ có nhiều lô.
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useCurrentUser} from '../auth/AuthContext';
import {AppHeader} from '../components/AppHeader';
import {Badge} from '../components/Badge';
import {IconTile} from '../components/IconTile';
import {Card} from '../components/Card';
import {EmptyState} from '../components/EmptyState';
import {ChevronRight, CropIcon, SproutIcon} from '../components/icons';
import {Screen} from '../components/Screen';
import {SyncStatus} from '../components/SyncStatus';
import {Tabs} from '../components/Tabs';
import type Plot from '../db/models/Plot';
import {observePlots} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import {plotsSummary, syncBadgeOf} from '../domain/plotSync';
import type {RootStackParamList} from '../navigation/types';
import {colors, radius, size, space, text} from '../theme';
import {formatArea} from '../utils/format';
import {cropNameOf, cropTypeById} from '../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TabKey = 'plots' | 'settings';

const TABS = [
  {key: 'plots' as const, label: 'Lô của tôi'},
  {key: 'settings' as const, label: 'Cài đặt'},
];

export function PlotPickerScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const [tab, setTab] = useState<TabKey>('plots');
  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  const choose = useCallback(
    (plot: Plot) => navigation.navigate('PlotDetail', {plotId: plot.id}),
    [navigation],
  );

  return (
    <Screen>
      <AppHeader title="Lô của tôi" eyebrow="Chọn lô để quản lý" onBack={() => navigation.goBack()} />
      <Text style={[text('bodySm', colors.text.muted), styles.summary]}>{plotsSummary(plots)}</Text>
      <Tabs items={TABS} value={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'plots' ? (
          plots.length === 0 ? (
            <EmptyState
              icon={<SproutIcon color={colors.gray['400']} />}
              title="Chưa có lô nào được giao"
              body="Lô đất do bên quản lý đất chia và gán cho bạn. Khi đã được giao, mở ứng dụng lúc có mạng là lô hiện ra ở đây."
            />
          ) : (
            <View style={styles.list}>
              {plots.map(plot => {
                const badge = syncBadgeOf(plot.syncStatus);
                const cropName = cropNameOf(plot.cropType, plot.cropName);
                return (
                  <Card
                    key={plot.id}
                    style={styles.card}
                    onPress={() => choose(plot)}
                    accessibilityLabel={`Lô ${plot.code}`}
                    testID={`plot-${plot.code}`}>
                    <View style={styles.cardHead}>
                      <View style={styles.cardText}>
                        <Text style={text('cardTitle')} numberOfLines={1}>
                          {plot.code}
                        </Text>
                        <Text style={[text('bodySm', colors.text.muted), styles.line]} numberOfLines={1}>
                          {[cropName, plot.varietyName].filter(Boolean).join(' · ')}
                        </Text>
                        <Text style={[text('bodySm', colors.text.muted), styles.line]} numberOfLines={1}>
                          {formatArea(plot.area, plot.areaUnit)}
                        </Text>
                      </View>
                      <IconTile size={40} tone={badge.state === 'pending' ? 'amber' : 'green'}>
                        <CropIcon name={cropTypeById(plot.cropType)?.icon ?? 'other'} size={22} />
                      </IconTile>
                    </View>

                    <View style={styles.cardFoot}>
                      <Badge label={badge.label} tone={badge.tone} />
                      <ChevronRight />
                    </View>
                  </Card>
                );
              })}

            </View>
          )
        ) : (
          <View style={styles.list}>
            <Card>
              <Text style={[text('cardTitle'), styles.settingsTitle]}>Trạng thái đồng bộ</Text>
              <SyncStatus />
              <Text style={[text('caption', colors.text.muted), styles.settingsNote]}>
                Mọi thay đổi lưu trên máy trước rồi mới đẩy lên máy chủ — tắt mạng vẫn ghi được.
              </Text>
            </Card>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở cài đặt đầy đủ"
              onPress={() => navigation.navigate('Settings')}
              style={({pressed}) => [styles.linkRow, pressed && styles.addRowPressed]}>
              <Text style={text('bodyStrong')}>Cài đặt đầy đủ</Text>
              <ChevronRight />
            </Pressable>

          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space['3xl'],
  },
  list: {
    gap: space.md,
  },
  card: {
    gap: space.md,
  },
  summary: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    marginTop: 2,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  addRowPressed: {
    backgroundColor: colors.surface.pressed,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: size.buttonMinHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
  },
  settingsTitle: {
    marginBottom: space.sm,
  },
  settingsNote: {
    marginTop: space.sm,
  },
});
