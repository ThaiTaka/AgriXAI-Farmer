/**
 * Màn hình 08 — Chi tiết lô đất.
 *
 * Design reference: screen "08 Chi tiết lô đất" — hero header with a scrim,
 * back + edit icon buttons, then a facts card. The five tabs required by
 * Giai đoạn 1 are added on top using the same chip styling the design uses for
 * its other filter rows (screens 03 and 07), so nothing new is invented.
 *
 * Every tab reads from the local database or from the bundled JSON catalogues,
 * so the whole screen works with the network off.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../auth/AuthContext';
import {DangerButton, IconButton, PrimaryButton} from '../components/buttons';
import {GlassSurface} from '../components/GlassSurface';
import {CheckIcon, ChevronLeft, ClockIcon, PencilIcon} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import {severityDot} from '../components/SeverityBadge';
import type ChangeLog from '../db/models/ChangeLog';
import type CropCycle from '../db/models/CropCycle';
import type Diagnosis from '../db/models/Diagnosis';
import type Plot from '../db/models/Plot';
import {observeChangeLogs} from '../db/repositories/changeLogRepository';
import {
  deletePlot,
  observePlot,
  PLOT_STATUS_LABELS,
} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import type {RootStackParamList} from '../navigation/types';
import {colors, radius, severity as severityTokens, spacing, text} from '../theme';
import {formatArea, formatDate, formatDateTime, formatRelative} from '../utils/format';
import {inferGrowthStage} from '../utils/growthStage';
import {
  allCareStages,
  careProtocolDisclaimer,
  careProtocolSource,
  STAGE_LABELS,
} from '../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PlotDetail'>;

const TABS = [
  {key: 'info', label: 'Thông tin'},
  {key: 'diagnoses', label: 'Chẩn đoán'},
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

  const plot = useObservable<Plot | null>(
    () => observePlot(params.plotId),
    [params.plotId],
    null,
  );

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
      <ScreenBackground>
        <SafeAreaView style={styles.root} edges={['top']}>
          <View style={styles.missing}>
            <Text style={text('cardTitleLg')}>Không tìm thấy lô đất</Text>
            <Text style={[text('body', colors.text.alpha['74']), styles.missingBody]}>
              Lô đất này có thể đã bị xoá trên một thiết bị khác.
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Quay lại" onPress={() => navigation.goBack()}>
            <ChevronLeft />
          </IconButton>
          <View style={styles.headerText}>
            <Text style={text('groupTitle')} numberOfLines={1}>
              {plot.name}
            </Text>
            <Text style={[text('metaSm', 'rgba(18,48,29,0.88)')]}>{plot.code}</Text>
          </View>
          <IconButton
            accessibilityLabel="Sửa lô đất"
            onPress={() => navigation.navigate('PlotForm', {plotId: plot.id})}>
            <PencilIcon />
          </IconButton>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Without flexGrow: 0 this row is a flex child of the column and
          // stretches to fill the screen, turning the chips into tall ovals.
          style={styles.tabScroll}
          contentContainerStyle={styles.tabRow}>
          {TABS.map(item => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{selected: tab === item.key}}
              onPress={() => setTab(item.key)}
              style={[styles.tab, tab === item.key ? styles.tabActive : styles.tabIdle]}>
              <Text
                style={text('meta', tab === item.key ? colors.neutral.white : colors.text.alpha['74'])}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'info' ? <InfoTab plot={plot} /> : null}
          {tab === 'diagnoses' ? <DiagnosesTab plot={plot} /> : null}
          {tab === 'cycles' ? <CyclesTab plot={plot} /> : null}
          {tab === 'care' ? <CareTab plot={plot} /> : null}
          {tab === 'audit' ? <AuditTab plot={plot} /> : null}

          <PrimaryButton
            label="Chẩn đoán cho lô này"
            onPress={() =>
              Alert.alert(
                'Sắp có',
                'Luồng chẩn đoán bệnh qua ảnh được xây ở Giai đoạn 2.',
              )
            }
            style={styles.primaryAction}
          />
          <DangerButton label="Xoá lô đất" onPress={onDelete} style={styles.deleteAction} />
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* ------------------------------- tab 1: info ------------------------------ */

