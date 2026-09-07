/**
 * Màn hình 05 — Kết quả chẩn đoán.
 *
 * Design reference: screen "05 Kết quả chẩn đoán".
 *
 * Three states, because a diagnosis reaches this screen three ways:
 *   fresh    — just analysed online, not yet written to the database
 *   pending  — queued while offline, no answer yet
 *   saved    — opened from the history list
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, Ellipse, RadialGradient, Stop} from 'react-native-svg';

import {useChangeAuthor} from '../auth/AuthContext';
import {GhostButton, IconButton, PrimaryButton} from '../components/buttons';
import {GlassSurface} from '../components/GlassSurface';
import {ChevronLeft, ClockIcon, OfflineIcon} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import type Diagnosis from '../db/models/Diagnosis';
import type PendingDiagnosis from '../db/models/PendingDiagnosis';
import type {Heatmap, Prediction} from '../db/repositories/diagnosisRepository';
import {
  observeDiagnosis,
  observePending,
  parseHeatmap,
  parsePredictions,
  saveDiagnosis,
} from '../db/repositories/diagnosisRepository';
import {useObservable} from '../db/useObservable';
import {useDiagnosisQueue} from '../diagnosis/DiagnosisQueueContext';
import type {RootStackParamList} from '../navigation/types';
import {
  colors,
  glass,
  gradients,
  radius,
  severity as severityTokens,
  spacing,
  text,
} from '../theme';
import {DISEASE_TYPE_LABELS, diseaseByKey, diseaseName, severityForDisease} from '../utils/diseases';
import {formatDateTime} from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'DiagnosisResult'>;

const PROGRESS_COLORS = [...gradients.progress.colors] as string[];
const PILL_COLORS = [...glass.pill.gradientColors] as string[];

export function DiagnosisResultScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const author = useChangeAuthor();
  const {drain, offline} = useDiagnosisQueue();

  const [saving, setSaving] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Pending mode: watch the queue row so the screen updates itself the moment
  // the processor finishes the upload.
  const pendingId = params.mode === 'pending' ? params.pendingId : null;
  const pendingRow = useObservable<PendingDiagnosis | null>(
    () => observePending(pendingId),
    [pendingId],
    null,
  );

  /**
   * The id this screen is about.
   *
   * For a fresh analysis it was minted before the upload, so it exists before the
   * row does. That is deliberate: "đã lưu" is then answered by looking the id up
   * in the database instead of by a piece of screen state. Screen state survives
   * a navigation and can go on claiming a brand-new result is already saved —
   * which is exactly the bug this replaced.
   */
  const targetId =
    params.mode === 'saved'
      ? params.diagnosisId
      : params.mode === 'fresh'
        ? params.diagnosisId
        // Queued mode uses the queue row's own id, because the processor saves
        // the diagnosis under exactly that id. Following `pendingRow.diagnosisId`
        // instead would strand this screen: the processor drops the queue row the
        // moment it finishes, so the pointer disappears at the same instant the
        // answer arrives and the screen stays on "Đang chờ mạng" forever.
        : params.pendingId;

  const savedRow = useObservable<Diagnosis | null>(
    () => observeDiagnosis(targetId),
    [targetId],
    null,
  );

  const activeRow = savedRow;
  const isSaved = savedRow !== null;

  const predictions: Prediction[] | null = useMemo(() => {
    if (activeRow) return parsePredictions(activeRow);
    if (params.mode === 'fresh') return params.result.predictions;
    return null;
  }, [activeRow, params]);

  const heatmap: Heatmap | null = useMemo(() => {
    if (activeRow) return parseHeatmap(activeRow);
    if (params.mode === 'fresh') return params.result.heatmap;
    return null;
  }, [activeRow, params]);

  const photoUri = activeRow?.imagePath ?? params.photoUri ?? null;
  const top = predictions?.[0] ?? null;
  const topDisease = top ? diseaseByKey(top.disease_key) : null;
  const topSeverity = top ? severityForDisease(top.disease_key) : null;
  const token = topSeverity ? severityTokens[topSeverity] : null;

  const analysedAt = activeRow
    ? activeRow.diagnosedAt
    : params.mode === 'fresh'
      ? params.result.analysed_at
      : null;

  const onSave = useCallback(async () => {
    if (params.mode !== 'fresh' || saving || isSaved) return;
    setSaving(true);
    try {
      // Passing the id makes this idempotent: a double tap, or a re-entry with
      // the same params, writes the one row rather than two.
      await saveDiagnosis(
        {
          id: params.diagnosisId,
          plotId: params.plotId,
          result: params.result,
          localPhotoPath: params.photoUri ?? null,
        },
        author,
      );
    } finally {
      setSaving(false);
    }
  }, [params, saving, isSaved, author]);

  const openTreatment = useCallback(() => {
    if (!top) return;
    navigation.navigate('Treatment', {diseaseKey: top.disease_key});
  }, [navigation, top]);

  /* ------------------------------ waiting ------------------------------- */

  if (!predictions && !targetId) {
    return (
      <ScreenBackground>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={styles.root} edges={['top']}>
          <Header title="Kết quả chẩn đoán" onBack={() => navigation.goBack()} />
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {photoUri ? (
              <Image source={{uri: photoUri}} style={styles.photo} resizeMode="cover" />
            ) : null}

            <GlassSurface level="card" style={styles.waitingCard}>
              <View style={styles.waitingHead}>
                <OfflineIcon size={20} />
                <Text style={text('cardTitleLg')}>Đang chờ mạng</Text>
              </View>
              <Text style={[text('body', colors.text.alpha['74']), styles.waitingBody]}>
                Ảnh đã được lưu trên máy và xếp hàng chờ. Khi có mạng trở lại, hệ thống tự gửi
                đi và lưu kết quả vào lô đất — bạn không cần chụp lại.
              </Text>
              {pendingRow ? (
                <View style={styles.waitingMeta}>
                  <ClockIcon size={16} />
                  <Text style={text('caption', colors.text.alpha['68'])}>
                    Xếp hàng lúc {formatDateTime(pendingRow.createdAt)}
                    {pendingRow.attempts > 0 ? ` · đã thử ${pendingRow.attempts} lần` : ''}
                  </Text>
                </View>
              ) : null}
              {pendingRow?.lastError ? (
                <Text style={[text('caption', colors.amber['700']), styles.waitingError]}>
                  Lỗi gần nhất: {pendingRow.lastError}
                </Text>
              ) : null}
            </GlassSurface>

            <GhostButton
              label={offline ? 'Thử gửi lại' : 'Kiểm tra ngay'}
              onPress={() => {
                drain().catch(() => {});
              }}
              style={styles.action}
            />
            <GhostButton
              label="Về trang chủ"
              onPress={() => navigation.navigate('Home')}
              style={styles.action}
            />
          </ScrollView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!predictions || !top) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.root} edges={['top']}>
          <Header title="Kết quả chẩn đoán" onBack={() => navigation.goBack()} />
          <View style={styles.center}>
            <Text style={text('cardTitleLg')}>Đang tải kết quả…</Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  /* ------------------------------- result -------------------------------- */

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header title="Kết quả chẩn đoán" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {photoUri ? (
            <View style={styles.photoWrap}>
              <Image source={{uri: photoUri}} style={styles.photo} resizeMode="cover" />
              {heatmap && showHeatmap ? <HeatmapOverlay heatmap={heatmap} /> : null}

              {/* The toggle only exists when there is something to toggle —
                  a heatmap is never invented to fill the space. */}
              {heatmap ? (
                <LinearGradient
                  colors={PILL_COLORS}
                  start={glass.pill.gradientStart}
                  end={glass.pill.gradientEnd}
                  style={styles.toggle}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{selected: showHeatmap}}
                    onPress={() => setShowHeatmap(true)}
                    style={[styles.toggleItem, showHeatmap && styles.toggleOn]}>
                    <Text
                      style={text('caption', showHeatmap ? colors.neutral.white : colors.text.alpha['74'])}>
                      Vùng nghi ngờ
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{selected: !showHeatmap}}
                    onPress={() => setShowHeatmap(false)}
                    style={[styles.toggleItem, !showHeatmap && styles.toggleOn]}>
                    <Text
                      style={text('caption', !showHeatmap ? colors.neutral.white : colors.text.alpha['74'])}>
                      Ảnh gốc
                    </Text>
                  </Pressable>
                </LinearGradient>
              ) : null}
            </View>
          ) : null}

          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              {topDisease ? (
                <Text style={text('eyebrow', colors.lime['800'])}>
                  {DISEASE_TYPE_LABELS[topDisease.type]} · {topDisease.pathogen}
                </Text>
              ) : null}
              <Text style={[text('resultTitle'), styles.diseaseName]}>
                {diseaseName(top.disease_key)}
              </Text>
            </View>
            {token ? (
              <View style={[styles.severity, {backgroundColor: token.bg}]}>
                <Text style={text('meta', token.fg)}>{token.label}</Text>
              </View>
            ) : null}
          </View>

          <GlassSurface level="card" style={styles.metrics}>
            <Metric label="Độ tin cậy" value={top.confidence} />
            {heatmap?.affected_ratio != null ? (
              <Metric
                label="Vùng nghi ngờ trên ảnh"
                value={heatmap.affected_ratio}
                color={colors.amber['500']}
              />
            ) : null}
          </GlassSurface>

          <GlassSurface level="soft" style={styles.topThree}>
            <Text style={[text('meta', colors.text.alpha['74']), styles.topThreeLabel]}>
              Ba khả năng cao nhất
            </Text>
            {predictions.slice(0, 3).map((prediction, index) => (
              <PredictionRow
                key={prediction.disease_key}
                prediction={prediction}
                leading={index === 0}
                onPress={() => navigation.navigate('Treatment', {diseaseKey: prediction.disease_key})}
              />
            ))}
          </GlassSurface>

          <View style={styles.chips}>
            {analysedAt ? <MetaChip label={formatDateTime(analysedAt)} /> : null}
            <MetaChip
              label={
                activeRow?.modelVersion ??
                (params.mode === 'fresh' ? params.result.model_version : 'dummy')
              }
            />
            <MetaChip label={isSaved ? 'Đã lưu vào lô' : 'Chưa lưu'} />
          </View>

          <Text style={[text('caption', colors.text.alpha['62']), styles.disclaimer]}>
            Gợi ý mang tính tham khảo. Cần đối chiếu với cán bộ khuyến nông địa phương và nhãn
            thuốc trước khi sử dụng.
          </Text>

          <PrimaryButton
            label="Xem gợi ý xử lý"
            onPress={openTreatment}
            withArrow
            style={styles.action}
          />

          {params.mode === 'fresh' && !isSaved ? (
            <PrimaryButton
              label="Lưu chẩn đoán"
              onPress={onSave}
              loading={saving}
              style={styles.action}
            />
          ) : null}

          <View style={styles.actionRow}>
            <GhostButton
              label="Lịch sử"
              onPress={() =>
                navigation.navigate('DiagnosisHistory', {
                  plotId: activeRow?.plotId ?? params.plotId ?? '',
                })
              }
              style={styles.half}
            />
            <GhostButton
              label="Chụp lại"
              onPress={() =>
                navigation.navigate('CaptureImage', {
                  plotId: activeRow?.plotId ?? params.plotId,
                })
              }
              style={styles.half}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function Header({title, onBack}: {title: string; onBack: () => void}) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Quay lại" onPress={onBack}>
        <ChevronLeft />
      </IconButton>
      <Text style={text('screenHeading')}>{title}</Text>
    </View>
  );
}

