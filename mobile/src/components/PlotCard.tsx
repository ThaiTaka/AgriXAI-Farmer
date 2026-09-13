import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type Plot from '../db/models/Plot';
import type {PlotStatus} from '../db/models/Plot';
import {PLOT_STATUS_LABELS} from '../db/repositories/plotRepository';
import {colors, radius, space, text} from '../theme';
import {formatArea, formatDate} from '../utils/format';
import {cropNameOf, cropTypeById} from '../utils/staticData';
import type {BadgeTone} from './Badge';
import {Badge} from './Badge';
import {Card} from './Card';
import {ChevronRight, CropIcon} from './icons';

/** Badge tone per cultivation status: green while worked, neutral once resting. */
const STATUS_TONE: Record<PlotStatus, BadgeTone> = {
  active: 'green',
  fallow: 'yellow',
  harvested: 'gray',
};

interface Props {
  plot: Plot;
  onPress: (plot: Plot) => void;
}

/** One row of the home list: name, code, area, crop + variety and cultivation status. */
export function PlotCard({plot, onPress}: Props) {
  const cropName = cropNameOf(plot.cropType, plot.cropName);
  const subtitle = [plot.code, formatArea(plot.area, plot.areaUnit)].join(' · ');
  const crop = [cropName, plot.varietyName].filter(Boolean).join(' · ');

  return (
    <Card onPress={() => onPress(plot)} accessibilityLabel={`Lô ${plot.name}`} style={styles.card}>
      <View style={styles.iconBox}>
        <CropIcon name={cropTypeById(plot.cropType)?.icon ?? 'other'} size={24} />
      </View>

      <View style={styles.body}>
        <Text style={text('cardTitle')} numberOfLines={1}>
          {plot.name}
        </Text>
        <Text style={[text('bodySm', colors.text.muted), styles.line]} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={[text('bodySm', colors.text.secondary), styles.line]} numberOfLines={1}>
          {crop}
        </Text>

        <View style={styles.footer}>
          <Badge
            label={PLOT_STATUS_LABELS[plot.status] ?? plot.status}
            tone={STATUS_TONE[plot.status] ?? 'gray'}
          />
          <Text style={text('caption', colors.text.muted)}>Tạo {formatDate(plot.createdAt)}</Text>
        </View>
      </View>

      <ChevronRight />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
});