function InfoTab({plot}: {plot: Plot}) {
  const facts = useMemo(
    () => [
      {label: 'Tên lô đất', value: plot.name},
      {label: 'Mã vùng trồng', value: plot.code},
      {label: 'Diện tích', value: formatArea(plot.area, plot.areaUnit)},
      {label: 'Khu vực', value: plot.region || '—'},
      {label: 'Cây trồng', value: plot.cropType === 'ca_chua' ? 'Cà chua' : plot.cropType},
      {label: 'Giống', value: plot.varietyName || '—'},
      {label: 'Ngày trồng', value: formatDate(plot.plantedAt)},
      {label: 'Trạng thái', value: PLOT_STATUS_LABELS[plot.status]},
      {label: 'Cập nhật lần cuối', value: formatRelative(plot.updatedAt)},
    ],
    [plot],
  );

  return (
    <>
      <GlassSurface level="card" style={styles.factCard}>
        {facts.map((fact, index) => (
          <View
            key={fact.label}
            style={[styles.factRow, index === facts.length - 1 && styles.factRowLast]}>
            <Text style={[text('meta', colors.text.alpha['72']), styles.factLabel]}>
              {fact.label}
            </Text>
            <Text style={text('bodySm')} numberOfLines={2}>
              {fact.value}
            </Text>
          </View>
        ))}
      </GlassSurface>

      {plot.notes ? (
        <GlassSurface level="soft" style={styles.noteCard}>
          <Text style={text('eyebrow', colors.green['700'])}>Ghi chú</Text>
          <Text style={[text('body'), styles.noteBody]}>{plot.notes}</Text>
        </GlassSurface>
      ) : null}
    </>
  );
}

/* --------------------------- tab 2: diagnoses ----------------------------- */

function DiagnosesTab({plot}: {plot: Plot}) {
  const rows = useObservable<Diagnosis[]>(
    () => plot.diagnosisHistory.observe(),
    [plot.id],
    [],
  );

  if (rows.length === 0) {
    return (
      <EmptyTab
        title="Chưa có lần chẩn đoán nào"
        body="Chụp ảnh lá để chẩn đoán bệnh cho lô này. Lịch sử sẽ hiện ở đây."
      />
    );
  }

  return (
    <View style={styles.rowList}>
      {rows.map(row => {
        const token = severityTokens[row.severity];
        return (
          <GlassSurface key={row.id} level="soft" style={styles.historyRow}>
            <View style={[styles.dot, {backgroundColor: severityDot(row.severity)}]} />
            <View style={styles.historyBody}>
              <Text style={text('bodySm')} numberOfLines={1}>
                {row.diseaseName}
              </Text>
              <Text style={text('caption', colors.text.alpha['68'])}>
                {formatDateTime(row.diagnosedAt)} · độ tin cậy {Math.round(row.confidence * 100)}%
              </Text>
            </View>
            <View style={[styles.badge, {backgroundColor: token.bg}]}>
              <Text style={text('badge', token.fg)}>{token.label}</Text>
            </View>
          </GlassSurface>
        );
      })}
    </View>
  );
}

/* ----------------------------- tab 3: cycles ------------------------------ */