function Metric({label, value, color}: {label: string; value: number; color?: string}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View style={styles.metric}>
      <View style={styles.metricHead}>
        <Text style={text('meta', colors.text.alpha['74'])}>{label}</Text>
        <Text style={text('meta')}>{pct}%</Text>
      </View>
      <View style={styles.bar}>
        {color ? (
          <View style={[styles.barFill, {width: `${pct}%`, backgroundColor: color}]} />
        ) : (
          <LinearGradient
            colors={PROGRESS_COLORS}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={[styles.barFill, {width: `${pct}%`}]}
          />
        )}
      </View>
    </View>
  );
}

function PredictionRow({
  prediction,
  leading,
  onPress,
}: {
  prediction: Prediction;
  leading: boolean;
  onPress: () => void;
}) {
  const pct = Math.round(prediction.confidence * 100);
  const key = severityForDisease(prediction.disease_key);
  const token = severityTokens[key];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${diseaseName(prediction.disease_key)} ${pct} phần trăm`}
      onPress={onPress}
      style={({pressed}) => [styles.prediction, pressed && styles.pressed]}>
      <View style={styles.predictionBody}>
        <Text
          numberOfLines={1}
          style={leading ? text('bodySm') : text('body', colors.text.alpha['74'])}>
          {diseaseName(prediction.disease_key)}
        </Text>
        <View style={[styles.miniBadge, {backgroundColor: token.bg}]}>
          <Text style={text('badge', token.fg)}>{token.label}</Text>
        </View>
      </View>
      <View style={styles.predictionBar}>
        <View
          style={[
            styles.predictionFill,
            {width: `${pct}%`, backgroundColor: leading ? colors.green['500'] : token.dot},
          ]}
        />
      </View>
      <Text style={[text('meta'), styles.predictionPct]}>{pct}%</Text>
    </Pressable>
  );
}

function MetaChip({label}: {label: string}) {
  return (
    <View style={styles.metaChip}>
      <Text style={text('badge', colors.text.alpha['70'])} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The explainability overlay.
 *
 * Rendered only when the model actually returned regions. Coordinates are
 * normalised 0..1, so the ellipses land in the right place whatever size the
 * photo is drawn at.
 */
function HeatmapOverlay({heatmap}: {heatmap: Heatmap}) {
  return (
    <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="agriGlow">
          <Stop offset="0%" stopColor={colors.amber['500']} stopOpacity={0.6} />
          <Stop offset="62%" stopColor={colors.amber['500']} stopOpacity={0.2} />
          <Stop offset="100%" stopColor={colors.amber['500']} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {heatmap.regions.map((region, index) => (
        <React.Fragment key={`${region.cx}-${region.cy}-${index}`}>
          <Ellipse
            cx={region.cx * 100}
            cy={region.cy * 100}
            rx={region.rx * 100}
            ry={region.ry * 100}
            fill="url(#agriGlow)"
          />
          <Ellipse
            cx={region.cx * 100}
            cy={region.cy * 100}
            rx={region.rx * 100}
            ry={region.ry * 100}
            fill="none"
            stroke={colors.amber['500']}
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
        </React.Fragment>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingBottom: spacing['18'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    paddingHorizontal: spacing['11'],
    paddingTop: spacing['6'],
    paddingBottom: spacing['10'],
  },
  photoWrap: {
    position: 'relative',
    marginBottom: spacing['11'],
  },
  photo: {
    width: '100%',
    height: 272,
    borderRadius: radius['8xl'],
    backgroundColor: colors.neutral.photoBackdrop,
    marginBottom: spacing['11'],
  },
  toggle: {
    position: 'absolute',
    top: spacing['10'],
    right: spacing['10'],
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.pill.borderColor,
  },
  toggleItem: {
    minHeight: 34,
    paddingHorizontal: spacing['10'],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: colors.green['700'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['7'],
    marginBottom: spacing['11'],
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
  diseaseName: {
    marginTop: spacing['2'],
  },
  severity: {
    paddingHorizontal: spacing['11'],
    paddingVertical: spacing['4'],
    borderRadius: radius.pill,
  },
  metrics: {
    padding: spacing['12'],
    borderRadius: radius['6xl'],
    gap: spacing['10'],
    marginBottom: spacing['10'],
  },
  metric: {
    gap: spacing['3'],
  },
  metricHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bar: {
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  topThree: {
    padding: spacing['12'],
    borderRadius: radius['5xl'],
    marginBottom: spacing['10'],
  },
  topThreeLabel: {
    marginBottom: spacing['7'],
  },
  prediction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    paddingVertical: spacing['5'],
  },
  predictionBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing['1'],
  },
  miniBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing['4'],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  predictionBar: {
    width: 76,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  predictionFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  predictionPct: {
    width: 42,
    textAlign: 'right',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['3'],
    marginBottom: spacing['10'],
  },
  metaChip: {
    maxWidth: '100%',
    paddingHorizontal: spacing['8'],
    paddingVertical: spacing['2'],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: glass.soft.borderColor,
  },
  disclaimer: {
    marginBottom: spacing['12'],
  },
  action: {
    marginBottom: spacing['6'],
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing['6'],
  },
  half: {
    flex: 1,
  },
  waitingCard: {
    padding: spacing['13'],
    borderRadius: radius['6xl'],
    marginBottom: spacing['11'],
  },
  waitingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['6'],
    marginBottom: spacing['6'],
  },
  waitingBody: {
    marginBottom: spacing['8'],
  },
  waitingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4'],
  },
  waitingError: {
    marginTop: spacing['4'],
  },
  pressed: {
    opacity: 0.75,
  },
});
