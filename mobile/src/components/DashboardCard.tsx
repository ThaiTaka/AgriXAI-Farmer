import React from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, shadows, space, text} from '../theme';
import {ChevronRight} from './icons';
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
  testID?: string;
}

/**
 * Dashboard summary card: white, hairline, 12pt radius, 16pt padding. The
 * figure is monospace 24pt in green, or red for a loss; the caption under it
 * is 12pt gray. Pressing scales to 0.98 and lifts the shadow to md.
 */
export function DashboardCard({label, value, prefix, unit, negative = false, subtext, onPress, icon, flag, testID}: Props) {
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
      <Animated.View style={[styles.card, pressed ? shadows.md : shadows.sm, {transform: [{scale}]}]}>
        <View style={styles.head}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[text('eyebrow', colors.text.muted), styles.label]} numberOfLines={1}>
            {label}
          </Text>
          {flag ? (
            <View style={styles.flag}>
              <Text style={text('badge', colors.badge.yellowFg)}>{flag}</Text>
            </View>
          ) : null}
          <ChevronRight />
        </View>
        <View style={styles.value}>
          {prefix ? <Text style={[text('subheading', figureColor), styles.word]}>{prefix}</Text> : null}
          <NumberText size="lg" color={figureColor} numberOfLines={1}>
            {value}
          </NumberText>
          {unit ? <Text style={[text('subheading', figureColor), styles.word]}>{unit}</Text> : null}
        </View>
        <Text style={[text('caption', colors.text.muted), styles.subtext]} numberOfLines={2}>
          {subtext}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: space.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.xs,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
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