function CyclesTab({plot}: {plot: Plot}) {
  const rows = useObservable<CropCycle[]>(() => plot.cycles.observe(), [plot.id], []);

  if (rows.length === 0) {
    return (
      <EmptyTab
        title="Chưa có chu kỳ canh tác"
        body="Chu kỳ canh tác ghi lại từng vụ trên lô: ngày xuống giống, giai đoạn hiện tại và sản lượng thu được."
      />
    );
  }

  return (
    <View style={styles.rowList}>
      {rows.map(cycle => (
        <GlassSurface key={cycle.id} level="soft" style={styles.cycleCard}>
          <View style={styles.cycleHead}>
            <Text style={text('cardTitle')} numberOfLines={1}>
              {cycle.name}
            </Text>
            <View style={styles.stagePill}>
              <Text style={text('badge', colors.green['700'])}>{STAGE_LABELS[cycle.stage]}</Text>
            </View>
          </View>
          <Text style={text('metaSm', colors.text.alpha['72'])}>
            {formatDate(cycle.startedAt)} → {cycle.endedAt ? formatDate(cycle.endedAt) : 'đang canh tác'}
          </Text>
          {cycle.varietyName ? (
            <Text style={text('caption', colors.text.alpha['68'])}>Giống: {cycle.varietyName}</Text>
          ) : null}
          {cycle.yieldKg ? (
            <Text style={text('caption', colors.text.alpha['68'])}>
              Sản lượng: {cycle.yieldKg} kg
            </Text>
          ) : null}
        </GlassSurface>
      ))}
    </View>
  );
}

/* ------------------------------ tab 4: care ------------------------------- */

function CareTab({plot}: {plot: Plot}) {
  const cycles = useObservable<CropCycle[]>(() => plot.cycles.observe(), [plot.id], []);

  const active = cycles.find(c => !c.endedAt);
  const inferred = inferGrowthStage(plot.plantedAt);
  const stage = active?.stage ?? inferred?.stage ?? null;
  const stages = allCareStages(plot.cropType);
  const current = stage ? stages.find(s => s.stage_code === stage) : undefined;

  if (stages.length === 0) {
    return (
      <EmptyTab
        title="Chưa có quy trình chăm sóc"
        body={`Hiện chỉ có quy trình cho cà chua. Cây trồng "${plot.cropType}" chưa có dữ liệu.`}
      />
    );
  }

  if (!stage) {
    return (
      <EmptyTab
        title="Chưa xác định được giai đoạn"
        body="Nhập ngày trồng ở màn hình sửa lô đất để hệ thống gợi ý công việc theo giai đoạn cây."
      />
    );
  }

  return (
    <>
      <GlassSurface level="card" style={styles.stageHeader}>
        <Text style={text('eyebrow', colors.green['700'])}>Giai đoạn hiện tại</Text>
        <Text style={[text('cardTitleLg'), styles.stageTitle]}>{STAGE_LABELS[stage]}</Text>
        <Text style={text('metaSm', colors.text.alpha['72'])}>
          {active
            ? `Theo chu kỳ "${active.name}"`
            : `Ước tính từ ngày trồng · ngày thứ ${inferred?.dayCount ?? 0}`}
        </Text>
        {current ? (
          <Text style={[text('caption', colors.text.alpha['68']), styles.stagePct]}>
            Đợt bón thúc này chiếm {current.pct_of_total_topdress}% tổng lượng phân thúc cả vụ.
          </Text>
        ) : null}
      </GlassSurface>

      <View style={styles.rowList}>
        {(current?.tasks ?? []).map(task => (
          <GlassSurface key={task.key} level="soft" style={styles.taskCard}>
            <CheckIcon />
            <View style={styles.taskBody}>
              <Text style={text('bodySm')}>{task.title}</Text>
              <Text style={[text('caption', colors.text.alpha['68']), styles.taskDetail]}>
                {task.detail}
              </Text>
            </View>
          </GlassSurface>
        ))}
      </View>

      <GlassSurface level="soft" style={styles.disclaimer}>
        <Text style={text('caption', colors.text.alpha['68'])}>
          {careProtocolDisclaimer(plot.cropType)}
        </Text>
        <Text style={[text('caption', colors.text.alpha['60']), styles.source]}>
          Nguồn: {careProtocolSource(plot.cropType)}
        </Text>
      </GlassSurface>
    </>
  );
}

/* ------------------------------ tab 5: audit ------------------------------ */

