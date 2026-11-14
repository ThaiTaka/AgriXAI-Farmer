/**
 * One photo per fertiliser product — the product itself, as its maker shows
 * it — bundled so the budget and price lists show them offline.
 *
 * Each comes from the official site of the company named in the product
 * (PVCFC, Phú Mỹ, Hà Bắc, Lâm Thao, Văn Điển, Bình Điền, SFARM, Điền Trang);
 * the page it was taken from, the company and the date are recorded with every
 * product in shared/data/fertilizer_recommendations.json (`image`). The photos are those
 * companies' copyright, shown with their name and a link to identify the
 * product. Files are named after the product, so no two products share one.
 */

import type {ImageSourcePropType} from 'react-native';

const PHOTOS: Record<string, ImageSourcePropType> = {
  'kali_bot_ca_mau.jpg': require('./kali_bot_ca_mau.jpg'),
  'kali_bot_phu_my.jpg': require('./kali_bot_phu_my.jpg'),
  'lan_nung_chay_van_dien.jpg': require('./lan_nung_chay_van_dien.jpg'),
  'npk_16_16_8_ca_mau.jpg': require('./npk_16_16_8_ca_mau.jpg'),
  'npk_16_16_8_dau_trau.jpg': require('./npk_16_16_8_dau_trau.jpg'),
  'npk_16_16_8_phu_my.jpg': require('./npk_16_16_8_phu_my.jpg'),
  'npk_18_8_18_ca_mau.jpg': require('./npk_18_8_18_ca_mau.jpg'),
  'npk_20_20_15_binh_dien.jpg': require('./npk_20_20_15_binh_dien.jpg'),
  'phan_ga_huu_co.jpg': require('./phan_ga_huu_co.jpg'),
  'phan_trun_que_pb01_2kg.jpg': require('./phan_trun_que_pb01_2kg.jpg'),
  'phan_trun_que_pb01_5kg.jpg': require('./phan_trun_que_pb01_5kg.jpg'),
  'sieu_lan_lam_thao.jpg': require('./sieu_lan_lam_thao.jpg'),
  'tricho_dien_trang_1kg.jpg': require('./tricho_dien_trang_1kg.jpg'),
  'tricho_humic_sfarm_1kg.jpg': require('./tricho_humic_sfarm_1kg.jpg'),
  'ure_ca_mau.jpg': require('./ure_ca_mau.jpg'),
  'ure_ha_bac.jpg': require('./ure_ha_bac.jpg'),
  'ure_phu_my.jpg': require('./ure_phu_my.jpg'),
};

/** The bundled photo named in a product's `image.file`; undefined when there is none. */
export function fertilizerPhoto(file: string | null | undefined): ImageSourcePropType | undefined {
  return file ? PHOTOS[file] : undefined;
}
