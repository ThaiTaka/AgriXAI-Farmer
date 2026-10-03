/**
 * Thời tiết — the village forecast: now, any official warning, and 7 days.
 *
 * The forecast is Open-Meteo's (CC BY 4.0), fetched by the server for the
 * whole village and kept on the phone, so this screen opens offline with the
 * last forecast and says how old it is. Warnings follow QĐ 18/2021/QĐ-TTg —
 * the screen states the thresholds so a farmer can check the rule.
 */

import {useNavigation} from '@react-navigation/native';
import React, {useCallback, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useAuth} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {AlertIcon} from '../../components/icons';
import {Screen} from '../../components/Screen';
import {SourceLink} from '../../components/SourceLink';
import {WeatherGlyph} from '../../components/WeatherGlyph';
import {refreshForecast} from '../../live/weather';
import type {WeatherDay} from '../../live/weatherIndex';
import {activeAlerts, dayLabel, degrees, millimetres, updatedLabel, useForecast} from '../../live/weatherIndex';
import {colors, radius, space, text} from '../../theme';

const OFFICIAL_BULLETIN = 'https://www.nchmf.gov.vn/kttv/';

export function WeatherScreen() {
  const navigation = useNavigation();
  const {session} = useAuth();
  const forecast = useForecast();
  const [refreshing, setRefreshing] = useState(false);
  const now = Date.now();

  const refresh = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    await refreshForecast(session.token, {force: true});
    setRefreshing(false);
  }, [session?.token]);

  const alerts = activeAlerts(forecast, now);
  const lows = forecast?.daily.map(d => d.temp_min ?? Infinity) ?? [];
  const highs = forecast?.daily.map(d => d.temp_max ?? -Infinity) ?? [];
  const range = {min: Math.min(...lows), max: Math.max(...highs)};

  return (
    <Screen>
      <AppHeader eyebrow="Thời tiết" title={forecast?.place ?? 'Làng hoa Vạn Thành'} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary.default]} />}>
        {!forecast ? (
          <EmptyState
            icon={<WeatherGlyph icon="partly" size={36} />}
            title="Chưa có dự báo trên máy"
            body="Kéo xuống để tải khi có mạng. Sau lần đầu, dự báo gần nhất luôn xem được cả khi mất sóng."
          />
        ) : (
          <>
            <Card style={styles.hero}>
              <View style={styles.heroRow}>
                <WeatherGlyph icon={forecast.current.icon} night={!forecast.current.is_day} size={84} />
                <View style={styles.flex}>
                  <Text style={styles.heroTemp}>{degrees(forecast.current.temperature)}</Text>
                  <Text style={text('subheading')}>{forecast.current.summary}</Text>
                </View>
              </View>
              <View style={styles.facts}>
                <Fact label="Độ ẩm" value={forecast.current.humidity != null ? `${forecast.current.humidity}%` : '–'} />
                <Fact label="Gió" value={forecast.current.wind_speed != null ? `${Math.round(forecast.current.wind_speed)} km/h` : '–'} />
                <Fact label="Mưa lúc này" value={millimetres(forecast.current.precipitation)} />
              </View>
              <Text style={[text('caption', colors.text.muted), styles.updated]}>
                {updatedLabel(forecast.fetched_at, now)}
                {forecast.elevation ? ` · độ cao ô lưới ${Math.round(forecast.elevation)} m` : ''}
                {forecast.stale ? ' · máy chủ chưa lấy được bản mới, đang xem bản trước' : ''}
              </Text>
            </Card>

            {alerts.map(alert => (
              <View key={alert.id} style={[styles.alert, alert.level === 'danger' ? styles.alertDanger : styles.alertWarning]} testID={`weather-alert-${alert.kind}`}>
                <AlertIcon size={20} color={alert.level === 'danger' ? colors.badge.redFg : colors.badge.yellowFg} />
                <View style={styles.flex}>
                  <Text style={text('cardTitle', alert.level === 'danger' ? colors.badge.redFg : colors.badge.yellowFg)}>{alert.title}</Text>
                  <Text style={[text('bodySm', colors.text.secondary), styles.alertBody]}>{alert.body}</Text>
                </View>
              </View>
            ))}

            <Text style={[text('eyebrow', colors.text.secondary), styles.section]}>7 ngày tới</Text>
            <Card flush style={styles.days}>
              {forecast.daily.map((day, index) => (
                <DayRow key={day.date} day={day} now={now} range={range} last={index === forecast.daily.length - 1} />
              ))}
            </Card>

            <Text style={[text('eyebrow', colors.text.secondary), styles.section]}>Nguồn và cách cảnh báo</Text>
            <Card style={styles.notes}>
              <Text style={text('bodySm', colors.text.secondary)}>
                Dự báo theo mô hình của {forecast.source.name} ({forecast.source.licence}) cho một điểm ở làng hoa; máy chủ cập nhật mỗi 30 phút.
                Đây là dự báo, không phải số đo tại vườn.
              </Text>
              <SourceLink url={forecast.source.url} citation="Weather data by Open-Meteo.com" label="Mở open-meteo.com" />
              <Text style={[text('bodySm', colors.text.secondary), styles.rule]}>
                Cảnh báo theo {forecast.basis}: mưa to khi tổng lượng mưa trên 50 đến 100 mm trong 24 giờ, mưa rất to khi trên 100 mm (khoản 17);
                rét hại khi nhiệt độ trung bình ngày dưới 13°C (khoản 18). Chỉ báo cho hôm nay và hai ngày tới.
              </Text>
              <SourceLink url={OFFICIAL_BULLETIN} citation="Trung tâm Dự báo Khí tượng Thủy văn Quốc gia" label="Xem bản tin chính thức" />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Fact({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.fact}>
      <Text style={text('caption', colors.text.muted)}>{label}</Text>
      <Text style={text('bodyStrong')}>{value}</Text>
    </View>
  );
}

function DayRow({day, now, range, last}: {day: WeatherDay; now: number; range: {min: number; max: number}; last: boolean}) {
  const span = Math.max(1, range.max - range.min);
  const from = day.temp_min == null ? 0 : (day.temp_min - range.min) / span;
  const to = day.temp_max == null ? 1 : (day.temp_max - range.min) / span;
  const wet = (day.precipitation_sum ?? 0) > 50;
  return (
    <View style={[styles.dayRow, last && styles.dayLast]} accessible accessibilityLabel={`${dayLabel(day.date, now)}: ${day.summary}, ${degrees(day.temp_min)} đến ${degrees(day.temp_max)}, mưa ${millimetres(day.precipitation_sum)}`}>
      <Text style={[text('bodyStrong'), styles.dayName]} numberOfLines={1}>
        {dayLabel(day.date, now)}
      </Text>
      <WeatherGlyph icon={day.icon} size={30} />
      <View style={styles.flex}>
        <View style={styles.tempLine}>
          <Text style={[text('meta', colors.text.muted), styles.tempLow]}>{degrees(day.temp_min)}</Text>
          <View style={styles.track}>
            <View style={[styles.bar, {left: `${from * 100}%`, right: `${(1 - to) * 100}%`}]} />
          </View>
          <Text style={[text('meta'), styles.tempHigh]}>{degrees(day.temp_max)}</Text>
        </View>
        <Text style={text('caption', wet ? colors.badge.redFg : colors.text.muted)} numberOfLines={2}>
          {day.summary} · {millimetres(day.precipitation_sum)}
          {day.precipitation_probability != null ? ` · khả năng mưa ${day.precipitation_probability}%` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    padding: space.lg,
    marginBottom: space.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  heroTemp: {
    ...text('display'),
    fontSize: 48,
    lineHeight: 56,
    color: colors.text.primary,
  },
  facts: {
    flexDirection: 'row',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  fact: {
    flex: 1,
    gap: 2,
  },
  updated: {
    marginTop: space.md,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.md,
  },
  alertWarning: {
    backgroundColor: colors.badge.yellowBg,
  },
  alertDanger: {
    backgroundColor: colors.badge.redBg,
  },
  alertBody: {
    marginTop: space.xs,
  },
  section: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
  days: {
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  dayLast: {
    borderBottomWidth: 0,
  },
  dayName: {
    width: 84,
  },
  tempLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  tempLow: {
    width: 30,
    textAlign: 'right',
  },
  tempHigh: {
    width: 30,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface.subtle,
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: colors.semantic.warning,
  },
  notes: {
    padding: space.lg,
    gap: space.sm,
  },
  rule: {
    marginTop: space.sm,
  },
});
