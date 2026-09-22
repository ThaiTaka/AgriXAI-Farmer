/**
 * Mã cây trồng là mã, không phải nhãn.
 *
 * Hai lỗi dữ liệu đi kèm nhau: bà con gõ "Ớt" thì mã tự sinh là `ot`, không
 * khớp mã danh mục `chili` nên danh sách hiện hai cây "Ớt"; và chỗ nào thiếu
 * tên đã lưu thì mã trần (`ot`, `sau_rieng`) trèo thẳng lên màn hình.
 */

import {humanizeCropSlug, slugifyCropName} from '../src/utils/cropSlug';
import {allCropTypes, canonicalCropType, cropNameOf, cropTypeByName} from '../src/utils/staticData';

describe('slug cây trồng', () => {
  test('bỏ dấu, hạ chữ thường, nối bằng gạch dưới', () => {
    expect(slugifyCropName('Sầu riêng Ri6')).toBe('sau_rieng_ri6');
    expect(slugifyCropName('Ớt')).toBe('ot');
    expect(slugifyCropName('Đậu đũa')).toBe('dau_dua');
    expect(slugifyCropName('   ')).toBe('khac');
  });

  test('dựng lại chữ đọc được, không còn gạch dưới', () => {
    expect(humanizeCropSlug('sau_rieng')).toBe('Sau rieng');
    expect(humanizeCropSlug('ot')).toBe('Ot');
    expect(humanizeCropSlug('')).toBe('Chưa rõ cây trồng');
  });
});

describe('khớp cây trong danh mục theo tên', () => {
  test('tiếng Việt có dấu, không dấu, hoa thường đều về một chỗ', () => {
    expect(cropTypeByName('Ớt')?.id).toBe('chili');
    expect(cropTypeByName('ot')?.id).toBe('chili');
    expect(cropTypeByName('  CÀ CHUA ')?.id).toBe('tomato');
    expect(cropTypeByName('Dưa leo')?.id).toBe('cucumber');
  });

  test('cây thật sự chưa có trong danh mục thì vẫn là chưa có', () => {
    expect(cropTypeByName('Sầu riêng')).toBeUndefined();
    expect(cropTypeByName('')).toBeUndefined();
  });

  test('năm cây thêm ngày 23/09/2026 cũng chặn được trùng tên', () => {
    expect(cropTypeByName('Cà rốt')?.id).toBe('carrot');
    expect(cropTypeByName('rau muong')?.id).toBe('water_spinach');
    expect(cropTypeByName('Bắp cải')?.id).toBe('cabbage');
    expect(cropTypeByName('NGÔ')?.id).toBe('corn');
    expect(cropTypeByName('lúa')?.id).toBe('rice');
  });
});

describe('danh mục sau khi thêm cây', () => {
  test('đủ tám loài giáo viên yêu cầu, cộng cà phê sẵn có', () => {
    const names = allCropTypes().map(c => c.name);
    for (const wanted of ['Cà chua', 'Ớt', 'Dưa leo', 'Cà rốt', 'Rau muống', 'Bắp cải', 'Lúa', 'Ngô']) {
      expect(names).toContain(wanted);
    }
  });

  test('không có tên nào mất dấu hay trùng nhau', () => {
    const crops = allCropTypes();
    const slugs = crops.map(c => slugifyCropName(c.name));
    expect(new Set(slugs).size).toBe(crops.length);
    for (const crop of crops) {
      // Tên hiện lên màn phải là tiếng Việt có dấu, không phải mã ASCII.
      expect(crop.name).not.toMatch(/_/);
      expect(crop.name).toBe(crop.name.trim());
    }
  });

  test('mọi cây đều chọn được giống, và giống nào cũng có nguồn', () => {
    for (const crop of allCropTypes()) {
      const varieties = crop.categories.flatMap(c => c.varieties);
      expect(varieties.length).toBeGreaterThan(0);
      for (const variety of varieties) {
        expect(variety.source).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('canonicalCropType', () => {
  test('cây tự thêm trùng tên danh mục được gộp về mã danh mục', () => {
    expect(canonicalCropType('ot', 'Ớt')).toBe('chili');
    expect(canonicalCropType('ca_chua', 'Cà chua')).toBe('tomato');
    // Cả khi bản ghi không lưu tên, mã tự sinh vẫn đủ để nhận ra.
    expect(canonicalCropType('dua_leo')).toBe('cucumber');
  });

  test('mã danh mục giữ nguyên, cây lạ giữ nguyên', () => {
    expect(canonicalCropType('chili', 'Ớt')).toBe('chili');
    expect(canonicalCropType('sau_rieng', 'Sầu riêng')).toBe('sau_rieng');
  });
});

describe('cropNameOf', () => {
  test('tên đã lưu luôn thắng', () => {
    expect(cropNameOf('tomato', 'Cà chua bi')).toBe('Cà chua bi');
  });

  test('thiếu tên thì lấy tên danh mục, kể cả khi bản ghi mang mã tự sinh', () => {
    expect(cropNameOf('chili', null)).toBe('Ớt');
    expect(cropNameOf('ot', null)).toBe('Ớt');
    expect(cropNameOf('chili', '   ')).toBe('Ớt');
  });

  test('không bao giờ trả về mã trần lên màn hình', () => {
    expect(cropNameOf('sau_rieng', null)).toBe('Sau rieng');
    expect(cropNameOf('sau_rieng', null)).not.toContain('_');
  });
});
