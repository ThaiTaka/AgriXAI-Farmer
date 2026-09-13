import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

import {colors, radius, space, text} from '../theme';
import {SecondaryButton} from './buttons';
import {Card} from './Card';

interface Props {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: {label: string; onPress: () => void};
  style?: StyleProp<ViewStyle>;
}

/** Icon + one-line title + explanation + optional action. Never just "Không có dữ liệu". */
export function EmptyState({icon, title, body, action, style}: Props) {
  return (
    <Card style={[styles.card, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[text('subheading'), styles.title]}>{title}</Text>
      <Text style={[text('body', colors.text.muted), styles.body]}>{body}</Text>
      {action ? (
        <SecondaryButton small label={action.label} onPress={action.onPress} style={styles.action} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginTop: space.xs,
  },
  action: {
    marginTop: space.lg,
    alignSelf: 'center',
  },
});
