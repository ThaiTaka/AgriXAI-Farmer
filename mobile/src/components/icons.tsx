/**
 * The icon set used by the design, transcribed from the reference HTML
 * (docs/design-reference/agrixai-farmer-v4.html). Paths are copied verbatim so
 * the shapes match the mock exactly.
 */

import React from 'react';
import Svg, {Circle, G, Path} from 'react-native-svg';

import {colors} from '../theme';

interface IconProps {
  size?: number;
  color?: string;
}

export function LeafMark({size = 24, leafA = colors.lime['500'], leafB = colors.green['075']}: {
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

export function ChevronLeft({size = 21, color = colors.text.primary}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 18-6-6 6-6"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronRight({size = 20, color = colors.text.alpha['55']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 18 6-6-6-6"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ArrowRight({size = 22, color = colors.green['700']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h15" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <Path
        d="m13 6 6 6-6 6"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PencilIcon({size = 20, color = colors.text.primary}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L20 8l-4-4L4 16v4Z"
        stroke={color}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CameraIcon({size = 28, body = colors.green['075'], lens = colors.green['700']}: {
  size?: number;
  body?: string;
  lens?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9.4 3h5.2l2.1 2.6H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7.6a2 2 0 0 1 2-2h3.3L9.4 3Z"
        fill={body}
      />
      <Circle cx={12} cy={12.8} r={4.2} fill={lens} />
      <Circle cx={12} cy={12.8} r={2.1} fill={colors.lime['500']} />
    </Svg>
  );
}

export function SunIcon({size = 46, color = colors.amber['500']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={5.2} fill={color} />
      <G stroke={color} strokeWidth={2.1} strokeLinecap="round">
        <Path d="M12 2.4v2.2" />
        <Path d="M12 19.4v2.2" />
        <Path d="M2.4 12h2.2" />
        <Path d="M19.4 12h2.2" />
        <Path d="m5.4 5.4 1.5 1.5" />
        <Path d="m17.1 17.1 1.5 1.5" />
        <Path d="m18.6 5.4-1.5 1.5" />
        <Path d="m6.9 17.1-1.5 1.5" />
      </G>
    </Svg>
  );
}

export function WarningIcon({size = 22, fill = colors.amber['500'], mark = colors.lime['900']}: {
  size?: number;
  fill?: string;
  mark?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.6 22.4 21H1.6L12 2.6Z" fill={fill} />
      <Path d="M12 9.4v5.1" stroke={mark} strokeWidth={2.1} strokeLinecap="round" />
      <Circle cx={12} cy={17.6} r={1.15} fill={mark} />
    </Svg>
  );
}

export function CheckIcon({size = 19, color = colors.lime['800']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill="rgba(195,210,74,.2)" />
      <Path
        d="m7.5 12.4 3 3 6-6.4"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClockIcon({size = 23, color = colors.text.alpha['55']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.4} stroke={color} strokeWidth={2.2} />
      <Path d="M12 7v5.2l3.4 2" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({size = 18, color = colors.green['700']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function CalendarIcon({size = 20, color = colors.green['700']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7.5A2 2 0 0 1 6 5.5h12a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z"
        stroke={color}
        strokeWidth={2.1}
        strokeLinejoin="round"
      />
      <Path d="M4 10h16M8.5 3v4M15.5 3v4" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
}

export function OfflineIcon({size = 18, color = colors.amber['700']}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 5.5 22 19"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M5 11.5a11 11 0 0 1 5-2.6M2.5 8A15 15 0 0 1 8 5.1M16 9.3a11 11 0 0 1 3 2.2M21.5 8a15 15 0 0 0-6.2-3.2"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={18.2} r={1.4} fill={color} />
    </Svg>
  );
}
