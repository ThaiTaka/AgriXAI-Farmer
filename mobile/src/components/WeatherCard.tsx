/**
 * Thời tiết on the home screen: now, today's range and rain, the next three
 * days, and any official warning still ahead. Reads the forecast kept on the
 * phone (live/weather.ts), so it shows the last one — with its age — offline.
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import type {Forecast} from '../live/weatherIndex';
import {activeAlerts, dayLabel, degrees, millimetres, updatedLabel} from '../live/weatherIndex';
import {colors, radius, shadows, space, text} from '../theme';
import {AlertIcon, ChevronRight} from './icons';
import {WeatherGlyph} from './WeatherGlyph';

interface Props {
  forecast: Forecast | null;
  onPress: () => void;
  now?: number;
}

export function WeatherCard({forecast, onPress, now = Date.now()}: Props) {
  if (!forecast) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thời tiết — chưa có dự báo"
        onPress={onPress}
        style={({pressed}) => [styles.card, styles.empty, pressed && styles.pressed]}
        testID="weather-card-empty">
        <WeatherGlyph icon="partly" size={36} />
        <View style={styles.flex}>
          <Text style={text('bodyStrong')}>Thời tiết làng hoa</Text>
          <Text style={text('caption', colors.text.muted)}>Chưa có dự báo — mở ứng dụng lúc có mạng để tải lần đầu.</Text>
        </View>
        <ChevronRight color={colors.text.muted} />
      </Pressable>
    );
  }

  const today = forecast.daily[0];
  const next = forecast.daily.slice(1, 4);
  const alerts = activeAlerts(forecast, now);
  const top = alerts.find(a => a.level === 'danger') ?? alerts[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Thời tiết ${forecast.place}: ${forecast.current.summary}, ${degrees(forecast.current.temperature)}. Xem 7 ngày`}
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}
      testID="weather-card">
      <View style={styles.headRow}>
        <Text style={[text('eyebrow', colors.text.secondary), styles.flex]} numberOfLines={1}>
          Thời tiết · {forecast.place}
        </Text>
        <ChevronRight color={colors.text.muted} />
      </View>

      <View style={styles.now}>
        <WeatherGlyph icon={forecast.current.icon} night={!forecast.current.is_day} size={56} />
        <Text style={styles.temp} accessibilityElementsHidden>
          {degrees(forecast.current.temperature)}
        </Text>
        <View style={styles.flex}>
          <Text style={text('cardTitle')} numberOfLines={1}>
            {forecast.current.summary}
          </Text>
          {today ? (
            <Text style={text('caption', colors.text.secondary)} numberOfLines={2}>
              Hôm nay {degrees(today.temp_min)}–{degrees(today.temp_max)}
              {today.precipitation_sum != null ? ` · mưa ${millimetres(today.precipitation_sum)}` : ''}
              {forecast.current.humidity != null ? ` · ẩm ${forecast.current.humidity}%` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {top ? (
        <View style={[styles.alert, top.level === 'danger' ? styles.alertDanger : styles.alertWarning]} testID="weather-card-alert">
          <AlertIcon size={18} color={top.level === 'danger' ? colors.badge.redFg : colors.badge.yellowFg} />
          <Text style={[text('meta', top.level === 'danger' ? colors.badge.redFg : colors.badge.yellowFg), styles.flex]} numberOfLines={2}>
            {top.title}
            {alerts.length > 1 ? ` (+${alerts.length - 1} cảnh báo)` : ''}
          </Text>
        </View>
      ) : null}

      {next.length > 0 ? (
        <View style={styles.days}>
          {next.map(day => (
            <View key={day.date} style={styles.day}>
              <Text style={text('caption', colors.text.secondary)} numberOfLines={1}>
                {dayLabel(day.date, now)}
              </Text>
              <WeatherGlyph icon={day.icon} size={30} />
              <Text style={text('meta')} numberOfLines={1}>
                {degrees(day.temp_min)}–{degrees(day.temp_max)}
              </Text>
              <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                {millimetres(day.precipitation_sum)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={[text('caption', colors.text.muted), styles.foot]} numberOfLines={1}>
        {forecast.source.name} · {updatedLabel(forecast.fetched_at, now)}
        {forecast.stale ? ' · máy chủ chưa lấy được bản mới' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: space.lg,
    marginBottom: space.xl,
    ...shadows.sm,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.sm,
  },
  temp: {
    ...text('display'),
    color: colors.text.primary,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginTop: space.md,
  },
  alertWarning: {
    backgroundColor: colors.badge.yellowBg,
  },
  alertDanger: {
    backgroundColor: colors.badge.redBg,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  foot: {
    marginTop: space.md,
  },
});
