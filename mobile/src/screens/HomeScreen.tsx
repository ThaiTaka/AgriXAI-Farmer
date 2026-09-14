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
import {
  BellIcon,
  CalculatorIcon,
  ClipboardIcon,
  CoinsIcon,
  PlusIcon,
  SackIcon,
  ScaleIcon,
  SproutIcon,
  TagIcon,
  WarehouseIcon,
} from '../components/icons';
import {PlotCard} from '../components/PlotCard';
import {Screen} from '../components/Screen';
import {SyncStatus} from '../components/SyncStatus';
import type Plot from '../db/models/Plot';
import type TaskHistory from '../db/models/TaskHistory';
import {observePlots} from '../db/repositories/plotRepository';
import {observeUpcomingReminders} from '../db/repositories/taskHistoryRepository';
import {useObservable} from '../db/useObservable';
import type {RootStackParamList} from '../navigation/types';
import {colors, radius, space, text} from '../theme';
import {formatDate, formatWeekdayDate} from '../utils/format';
import {allProtocols, fertilizerProducts} from '../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ToolRoute = 'FertilizerCalculator' | 'FertilizerBudget' | 'StockCheck' | 'CareProtocol' | 'Warehouse' | 'Finance';

/** The six Giai đoạn 3 tools, two per row; the catalogue sits under them. */
const TOOLS: {route: ToolRoute; title: string; meta: string; icon: React.ReactNode; testID: string}[] = [
  {route: 'FertilizerCalculator', title: 'Tính lượng phân', meta: 'Theo diện tích & phương án', icon: <CalculatorIcon />, testID: 'home-calculator'},
  {route: 'FertilizerBudget', title: 'Lọc theo ngân sách', meta: 'Bình dân · Trung bình · Cao cấp', icon: <TagIcon />, testID: 'home-budget'},
  {route: 'StockCheck', title: 'Kiểm tra kho', meta: 'Đủ hay thiếu trước khi bón', icon: <ScaleIcon />, testID: 'home-stock-check'},
  {route: 'CareProtocol', title: 'Quy trình chăm sóc', meta: `${allProtocols().length} quy trình có nguồn`, icon: <ClipboardIcon />, testID: 'home-care'},
  {route: 'Warehouse', title: 'Kho vật tư', meta: 'Nhập · Xuất · Tồn', icon: <WarehouseIcon />, testID: 'home-warehouse'},
  {route: 'Finance', title: 'Thu – Chi', meta: 'Ghi chép & lãi/lỗ', icon: <CoinsIcon />, testID: 'home-finance'},
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const {signOut} = useAuth();

  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);
  const reminders = useObservable<TaskHistory[]>(() => observeUpcomingReminders(user.id), [user.id], []);

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
        <View style={styles.toolGrid}>
          {TOOLS.map(tool => (
            <Card
              key={tool.route}
              onPress={() => navigation.navigate(tool.route)}
              accessibilityLabel={tool.title}
              style={styles.toolTile}
              testID={tool.testID}>
              <View style={styles.toolIcon}>{tool.icon}</View>
              <Text style={text('cardTitle')} numberOfLines={1}>
                {tool.title}
              </Text>
              <Text style={[text('caption', colors.text.muted), styles.toolMeta]} numberOfLines={2}>
                {tool.meta}
              </Text>
            </Card>
          ))}
        </View>
        <Card
          onPress={() => navigation.navigate('FertilizerGroups')}
          accessibilityLabel="Danh mục phân bón"
          style={styles.tool}
          testID="home-fertilizers">
          <View style={styles.toolIconSm}>
            <SackIcon />
          </View>
          <View style={styles.toolBody}>
            <Text style={text('bodyStrong')}>Danh mục phân bón</Text>
            <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
              {fertilizerProducts().length} sản phẩm · giá tham khảo
            </Text>
          </View>
        </Card>

        {reminders.length > 0 ? (
          <>
            <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Nhắc việc sắp tới</Text>
            <Card flush style={styles.reminders}>
              {reminders.slice(0, 5).map((row, index) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('CareProtocol', {plotId: row.plotId ?? undefined, protocolId: row.protocolId})}
                  style={({pressed}) => [
                    styles.reminderRow,
                    index === Math.min(reminders.length, 5) - 1 && styles.reminderLast,
                    pressed && styles.reminderPressed,
                  ]}>
                  <BellIcon size={18} />
                  <View style={styles.toolBody}>
                    <Text style={text('bodySm')} numberOfLines={1}>
                      {row.taskTitle}
                    </Text>
                    <Text style={text('caption', colors.text.muted)}>{formatDate(row.remindAt)}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

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
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    marginBottom: space.lg,
  },
  toolTile: {
    // Two columns with a 16pt gutter: (100% - 16) / 2.
    width: '47.8%',
    minHeight: 124,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
    paddingVertical: space.md,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  toolIconSm: {
    width: 36,
    height: 36,
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
  reminders: {
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    minHeight: 52,
  },
  reminderLast: {
    borderBottomWidth: 0,
  },
  reminderPressed: {
    backgroundColor: colors.surface.pressed,
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
