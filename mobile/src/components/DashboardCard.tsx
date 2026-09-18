import React from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, shadows, space, text} from '../theme';
import type {TileTone} from './IconTile';
import {IconTile} from './IconTile';
import {NumberText} from './NumberText';

interface Props {
  label: string;
  /** The headline figure, already formatted ("1.508.000₫", "4"). */
  value: string;
  /** Word set before the figure in body type, e.g. "Lỗ". */
  prefix?: string;
  /** Word set after the figure in body type, e.g. "việc giai đoạn này". */
  unit?: string;
  /** Negative figures (a loss) are set in red; everything else in brand green. */
  negative?: boolean;
  subtext: string;
  onPress: () => void;
  icon?: React.ReactNode;
  /** Small badge text next to the label, e.g. "Chưa đồng bộ". */
  flag?: string | null;
  /** Ground of the icon tile. Three green tiles in a column all look alike. */
  tone?: TileTone;
  testID?: string;
}

/**
 * Dashboard summary card: white, hairline, 16pt radius, 20pt padding.
 *
 * The icon sits in its own tinted tile on the right rather than inline with
 * the label, so the eye finds the card by its shape before reading a word; the
 * figure is monospace 28pt in green, or red for a loss. Pressing scales to
 * 0.98 and lifts the shadow.
 */
export function DashboardCard({label, value, prefix, unit, negative = false, subtext, onPress, icon, flag, tone = 'green', testID}: Props) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const figureColor = negative ? colors.text.danger : colors.primary.default;
  const [pressed, setPressed] = React.useState(false);

  const animate = (to: number) =>
    Animated.spring(scale, {toValue: to, useNativeDriver: true, speed: 40, bounciness: 0}).start();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${[prefix, value, unit].filter(Boolean).join(' ')}. ${subtext}`}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        animate(0.98);
      }}
      onPressOut={() => {
        setPressed(false);
        animate(1);
      }}>
      <Animated.View style={[styles.card, pressed ? shadows.raised : shadows.card, {transform: [{scale}]}]}>
        <View style={styles.body}>
          <View style={styles.column}>
            <View style={styles.head}>
              <Text style={[text('eyebrow', colors.text.muted), styles.label]} numberOfLines={1}>
                {label}
              </Text>
              {flag ? (
                <View style={styles.flag}>
                  <Text style={text('badge', colors.badge.yellowFg)}>{flag}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.value}>
              {prefix ? <Text style={[text('subheading', figureColor), styles.word]}>{prefix}</Text> : null}
              <NumberText size="xl" color={figureColor} numberOfLines={1}>
                {value}
              </NumberText>
              {unit ? <Text style={[text('subheading', figureColor), styles.word]}>{unit}</Text> : null}
            </View>
            <Text style={[text('caption', colors.text.muted), styles.subtext]} numberOfLines={2}>
              {subtext}
            </Text>
          </View>
          {icon ? <IconTile tone={tone}>{icon}</IconTile> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: space.xl,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  label: {
    flexShrink: 1,
  },
  flag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.badge.yellowBg,
  },
  value: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: space.sm,
  },
  word: {
    fontWeight: '700',
  },
  subtext: {
    marginTop: 2,
  },
});
