/**
 * Màn hình 08 — Chi tiết lô đất.
 *
 * Header with back + edit, a segmented control for the four tabs (info, cycles,
 * care, audit), then the tab body. Every tab reads from the local database or
 * from the bundled JSON catalogues, so the whole screen works with the network
 * off.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor} from '../auth/AuthContext';
import {AppHeader} from '../components/AppHeader';
import {Badge} from '../components/Badge';
import {DangerButton, GhostButton, IconButton} from '../components/buttons';
import {Card} from '../components/Card';
import {EmptyState} from '../components/EmptyState';
import {SegmentedControl} from '../components/form';
import {CalculatorIcon, ClockIcon, PencilIcon} from '../components/icons';
import {Screen} from '../components/Screen';
import type ChangeLog from '../db/models/ChangeLog';
import type CropCycle from '../db/models/CropCycle';
import type Plot from '../db/models/Plot';
import {observeChangeLogs} from '../db/repositories/changeLogRepository';
import {deletePlot, observePlot, PLOT_STATUS_LABELS} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import type {RootStackParamList} from '../navigation/types';
import {colors, size, space, text} from '../theme';
import {formatArea, formatDate, formatDateTime, formatRelative} from '../utils/format';
import {inferGrowthStage} from '../utils/growthStage';
import {
  citation,
  cropNameOf,
  protocolAvailability,
  stageForGrowth,
  stageForMonth,
  STAGE_LABELS,
} from '../utils/staticData';
import {CareStageAccordion} from './care/CareStageAccordion';
import {ProtocolUnavailable} from './care/ProtocolUnavailable';
import {useCategoryOf} from './care/useCategoryOf';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PlotDetail'>;

const TABS = [
  {key: 'info', label: 'Thông tin'},
  {key: 'cycles', label: 'Chu kỳ'},
  {key: 'care', label: 'Chăm sóc'},
  {key: 'audit', label: 'Thay đổi'},
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function PlotDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const author = useChangeAuthor();
  const [tab, setTab] = useState<TabKey>('info');

  const plot = useObservable<Plot | null>(() => observePlot(params.plotId), [params.plotId], null);

  const onDelete = useCallback(() => {
    if (!plot) return;
    Alert.alert(
      'Xoá lô đất',
      `Xoá "${plot.name}"? Toàn bộ dữ liệu gắn với lô này sẽ không còn hiển thị.`,
      [
        {text: 'Huỷ', style: 'cancel'},
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            await deletePlot(plot, author);
            navigation.goBack();
          },
        },
      ],
    );
  }, [plot, author, navigation]);

  if (!plot) {
    return (
      <Screen>
        <AppHeader title="Lô đất" onBack={() => navigation.goBack()} />
        <View style={styles.missing}>
          <EmptyState
            title="Không tìm thấy lô đất"
            body="Lô đất này có thể đã bị xoá trên một thiết bị khác."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        eyebrow={plot.code}
        title={plot.name}
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            accessibilityLabel="Sửa lô đất"
            onPress={() => navigation.navigate('PlotForm', {plotId: plot.id})}>
            <PencilIcon />
          </IconButton>
        }
      />

      <View style={styles.tabs}>
        <SegmentedControl items={TABS} value={tab} onChange={setTab} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'info' ? <InfoTab plot={plot} /> : null}
        {tab === 'cycles' ? <CyclesTab plot={plot} /> : null}
        {tab === 'care' ? <CareTab plot={plot} /> : null}
        {tab === 'audit' ? <AuditTab plot={plot} /> : null}

        {tab === 'info' ? (
          <DangerButton label="Xoá lô đất" onPress={onDelete} style={styles.deleteAction} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------- tab 1: info ------------------------------ */

