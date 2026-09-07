/**
 * Màn hình 07 — Lịch sử chẩn đoán.
 *
 * Design reference: screen "07 Lịch sử" — severity filter chips, then rows with a
 * tinted leaf mark, disease name, meta line, severity badge and confidence.
 *
 * Reads from SQLite, so the history is there with no signal. Photos queued and
 * still waiting appear at the top so a farmer can see the phone has not lost
 * them.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../auth/AuthContext';
import {IconButton} from '../components/buttons';
import {GlassSurface} from '../components/GlassSurface';
import {ChevronLeft, LeafMark, OfflineIcon} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import type Diagnosis from '../db/models/Diagnosis';
import type {SeverityKey} from '../db/models/Diagnosis';
import {deleteDiagnosis, observeDiagnoses} from '../db/repositories/diagnosisRepository';
import {useObservable} from '../db/useObservable';
import {useDiagnosisQueue} from '../diagnosis/DiagnosisQueueContext';
import type {RootStackParamList} from '../navigation/types';
import {
  colors,
  glass,
  radius,
  severity as severityTokens,
  spacing,
  text,
} from '../theme';
import {formatDateTime, formatRelative} from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'DiagnosisHistory'>;

type Filter = 'all' | SeverityKey;

const FILTERS: Array<{key: Filter; label: string}> = [
  {key: 'all', label: 'Tất cả'},
  {key: 'severe', label: 'Nặng'},
  {key: 'moderate', label: 'Trung bình'},
  {key: 'mild', label: 'Nhẹ'},
  {key: 'none', label: 'Khoẻ mạnh'},
];

const ICON_TINT: Record<SeverityKey, {bg: string; leafA: string; leafB: string}> = {
  none: {bg: 'rgba(84,169,106,.2)', leafA: colors.lime['500'], leafB: colors.green['700']},
  mild: {bg: 'rgba(195,210,74,.2)', leafA: colors.lime['500'], leafB: colors.lime['800']},
  moderate: {bg: 'rgba(242,161,4,.2)', leafA: colors.amber['500'], leafB: colors.amber['700']},
  severe: {bg: 'rgba(194,74,18,.18)', leafA: colors.danger.dot, leafB: colors.danger.bg},
};

export function DiagnosisHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const author = useChangeAuthor();
  const {queue} = useDiagnosisQueue();

  const [filter, setFilter] = useState<Filter>('all');

  const rows = useObservable<Diagnosis[]>(
    () => observeDiagnoses(params.plotId),
    [params.plotId],
    [],
  );

  const waiting = useMemo(
    () => queue.filter(row => row.plotId === params.plotId),
    [queue, params.plotId],
  );

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter(row => row.severity === filter)),
    [rows, filter],
  );

  const confirmDelete = useCallback(
    (row: Diagnosis) => {
      Alert.alert(
        'Xoá chẩn đoán',
        `Xoá kết quả "${row.diseaseName}" ngày ${formatDateTime(row.diagnosedAt)}?`,
        [
          {text: 'Huỷ', style: 'cancel'},
          {
            text: 'Xoá',
            style: 'destructive',
            onPress: () => {
              deleteDiagnosis(row, author).catch(error =>
                console.warn('[history] delete failed', error),
              );
            },
          },
        ],
      );
    },
    [author],
  );

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Quay lại" onPress={() => navigation.goBack()}>
            <ChevronLeft />
          </IconButton>
          <View style={styles.headerText}>
            <Text style={text('sectionTitle')}>Lịch sử chẩn đoán</Text>
            <Text style={text('meta', colors.text.alpha['70'])}>
              {rows.length} kết quả
              {waiting.length > 0 ? ` · ${waiting.length} ảnh đang chờ` : ''}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}>
          {FILTERS.map(item => {
            const on = filter === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{selected: on}}
                onPress={() => setFilter(item.key)}
                style={[styles.filter, on ? styles.filterOn : styles.filterOff]}>
                <Text style={text('meta', on ? colors.neutral.white : colors.text.alpha['74'])}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {waiting.length > 0 && filter === 'all'
            ? waiting.map(row => (
                <GlassSurface key={row.id} level="soft" style={styles.waitingRow}>
                  <OfflineIcon size={20} />
                  <View style={styles.rowBody}>
                    <Text style={text('cardTitle')}>Đang chờ mạng</Text>
                    <Text style={text('caption', colors.text.alpha['68'])}>
                      Ảnh chụp {formatRelative(row.createdAt)}
                      {row.attempts > 0 ? ` · đã thử ${row.attempts} lần` : ''}
                    </Text>
                  </View>
                </GlassSurface>
              ))
            : null}

          {visible.length === 0 && waiting.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[text('cardTitleLg'), styles.emptyTitle]}>
                {rows.length === 0 ? 'Chưa có chẩn đoán nào' : 'Không có kết quả'}
              </Text>
              <Text style={[text('bodySm', colors.text.alpha['68']), styles.emptyBody]}>
                {rows.length === 0
                  ? 'Chụp ảnh lá để chẩn đoán bệnh cho lô này.'
                  : 'Chưa có lần chẩn đoán nào ở mức độ này.'}
              </Text>
            </View>
          ) : null}

          {visible.map(row => {
            const token = severityTokens[row.severity];
            const tint = ICON_TINT[row.severity];
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={`${row.diseaseName}, ${token.label}`}
                onPress={() =>
                  navigation.navigate('DiagnosisResult', {mode: 'saved', diagnosisId: row.id})
                }
                onLongPress={() => confirmDelete(row)}
                style={({pressed}) => [styles.rowWrap, pressed && styles.pressed]}>
                <GlassSurface level="card" style={styles.row}>
                  <View style={[styles.icon, {backgroundColor: tint.bg}]}>
                    <LeafMark size={26} leafA={tint.leafA} leafB={tint.leafB} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={text('cardTitle')} numberOfLines={1}>
                      {row.diseaseName}
                    </Text>
                    <Text style={[text('metaSm', colors.text.alpha['68']), styles.rowMeta]}>
                      {formatDateTime(row.diagnosedAt)}
                    </Text>
                  </View>
                  <View style={styles.rowTail}>
                    <View style={[styles.badge, {backgroundColor: token.bg}]}>
                      <Text style={text('badge', token.fg)}>{token.label}</Text>
                    </View>
                    <Text style={text('badge', colors.text.alpha['62'])}>
                      {Math.round(row.confidence * 100)}%
                    </Text>
                  </View>
                </GlassSurface>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xoá chẩn đoán ${row.diseaseName}`}
                  onPress={() => confirmDelete(row)}
                  hitSlop={8}
                  style={styles.deleteButton}>
                  <Text style={text('caption', colors.amber['700'])}>Xoá chẩn đoán này</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
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
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    alignItems: 'center',
    paddingHorizontal: spacing['11'],
    gap: spacing['3'],
    paddingBottom: spacing['8'],
  },
  filter: {
    minHeight: 44,
    paddingHorizontal: spacing['12'],
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOff: {
    borderColor: glass.control.borderColor,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  filterOn: {
    borderColor: colors.green['700'],
    backgroundColor: colors.green['700'],
  },
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingBottom: spacing['18'],
    gap: spacing['7'],
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['8'],
    padding: spacing['11'],
    borderRadius: radius['4xl'],
    borderColor: 'rgba(242,161,4,0.34)',
    backgroundColor: 'rgba(242,161,4,0.14)',
  },
  rowWrap: {
    gap: spacing['2'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['9'],
    padding: spacing['9'],
    borderRadius: radius['4xl'],
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    marginTop: 2,
  },
  rowTail: {
    alignItems: 'flex-end',
    gap: spacing['2'],
  },
  badge: {
    paddingHorizontal: spacing['6'],
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  deleteButton: {
    alignSelf: 'flex-end',
    minHeight: 34,
    paddingHorizontal: spacing['8'],
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 46,
    paddingHorizontal: spacing['13'],
  },
  emptyTitle: {
    marginBottom: spacing['3'],
  },
  emptyBody: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
