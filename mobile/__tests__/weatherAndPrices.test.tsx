/**
 * V2.2 — the village forecast on the phone and the admin's prices laid over
 * the surveyed catalogue.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {WeatherCard} from '../src/components/WeatherCard';
import {fromLatest, publishLivePrices} from '../src/live/priceIndex';
import type {Forecast} from '../src/live/weatherIndex';
import {activeAlerts, dayLabel, degrees, millimetres, updatedLabel} from '../src/live/weatherIndex';
import {fertilizerProduct, fertilizerProducts} from '../src/utils/staticData';

const NOW = new Date(2026, 9, 3, 9, 0).getTime();

function forecast(fields: Partial<Forecast> = {}): Forecast {
  const day = (offset: number) => {
    const d = new Date(2026, 9, 3 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    place: 'Làng hoa Vạn Thành, Đà Lạt',
    elevation: 1499,
    fetched_at: NOW - 5 * 60_000,
    stale: false,
    current: {time: null, temperature: 17.2, humidity: 92, precipitation: 0, wind_speed: 4, is_day: true, summary: 'Nhiều mây', icon: 'cloud'},
    daily: [0, 1, 2, 3, 4, 5, 6].map(i => ({
      date: day(i),
      summary: 'Mưa rào',
      icon: 'rain',
      temp_max: 24.6,
      temp_min: 14.3,
      temp_mean: 18,
      precipitation_sum: i === 1 ? 64 : 9.1,
      precipitation_probability: 90,
      wind_speed_max: 12,
    })),
    alerts: [
      {
        id: `weather-${day(1)}-mua-to`,
        date: day(1),
        kind: 'mua_to',
        level: 'warning',
        title: 'Dự báo mưa to ngày 04/10',
        body: '…',
        expires_at: new Date(2026, 9, 5).getTime(),
      },
    ],
    source: {name: 'Open-Meteo', url: 'https://open-meteo.com/', licence: 'CC BY 4.0'},
    basis: 'Quyết định 18/2021/QĐ-TTg, Điều 5',
    ...fields,
  };
}

describe('forecast wording', () => {
  test('days read as the farmer says them', () => {
    expect(dayLabel('2026-10-03', NOW)).toBe('Hôm nay');
    expect(dayLabel('2026-10-04', NOW)).toBe('Ngày mai');
    expect(dayLabel('2026-10-08', NOW)).toBe('T5 08/10');
    expect(dayLabel('2026-10-11', NOW)).toBe('CN 11/10');
  });

  test('numbers', () => {
    expect(degrees(17.6)).toBe('18°');
    expect(degrees(null)).toBe('–');
    expect(millimetres(9.14)).toBe('9,1 mm');
    expect(millimetres(0)).toBe('0 mm');
    expect(updatedLabel(NOW - 30_000, NOW)).toBe('vừa cập nhật');
    expect(updatedLabel(NOW - 2 * 3_600_000, NOW)).toBe('cập nhật 2 giờ trước');
  });

  test('a warning for a day gone by is history', () => {
    const f = forecast();
    expect(activeAlerts(f, NOW)).toHaveLength(1);
    expect(activeAlerts(f, new Date(2026, 9, 6).getTime())).toHaveLength(0);
    expect(activeAlerts(null, NOW)).toEqual([]);
  });
});

describe('the home card', () => {
  test('now, today, the next three days, the warning and the source', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<WeatherCard forecast={forecast()} onPress={() => {}} now={NOW} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('17°');
    expect(json).toContain('Nhiều mây');
    expect(json).toContain('Dự báo mưa to ngày 04/10');
    expect(json).toContain('Ngày mai');
    expect(json).toContain('64 mm');
    expect(json).toContain('Open-Meteo');
    expect(json).toContain('cập nhật 5 phút trước');
  });

  test('a stale forecast says so; no forecast asks for a connection once', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<WeatherCard forecast={forecast({stale: true, alerts: []})} onPress={() => {}} now={NOW} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('máy chủ chưa lấy được bản mới');
    ReactTestRenderer.act(() => {
      tree.update(<WeatherCard forecast={null} onPress={() => {}} now={NOW} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Chưa có dự báo');
  });
});

describe('the admin’s prices over the survey', () => {
  afterEach(() => publishLivePrices({fetchedAt: 0, prices: []}));

  test('only real, current server prices are taken', () => {
    const rows = [
      {id: 7, fertilizer_id: 'ure_ca_mau', price_per_kg: 13200, effective_from: NOW - 1000},
      {id: -1, fertilizer_id: 'ure_phu_my', price_per_kg: 13000, effective_from: 0}, // catalogue fallback
      {id: 9, fertilizer_id: 'kali_bot_phu_my', price_per_kg: 12000, effective_from: NOW + 86_400_000}, // not yet
    ];
    expect(fromLatest(rows, NOW).map(p => p.fertilizerId)).toEqual(['ure_ca_mau']);
  });

  test('a priced product carries the admin’s price into every estimate and keeps the survey’s', () => {
    const survey = fertilizerProduct('ure_ca_mau')!;
    expect(survey.live_price).toBeUndefined();

    publishLivePrices({fetchedAt: NOW, prices: [{fertilizerId: 'ure_ca_mau', pricePerKg: 14100, effectiveFrom: NOW - 1000}]});
    const live = fertilizerProduct('ure_ca_mau')!;
    expect(live.price_per_kg_avg).toBe(14100);
    expect(live.live_price).toEqual({per_kg: 14100, from: NOW - 1000, survey_avg: survey.price_per_kg_avg});
    expect(fertilizerProducts('dam').find(p => p.id === 'ure_ca_mau')?.price_per_kg_avg).toBe(14100);
    // Products the admin never priced keep the survey's price.
    expect(fertilizerProduct('ure_phu_my')?.live_price).toBeUndefined();
  });
});
