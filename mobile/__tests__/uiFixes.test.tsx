/**
 * Tám lỗi giao diện từ buổi soi màn hình: mỗi lỗi một bài kiểm, để lần sau
 * ai sửa lệch là biết ngay.
 */

import React from 'react';
import {StatusBar} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Badge} from '../src/components/Badge';
import {Field} from '../src/components/form';
import {Screen} from '../src/components/Screen';
import {hostOf, SourceLink} from '../src/components/SourceLink';
import {TopInsetProvider, useClaimTopInset} from '../src/components/TopInset';
import {colors} from '../src/theme';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

/* ---------- 1.1 thanh trạng thái không được chìm trong dải xanh ---------- */

test('màn hình có dải tối tự xin chữ trắng cho đồng hồ, pin, sóng', () => {
  const dark = render(
    <Screen statusBar="light" statusBarColor={colors.primary.default}>
      <></>
    </Screen>,
  );
  const bar = dark.root.findAllByType(StatusBar)[0];
  expect(bar.props.barStyle).toBe('light-content');
  expect(bar.props.backgroundColor).toBe(colors.primary.default);

  const plain = render(
    <Screen>
      <></>
    </Screen>,
  );
  // Chỉ MỘT khai báo cho mỗi màn: hai thẻ StatusBar chồng nhau thì kiểu chữ
  // phụ thuộc thứ tự gắn kết, lúc trắng lúc đen.
  const bars = plain.root.findAllByType(StatusBar);
  expect(bars).toHaveLength(1);
  expect(bars[0].props.barStyle).toBe('dark-content');
});

/* ------------------- 2.1 nhãn không được trông như nút ------------------- */

test('nhãn "yên lặng" bỏ viền, khác hẳn cái nút ngay dưới nó', () => {
  const pill = (tree: ReactTestRenderer.ReactTestRenderer) =>
    flat(tree.root.findAll(n => typeof n.type === 'string' && n.props.style)[0].props.style);
  const outline = pill(render(<Badge label="Bao 50 kg" tone="gray" />));
  const quiet = pill(render(<Badge label="Bao 50 kg" tone="gray" variant="quiet" />));
  expect(outline.borderWidth).toBe(1);
  expect(quiet.borderWidth).toBe(0);
  expect(quiet.backgroundColor).toBe(colors.badge.grayBg);
});

/* --------------------- 2.2 ô ghi chú phải xem được --------------------- */

test('ô ghi chú nhiều dòng cao bằng bốn dòng và viết từ trên xuống', () => {
  const tree = render(<Field label="Ghi chú" value="" multiline />);
  const input = tree.root.findAll(n => typeof n.type === 'string' && n.props.multiline === true)[0];
  expect(input.props.numberOfLines).toBe(4);
  const style = flat(input.props.style);
  expect(style.textAlignVertical).toBe('top');
  expect(Number(style.minHeight)).toBeGreaterThanOrEqual(100);
});

test('ô một dòng không bị ép thành khung cao', () => {
  const tree = render(<Field label="Số tiền" value="" />);
  const input = tree.root.findAll(n => typeof n.type === 'string' && 'multiline' in n.props)[0];
  expect(input.props.multiline).toBe(false);
  expect(input.props.numberOfLines).toBeUndefined();
});

/* ------------------- 3.2 không dán địa chỉ web lên màn ------------------- */

test('dòng dẫn nguồn hiện câu mời bấm, không hiện địa chỉ web', () => {
  const url = 'https://www.giongcaytrong.org/phan-bon-urea';
  const json = JSON.stringify(render(<SourceLink url={url} citation="Nguồn: Cục Trồng trọt (2024)" />).toJSON());
  expect(json).toContain('Xem tài liệu tham khảo');
  expect(json).toContain('Cục Trồng trọt');
  expect(json).not.toContain(url);
  expect(json).toContain('underline');
});

test('hostOf rút gọn địa chỉ cho nhãn trợ năng', () => {
  expect(hostOf('https://www.giongcaytrong.org/phan-bon-urea')).toBe('giongcaytrong.org');
  expect(hostOf('http://khuyennong.gov.vn')).toBe('khuyennong.gov.vn');
  expect(hostOf('giongcaytrong.org')).toBe('giongcaytrong.org');
});

/* ---------------- 4.1 dải đồng bộ và màn hình không cộng đôi ---------------- */

function Claimer() {
  useClaimTopInset(true);
  return null;
}

test('khi dải đồng bộ đã phủ tai thỏ, màn hình bên dưới bỏ cạnh trên', () => {
  const withBanner = render(
    <TopInsetProvider>
      <Claimer />
      <Screen>
        <></>
      </Screen>
    </TopInsetProvider>,
  );
  expect(withBanner.root.findAllByType(SafeAreaView)[0].props.edges).toEqual([]);

  const withoutBanner = render(
    <TopInsetProvider>
      <Screen>
        <></>
      </Screen>
    </TopInsetProvider>,
  );
  expect(withoutBanner.root.findAllByType(SafeAreaView)[0].props.edges).toEqual(['top']);
});
