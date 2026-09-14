/**
 * F1 — tính lượng phân bón. Numbers come straight from the protocol files:
 * scaling is linear in area, nutrient protocols convert through the
 * documented factors, and unpriced items are excluded from the total.
 */

import {conversionFactors, protocolById} from '../src/domain/careProtocol';
import {calculate, formatQuantity, formatRange} from '../src/domain/fertilizerCalc';
import {toSquareMetres} from '../src/domain/areaUnits';
import {fertilizerProduct} from '../src/utils/staticData';

const findProduct = (id: string) => fertilizerProduct(id);

function scenario(protocolId: string, scenarioId: string) {
  const protocol = protocolById(protocolId);
  if (!protocol) throw new Error(protocolId);
  const found = protocol.scenarios.find(s => s.id === scenarioId);
  if (!found) throw new Error(scenarioId);
  return {protocol, scenario: found};
}

describe('F1 — cà chua MV1', () => {
  test('500 m², phương án 2 (50% phân chuồng) scales every item by 0,05', () => {
    const {protocol, scenario: sc} = scenario('tomato_default', 'scenario_50_phan_chuong');
    const result = calculate({protocol, scenario: sc, areaM2: 500, findProduct});

    expect(result.factor).toBeCloseTo(0.05);
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect(byKey.phan_chuong.unit).toBe('tấn');
    expect(byKey.phan_chuong.min).toBeCloseTo(0.3);
    expect(byKey.phan_chuong.max).toBeCloseTo(0.4);
    expect(byKey.ure.min).toBeCloseTo(3.75);
    expect(byKey.ure.max).toBeCloseTo(4.25);
    expect(byKey.super_lan.min).toBeCloseTo(8);
    expect(byKey.super_lan.max).toBeCloseTo(9.5);
    expect(byKey.kali_clorua.min).toBeCloseTo(7.5);
    expect(byKey.kali_clorua.max).toBeCloseTo(8.25);
    expect(byKey.npk_5_10_3.min).toBeCloseTo(20);
    expect(byKey.npk_5_10_3.max).toBeCloseTo(30);
  });

  test('500 m², phương án 1 (25% hữu cơ) has no manure line and more urê', () => {
    const {protocol, scenario: sc} = scenario('tomato_default', 'scenario_25_huu_co');
    const result = calculate({protocol, scenario: sc, areaM2: 500, findProduct});
    expect(result.lines.map(l => l.key)).toEqual(['npk_5_10_3', 'ure', 'super_lan', 'kali_clorua']);
    const ure = result.lines.find(l => l.key === 'ure')!;
    expect(ure.min).toBeCloseTo(7);
    expect(ure.max).toBeCloseTo(7.5);
  });

  test('prices come from the catalogue and unpriced items are named, not guessed', () => {
    const {protocol, scenario: sc} = scenario('tomato_default', 'scenario_50_phan_chuong');
    const result = calculate({protocol, scenario: sc, areaM2: 10_000, findProduct});

    const ure = result.lines.find(l => l.key === 'ure')!;
    expect(ure.priceProductId).toBe('ure_ca_mau');
    expect(ure.pricePerKg).toBe(13_000);
    expect(ure.costMin).toBe(75 * 13_000);
    expect(ure.costMax).toBe(85 * 13_000);

    const priced = result.lines.filter(l => l.costMin !== null);
    expect(result.costMin).toBe(priced.reduce((s, l) => s + l.costMin!, 0));
    expect(result.unpriced).toEqual(['Phân chuồng hoai mục', 'NPK 5-10-3']);
    expect(result.lines.find(l => l.key === 'phan_chuong')!.costMin).toBeNull();
  });

  test('1 ha reproduces the source figures exactly', () => {
    const {protocol, scenario: sc} = scenario('tomato_default', 'scenario_25_huu_co');
    const result = calculate({protocol, scenario: sc, areaM2: 10_000, findProduct});
    const ure = result.lines.find(l => l.key === 'ure')!;
    expect([ure.min, ure.max]).toEqual([140, 150]);
  });
});

