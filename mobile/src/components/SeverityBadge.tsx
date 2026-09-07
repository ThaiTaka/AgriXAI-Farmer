import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

import type {SeverityKey} from '../db/models/Diagnosis';
import {radius, severity as severityTokens, spacing, text} from '../theme';

interface Props {
  severity: SeverityKey | null;
  /** Extra text shown before the level, e.g. the disease name. */
  prefix?: string;
  /** Opaque palette for "Chế độ ngoài nắng" / weak devices. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Label used when a plot has never been diagnosed. */
export const NO_DIAGNOSIS_LABEL = 'Chưa chẩn đoán';

/**
 * The health badge.
 *
 * `severe` keeps an opaque background in both modes — that is deliberate in the
 * design so the worst case is still readable at a glance in direct sunlight.
 */
export function SeverityBadge({severity, prefix, solid = false, style}: Props) {
  if (!severity) {
    return (
      <View style={[styles.badge, styles.unknown, style]}>
        <Text style={text('badge', 'rgba(18,48,29,0.62)')}>
          {prefix ? `${prefix} · ${NO_DIAGNOSIS_LABEL}` : NO_DIAGNOSIS_LABEL}
        </Text>
      </View>
    );
  }

  const token = severityTokens[severity];
  return (
    <View
      style={[styles.badge, {backgroundColor: solid ? token.solidBg : token.bg}, style]}>
      <Text style={text('badge', token.fg)} numberOfLines={1}>
        {prefix ? `${prefix} · ${token.label}` : token.label}
      </Text>
    </View>
  );
}

export function severityLabel(severity: SeverityKey | null): string {
  return severity ? severityTokens[severity].label : NO_DIAGNOSIS_LABEL;
}

export function severityDot(severity: SeverityKey | null): string {
  return severity ? severityTokens[severity].dot : 'rgba(18,48,29,0.35)';
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['1'],
    borderRadius: radius.pill,
  },
  unknown: {
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
});
