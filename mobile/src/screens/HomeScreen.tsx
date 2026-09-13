/**
 * Màn hình 02 — Trang chủ.
 *
 * Greeting + avatar, a row of tools (today: the fertiliser catalogue; Giai đoạn 3
 * adds the calculator, care schedule, stock and finance), then the plot list.
 *
 * Everything renders from a WatermelonDB observable query — with the network
 * off the list still loads, and a plot added offline appears the instant it is
 * written (Điều 1).
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useAuth, useCurrentUser} from '../auth/AuthContext';
import {GhostButton} from '../components/buttons';
import {Card} from '../components/Card';
import {EmptyState} from '../components/EmptyState';
import {ChevronRight, PlusIcon, SackIcon, SproutIcon} from '../components/icons';
import {PlotCard} from '../components/PlotCard';
import {Screen} from '../components/Screen';
import {SyncStatus} from '../components/SyncStatus';
import type Plot from '../db/models/Plot';
import {observePlots} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import type {RootStackParamList} from '../navigation/types';
import {colors, radius, space, text} from '../theme';
import {formatWeekdayDate} from '../utils/format';
import {fertilizerCategories, fertilizerProducts} from '../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const {signOut} = useAuth();

  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  const openPlot = useCallback(
    (plot: Plot) => navigation.navigate('PlotDetail', {plotId: plot.id}),
    [navigation],
  );

  const confirmSignOut = useCallback(() => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi ứng dụng?', [
      {text: 'Huỷ', style: 'cancel'},
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          signOut().catch(error => console.warn('[auth] sign out failed', error));
        },
      },
    ]);
  }, [signOut]);

  // Vietnamese names put the given name last, so the avatar shows the first
  // letter of the final word: "Thái Taka" -> "T".
  const initial =
    (user.fullName || user.username).trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={text('heading')} numberOfLines={1}>
              Chào {user.fullName || user.username}
            </Text>
            <Text style={[text('bodySm', colors.text.muted), styles.headerMeta]}>
              {formatWeekdayDate()}
              {user.region ? ` · ${user.region}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tài khoản và đăng xuất"
            onPress={confirmSignOut}
            style={({pressed}) => [styles.avatar, pressed && styles.avatarPressed]}>
            <Text style={text('cardTitle', colors.primary.default)}>{initial}</Text>
          </Pressable>
        </View>

        <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Công cụ</Text>
        <Card
          onPress={() => navigation.navigate('FertilizerGroups')}
          accessibilityLabel="Danh mục phân bón"
          style={styles.tool}
          testID="home-fertilizers">
          <View style={styles.toolIcon}>
            <SackIcon />
          </View>
          <View style={styles.toolBody}>
            <Text style={text('cardTitle')}>Danh mục phân bón</Text>
            <Text style={[text('bodySm', colors.text.muted), styles.toolMeta]} numberOfLines={1}>
              {fertilizerCategories().length} nhóm · {fertilizerProducts().length} sản phẩm · giá
              tham khảo
            </Text>
          </View>
          <ChevronRight />
        </Card>

        <View style={styles.sectionHead}>
          <Text style={text('eyebrow', colors.text.muted)}>Lô đất của bạn</Text>
          <GhostButton
            small
            label="Thêm lô"
            icon={<PlusIcon size={16} />}
            onPress={() => navigation.navigate('PlotForm')}
          />
        </View>

        {plots.length === 0 ? (
          <EmptyState
            icon={<SproutIcon color={colors.gray['400']} />}
            title="Chưa có lô đất nào"
            body="Thêm lô đất đầu tiên để bắt đầu ghi chép vật tư và chi phí cho vườn của bạn."
            action={{label: 'Thêm lô đất', onPress: () => navigation.navigate('PlotForm')}}
          />
        ) : (
          <View style={styles.list}>
            {plots.map(plot => (
              <PlotCard key={plot.id} plot={plot} onPress={openPlot} />
            ))}
          </View>
        )}

        <View style={styles.footnote}>
          <SyncStatus />
          <Text style={text('caption', colors.text.muted)}>
            Danh sách đọc từ máy — vẫn xem và thêm lô được khi mất mạng.
          </Text>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.soft,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: {
    backgroundColor: colors.primary.softStrong,
  },
  sectionLabel: {
    marginBottom: space.sm,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBody: {
    flex: 1,
    minWidth: 0,
  },
  toolMeta: {
    marginTop: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    gap: space.sm,
  },
  list: {
    gap: space.md,
  },
  footnote: {
    marginTop: space.xl,
    gap: space.xs,
  },
});
