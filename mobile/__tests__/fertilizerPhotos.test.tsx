/**
 * Ảnh phân bón trên màn "Chọn phân theo túi tiền" và "Bảng giá phân bón": mỗi
 * sản phẩm có ảnh RIÊNG của chính nó (không sản phẩm nào dùng chung ảnh), lấy
 * từ trang chính thức của đúng hãng có tên trong sản phẩm, kèm tên doanh nghiệp
 * và trang gốc — hoặc, khi chưa có ảnh đúng sản phẩm, được khai báo trong
 * image_gaps và giữ biểu tượng nhóm, không mượn ảnh sản phẩm khác.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockNavigate = jest.fn();
const mockRoute = {params: {categoryCode: 'dam'}};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
  useRoute: () => mockRoute,
}));

import fertilizerJson from '@shared/data/fertilizer_recommendations.json';
import {Modal, Text} from 'react-native';

import {fertilizerPhoto} from '../src/assets/fertilizers';
import {hostOf} from '../src/components/SourceLink';
import {FertilizerBudgetScreen} from '../src/screens/fertilizer/FertilizerBudgetScreen';
import {FertilizerThumb} from '../src/screens/fertilizer/FertilizerPhoto';
import {FertilizerProductsScreen} from '../src/screens/fertilizer/FertilizerProductsScreen';
import {formatVndRange} from '../src/utils/format';
import type {FertilizerProduct} from '../src/utils/staticData';
import {fertilizerProducts} from '../src/utils/staticData';

const gaps = (fertilizerJson as unknown as {$meta: {image_gaps: {product_id: string; reason: string}[]}}).$meta.image_gaps;

/** Official site → the company it belongs to, as it appears in product names. */
const MAKER: Record<string, RegExp> = {
  'pvcfc.com.vn': /Cà Mau/,
  'dpm.vn': /Phú Mỹ/,
  'damhabac.com.vn': /Hà Bắc/,
  'supelamthao.vn': /Lâm Thao/,
  'vandienfmp.vn': /Văn Điển/,
  'binhdien.com': /Đầu Trâu|Bình Điền/,
  // SFARM makes Pb01 and the Trichoderma, and sells the chicken manure.
  'sfarm.vn': /Pb01|Phân gà|SFARM/,
  'phanbondientrang.vn': /Điền Trang/,
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  ReactTestRenderer.act(() => {
    mounted.splice(0).forEach(tree => tree.unmount());
  });
  mockRoute.params.categoryCode = 'dam';
});

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(n => typeof n.type !== 'string' && n.props?.testID === id && n.parent?.props?.testID !== id);

const flatten = (node: unknown): string =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(flatten).join('')
      : '';

function shownText(tree: ReactTestRenderer.ReactTestRenderer): string {
  return tree.root
    .findAll(n => n.type === Text)
    .map(n => flatten(n.props.children))
    .join(' | ');
}

const product = (id: string): FertilizerProduct => fertilizerProducts().find(p => p.id === id)!;
const withPhoto = () => fertilizerProducts().filter(p => p.image);

async function openSheet(id: string) {
  const tree = await render(<FertilizerThumb product={product(id)} />);
  await ReactTestRenderer.act(async () => {
    byTestId(tree, `fert-photo-${id}`)[0].props.onPress();
  });
  return tree;
}