function AuditTab({plot}: {plot: Plot}) {
  const rows = useObservable<ChangeLog[]>(
    () => observeChangeLogs('plots', plot.id),
    [plot.id],
    [],
  );

  if (rows.length === 0) {
    return (
      <EmptyTab
        title="Chưa có thay đổi nào"
        body="Mọi lần sửa lô đất sẽ được ghi lại ở đây: ai sửa, sửa gì, lúc nào."
      />
    );
  }

  return (
    <View style={styles.rowList}>
      {rows.map(row => (
        <GlassSurface key={row.id} level="soft" style={styles.auditRow}>
          <ClockIcon size={20} />
          <View style={styles.auditBody}>
            <Text style={text('bodySm')}>{describeChange(row)}</Text>
            <Text style={text('caption', colors.text.alpha['68'])}>
              {row.changedByName ?? row.changedBy} · {formatDateTime(row.changedAt)}
            </Text>
          </View>
        </GlassSurface>
      ))}
    </View>
  );
}

const FIELD_LABELS: Record<string, string> = {
  code: 'mã vùng trồng',
  name: 'tên lô',
  region: 'khu vực',
  area: 'diện tích',
  cropType: 'cây trồng',
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

/* -------------------------------- shared --------------------------------- */

function EmptyTab({title, body}: {title: string; body: string}) {
  return (
    <GlassSurface level="card" style={styles.emptyTab}>
      <Text style={text('cardTitle')}>{title}</Text>
      <Text style={[text('body', colors.text.alpha['74']), styles.emptyTabBody]}>{body}</Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    paddingHorizontal: spacing['11'],
    paddingTop: spacing['6'],
    paddingBottom: spacing['8'],
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabRow: {
    alignItems: 'center',
    paddingHorizontal: spacing['11'],
    gap: spacing['3'],
    paddingBottom: spacing['8'],
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: spacing['11'],
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIdle: {
    borderColor: 'rgba(255,255,255,0.62)',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  tabActive: {
    borderColor: colors.green['700'],
    backgroundColor: colors.green['700'],
  },
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingBottom: spacing['18'],
  },
  factCard: {
    borderRadius: radius['5xl'],
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['6'],
    paddingHorizontal: spacing['12'],
    paddingVertical: spacing['10'],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.72)',
  },
  factRowLast: {
    borderBottomWidth: 0,
  },
  factLabel: {
    flex: 1,
  },
  noteCard: {
    marginTop: spacing['8'],
    padding: spacing['12'],
    borderRadius: radius['4xl'],
  },
  noteBody: {
    marginTop: spacing['3'],
  },
  rowList: {
    gap: spacing['6'],
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['8'],
    padding: spacing['10'],
    borderRadius: radius['3xl'],
  },
  historyBody: {
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
  },
  badge: {
    paddingHorizontal: spacing['6'],
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  cycleCard: {
    padding: spacing['12'],
    borderRadius: radius['4xl'],
    gap: spacing['1'],
  },
  cycleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['6'],
    marginBottom: spacing['2'],
  },
  stagePill: {
    paddingHorizontal: spacing['6'],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(84,169,106,0.2)',
  },
  stageHeader: {
    padding: spacing['12'],
    borderRadius: radius['5xl'],
    marginBottom: spacing['8'],
  },
  stageTitle: {
    marginTop: spacing['1'],
    marginBottom: spacing['2'],
  },
  stagePct: {
    marginTop: spacing['4'],
  },
  taskCard: {
    flexDirection: 'row',
    gap: spacing['8'],
    padding: spacing['11'],
    borderRadius: radius['4xl'],
  },
  taskBody: {
    flex: 1,
  },
  taskDetail: {
    marginTop: spacing['2'],
  },
  disclaimer: {
    marginTop: spacing['8'],
    padding: spacing['11'],
    borderRadius: radius['3xl'],
  },
  source: {
    marginTop: spacing['3'],
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['8'],
    padding: spacing['11'],
    borderRadius: radius['3xl'],
  },
  auditBody: {
    flex: 1,
    gap: spacing['1'],
  },
  emptyTab: {
    padding: spacing['13'],
    borderRadius: radius['6xl'],
  },
  emptyTabBody: {
    marginTop: spacing['3'],
  },
  primaryAction: {
    marginTop: spacing['15'],
  },
  deleteAction: {
    marginTop: spacing['6'],
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['13'],
  },
  missingBody: {
    marginTop: spacing['3'],
    textAlign: 'center',
  },
});
