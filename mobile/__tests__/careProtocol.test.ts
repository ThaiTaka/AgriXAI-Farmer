/**
 * F5–F6 — quy trình chăm sóc: which protocol a crop/category gets, and the
 * "Chưa có dữ liệu" rule for the ones without an official source.
 */

import {
  applicationPct,
  citation,
  protocolAvailability,
  protocolsFor,
  stageForGrowth,
  stageForMonth,
  unavailableEntries,
} from '../src/domain/careProtocol';
import {pricePerKg, tierBandLabel, tierFor} from '../src/domain/budgetTier';
import {toSquareMetres, AREA_UNITS} from '../src/domain/areaUnits';
import {budgetTiers, fertilizerProducts, seedVarietyCategory} from '../src/utils/staticData';
import {formatVnd} from '../src/utils/format';

describe('protocol lookup', () => {
  test('cà chua: one protocol for every category, 4 stages, sourced', () => {
    const {protocols, unavailable} = protocolAvailability('tomato', 'tomato_round');
    expect(unavailable).toBeNull();
    expect(protocols.map(p => p.id)).toEqual(['tomato_default']);
    expect(protocols[0].stages).toHaveLength(4);
    expect(protocols[0].source.url).toMatch(/^https?:\/\//);
    expect(protocols[0].stages.map(s => s.pct_of_total_topdress)).toEqual([20, 20, 30, 30]);
  });

  test('cà phê vối and chè each get their own protocol', () => {
    expect(protocolsFor('coffee', 'coffee_robusta').map(p => p.id)).toEqual(['coffee_robusta_ctt_2010']);
    expect(protocolsFor('coffee', 'coffee_arabica').map(p => p.id)).toEqual(['coffee_arabica_wasi_2026']);
    expect(protocolsFor('coffee').map(p => p.id)).toEqual(['coffee_robusta_ctt_2010', 'coffee_arabica_wasi_2026']);
  });

  test('cà phê mít / Excelsa / ớt kiểng: "Chưa có dữ liệu" with a reason and sources', () => {
    for (const [crop, cat] of [
      ['coffee', 'coffee_liberica'],
      ['coffee', 'coffee_excelsa'],
      ['chili', 'chili_ornamental'],
    ] as const) {
      const {protocols, unavailable} = protocolAvailability(crop, cat);
      expect(protocols).toEqual([]);
      expect(unavailable?.category_id).toBe(cat);
      expect(unavailable?.reason).toMatch(/Chưa tìm được/);
      expect(unavailable?.suggested_sources.length).toBeGreaterThan(0);
    }
    expect(unavailableEntries().map(u => u.category_id).sort()).toEqual(['chili_ornamental', 'coffee_excelsa', 'coffee_liberica']);
    expect(unavailableEntries('chili')).toHaveLength(1);
  });

  test('a farmer-added crop has neither a protocol nor an unavailable entry', () => {
    const {protocols, unavailable} = protocolAvailability('sau_rieng');
    expect(protocols).toEqual([]);
    expect(unavailable).toBeNull();
  });

  test('growth stages map onto protocol rounds; calendar rounds map onto months', () => {
    const tomato = protocolsFor('tomato')[0];
    expect(stageForGrowth(tomato, 'seedling')?.stage_code).toBe('seedling');
    expect(stageForGrowth(tomato, 'vegetative')?.stage_code).toBe('flowering');
    expect(stageForGrowth(tomato, 'harvesting')?.stage_code).toBe('harvesting');
    expect(stageForMonth(tomato, 5)).toBeUndefined();

    const robusta = protocolsFor('coffee', 'coffee_robusta')[0];
    expect(stageForMonth(robusta, 1)?.stage_name_vi).toBe('Đợt 1 — giữa mùa khô');
    expect(stageForMonth(robusta, 7)?.stage_name_vi).toBe('Đợt 3 — giữa mùa mưa');
    expect(stageForMonth(robusta, 3)).toBeUndefined();
    expect(stageForGrowth(robusta, 'seedling')).toBeUndefined();
  });

  test('application split per round reads off the stage', () => {
    const robusta = protocolsFor('coffee', 'coffee_robusta')[0];
    const round2 = robusta.stages[1];
    expect(applicationPct(round2, 'ure')).toBe(30);
    expect(applicationPct(round2, 'lan_nung_chay')).toBe(100);
    expect(applicationPct(round2, 'sa')).toBe(0);
    expect(citation(robusta)).toContain('Cục Trồng trọt');
    expect(citation(robusta)).toContain('2010-07-20');
  });

  test('seed variety → catalogue category', () => {
    expect(seedVarietyCategory('seed_ca_chua_mv1')).toBe('tomato_round');
    expect(seedVarietyCategory('coffee_robusta_tr4')).toBe('coffee_robusta');
    expect(seedVarietyCategory('not-a-seed')).toBeNull();
    expect(seedVarietyCategory(null)).toBeNull();
  });
});

describe('F3 — budget tiers', () => {
  const tiers = budgetTiers();

  test('bands come from the data file', () => {
    expect(tiers.map(t => t.max_price_per_kg)).toEqual([12_300, 14_500, null]);
    expect(tierFor(12_300, tiers)).toBe('binh_dan');
    expect(tierFor(12_301, tiers)).toBe('trung_binh');
    expect(tierFor(14_500, tiers)).toBe('trung_binh');
    expect(tierFor(14_501, tiers)).toBe('cao_cap');
  });

  test('the brief’s worked examples', () => {
    // Urê Cà Mau 610k–690k / 50 kg → 12.2k–13.8k, avg 13k → trung bình
    expect(pricePerKg(610_000, 50)).toBe(12_200);
    expect(tierFor(13_000, tiers)).toBe('trung_binh');
    // DAP Hàn Quốc 1.07M–1.12M / 50 kg → 21.4k–22.4k → cao cấp
    expect(tierFor(pricePerKg(1_070_000, 50), tiers)).toBe('cao_cap');
    // Kali MOP 490k–600k / 50 kg → 9.8k–12k → bình dân
    expect(tierFor(pricePerKg(600_000, 50), tiers)).toBe('binh_dan');
    expect(() => pricePerKg(1, 0)).toThrow();
  });

  test('every catalogue product carries the tier its price implies', () => {
    for (const product of fertilizerProducts()) {
      expect(product.budget_tier).toBe(tierFor(product.price_per_kg_avg!, tiers));
    }
  });

  test('band labels', () => {
    expect(tierBandLabel(tiers[0], tiers, formatVnd)).toBe('≤ 12.300₫/kg');
    expect(tierBandLabel(tiers[1], tiers, formatVnd)).toBe('12.300₫ – 14.500₫/kg');
    expect(tierBandLabel(tiers[2], tiers, formatVnd)).toBe('> 14.500₫/kg');
  });
});

describe('area units', () => {
  test('conversions to m²', () => {
    expect(toSquareMetres(300, 'm2')).toBe(300);
    expect(toSquareMetres(2, 'sao_bac')).toBe(720);
    expect(toSquareMetres(1, 'cong_nam')).toBe(1000);
    expect(toSquareMetres(0.5, 'ha')).toBe(5000);
    expect(toSquareMetres(1, 'mau_bac')).toBe(3600);
    expect(toSquareMetres(7, 'unknown')).toBe(7);
    expect(AREA_UNITS.map(u => u.code)).toContain('sao_trung');
  });
});