describe('dữ liệu ảnh', () => {
  test('every photo is bundled and says what it shows, whose it is and where it came from', () => {
    expect(withPhoto()).toHaveLength(17);
    for (const p of withPhoto()) {
      const image = p.image!;
      expect(fertilizerPhoto(image.file)).toBeDefined();
      expect(image.subject).toBeTruthy();
      expect(image.owner).toBeTruthy();
      expect(image.source_url).toMatch(/^https:\/\//);
      // The picture comes from the same site as the product page it credits.
      expect(hostOf(image.image_url)).toBe(hostOf(image.source_url));
      expect(image.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('no two products share a photo', () => {
    const files = withPhoto().map(p => p.image!.file);
    expect(new Set(files).size).toBe(files.length);
    for (const p of withPhoto()) expect(p.image!.file).toBe(`${p.id}.jpg`);
    // The two pack sizes of Pb01 are two products, so two different photos.
    expect(product('phan_trun_que_pb01_2kg').image!.image_url).not.toBe(product('phan_trun_que_pb01_5kg').image!.image_url);
  });

  test('each photo comes from the official site of the company named in the product', () => {
    for (const p of withPhoto()) {
      const host = hostOf(p.image!.source_url);
      expect(MAKER[host]).toBeDefined();
      expect(p.name).toMatch(MAKER[host]);
    }
    expect(hostOf(product('ure_ca_mau').image!.source_url)).toBe('pvcfc.com.vn');
    expect(hostOf(product('ure_phu_my').image!.source_url)).toBe('dpm.vn');
    expect(hostOf(product('npk_16_16_8_dau_trau').image!.source_url)).toBe('binhdien.com');
  });

  test('a product without a photo of its own is one declared in image_gaps, with a reason', () => {
    const without = fertilizerProducts()
      .filter(p => !p.image)
      .map(p => p.id)
      .sort();
    expect(without).toEqual(gaps.map(g => g.product_id).sort());
    expect(without).toEqual(['dap_han_quoc', 'dap_nga', 'huu_co_vi_sinh_song_gianh_hc15_10kg']);
    for (const gap of gaps) expect(gap.reason.length).toBeGreaterThan(20);
  });

  test('a file the catalogue does not name has no photo', () => {
    expect(fertilizerPhoto('urea.jpg')).toBeUndefined();
    expect(fertilizerPhoto(undefined)).toBeUndefined();
  });
});

describe('ô ảnh trên thẻ', () => {
  test('a product with a photo shows it; tapping opens it large with what it shows, whose it is and its page', async () => {
    const tree = await render(<FertilizerThumb product={product('ure_ca_mau')} />);
    expect(byTestId(tree, 'fert-photo-ure_ca_mau')).toHaveLength(1);
    expect(tree.root.findByType(Modal).props.visible).toBe(false);

    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'fert-photo-ure_ca_mau')[0].props.onPress();
    });
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    const shown = shownText(tree);
    expect(shown).toContain('Urê Cà Mau');
    expect(shown).toContain('Bao Đạm Cà Mau (urê hạt đục) 50 kg');
    expect(shown).toContain('Ảnh: Công ty CP Phân bón Dầu khí Cà Mau (PVCFC) · pvcfc.com.vn');
    expect(shown).toContain('Xem trang sản phẩm');
  });

  test('a photo that is not the exact pack sold says so', async () => {
    const shown = shownText(await openSheet('phan_trun_que_pb01_2kg'));
    expect(shown).toContain('chưa có ảnh gói 2 kg');
    expect(shown).toContain('sfarm.vn');
  });

  test('a product without a photo of its own keeps the group icon, and nothing opens', async () => {
    const tree = await render(<FertilizerThumb product={product('dap_nga')} />);
    expect(byTestId(tree, 'fert-icon-dap_nga')).toHaveLength(1);
    expect(byTestId(tree, 'fert-photo-dap_nga')).toHaveLength(0);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  });
});

describe('màn hình', () => {
  test('"Chọn phân theo túi tiền" puts each product\'s own photo on its card, and says where they come from', async () => {
    const tree = await render(<FertilizerBudgetScreen />);
    // The first tab (bình dân): urea Hà Bắc, potash, supe lân, lân nung chảy — each its own photo.
    for (const id of ['ure_ha_bac', 'kali_bot_ca_mau', 'sieu_lan_lam_thao', 'lan_nung_chay_van_dien']) {
      expect(byTestId(tree, `fert-photo-${id}`)).toHaveLength(1);
    }
    expect(shownText(tree)).toContain('trang chính thức của hãng');
  });

  test('beside the larger photo, the bag price and its source are never cut short', async () => {
    const tree = await render(<FertilizerBudgetScreen />);
    const p = product('sieu_lan_lam_thao');
    const lineCaps = (shown: string) =>
      tree.root.findAll(n => n.type === Text && flatten(n.props.children) === shown).map(n => n.props.numberOfLines);
    // One line beside "Bao 50 kg" showed "290.000 – 330.0…"; two lines in the
    // column beside the photo cut "…giacaphe.com qua vietn…".
    expect(lineCaps(formatVndRange(p.price_min, p.price_max))).toEqual([undefined]);
    expect(lineCaps(`${p.region} · ${p.source}`)).toEqual([undefined]);
  });

  test('the price table shows the same photos, and the icon where a product has none', async () => {
    const urea = await render(<FertilizerProductsScreen />);
    expect(byTestId(urea, 'fert-photo-ure_ca_mau')).toHaveLength(1);
    expect(byTestId(urea, 'fert-photo-ure_phu_my')).toHaveLength(1);
    expect(shownText(urea)).toContain('trang chính thức của hãng');

    mockRoute.params.categoryCode = 'lan';
    const phosphate = await render(<FertilizerProductsScreen />);
    expect(byTestId(phosphate, 'fert-photo-sieu_lan_lam_thao')).toHaveLength(1);
    expect(byTestId(phosphate, 'fert-icon-dap_han_quoc')).toHaveLength(1);
    expect(byTestId(phosphate, 'fert-icon-dap_nga')).toHaveLength(1);
  });

  test('the microbial group now lists priced products instead of "Chưa có dữ liệu giá"', async () => {
    mockRoute.params.categoryCode = 'vi_sinh';
    const tree = await render(<FertilizerProductsScreen />);
    const shown = shownText(tree);
    expect(shown).not.toContain('Chưa có dữ liệu giá');
    expect(shown).toContain('Phân vi sinh vật Tricho Điền Trang');
    expect(shown).toContain(formatVndRange(86_400, 92_000));
    expect(shown).toContain('dientrangmart.vn');
    expect(byTestId(tree, 'fert-photo-tricho_dien_trang_1kg')).toHaveLength(1);
    expect(byTestId(tree, 'fert-photo-tricho_humic_sfarm_1kg')).toHaveLength(1);
    // Sông Gianh only shows its 50 kg bag; the 10 kg card keeps the group icon.
    expect(byTestId(tree, 'fert-icon-huu_co_vi_sinh_song_gianh_hc15_10kg')).toHaveLength(1);
  });
});
