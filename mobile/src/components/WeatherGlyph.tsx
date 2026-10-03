/**
 * Weather pictures for the forecast card — small duotone drawings rather than
 * line icons, because a farmer reads "nắng / mưa / dông" from the picture
 * before the words. One per icon key the server sends (app/services/weather.py).
 */

import React from 'react';
import Svg, {Circle, G, Path} from 'react-native-svg';

import type {WeatherIcon} from '../live/weatherIndex';

const SUN = '#F5A524';
const CLOUD_FILL = '#E8EEF5';
const CLOUD_LINE = '#8A9BB0';
const RAIN = '#2F80ED';
const BOLT = '#F59E0B';
const MOON = '#8A9BB0';

const CLOUD = 'M7.5 19h9.5a4.5 4.5 0 0 0 .9-8.91A6 6 0 0 0 6.3 10.2 4.5 4.5 0 0 0 7.5 19Z';

function Cloud({dy = 0}: {dy?: number}) {
  return (
    <G transform={`translate(0 ${dy})`}>
      <Path d={CLOUD} fill={CLOUD_FILL} stroke={CLOUD_LINE} strokeWidth={1.6} strokeLinejoin="round" />
    </G>
  );
}

function Sun({cx = 12, cy = 12, r = 4.2}: {cx?: number; cy?: number; r?: number}) {
  const rays = Array.from({length: 8}, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 2.2);
    const y1 = cy + Math.sin(a) * (r + 2.2);
    const x2 = cx + Math.cos(a) * (r + 4);
    const y2 = cy + Math.sin(a) * (r + 4);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }).join('');
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={SUN} />
      <Path d={rays} stroke={SUN} strokeWidth={1.8} strokeLinecap="round" />
    </G>
  );
}

export function WeatherGlyph({icon, size = 40, night = false}: {icon: WeatherIcon; size?: number; night?: boolean}) {
  let body: React.ReactNode;
  switch (icon) {
    case 'clear':
      body = night ? (
        <Path d="M19.5 14.6A7.6 7.6 0 1 1 9.4 4.5a6.1 6.1 0 0 0 10.1 10.1Z" fill={MOON} />
      ) : (
        <Sun />
      );
      break;
    case 'partly':
      body = (
        <>
          {night ? <Path d="M13.2 9.6A5 5 0 1 1 6.4 2.8a4 4 0 0 0 6.8 6.8Z" fill={MOON} /> : <Sun cx={8.5} cy={8.5} r={3.2} />}
          <G transform="translate(3.2 2.4) scale(0.86)">
            <Path d={CLOUD} fill={CLOUD_FILL} stroke={CLOUD_LINE} strokeWidth={1.8} strokeLinejoin="round" />
          </G>
        </>
      );
      break;
    case 'fog':
      body = <Path d="M4 8.5h16M6 12.5h12M4 16.5h16" stroke={CLOUD_LINE} strokeWidth={2} strokeLinecap="round" />;
      break;
    case 'drizzle':
      body = (
        <>
          <Cloud dy={-3.5} />
          <Path d="M8.5 19.2v.1M12 20.6v.1M15.5 19.2v.1M10.2 22.4v.1M13.8 22.4v.1" stroke={RAIN} strokeWidth={2.2} strokeLinecap="round" />
        </>
      );
      break;
    case 'rain':
      body = (
        <>
          <Cloud dy={-3.5} />
          <Path d="M8.6 18.2l-1.2 3.4M12.6 18.2l-1.2 3.4M16.6 18.2l-1.2 3.4" stroke={RAIN} strokeWidth={1.9} strokeLinecap="round" />
        </>
      );
      break;
    case 'storm':
      body = (
        <>
          <Cloud dy={-3.5} />
          <Path d="M13.4 13.6l-3.6 5h2.9l-1.3 4.2 4.3-5.6h-2.9l0.6-3.6Z" fill={BOLT} stroke={BOLT} strokeWidth={0.6} strokeLinejoin="round" />
        </>
      );
      break;
    case 'snow':
      body = (
        <>
          <Cloud dy={-3.5} />
          <Path d="M9 19.5h.01M12 21h.01M15 19.5h.01" stroke={CLOUD_LINE} strokeWidth={2.6} strokeLinecap="round" />
        </>
      );
      break;
    case 'cloud':
    default:
      body = <Cloud dy={-1.5} />;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {body}
    </Svg>
  );
}
