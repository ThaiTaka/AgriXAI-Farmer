import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type Plot from '../db/models/Plot';
import type {PlotStatus} from '../db/models/Plot';
import {PLOT_STATUS_LABELS} from '../db/repositories/plotRepository';
import {formatArea, formatDate} from '../utils/format';
import {colors, glass, radius, spacing, surface, text} from '../theme';
import {ChevronRight, LeafMark} from './icons';

const SOFT_COLORS = [...glass.soft.gradientColors] as string[];

/**
 * Tint per cultivation status.
 *
 * Green while the plot is being worked, muted amber once it is resting or
 * harvested — a farmer scanning the list should be able to tell which plots
 * still need attention without reading the labels.
 */
const STATUS_TINT: Record<PlotStatus, {badge: string; label: string; leafB: string}> = {
  active: {
    badge: 'rgba(84,169,106,0.18)',
    label: colors.green['700'],
    leafB: colors.green['700'],
  },
  fallow: {
    badge: 'rgba(242,161,4,0.18)',
    label: colors.amber['700'],
    leafB: colors.amber['700'],
  },
  harvested: {
    badge: 'rgba(195,210,74,0.20)',
    label: colors.lime['800'],
    leafB: colors.lime['800'],
  },
};

interface Props {
  plot: Plot;
  onPress: (plot: Plot) => void;
}

/** One row of the home list: name, code, area, variety and cultivation status. */
export function PlotCard({plot, onPress}: Props) {
  const tint = STATUS_TINT[plot.status] ?? STATUS_TINT.active;

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
        <View style={[styles.iconBox, {backgroundColor: tint.badge}]}>
          <LeafMark size={24} leafA={colors.lime['500']} leafB={tint.leafB} />
        </View>

        <View style={styles.body}>
          <Text style={text('listTitle')} numberOfLines={1}>
            {plot.name}
          </Text>
          <Text style={[text('metaSm', colors.text.alpha['72']), styles.subtitle]} numberOfLines={1}>
            {subtitle}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, {backgroundColor: tint.badge}]}>
              <Text style={text('badge', tint.label)} numberOfLines={1}>
                {PLOT_STATUS_LABELS[plot.status] ?? plot.status}
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