function InfoTab({plot}: {plot: Plot}) {
  const facts = useMemo(
    () => [
      {label: 'Mã vùng trồng', value: plot.code},
      {label: 'Diện tích', value: formatArea(plot.area, plot.areaUnit)},
      {label: 'Khu vực', value: plot.region || '—'},
      {label: 'Cây trồng', value: cropNameOf(plot.cropType, plot.cropName)},
      {label: 'Giống', value: plot.varietyName || 'Chưa rõ giống'},
      {label: 'Ngày trồng', value: formatDate(plot.plantedAt)},
      {label: 'Trạng thái', value: PLOT_STATUS_LABELS[plot.status]},
      {label: 'Cập nhật lần cuối', value: formatRelative(plot.updatedAt)},
    ],
    [plot],
  );

  return (
    <>
      <Card flush style={styles.factCard}>
        {facts.map((fact, index) => (
          <View
            key={fact.label}
            style={[styles.factRow, index === facts.length - 1 && styles.factRowLast]}>
            <Text style={[text('bodySm', colors.text.muted), styles.factLabel]}>{fact.label}</Text>
            <Text style={[text('bodyStrong'), styles.factValue]} numberOfLines={2}>
              {fact.value}
            </Text>
          </View>
        ))}
      </Card>

      {plot.notes ? (
        <Card style={styles.noteCard}>
          <Text style={text('eyebrow', colors.text.muted)}>Ghi chú</Text>
          <Text style={[text('body'), styles.noteBody]}>{plot.notes}</Text>
        </Card>
      ) : null}
    </>
  );
}

/* ----------------------------- tab 2: cycles ------------------------------ */

