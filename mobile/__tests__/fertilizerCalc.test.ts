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

describe('F1 — cà chua trồng trên đất (QĐ 1972/QĐ-UBND tỉnh Lâm Đồng)', () => {
  test('500 m² scales every item by 0,05', () => {
    const {protocol, scenario: sc} = scenario('tomato_lamdong_2025', 'tren_dat');
    const result = calculate({protocol, scenario: sc, areaM2: 500, findProduct});

    expect(result.factor).toBeCloseTo(0.05);
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect(byKey.phan_chuong.unit).toBe('tấn');
    expect(byKey.phan_chuong.min).toBeCloseTo(2);
    expect(byKey.voi.min).toBeCloseTo(50);
    expect(byKey.voi.max).toBeCloseTo(75);
    expect(byKey.ure.min).toBeCloseTo(26.1);
    expect(byKey.super_lan.min).toBeCloseTo(28.125);
    expect(byKey.kcl.min).toBeCloseTo(22.9);
  });

  test('prices come from the catalogue and unpriced items are named, not guessed', () => {
    const {protocol, scenario: sc} = scenario('tomato_lamdong_2025', 'tren_dat');
    const result = calculate({protocol, scenario: sc, areaM2: 10_000, findProduct});

    const ure = result.lines.find(l => l.key === 'ure')!;
    expect(ure.priceProductId).toBe('ure_ca_mau');
    expect(ure.pricePerKg).toBe(13_000);
    expect(ure.costMin).toBe(522 * 13_000);

    const priced = result.lines.filter(l => l.costMin !== null);
    expect(result.costMin).toBe(priced.reduce((s, l) => s + l.costMin!, 0));
    expect(result.unpriced).toEqual([
      'Phân chuồng hoai',
      'Phân hữu cơ vi sinh',
      'Vôi bột',
      'Borat',
      'Canxi – Bo',
      'Chế phẩm Trichoderma',
    ]);
    expect(result.lines.find(l => l.key === 'phan_chuong')!.costMin).toBeNull();
  });

  test('1 ha reproduces the source figures exactly', () => {
    const {protocol, scenario: sc} = scenario('tomato_lamdong_2025', 'tren_dat');
    const result = calculate({protocol, scenario: sc, areaM2: 10_000, findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect([byKey.ure.min, byKey.ure.max]).toEqual([522, 522]);
    expect([byKey.super_lan.min, byKey.super_lan.max]).toEqual([562.5, 562.5]);
    expect([byKey.kcl.min, byKey.kcl.max]).toEqual([458, 458]);
  });
});

describe('F1 — hoa cúc, nhà màng 300 m² (lô demo PUC-001-VT)', () => {
  test('urê 544 kg/ha and 40–50 tấn phân chuồng scale to 300 m²', () => {
    const {protocol, scenario: sc} = scenario('chrysanthemum_lamdong_2025', 'chuong');
    const result = calculate({protocol, scenario: sc, areaM2: 300, findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect(byKey.ure.min).toBeCloseTo(16.32);
    expect(byKey.phan_chuong.min).toBeCloseTo(1.2);
    expect(byKey.phan_chuong.max).toBeCloseTo(1.5);
  });
});

describe('F1 — phân chuồng tính bằng m³', () => {
  test('a volume is listed but never priced per kg', () => {
    const {protocol, scenario: sc} = scenario('bell_pepper_lamdong_2025', 'tren_dat');
    const result = calculate({protocol, scenario: sc, areaM2: 1_000, findProduct});
    const manure = result.lines.find(l => l.key === 'phan_chuong')!;
    expect(manure.unit).toBe('m³');
    expect([manure.min, manure.max]).toEqual([4, 5]);
    expect(manure.costMin).toBeNull();
    expect(result.unpriced).toContain('Phân chuồng hoai');
  });

  test('even with a price id, m³ is not multiplied by a per-kg price', () => {
    const {protocol, scenario: sc} = scenario('bell_pepper_lamdong_2025', 'tren_dat');
    const priced = {
      ...sc,
      items: sc.items.map(i => (i.key === 'phan_chuong' ? {...i, price_product_id: 'ure_ca_mau'} : i)),
    };
    const result = calculate({protocol, scenario: priced, areaM2: 1_000, findProduct});
    const manure = result.lines.find(l => l.key === 'phan_chuong')!;
    expect(manure.pricePerKg).toBeNull();
    expect(manure.costMin).toBeNull();
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

describe('F1 — dưa leo, ớt cay, lúa theo sào Lâm Đồng', () => {
  test('dưa leo 1 sào (1.000 m²) is a tenth of the per-hectare table', () => {
    const {protocol, scenario: sc} = scenario('cucumber_lamdong_2025', 'phan_don');
    expect(protocol.reference_area.m2).toBe(10_000);
    const result = calculate({protocol, scenario: sc, areaM2: toSquareMetres(1, 'sao_lam_dong'), findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect(byKey.ure.min).toBeCloseTo(32.5);
    expect(byKey.super_lan.min).toBeCloseTo(59.5);
    expect(byKey.kcl.min).toBeCloseTo(25.8);
    expect(byKey.phan_chuong.unit).toBe('m³');
    expect(byKey.phan_chuong.min).toBeCloseTo(2);
  });

  test('ớt cay 2 sào (2.000 m²)', () => {
    const {protocol, scenario: sc} = scenario('hot_chili_lamdong_2025', 'mot_vu');
    const result = calculate({protocol, scenario: sc, areaM2: toSquareMetres(2, 'sao_lam_dong'), findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect(byKey.ure.min).toBeCloseTo(60);
    expect(byKey.kcl.min).toBeCloseTo(80);
    expect(byKey.voi.min).toBeCloseTo(100);
    expect(byKey.voi.pricePerKg).toBeNull();
  });

  test('lúa nửa héc-ta', () => {
    const {protocol, scenario: sc} = scenario('rice_lamdong_2025', 'phan_don');
    const result = calculate({protocol, scenario: sc, areaM2: toSquareMetres(0.5, 'ha'), findProduct});
    const byKey = Object.fromEntries(result.lines.map(l => [l.key, l]));
    expect(byKey.ure.min).toBeCloseTo(97.5);
    expect(byKey.super_lan.min).toBeCloseTo(218.5);
    expect(byKey.kcl.min).toBeCloseTo(58);
  });

  test('rejects a non-positive area', () => {
    const {protocol, scenario: sc} = scenario('hot_chili_lamdong_2025', 'mot_vu');
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
