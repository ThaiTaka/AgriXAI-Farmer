import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, space, text} from '../theme';
import {GhostButton, IconButton} from './buttons';
import {ChevronLeft} from './icons';

interface Props {
  title: string;
  /** Small line above the title, e.g. the breadcrumb "Cà chua › Cà chua bi". */
  eyebrow?: string;
  onBack?: () => void;
  /** Text action on the right ("Huỷ", "Lưu"). */
  action?: {label: string; onPress: () => void};
  /** Icon action on the right (edit pencil...). */
  right?: React.ReactNode;
}

/**
 * Page header: a transparent back arrow, the title, an optional right action.
 * Nothing is elevated — the header sits on the same ground as the content.
 */
export function AppHeader({title, eyebrow, onBack, action, right}: Props) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <IconButton accessibilityLabel="Quay lại" onPress={onBack}>
          <ChevronLeft />
        </IconButton>
      ) : null}
      <View style={[styles.titles, !onBack && styles.titlesNoBack]}>
        {eyebrow ? (
          <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={text('heading')} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {action ? <GhostButton small label={action.label} onPress={action.onPress} /> : null}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.sm,
    paddingRight: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    minHeight: 56,
  },
  titles: {
    flex: 1,
    minWidth: 0,
    paddingLeft: space.xs,
  },
  titlesNoBack: {
    paddingLeft: space.sm,
  },
});
