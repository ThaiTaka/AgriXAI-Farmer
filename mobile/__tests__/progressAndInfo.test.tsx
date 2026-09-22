/**
 * ProgressBar và InfoTooltip.
 *
 * Hai mảnh này thay cho những câu giải thích trước đây nằm thường trực trên
 * màn. Điều phải giữ: phần trăm không được sai (nông hộ nhìn thanh để quyết
 * định còn phải làm gì), và nội dung giải thích không được mất — nó chỉ chuyển
 * chỗ, từ thân màn vào sau một cái chạm.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {InfoTooltip} from '../src/components/InfoTooltip';
import {ProgressBar} from '../src/components/ProgressBar';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

const json = (tree: ReactTestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

// JSX nội suy tách chuỗi thành nhiều mảnh con ("1", "/", "4"), nên so khớp
// trên chuỗi JSON phải nối lại trước.
const flatText = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join(' | ');

test('phần trăm làm tròn đúng và hiện cả số việc', () => {
  const tree = render(<ProgressBar label="Phân thúc" done={1} total={4} />);
  const out = flatText(tree);
  expect(out).toContain('25%');
  expect(out).toContain('Phân thúc — 1/4 đã làm');
});

test('xong hết là 100%', () => {
  expect(flatText(render(<ProgressBar label="Phân thúc" done={3} total={3} />))).toContain('100%');
});

test('chưa làm gì là 0%, không phải NaN', () => {
  const out = flatText(render(<ProgressBar label="Phân thúc" done={0} total={4} />));
  expect(out).toContain('0%');
  expect(out).not.toContain('NaN');
});

test('không có việc nào thì không vẽ thanh — tránh chia cho 0', () => {
  expect(render(<ProgressBar label="Phân thúc" done={0} total={0} />).toJSON()).toBeNull();
});

test('máy đọc màn hình nghe được tiến độ', () => {
  const tree = render(<ProgressBar testID="pb" label="Phân thúc" done={1} total={4} />);
  const node = tree.root.findAll(n => n.props.testID === 'pb' && typeof n.type === 'string')[0];
  expect(node.props.accessibilityLabel).toContain('1 trên 4');
  expect(node.props.accessibilityValue).toEqual({min: 0, max: 4, now: 1});
});

test('tooltip giấu nội dung cho tới khi chạm, rồi hiện đủ', () => {
  const body = 'Tồn kho = tổng đã nhập − tổng đã dùng.';
  const tree = render(<InfoTooltip testID="info" title="Cách tính" body={body} />);
  expect(json(tree)).not.toContain(body);

  const trigger = tree.root.findAll(n => n.props.testID === 'info' && typeof n.props.onPress === 'function')[0];
  ReactTestRenderer.act(() => trigger.props.onPress());
  expect(json(tree)).toContain(body);
});
