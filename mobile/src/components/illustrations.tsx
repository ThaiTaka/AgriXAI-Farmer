import React from 'react';
import Svg, {Circle, Ellipse, Path, Rect} from 'react-native-svg';

import {colors} from '../theme';

/**
 * A small, friendly scene for the login header: sun, two furrows, and a sprout
 * coming up out of them.
 *
 * Drawn from the palette rather than stock art so it cannot drift from the
 * brand, and kept to simple shapes — this renders at 120pt on a cheap phone,
 * where detail turns to mush. No faces or people: a farmer figure at this size
 * is either a blob or a caricature, and the crop is what the app is about.
 */
export function FarmScene({width = 160}: {width?: number}) {
  const height = (width * 100) / 160;
  return (
    <Svg width={width} height={height} viewBox="0 0 160 100">
      {/* sun */}
      <Circle cx="130" cy="24" r="14" fill={colors.accent.limeSoft} />
      <Circle cx="130" cy="24" r="8" fill={colors.accent.lime} />

      {/* far field band */}
      <Path d="M0 62 Q40 52 80 60 T160 58 L160 72 L0 72 Z" fill={colors.green['100']} />

      {/* near furrows */}
      <Path d="M0 72 Q50 66 100 72 T160 70 L160 100 L0 100 Z" fill={colors.primary.soft} />
      <Path
        d="M10 84 Q60 78 110 84"
        stroke={colors.green['300']}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M26 93 Q76 87 140 92"
        stroke={colors.green['300']}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* sprout */}
      <Path
        d="M56 72 L56 44"
        stroke={colors.primary.default}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Ellipse cx="45" cy="47" rx="11" ry="7" fill={colors.primary.default} transform="rotate(-24 45 47)" />
      <Ellipse cx="68" cy="41" rx="12" ry="7.5" fill={colors.green['600']} transform="rotate(18 68 41)" />

      {/* a staked seedling beside it, so the field reads as tended */}
      <Rect x="98" y="52" width="2.5" height="20" rx="1.2" fill={colors.green['300']} />
      <Path
        d="M100 58 q9 -3 12 -10"
        stroke={colors.green['600']}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