function CyclesTab({plot}: {plot: Plot}) {
  const rows = useObservable<CropCycle[]>(() => plot.cycles.observe(), [plot.id], []);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Chưa có chu kỳ canh tác"
        body="Chu kỳ canh tác ghi lại từng vụ trên lô: ngày xuống giống, giai đoạn hiện tại và sản lượng thu được."
      />
    );
  }

  return (
    <View style={styles.rowList}>
      {rows.map(cycle => (
        <Card key={cycle.id}>
          <View style={styles.cycleHead}>
            <Text style={[text('cardTitle'), styles.cycleTitle]} numberOfLines={1}>
              {cycle.name}
            </Text>
            <Badge label={STAGE_LABELS[cycle.stage]} tone="green" />
          </View>
          <Text style={[text('bodySm', colors.text.muted), styles.cycleLine]}>
            {formatDate(cycle.startedAt)} → {cycle.endedAt ? formatDate(cycle.endedAt) : 'đang canh tác'}
          </Text>
          {cycle.varietyName ? (
            <Text style={text('caption', colors.text.muted)}>Giống: {cycle.varietyName}</Text>
          ) : null}
          {cycle.yieldKg ? (
            <Text style={text('caption', colors.text.muted)}>Sản lượng: {cycle.yieldKg} kg</Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

/* ------------------------------ tab 3: care ------------------------------- */

function CareTab({plot}: {plot: Plot}) {
  const navigation = useNavigation<Nav>();
  const cycles = useObservable<CropCycle[]>(() => plot.cycles.observe(), [plot.id], []);
  const categoryId = useCategoryOf(plot.varietyId);
  const cropName = cropNameOf(plot.cropType, plot.cropName);

  const {protocols, unavailable} = useMemo(
    () => protocolAvailability(plot.cropType, categoryId),
    [plot.cropType, categoryId],
  );
  const protocol = protocols[0];

  const active = cycles.find(c => !c.endedAt);
  const inferred = inferGrowthStage(plot.plantedAt);
  const growth = active?.stage ?? inferred?.stage ?? null;
  const month = new Date().getMonth() + 1;

  const current = useMemo(() => {
    if (!protocol) return null;
    if (protocol.stage_model === 'calendar') return stageForMonth(protocol, month) ?? null;
    return growth ? (stageForGrowth(protocol, growth) ?? null) : null;
  }, [protocol, growth, month]);

  if (!protocol) {
    return <ProtocolUnavailable cropName={cropName} entry={unavailable} />;
  }

  return (
    <>
      <Card style={styles.stageHeader}>
        <Text style={text('eyebrow', colors.text.muted)}>
          {protocol.stage_model === 'calendar' ? `Đợt bón của tháng ${month}` : 'Giai đoạn hiện tại'}
        </Text>
        <Text style={[text('subheading'), styles.stageTitle]}>
          {current
            ? current.stage_name_vi
            : protocol.stage_model === 'calendar'
              ? 'Ngoài các đợt bón'
              : growth
                ? STAGE_LABELS[growth]
                : 'Chưa xác định'}
        </Text>
        <Text style={text('bodySm', colors.text.muted)}>
          {protocol.stage_model === 'calendar'
            ? 'Cây lâu năm: lịch bón theo mùa trong năm.'
            : active
              ? `Theo chu kỳ "${active.name}"`
              : inferred
                ? `Ước tính từ ngày trồng · ngày thứ ${inferred.dayCount}`
                : 'Nhập ngày trồng ở màn hình sửa lô đất để ứng dụng gợi ý giai đoạn.'}
        </Text>
        <View style={styles.stageActions}>
          <GhostButton
            small
            label="Toàn bộ quy trình"
            onPress={() => navigation.navigate('CareProtocol', {plotId: plot.id})}
          />
          <GhostButton
            small
            label="Tính lượng phân"
            icon={<CalculatorIcon size={18} />}
            onPress={() => navigation.navigate('FertilizerCalculator', {plotId: plot.id})}
          />
        </View>
      </Card>

      {current ? (
        <CareStageAccordion protocol={protocol} plotId={plot.id} currentStageCode={current.stage_code} onlyStage={current.stage_code} />
      ) : (
        <EmptyState
          title={protocol.stage_model === 'calendar' ? 'Tháng này không có đợt bón' : 'Chưa xác định được giai đoạn'}
          body={
            protocol.stage_model === 'calendar'
              ? 'Xem toàn bộ quy trình để biết đợt bón kế tiếp rơi vào tháng nào.'
              : 'Nhập ngày trồng ở màn hình sửa lô đất để hệ thống gợi ý công việc theo giai đoạn cây.'
          }
          action={{label: 'Xem toàn bộ quy trình', onPress: () => navigation.navigate('CareProtocol', {plotId: plot.id})}}
        />
      )}

      <Text style={[text('caption', colors.text.muted), styles.disclaimer]}>
        {protocol.disclaimer}
        {'\n'}Nguồn: {citation(protocol)} — {protocol.source.url}
      </Text>
    </>
  );
}

/* ------------------------------ tab 4: audit ------------------------------ */

function AuditTab({plot}: {plot: Plot}) {
  const rows = useObservable<ChangeLog[]>(() => observeChangeLogs('plots', plot.id), [plot.id], []);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Chưa có thay đổi nào"
        body="Mọi lần sửa lô đất sẽ được ghi lại ở đây: ai sửa, sửa gì, lúc nào."
      />
    );
  }

  return (
    <Card flush>
      {rows.map((row, index) => (
        <View key={row.id} style={[styles.auditRow, index === rows.length - 1 && styles.factRowLast]}>
          <ClockIcon size={20} />
          <View style={styles.auditBody}>
            <Text style={text('bodySm', colors.text.primary)}>{describeChange(row)}</Text>
            <Text style={text('caption', colors.text.muted)}>
              {row.changedByName ?? row.changedBy} · {formatDateTime(row.changedAt)}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const FIELD_LABELS: Record<string, string> = {
  code: 'mã vùng trồng',
  name: 'tên lô',
  region: 'khu vực',
  area: 'diện tích',
  cropType: 'cây trồng',
  cropName: 'cây trồng',
  varietyName: 'giống cây',
  plantedAt: 'ngày trồng',
  status: 'trạng thái',
  notes: 'ghi chú',
};

function describeChange(row: ChangeLog): string {
  if (row.action === 'create') return `Tạo lô đất "${row.newValue ?? ''}"`;
  if (row.action === 'delete') return `Xoá lô đất "${row.oldValue ?? ''}"`;
  const label = row.fieldName ? (FIELD_LABELS[row.fieldName] ?? row.fieldName) : 'thông tin';
  return `Đổi ${label}: ${row.oldValue || '(trống)'} → ${row.newValue || '(trống)'}`;
}

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  factCard: {
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
    minHeight: size.minTouchTarget,
  },
  factRowLast: {
    borderBottomWidth: 0,
  },
  factLabel: {
    // Nhãn dài ("Cập nhật lần cuối") co lại thay vì đẩy cột giá trị.
    flexBasis: 128,
    flexShrink: 1,
  },
  factValue: {
    flex: 1,
    textAlign: 'right',
  },
  noteCard: {
    marginTop: space.md,
  },
  noteBody: {
    marginTop: space.xs,
  },
  rowList: {
    gap: space.md,
  },
  cycleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  cycleTitle: {
    flexShrink: 1,
  },
  cycleLine: {
    marginTop: space.xs,
  },
  stageHeader: {
    marginBottom: space.md,
  },
  stageTitle: {
    marginTop: space.xs,
    marginBottom: 2,
  },
  stageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
    marginLeft: -space.md,
  },
  disclaimer: {
    marginTop: space.lg,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  auditBody: {
    flex: 1,
    gap: 2,
  },
  deleteAction: {
    marginTop: space.xl,
  },
  missing: {
    padding: space.lg,
  },
});
