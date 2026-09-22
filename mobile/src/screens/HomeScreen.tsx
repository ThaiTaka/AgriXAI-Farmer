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
import React, {useCallback} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useAuth, useCurrentUser} from '../auth/AuthContext';
import {GhostButton, IconButton} from '../components/buttons';
import {Card} from '../components/Card';
import {DashboardCard} from '../components/DashboardCard';
import {EmptyState} from '../components/EmptyState';
import {IconTile} from '../components/IconTile';
import {
  BellIcon,
  CalculatorIcon,
  ChevronRight,
  ClipboardIcon,
  CoinsIcon,
  PlusIcon,
  ScaleIcon,
  SettingsIcon,
  ShareIcon,
  SproutIcon,
  ToolsIcon,
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
import {colors, radius, size, space, text} from '../theme';
import {formatDate, formatNumber, formatVnd, formatWeekdayDate} from '../utils/format';
import {useDashboard} from './home/useDashboard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ToolRoute = 'FertilizerCalculator' | 'FertilizerBudget' | 'CareProtocol' | 'Warehouse' | 'Finance' | 'ReportExport';

/** The six tools, two per row, in the order the brief lists them. */
const TOOLS: {route: ToolRoute; title: string; meta: string; icon: React.ReactNode; testID: string}[] = [
  {route: 'FertilizerCalculator', title: 'Tính lượng phân bón', meta: 'Cần bón bao nhiêu cho ruộng của bạn', icon: <CalculatorIcon />, testID: 'home-calculator'},
  {route: 'FertilizerBudget', title: 'Chọn phân theo túi tiền', meta: 'Bình dân, trung bình hay cao cấp', icon: <ScaleIcon />, testID: 'home-budget'},
  {route: 'CareProtocol', title: 'Quy trình chăm sóc', meta: 'Bón gì, làm gì ở từng giai đoạn', icon: <ClipboardIcon />, testID: 'home-care'},
  {route: 'Warehouse', title: 'Kho phân bón', meta: 'Ghi phiếu nhập, xuất và xem tồn', icon: <WarehouseIcon />, testID: 'home-warehouse'},
  {route: 'Finance', title: 'Thu và chi', meta: 'Ghi tiền vào, tiền ra, xem lãi lỗ', icon: <CoinsIcon />, testID: 'home-finance'},
  {route: 'ReportExport', title: 'Xuất báo cáo', meta: 'Tạo file PDF để in hoặc gửi đi', icon: <ShareIcon size={22} />, testID: 'home-report'},
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useCurrentUser();
  const {signOut} = useAuth();
  const {pending: pendingSync} = useSync();
  const data = useDashboard(user.id);
  const reminders = useObservable<TaskHistory[]>(() => observeUpcomingReminders(user.id), [user.id], []);

  const openPlot = useCallback((plot: Plot) => navigation.navigate('PlotDetail', {plotId: plot.id}), [navigation]);

  const insets = useSafeAreaInsets();

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
    // edges bỏ 'top': dải xanh phải chạy lên sát mép trên, nên header tự cộng
    // inset thay vì để SafeAreaView đẩy xuống.
    <Screen ground="gradient" edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.default} />
      <View style={[styles.header, {paddingTop: insets.top + space.lg}]}>
        <View style={styles.headerText}>
          {/* "Xin chào" tách khỏi tên: gộp một dòng thì trên màn 320pt cột chữ
              chỉ còn 172pt, đủ cho "Xin chào" rồi cắt mất tên ở dòng hai. */}
          <Text style={text('eyebrow', colors.primary.onPrimary)}>Xin chào</Text>
          <Text style={[text('heading', colors.primary.onPrimary), styles.headerName]} numberOfLines={2}>
            {user.fullName || user.username}
          </Text>
          <Text style={[text('body', colors.primary.onPrimary), styles.headerMeta]} numberOfLines={2}>
            {formatWeekdayDate()}
            {user.region ? ` · ${user.region}` : ''}
          </Text>
        </View>
        <IconButton
          accessibilityLabel="Cài đặt"
          onPress={() => navigation.navigate('Settings')}>
          <SettingsIcon size={22} color={colors.primary.onPrimary} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tài khoản và đăng xuất"
          onPress={confirmSignOut}
          style={({pressed}) => [styles.avatar, pressed && styles.avatarPressed]}>
          <Text style={text('cardTitle', colors.primary.onPrimary)}>{initial}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.cards}>
          <DashboardCard
            testID="card-stock"
            label="Tồn kho"
            value={formatVnd(Math.round(data.stock.value))}
            countTo={Math.round(data.stock.value)}
            countFormat={formatVnd}
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
            countTo={Math.abs(Math.round(data.month.profit))}
            countFormat={formatVnd}
            negative={loss}
            subtext={`Thu ${formatVnd(data.month.income)}, Chi ${formatVnd(data.month.expense)}`}
            flag={financePending ? 'Chưa đồng bộ' : null}
            icon={<CoinsIcon size={24} color={loss ? colors.badge.redFg : colors.green['800']} />}
            tone={loss ? 'coral' : 'lime'}
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
              <Text style={[text('caption', colors.text.secondary), styles.toolMeta]} numberOfLines={2}>
                {tool.meta}
              </Text>
            </Card>
          ))}
        </View>

        {/* Không còn thanh tab, nên đây là lối duy nhất vào danh mục phân bón
            và F4 kiểm tra kho — hai công cụ không có ô riêng ở lưới trên. */}
        <Card
          onPress={() => navigation.navigate('Tools')}
          accessibilityLabel="Xem tất cả công cụ"
          style={styles.allTools}
          testID="home-all-tools">
          <View style={styles.allToolsBody}>
            <IconTile size={44}>
              <ToolsIcon color={colors.primary.default} />
            </IconTile>
            <View style={styles.allToolsText}>
              <Text style={text('bodyStrong')} numberOfLines={1}>
                Tất cả công cụ
              </Text>
              <Text style={[text('caption', colors.text.secondary), styles.toolMeta]} numberOfLines={2}>
                Bảng giá phân bón, kiểm tra kho và các mục khác
              </Text>
            </View>
            <ChevronRight color={colors.text.secondary} />
          </View>
        </Card>

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
                    <Text style={text('caption', colors.text.secondary)}>{formatDate(row.remindAt)}</Text>
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

        {!data.plotsReady ? (
          // SQLite trả về bất đồng bộ; hiện EmptyState ngay sẽ báo "chưa có lô
          // đất" cho cả nông hộ đang có lô, mỗi lần mở app.
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary.default} />
          </View>
        ) : data.plots.length === 0 ? (
          <EmptyState
            icon={<SproutIcon color={colors.text.secondary} />}
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
          <Text style={text('caption', colors.text.secondary)}>Số liệu đọc từ máy — vẫn xem và ghi được khi mất mạng.</Text>
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
    paddingBottom: space.xl,
    backgroundColor: colors.primary.default,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    marginTop: space.xs,
  },
  headerMeta: {
    marginTop: space.xs,
  },
  avatar: {
    width: size.minTouchTarget,
    height: size.minTouchTarget,
    borderRadius: radius.pill,
    // Trên nền xanh đậm: viền trắng mỏng thay vì nền xanh nhạt.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: {
    backgroundColor: colors.primary.pressed,
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
  allTools: {
    marginBottom: space.xl,
    padding: space.lg,
  },
  allToolsBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.minTouchTarget,
  },
  allToolsText: {
    flex: 1,
    minWidth: 0,
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
  loading: {
    alignItems: 'center',
    paddingVertical: space['2xl'],
  },
  footnote: {
    marginTop: space.xl,
    gap: space.xs,
  },
});
