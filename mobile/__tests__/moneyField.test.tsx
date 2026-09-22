/**
 * Ô nhập tiền: hiện có dấu chấm ngăn nghìn, nhưng trả về chữ số trần.
 *
 * Ranh giới quan trọng là chỗ này: màn hình lưu và tính trên chuỗi số trần
 * ("680000"), người dùng chỉ nhìn thấy bản đã nhóm ("680.000"). Nếu dấu chấm
 * lọt vào state thì số tiền ghi vào sổ sẽ sai.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {Field} from '../src/components/form';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

// Chỉ lấy host component: element <Field> cũng mang testID và onChangeText,
// nhưng props của nó là giá trị thô trước khi Field xử lý.
const inputOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === 'money' && typeof node.props.onChangeText === 'function',
  )[0];

test('hiện số đã nhóm nghìn cho giá trị đang giữ', () => {
  const tree = render(<Field testID="money" label="Giá" value="680000" money onChangeText={() => {}} />);
  expect(inputOf(tree).props.value).toBe('680.000');
});

test('hàng triệu cũng nhóm đúng', () => {
  const tree = render(<Field testID="money" label="Giá" value="1500000" money onChangeText={() => {}} />);
  expect(inputOf(tree).props.value).toBe('1.500.000');
});

test('trả lên chữ số trần, dấu chấm không lọt vào state', () => {
  const seen: string[] = [];
  const tree = render(<Field testID="money" label="Giá" value="" money onChangeText={v => seen.push(v)} />);
  ReactTestRenderer.act(() => inputOf(tree).props.onChangeText('1.500.000'));
  expect(seen).toEqual(['1500000']);
});

test('gõ ký tự rác cũng bị loại', () => {
  const seen: string[] = [];
  const tree = render(<Field testID="money" label="Giá" value="" money onChangeText={v => seen.push(v)} />);
  ReactTestRenderer.act(() => inputOf(tree).props.onChangeText('12a,3 ₫'));
  expect(seen).toEqual(['123']);
});

test('rỗng vẫn rỗng — placeholder còn hiện được', () => {
  const tree = render(<Field testID="money" label="Giá" value="" money onChangeText={() => {}} />);
  expect(inputOf(tree).props.value).toBe('');
});

test('không bật money thì giữ nguyên hành vi cũ', () => {
  const seen: string[] = [];
  const tree = render(<Field testID="money" label="Tên" value="Urê 50kg" onChangeText={v => seen.push(v)} />);
  expect(inputOf(tree).props.value).toBe('Urê 50kg');
  ReactTestRenderer.act(() => inputOf(tree).props.onChangeText('DAP 1.5'));
  expect(seen).toEqual(['DAP 1.5']);
});
