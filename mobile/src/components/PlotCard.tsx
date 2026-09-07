import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type Plot from '../db/models/Plot';
import {useObservable} from '../db/useObservable';
import type Diagnosis from '../db/models/Diagnosis';
import {formatArea, formatDate, formatRelative} from '../utils/format';
import {colors, glass, radius, severity as severityTokens, spacing, surface, text} from '../theme';
import {ChevronRight, LeafMark} from './icons';
import {NO_DIAGNOSIS_LABEL} from './SeverityBadge';

const SOFT_COLORS = [...glass.soft.gradientColors] as string[];

/** Leaf mark tint per health level, mirroring `p.iconBg` / `p.leafA` in the design. */
const ICON_TINT: Record<string, {bg: string; leafA: string; leafB: string}> = {
  none: {bg: 'rgba(84,169,106,.2)', leafA: colors.lime['500'], leafB: colors.green['700']},
  mild: {bg: 'rgba(195,210,74,.2)', leafA: colors.lime['500'], leafB: colors.lime['800']},
  moderate: {bg: 'rgba(242,161,4,.2)', leafA: colors.amber['500'], leafB: colors.amber['700']},
  severe: {bg: 'rgba(194,74,18,.18)', leafA: colors.danger.dot, leafB: colors.danger.bg},
  unknown: {bg: 'rgba(255,255,255,.55)', leafA: colors.lime['500'], leafB: colors.green['700']},
};

interface Props {
  plot: Plot;
  onPress: (plot: Plot) => void;
}

/**
 * One row of the home list.
 *
 * The health badge is derived from the most recent diagnosis on this plot, which
 * is why the card subscribes to its own query instead of taking a prop: a new
 * diagnosis has to repaint just this card, not the whole list.
 */
export function PlotCard({plot, onPress}: Props) {
  const latest = useObservable<Diagnosis[]>(
    () => plot.latestDiagnosis.observe(),
    [plot.id],
    [],
  );

  const diagnosis = latest[0] ?? null;
  const sevKey = diagnosis?.severity ?? 'unknown';
  const tint = ICON_TINT[sevKey] ?? ICON_TINT.unknown;
  const token = diagnosis ? severityTokens[diagnosis.severity] : null;

  const subtitle = [plot.code, formatArea(plot.area, plot.areaUnit), plot.varietyName]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Lô ${plot.name}`}
      onPress={() => onPress(plot)}
      style={({pressed}) => [pressed && styles.pressed]}>
      <LinearGradient
        colors={SOFT_COLORS}
        start={glass.soft.gradientStart}
        end={glass.soft.gradientEnd}
        style={[styles.card, surface('soft')]}>
        <View style={[styles.iconBox, {backgroundColor: tint.bg}]}>
          <LeafMark size={24} leafA={tint.leafA} leafB={tint.leafB} />
        </View>

        <View style={styles.body}>
          <Text style={text('listTitle')} numberOfLines={1}>
            {plot.name}
          </Text>
          <Text style={[text('metaSm', colors.text.alpha['72']), styles.subtitle]} numberOfLines={1}>
            {subtitle}
          </Text>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                {backgroundColor: token ? token.bg : 'rgba(255,255,255,0.62)'},
              ]}>
              <Text
                style={text('badge', token ? token.fg : colors.text.alpha['62'])}
                numberOfLines={1}>
                {diagnosis
                  ? `${diagnosis.diseaseName} · ${formatRelative(diagnosis.diagnosedAt)}`
                  : NO_DIAGNOSIS_LABEL}
              </Text>
            </View>
          </View>

          <Text style={[text('caption', colors.text.alpha['60']), styles.created]}>
            Tạo ngày {formatDate(plot.createdAt)}
          </Text>
        </View>

        <ChevronRight />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['9'],
    padding: spacing['11'],
    borderRadius: radius['5xl'],
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: spacing['2'],
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    maxWidth: '100%',
    paddingHorizontal: spacing['6'],
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  created: {
    marginTop: spacing['3'],
  },
  pressed: {
    opacity: 0.85,
  },
});
