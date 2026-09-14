import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

import type {PeriodFilter} from '../domain/warehouse';
import {periodLabel} from '../domain/warehouse';
import {colors, space, text} from '../theme';
import {IconButton} from './buttons';
import {SegmentedControl} from './form';
import {ChevronLeft, ChevronRight} from './icons';

interface Props {
  value: PeriodFilter;
  onChange: (next: PeriodFilter) => void;
  /** Hide the "Toàn bộ" option (the finance report is always for a period). */
  allowAll?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Kind = PeriodFilter['kind'];

/** Toàn bộ · Tháng · Quý, then ‹ label › to step through periods. */
export function PeriodPicker({value, onChange, allowAll = true, style}: Props) {
  const now = new Date();
  const items = [
    ...(allowAll ? [{key: 'all' as Kind, label: 'Toàn bộ'}] : []),
    {key: 'month' as Kind, label: 'Tháng'},
    {key: 'quarter' as Kind, label: 'Quý'},
  ];

  const switchKind = (kind: Kind) => {
    if (kind === 'all') onChange({kind: 'all'});
    else if (kind === 'month') onChange({kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1});
    else onChange({kind: 'quarter', year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1});
  };

  const step = (delta: number) => {
    if (value.kind === 'month') {
      const d = new Date(value.year, value.month - 1 + delta, 1);
      onChange({kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1});
    } else if (value.kind === 'quarter') {
      let q = value.quarter + delta;
      let y = value.year;
      if (q < 1) {
        q = 4;
        y -= 1;
      } else if (q > 4) {
        q = 1;
        y += 1;
      }
      onChange({kind: 'quarter', year: y, quarter: q});
    }
  };

  return (
    <View style={style}>
      <SegmentedControl items={items} value={value.kind} onChange={switchKind} />
      {value.kind !== 'all' ? (
        <View style={styles.stepper}>
          <IconButton accessibilityLabel="Kỳ trước" onPress={() => step(-1)}>
            <ChevronLeft />
          </IconButton>
          <Text style={[text('bodyStrong'), styles.label]} testID="period-label">
            {periodLabel(value)}
          </Text>
          <IconButton accessibilityLabel="Kỳ sau" onPress={() => step(1)}>
            <ChevronRight color={colors.text.primary} />
          </IconButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
});
