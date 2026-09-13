import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, space, text} from '../theme';
import {ChevronRight} from './icons';

interface Props {
  title: string;
  subtitle?: string | null;
  /** Short text at the right of the title line, e.g. "5 giống". */
  meta?: string;
  onPress?: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Hide the bottom hairline (last row of a group). */
  last?: boolean;
  testID?: string;
}

/**
 * Full-width row for drill-down lists: title, an optional two-line subtitle,
 * a chevron. Rows are separated by a very light hairline, never a dark one.
 */
export function ListRow({
  title,
  subtitle,
  meta,
  onPress,
  leading,
  trailing,
  last = false,
  testID,
}: Props) {
  const body = (
    <>
      {leading}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[text('cardTitle'), styles.title]} numberOfLines={1}>
            {title}
          </Text>
          {meta ? <Text style={text('caption', colors.text.muted)}>{meta}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={[text('bodySm', colors.text.muted), styles.subtitle]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight /> : null)}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, !last && styles.divider]}>{body}</View>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({pressed}) => [styles.row, !last && styles.divider, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    minHeight: 64,
    backgroundColor: colors.surface.card,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: {
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 2,
  },
});