describe('F1 — cà phê', () => {
  test('Robusta kinh doanh đất bazan on 2 ha doubles the per-hectare table', () => {
    const {protocol, scenario: sc} = scenario('coffee_robusta_ctt_2010', 'kinh_doanh_bazan');
    const result = calculate({protocol, scenario: sc, areaM2: 20_000, findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect([byKey.ure.min, byKey.ure.max]).toEqual([800, 900]);
    expect([byKey.kcl.min, byKey.kcl.max]).toEqual([700, 800]);
    expect(byKey.sa.pricePerKg).toBeNull(); // no SA in the price catalogue
    expect(result.unpriced).toContain('Sunphat amon (SA)');
  });

  test('năm trồng mới drops the "-" SA row instead of showing 0 kg', () => {
    const {protocol, scenario: sc} = scenario('coffee_robusta_ctt_2010', 'ktcb_nam_trong_moi');
    const result = calculate({protocol, scenario: sc, areaM2: 10_000, findProduct});
    expect(result.lines.map(l => l.key)).toEqual(['ure', 'lan_nung_chay', 'kcl']);
  });

  test('Arabica converts N–P₂O₅–K₂O to urê / super lân / KCl with the documented factors', () => {
    const {protocol, scenario: sc} = scenario('coffee_arabica_wasi_2026', 'kinh_doanh');
    const factors = conversionFactors('coffee');
    expect(factors).toBeDefined();
    const result = calculate({protocol, scenario: sc, areaM2: 10_000, factors, findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));

    expect(byKey.n.name).toBe('Urê (46% N)');
    expect(byKey.n.nutrientMin).toBe(255);
    expect(byKey.n.min).toBeCloseTo((255 * 100) / 46, 6);
    expect(byKey.n.max).toBeCloseTo((280 * 100) / 46, 6);
    expect(byKey.p2o5.min).toBeCloseTo((90 * 100) / 16, 6);
    expect(byKey.k2o.min).toBeCloseTo((270 * 100) / 60, 6);
    expect(byKey.k2o.priceProductId).toBe('kali_bot_ca_mau');
    expect(byKey.n.conversionPct).toBe(46);
  });

  test('a nutrient protocol without factors is an error, never a silent guess', () => {
    const {protocol, scenario: sc} = scenario('coffee_arabica_wasi_2026', 'kinh_doanh');
    expect(() => calculate({protocol, scenario: sc, areaM2: 100, findProduct})).toThrow('quy đổi');
  });
});

describe('F1 — dưa leo và ớt', () => {
  test('VUSTA cucumber protocol is per 1.000 m², so 500 m² halves it', () => {
    const {protocol, scenario: sc} = scenario('cucumber_vusta_2005', 'vusta_nam_bo');
    expect(protocol.reference_area.m2).toBe(1000);
    const result = calculate({protocol, scenario: sc, areaM2: 500, findProduct});
    const dap = result.lines.find(l => l.key === 'dap')!;
    expect([dap.min, dap.max]).toEqual([15, 17.5]);
    expect(dap.priceProductId).toBe('dap_han_quoc');
  });

  test('ớt cay 1 sào Bắc Bộ (360 m²)', () => {
    const {protocol, scenario: sc} = scenario('chili_hot_lamdong', 'lamdong_1ha');
    const areaM2 = toSquareMetres(1, 'sao_bac');
    const result = calculate({protocol, scenario: sc, areaM2, findProduct});
    const ure = result.lines.find(l => l.key === 'ure')!;
    expect(ure.min).toBeCloseTo(7.2);
    const voi = result.lines.find(l => l.key === 'voi')!;
    expect(voi.min).toBeCloseTo(36);
    expect(voi.pricePerKg).toBeNull();
  });

  test('rejects a non-positive area', () => {
    const {protocol, scenario: sc} = scenario('chili_hot_lamdong', 'lamdong_1ha');
    expect(() => calculate({protocol, scenario: sc, areaM2: 0, findProduct})).toThrow();
  });
});

describe('quantity formatting', () => {
  test('keeps decimals for small amounts and drops them for large ones', () => {
    expect(formatQuantity(2.25)).toBe('2,25');
    expect(formatQuantity(37.5)).toBe('37,5');
    expect(formatQuantity(1234.56)).toBe('1.235');
    expect(formatRange(140, 150)).toBe('140–150');
    expect(formatRange(550, 550)).toBe('550');
  });
});
