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
import {PrimaryButton, SecondaryButton} from '../components/buttons';
import {Card} from '../components/Card';
import {EmptyState} from '../components/EmptyState';
import {ChevronRight, CropIcon, PlusIcon, SproutIcon} from '../components/icons';
import {Screen} from '../components/Screen';
import {SyncStatus} from '../components/SyncStatus';
import {Tabs} from '../components/Tabs';
import type Plot from '../db/models/Plot';
import {observePlots} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import {plotsSummary, syncBadgeOf} from '../domain/plotSync';
import type {RootStackParamList} from '../navigation/types';
import {colors, radius, space, text} from '../theme';
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
      <AppHeader title="Chọn lô" eyebrow={plotsSummary(plots)} onBack={() => navigation.goBack()} />
      <Tabs items={TABS} value={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'plots' ? (
          plots.length === 0 ? (
            <EmptyState
              icon={<SproutIcon color={colors.gray['400']} />}
              title="Chưa có lô nào"
              body="Thêm lô đất đầu tiên để bắt đầu ghi chép vật tư và chi phí cho vườn của bạn."
              action={{label: 'Thêm lô', onPress: () => navigation.navigate('PlotForm')}}
            />
          ) : (
            <View style={styles.list}>
              {plots.map(plot => {
                const badge = syncBadgeOf(plot.syncStatus);
                const cropName = cropNameOf(plot.cropType, plot.cropName);
                return (
                  <Card key={plot.id} style={styles.card} testID={`plot-${plot.code}`}>
                    <View style={styles.cardHead}>
                      <View style={styles.iconBox}>
                        <CropIcon name={cropTypeById(plot.cropType)?.icon ?? 'other'} size={24} />
                      </View>
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
                    </View>

                    <View style={styles.cardFoot}>
                      <Badge label={badge.label} tone={badge.tone} />
                      <SecondaryButton
                        small
                        label="Chọn lô"
                        onPress={() => choose(plot)}
                        testID={`choose-${plot.code}`}
                      />
                    </View>
                  </Card>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm lô đất"
                onPress={() => navigation.navigate('PlotForm')}
                style={({pressed}) => [styles.addRow, pressed && styles.addRowPressed]}>
                <PlusIcon size={18} />
                <Text style={text('bodyStrong', colors.primary.default)}>Thêm lô đất</Text>
              </Pressable>
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
              onPress={() => navigation.navigate('Main', {screen: 'Settings'})}
              style={({pressed}) => [styles.linkRow, pressed && styles.addRowPressed]}>
              <Text style={text('bodyStrong')}>Cài đặt đầy đủ</Text>
              <ChevronRight />
            </Pressable>

            <PrimaryButton label="Thêm lô đất" onPress={() => navigation.navigate('PlotForm')} />
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
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
  },
  addRowPressed: {
    backgroundColor: colors.surface.pressed,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
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
