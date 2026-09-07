import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type {GlassLevel} from '../theme';
import {glass, surface} from '../theme';

interface Props {
  level?: GlassLevel;
  /** Opaque fallback — weak devices, or the farmer's "Chế độ ngoài nắng" (§3.4). */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * One glass recipe reused across the system: a translucent white gradient, a
 * hairline light border and a soft shadow.
 *
 * `backdrop-filter` has no React Native equivalent, so the blur is dropped and
 * the translucent gradient carries the effect on its own. When `solid` is set
 * the gradient is replaced by the pre-computed opaque token, which is what the
 * field-constraints rule asks for.
 */
export function GlassSurface({level = 'card', solid = false, style, children}: Props) {
  const recipe = glass[level];

  if (solid) {
    return (
      <View style={[surface(level, true), style]}>
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[...recipe.gradientColors] as string[]}
      start={recipe.gradientStart}
      end={recipe.gradientEnd}
      style={[surface(level), style]}>
      {children}
    </LinearGradient>
  );
}
