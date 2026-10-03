/**
 * Ảnh cây trồng trong bộ chọn giống: mỗi loại cây trong danh mục có một ảnh
 * nhúng sẵn (xem được khi không có mạng) và luôn đi kèm ghi công mà giấy phép
 * tự do của ảnh yêu cầu.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {cropPhoto} from '../src/assets/crops';
import {CropPhotoHero, photoCredit} from '../src/screens/variety/CropPhoto';
import {allCropTypes, cropTypeById} from '../src/utils/staticData';

describe('ảnh cây trồng', () => {
  test('every catalogue crop has a bundled photo and a credit', () => {
    for (const crop of allCropTypes()) {
      expect(cropPhoto(crop.id)).toBeDefined();
      expect(crop.image?.author).toBeTruthy();
      expect(crop.image?.license).toBeTruthy();
      expect(crop.image?.source_url).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  test('a crop the farmer added has no photo, so the tile keeps its icon', () => {
    expect(cropPhoto('sau_rieng')).toBeUndefined();
  });

  test('the credit names the author, the licence and what was changed', () => {
    expect(photoCredit(cropTypeById('rice')!.image!)).toBe(
      'Ảnh: Windrain · CC BY-SA 4.0 · Đã cắt khung quanh cánh đồng lúa',
    );
    expect(photoCredit(cropTypeById('tomato')!.image!)).toBe('Ảnh: NPS · Public domain');
  });

  test('the step-2 hero shows the photo with its credit and a link to the original', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<CropPhotoHero crop={cropTypeById('chrysanthemum')!} />);
    });
    expect(tree.root.findAll(n => n.props.testID === 'crop-photo-chrysanthemum').length).toBeGreaterThan(0);
    expect(tree.root.findAll(n => n.props.testID === 'crop-photo-credit-chrysanthemum').length).toBeGreaterThan(0);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Satin66Flower');
    expect(json).toContain('Xem ảnh gốc trên Wikimedia Commons');
  });
});
