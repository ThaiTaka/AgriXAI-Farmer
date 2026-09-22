/**
 * Trang chủ — dashboard nông hộ.
 *
 * Greeting, three summary cards (tồn kho · tháng này · công việc), six tool
 * buttons, then the plot list. Every number comes from local observables
 * through useDashboard, so the screen is complete with the network off and
 * updates the instant a row is written (Điều 1).
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useState} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useAuth, useCurrentUser} from '../auth/AuthContext';
import {GhostButton, IconButton} from '../components/buttons';
import {Card} from '../components/Card';
import {DashboardCard} from '../components/DashboardCard';
import {EmptyState} from '../components/EmptyState';
import {IconTile} from '../components/IconTile';
import {
  BellIcon,
  CalculatorIcon,
  ClipboardIcon,
  CoinsIcon,
  PlusIcon,
  ScaleIcon,
  SettingsIcon,
  ShareIcon,
  SproutIcon,
  WarehouseIcon,
} from '../components/icons';
import {PlotCard} from '../components/PlotCard';
import {Screen} from '../components/Screen';
import {SyncStatus} from '../components/SyncStatus';
import type Plot from '../db/models/Plot';
import type TaskHistory from '../db/models/TaskHistory';
import {observeUpcomingReminders} from '../db/repositories/taskHistoryRepository';
import {useObservable} from '../db/useObservable';
import {pendingSubtext, pendingTotal} from '../domain/dashboard';
import type {RootStackParamList} from '../navigation/types';
import {useSync} from '../sync/SyncContext';
import {colors, radius, shadows, size, space, text} from '../theme';
import {formatDate, formatNumber, formatVnd, formatWeekdayDate} from '../utils/format';
import {useDashboard} from './home/useDashboard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ToolRoute = 'FertilizerCalculator' | 'FertilizerBudget' | 'CareProtocol' | 'Warehouse' | 'Finance' | 'ReportExport';

/** The six tools, two per row, in the order the brief lists them. */
const TOOLS: {route: ToolRoute; title: string; meta: string; icon: React.ReactNode; testID: string}[] = [
  {route: 'FertilizerCalculator', title: 'F1 · Tính lượng', meta: 'Phân bón theo diện tích', icon: <CalculatorIcon />, testID: 'home-calculator'},
  {route: 'FertilizerBudget', title: 'F3–F4 · Lọc + kiểm', meta: 'Ngân sách rồi kiểm tra kho', icon: <ScaleIcon />, testID: 'home-budget'},
  {route: 'CareProtocol', title: 'F5–F6 · Quy trình', meta: '4 giai đoạn, có nguồn', icon: <ClipboardIcon />, testID: 'home-care'},
  {route: 'Warehouse', title: 'Kho · Nhập/xuất', meta: 'Tồn, FIFO, CSV', icon: <WarehouseIcon />, testID: 'home-warehouse'},
  {route: 'Finance', title: 'Thu-chi · Ghi', meta: 'Sổ thu, sổ chi', icon: <CoinsIcon />, testID: 'home-finance'},
  {route: 'ReportExport', title: 'Báo cáo · Xuất PDF', meta: 'Tháng / quý, A4', icon: <ShareIcon size={22} />, testID: 'home-report'},
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const {signOut} = useAuth();
  const {pending: pendingSync} = useSync();
  const data = useDashboard(user.id);
  const reminders = useObservable<TaskHistory[]>(() => observeUpcomingReminders(user.id), [user.id], []);

  const openPlot = useCallback((plot: Plot) => navigation.navigate('PlotDetail', {plotId: plot.id}), [navigation]);

  // The header earns its hairline + shadow only once content slides under it.
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > 8;
    setScrolled(prev => (prev === past ? prev : past));
  }, []);

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
  // letter of the final word: "Nguyễn Văn Cường" -> "C".
  const initial = (user.fullName || user.username).trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
  const stockPending = pendingSync.some(p => (p.table === 'warehouse_in' || p.table === 'warehouse_out') && p.pending > 0);
  const financePending = pendingSync.some(p => (p.table === 'income' || p.table === 'expense') && p.pending > 0);
  const taskCount = pendingTotal(data.pending);
  const loss = data.month.profit < 0;

  return (
    <Screen ground="gradient">
      <View style={[styles.header, scrolled && styles.headerScrolled]}>
        <View style={styles.headerText}>
          <Text style={text('heading')} numberOfLines={2}>
            Xin chào {user.fullName || user.username}
          </Text>
          <Text style={[text('bodySm', colors.text.muted), styles.headerMeta]} numberOfLines={2}>
            {formatWeekdayDate()}
            {user.region ? ` · ${user.region}` : ''}
          </Text>
        </View>
        <IconButton
          accessibilityLabel="Cài đặt"
          onPress={() => navigation.navigate('Main', {screen: 'Settings'})}>
          <SettingsIcon size={22} color={colors.text.secondary} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tài khoản và đăng xuất"
          onPress={confirmSignOut}
          style={({pressed}) => [styles.avatar, pressed && styles.avatarPressed]}>
          <Text style={text('cardTitle', colors.primary.default)}>{initial}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}>
        <View style={styles.cards}>
          <DashboardCard
            testID="card-stock"
            label="Tồn kho"
            value={formatVnd(Math.round(data.stock.value))}
            subtext={
              data.stock.kinds > 0
                ? `${data.stock.kinds} loại phân bón, ${formatNumber(data.stock.kg)} kg`
                : 'Kho trống — nhập phiếu mua đầu tiên ở Kho'
            }
            flag={stockPending ? 'Chưa đồng bộ' : null}
            icon={<WarehouseIcon size={24} />}
            tone="green"
            onPress={() => navigation.navigate('Warehouse', {tab: 'stock'})}
          />
          <DashboardCard
            testID="card-month"
            label={`Tháng ${data.monthNumber} này`}
            prefix={loss ? 'Lỗ' : 'Lãi'}
            value={formatVnd(Math.abs(Math.round(data.month.profit)))}
            negative={loss}
            subtext={`Thu ${formatVnd(data.month.income)}, Chi ${formatVnd(data.month.expense)}`}
            flag={financePending ? 'Chưa đồng bộ' : null}
            icon={<CoinsIcon size={24} color={colors.green['800']} />}
            tone="lime"
            onPress={() => navigation.navigate('Finance', {tab: 'report'})}
          />
          <DashboardCard
            testID="card-tasks"
            label="Công việc"
            value={String(taskCount)}
            unit={taskCount > 0 ? 'việc giai đoạn này' : 'việc chờ'}
            subtext={pendingSubtext(data.pending)}
            icon={<ClipboardIcon size={24} color={colors.badge.yellowFg} />}
            tone="amber"
            onPress={() => navigation.navigate('CareProtocol', data.pending[0] ? {plotId: data.pending[0].plotId} : undefined)}
          />
        </View>

        <Text style={[text('eyebrow', colors.text.secondary), styles.sectionLabel]}>Công cụ</Text>
        <View style={styles.toolGrid}>
          {TOOLS.map(tool => (
            <Card key={tool.route} onPress={() => navigation.navigate(tool.route)} accessibilityLabel={tool.title} style={styles.toolTile} testID={tool.testID}>
              <IconTile size={44} style={styles.toolIcon}>
                {tool.icon}
              </IconTile>
              <Text style={text('bodyStrong')} numberOfLines={2}>
                {tool.title}
              </Text>
              <Text style={[text('caption', colors.text.muted), styles.toolMeta]} numberOfLines={2}>
                {tool.meta}
              </Text>
            </Card>
          ))}
        </View>

        {reminders.length > 0 ? (
          <>
            <Text style={[text('eyebrow', colors.text.secondary), styles.sectionLabel]}>Nhắc việc sắp tới</Text>
            <Card flush style={styles.reminders}>
              {reminders.slice(0, 5).map((row, index) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('CareProtocol', {plotId: row.plotId ?? undefined, protocolId: row.protocolId})}
                  style={({pressed}) => [styles.reminderRow, index === Math.min(reminders.length, 5) - 1 && styles.reminderLast, pressed && styles.reminderPressed]}>
                  <BellIcon size={18} />
                  <View style={styles.reminderBody}>
                    <Text style={text('bodySm')} numberOfLines={2}>
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
          <Text style={text('eyebrow', colors.text.secondary)}>Lô đất của bạn</Text>
          <View style={styles.sectionActions}>
            {data.plots.length > 0 ? (
              <GhostButton small label="Chọn lô" onPress={() => navigation.navigate('PlotPicker')} testID="home-plot-picker" />
            ) : null}
            <GhostButton small label="Thêm lô" icon={<PlusIcon size={16} />} onPress={() => navigation.navigate('PlotForm')} />
          </View>
        </View>

        {data.plots.length === 0 ? (
          <EmptyState
            icon={<SproutIcon color={colors.gray['400']} />}
            title="Chưa có lô đất nào"
            body="Thêm lô đất đầu tiên để bắt đầu ghi chép vật tư và chi phí cho vườn của bạn."
            action={{label: 'Thêm lô đất', onPress: () => navigation.navigate('PlotForm')}}
          />
        ) : (
          <View style={styles.list}>
            {data.plots.map(plot => (
              <PlotCard key={plot.id} plot={plot} onPress={openPlot} />
            ))}
          </View>
        )}

        <View style={styles.footnote}>
          <SyncStatus />
          <Text style={text('caption', colors.text.muted)}>Số liệu đọc từ máy — vẫn xem và ghi được khi mất mạng.</Text>
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
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.gradient.groundFrom,
  },
  headerScrolled: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    ...shadows.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    marginTop: space.xs,
  },
  avatar: {
    width: size.minTouchTarget,
    height: size.minTouchTarget,
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
  cards: {
    gap: space.md,
    marginBottom: space.xl,
  },
  sectionLabel: {
    marginBottom: space.sm,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.lg,
    marginBottom: space.xl,
  },
  toolTile: {
    // space-between supplies the gutter: a fixed percentage cannot express
    // "half the row minus a gap" and collapses to one column under ~396pt.
    width: '48%',
    minHeight: 140,
    padding: space.lg,
  },
  toolIcon: {
    marginBottom: space.md,
  },
  toolMeta: {
    marginTop: space.xs,
  },
  reminders: {
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    minHeight: size.buttonMinHeight,
  },
  reminderLast: {
    borderBottomWidth: 0,
  },
  reminderPressed: {
    backgroundColor: colors.surface.pressed,
  },
  reminderBody: {
    flex: 1,
    minWidth: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    gap: space.sm,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  list: {
    gap: space.md,
  },
  footnote: {
    marginTop: space.xl,
    gap: space.xs,
  },
});
