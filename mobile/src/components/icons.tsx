/**
 * Line icons, 24×24 viewBox, 2px stroke, round caps — one consistent family.
 *
 * Only icons the app actually renders live here. Add one when a screen needs it
 * rather than keeping unused glyphs around.
 */

import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

import {colors} from '../theme';

interface IconProps {
  size?: number;
  color?: string;
}

const STROKE = 2;

export function LeafMark({
  size = 24,
  leafA = colors.green['500'],
  leafB = colors.white,
}: {
  size?: number;
  leafA?: string;
  leafB?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 22C12 13 16 4 22 2c0 10-4 18-10 20Z" fill={leafA} />
      <Path d="M12 22C12 14 8 6 2 5c0 9 4 16 10 17Z" fill={leafB} />
    </Svg>
  );
}

export function ChevronLeft({size = 22, color = colors.text.primary}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 18-6-6 6-6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronRight({size = 20, color = colors.gray['400']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 18 6-6-6-6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ArrowRight({size = 20, color = colors.white}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h15" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="m13 6 6 6-6 6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon({size = 20, color = colors.text.primary}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function PencilIcon({size = 20, color = colors.text.primary}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L20 8l-4-4L4 16v4Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({size = 20, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={STROKE + 0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Radio-style selection mark for pickers: hollow ring, or filled ring with a tick. */
export function RadioIcon({selected, size = 24}: {selected: boolean; size?: number}) {
  if (!selected) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} stroke={colors.gray['300']} strokeWidth={1.6} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={11} fill={colors.primary.default} />
      <Path
        d="m7 12.3 3.2 3.2L17 8.8"
        stroke={colors.white}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClockIcon({size = 22, color = colors.gray['400']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.4} stroke={color} strokeWidth={STROKE} />
      <Path d="M12 7v5.2l3.4 2" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({size = 18, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={STROKE + 0.4} strokeLinecap="round" />
    </Svg>
  );
}

export function CalendarIcon({size = 20, color = colors.gray['500']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7.5A2 2 0 0 1 6 5.5h12a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path d="M4 10h16M8.5 3v4M15.5 3v4" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function OfflineIcon({size = 18, color = colors.badge.yellowFg}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 5.5 22 19" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M5 11.5a11 11 0 0 1 5-2.6M2.5 8A15 15 0 0 1 8 5.1M16 9.3a11 11 0 0 1 3 2.2M21.5 8a15 15 0 0 0-6.2-3.2"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={18.2} r={1.4} fill={color} />
    </Svg>
  );
}

export function LogoutIcon({size = 20, color = colors.gray['500']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SackIcon({size = 22, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3h6l-1.5 3.5h-3L9 3ZM8.2 6.5h7.6c2.6 3 4.2 6 4.2 9.3 0 3.3-2.7 5.2-8 5.2s-8-1.9-8-5.2c0-3.3 1.6-6.3 4.2-9.3Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path d="M9.5 13.5h5M12 11v5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------- crop icons -------------------------------- */

export function TomatoIcon({size = 26, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13.5} r={7.5} stroke={color} strokeWidth={STROKE} />
      <Path
        d="M12 6V3.5M12 6c-1.5-1.2-3.4-1.4-4.8-.8 1 1.2 2.6 1.8 4.8 1.6 2.2.2 3.8-.4 4.8-1.6-1.4-.6-3.3-.4-4.8.8Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CoffeeIcon({size = 26, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5c3.6 0 6.5 3.8 6.5 8.5s-2.9 8.5-6.5 8.5S5.5 16.7 5.5 12 8.4 3.5 12 3.5Z"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Path
        d="M12 3.5c-2 2.5-2.4 5.3-1 8.5s1 6-1 8.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CucumberIcon({size = 26, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 18.5 16.8 7.2a3.2 3.2 0 0 1 4.5 4.5L10 23a3.2 3.2 0 0 1-4.5-4.5Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path d="M17.5 6.5 19 3.5M9.5 14.5l.5.5M12.5 11.5l.5.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function ChiliIcon({size = 26, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 6.5c2 4.5 0 10-4 13-3 2.3-7 2-8.5.5 3.5 0 6.8-2.2 8.5-5.5 1.3-2.6 1.6-5.3 1.2-8"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M16.5 6.5c1.5-1.5 3.5-1.7 4.5-1-1.2 0-2.3.6-3 1.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16.5 6.5V3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function SproutIcon({size = 26, color = colors.primary.default}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21v-9" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M12 12c0-4 3-7 8-7 0 4-3 7-8 7ZM12 14c0-3-2.5-5.5-6.5-5.5 0 3 2.5 5.5 6.5 5.5Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export type CropIconName = 'tomato' | 'coffee' | 'cucumber' | 'chili' | 'other';

export function CropIcon({name, size, color}: {name: CropIconName} & IconProps) {
  switch (name) {
    case 'tomato':
      return <TomatoIcon size={size} color={color} />;
    case 'coffee':
      return <CoffeeIcon size={size} color={color} />;
    case 'cucumber':
      return <CucumberIcon size={size} color={color} />;
    case 'chili':
      return <ChiliIcon size={size} color={color} />;
    default:
      return <SproutIcon size={size} color={color} />;
  }
}
