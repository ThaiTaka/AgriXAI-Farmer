/**
 * The village forecast as the server sends it (GET /weather — Open-Meteo,
 * CC BY 4.0, warnings per QĐ 18/2021/QĐ-TTg), plus the pure helpers the
 * screens use. Fetching and caching live in live/weather.ts.
 */

import {createStore, useStore} from './store';

export type WeatherIcon = 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface WeatherDay {
  date: string;
  summary: string;
  icon: WeatherIcon;
  temp_max: number | null;
  temp_min: number | null;
  temp_mean: number | null;
  precipitation_sum: number | null;
  precipitation_probability: number | null;
  wind_speed_max: number | null;
}

export interface WeatherAlert {
  id: string;
  date: string;
  kind: 'mua_to' | 'mua_rat_to' | 'ret_hai';
  level: 'warning' | 'danger';
  title: string;
  body: string;
  expires_at: number;
}

export interface Forecast {
  place: string;
  elevation: number | null;
  fetched_at: number;
  stale: boolean;
  current: {
    time: string | null;
    temperature: number | null;
    humidity: number | null;
    precipitation: number | null;
    wind_speed: number | null;
    is_day: boolean;
    summary: string;
    icon: WeatherIcon;
  };
  daily: WeatherDay[];
  alerts: WeatherAlert[];
  source: {name: string; url: string; licence: string};
  basis: string;
}

const store = createStore<Forecast | null>(null);

export const forecastNow = (): Forecast | null => store.get();
export const publishForecast = (next: Forecast | null): void => store.set(next);
export const useForecast = (): Forecast | null => useStore(store);

/** "Hôm nay", "Ngày mai", then the weekday: "T5 09/10". */
export function dayLabel(isoDate: string, now: number = Date.now()): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const day = new Date(y, m - 1, d).getTime();
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((day - start) / 86_400_000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  const weekday = new Date(y, m - 1, d).getDay();
  const name = weekday === 0 ? 'CN' : `T${weekday + 1}`;
  return `${name} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** 17.04 -> "17°", null -> "–". */
export const degrees = (value: number | null | undefined): string => (value == null ? '–' : `${Math.round(value)}°`);

/** 9.1 -> "9,1 mm", 0 -> "0 mm". */
export function millimetres(value: number | null | undefined): string {
  if (value == null) return '–';
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} mm`;
}

/** Warnings still ahead of us (a warning for a day gone by is history). */
export const activeAlerts = (forecast: Forecast | null, now: number = Date.now()): WeatherAlert[] =>
  (forecast?.alerts ?? []).filter(a => a.expires_at > now);

/** Age of the forecast in words, for "Cập nhật …". */
export function updatedLabel(fetchedAt: number, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - fetchedAt) / 60_000);
  if (minutes < 1) return 'vừa cập nhật';
  if (minutes < 60) return `cập nhật ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `cập nhật ${hours} giờ trước`;
  return `cập nhật ${Math.floor(hours / 24)} ngày trước`;
}
