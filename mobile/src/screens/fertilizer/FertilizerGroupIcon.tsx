import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

import {colors} from '../../theme';

const STROKE = 2;

/**
 * One line glyph per fertiliser group (codes from
 * shared/data/fertilizer_recommendations.json): N = leaf, P = root, K = fruit,
 * NPK = three dots, hữu cơ = compost heap, vi sinh = microbe.
 */
export function FertilizerGroupIcon({
  code,
  size = 26,
  color = colors.primary.default,
}: {
  code: string;
  size?: number;
  color?: string;
}) {
  switch (code) {
    case 'dam':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14Z"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          <Path d="M5 19 13 11" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        </Svg>
      );
    case 'lan':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3v7" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Path
            d="M12 10c-3 1-5 4-5.5 9M12 10c3 1 5 4 5.5 9M12 10v10M9 14l-2 1.5M15 14l2 1.5"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'kali':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={13.5} r={7} stroke={color} strokeWidth={STROKE} />
          <Path d="M12 6.5V3.5M12 3.5c1.6 0 3 .8 3.5 2" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        </Svg>
      );
    case 'npk':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={7} cy={16} r={3} stroke={color} strokeWidth={STROKE} />
          <Circle cx={17} cy={16} r={3} stroke={color} strokeWidth={STROKE} />
          <Circle cx={12} cy={7.5} r={3} stroke={color} strokeWidth={STROKE} />
        </Svg>
      );
    case 'huu_co':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 19h18M5 19c0-4 3-7 7-7s7 3 7 7M9 12c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M12 8.5V5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={STROKE} />
          <Path
            d="M12 6V3M12 21v-3M6 12H3M21 12h-3M7.8 7.8 5.6 5.6M18.4 18.4l-2.2-2.2M7.8 16.2l-2.2 2.2M18.4 5.6l-2.2 2.2"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}
