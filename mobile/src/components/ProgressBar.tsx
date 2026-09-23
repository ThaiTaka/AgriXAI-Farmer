import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, radius, space, text} from '../theme';

interface Props {
  /** Số việc đã làm. */
  done: number;
  /** Tổng số việc. 0 thì không vẽ gì — không có việc thì không có tiến độ. */
  total: number;
  /** Tên giai đoạn, ví dụ "Phân thúc". */
  label: string;
  testID?: string;
}

/**
 * Thanh tiến độ của một giai đoạn chăm sóc.
 *
 * Nông hộ liếc một cái là biết còn bao nhiêu việc, không phải đếm từng dòng.
 * Phần trăm để ở dạng chữ cạnh nhãn chứ không nằm trong thanh: thanh chỉ cao
 * 8pt, chữ nhét vào đó sẽ không đọc nổi ngoài nắng.
 */
export function ProgressBar({done, total, label, testID}: Props) {
  if (total <= 0) return null;

  const ratio = Math.min(1, Math.max(0, done / total));
  const percent = Math.round(ratio * 100);

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: total, now: done}}
      accessibilityLabel={`${label}: đã làm ${done} trên ${total} việc, ${percent} phần trăm`}>
      <View style={styles.head}>
        <Text style={[text('bodySm', colors.text.secondary), styles.label]} numberOfLines={1}>
          {label} — {done}/{total} đã làm
        </Text>
        <Text style={text('bodyStrong', percent === 100 ? colors.primary.default : colors.text.secondary)}>
          {percent}%
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${percent}%`}]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.xs,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.subtle,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary.default,
  },
});
