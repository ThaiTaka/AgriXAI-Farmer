/**
 * Lối vào màn hình sau khi bỏ thanh tab.
 *
 * Trước đây thanh tab luôn có mặt nên mọi màn đều cách người dùng một cú chạm.
 * Nay Trang chủ là màn gốc và mọi thứ khác được đẩy lên trên, nên một hàng bị
 * xoá nhầm là đủ để một màn không còn đường tới. Hai màn mong manh nhất:
 * FertilizerGroups và StockCheck — chúng KHÔNG có ô riêng ở lưới Trang chủ, lối
 * vào duy nhất là qua thẻ "Tất cả công cụ" rồi tới màn Công cụ.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
}));

import {ToolsScreen} from '../src/screens/ToolsScreen';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

beforeEach(() => mockNavigate.mockClear());

test('màn Công cụ vẫn là lối vào của hai màn không có ô ở Trang chủ', () => {
  const json = JSON.stringify(render(<ToolsScreen />).toJSON());
  expect(json).toContain('Bảng giá phân bón');
  expect(json).toContain('Kiểm tra kho trước khi bón');
});

test('bấm một hàng thì điều hướng đúng tên route', () => {
  const tree = render(<ToolsScreen />);
  const rows = tree.root.findAll(
    node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.includes('Bảng giá phân bón'),
  );
  const pressable = rows.find(node => typeof node.props.onPress === 'function');
  expect(pressable).toBeDefined();
  ReactTestRenderer.act(() => pressable!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('FertilizerGroups');
});

test('màn Công cụ có nút quay lại — không còn thanh tab để thoát', () => {
  const tree = render(<ToolsScreen />);
  const back = tree.root.findAll(node => node.props.accessibilityLabel === 'Quay lại');
  expect(back.length).toBeGreaterThan(0);
});
