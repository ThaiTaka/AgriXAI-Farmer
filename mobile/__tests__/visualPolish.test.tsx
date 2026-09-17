/**
 * Chiều sâu và phản hồi chạm (v6.1).
 *
 * Bối cảnh: app "trông phẳng" trên máy thật không phải vì token sai màu, mà vì
 * Android bỏ qua shadowColor/Radius/Opacity và chỉ vẽ theo `elevation` — mà
 * elevation lại đang bị suy ra từ mỗi độ lệch dọc, nên cả ba mức bóng dồn về
 * 1/2/4. Thẻ trắng trên nền xám-50 gần như không có mép, và cú nhấn nâng
 * shadow của thẻ dashboard xê dịch đúng một nấc không ai thấy.
 *
 * Nhóm test này khoá lại thang elevation và phản hồi chạm để lần chỉnh sau
 * không vô tình làm phẳng lại.
 */

import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {PrimaryButton, SecondaryButton} from '../src/components/buttons';
import {Card} from '../src/components/Card';
import {Screen} from '../src/components/Screen';
import {colors, shadows} from '../src/theme';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

/**
 * Resolves a Pressable's style function for a given press state.
 *
 * Matched by "has a callable style" rather than by component type: RN wraps
 * Pressable in memo/forwardRef, so the rendered node is not the imported
 * reference and findAllByType comes back empty.
 */
const pressableNodes = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => typeof node.props?.style === 'function');

const styleWhenPressed = (tree: ReactTestRenderer.ReactTestRenderer, pressed: boolean, index = 0) =>
  StyleSheet.flatten(pressableNodes(tree)[index].props.style({pressed}));

// ------------------------------ elevation --------------------------------

test('the Android elevation scale is spread wide enough to see', () => {
  expect(shadows.sm.elevation).toBe(2);
  expect(shadows.md.elevation).toBe(4);
  expect(shadows.lg.elevation).toBe(10);
});

test('each shadow step is strictly deeper than the one below it', () => {
  expect(shadows.sm.elevation).toBeLessThan(shadows.md.elevation);
  expect(shadows.md.elevation).toBeLessThan(shadows.lg.elevation);
});

test('a resting card still reads as resting — never a floating slab', () => {
  // The whole system is "quiet": if sm ever climbs past md's old value the
  // ground stops being calm, which is the failure mode in the other direction.
  expect(shadows.sm.elevation).toBeLessThanOrEqual(3);
});

test('the iOS side of the token is untouched by the elevation fix', () => {
  expect(shadows.sm.shadowOpacity).toBeCloseTo(0.05);
  expect(shadows.md.shadowOpacity).toBeCloseTo(0.08);
  expect(shadows.lg.shadowOpacity).toBeCloseTo(0.1);
});

// ------------------------------ press feedback ----------------------------

test('a pressable Card dips to 0.98 and lifts to shadow-md', () => {
  const tree = render(
    <Card onPress={() => {}} accessibilityLabel="Lô đất">
      <></>
    </Card>,
  );
  const pressed = styleWhenPressed(tree, true);
  expect(pressed.transform).toEqual([{scale: 0.98}]);
  expect(pressed.elevation).toBe(shadows.md.elevation);
});

test('a Card at rest neither dips nor lifts', () => {
  const tree = render(
    <Card onPress={() => {}} accessibilityLabel="Lô đất">
      <></>
    </Card>,
  );
  const resting = styleWhenPressed(tree, false);
  expect(resting.transform).toBeUndefined();
  expect(resting.elevation).toBe(shadows.sm.elevation);
});

test('a Card with no onPress stays a plain View — nothing to press, nothing to dip', () => {
  const tree = render(
    <Card>
      <></>
    </Card>,
  );
  expect(pressableNodes(tree)).toHaveLength(0);
});

test('the primary button dips and lifts on press', () => {
  const tree = render(<PrimaryButton label="Đăng nhập" onPress={() => {}} />);
  const pressed = styleWhenPressed(tree, true);
  expect(pressed.transform).toEqual([{scale: 0.98}]);
  expect(pressed.elevation).toBe(shadows.md.elevation);
  expect(pressed.backgroundColor).toBe(colors.primary.pressed);
});

test('the secondary button dips too, so every tap feels alike', () => {
  const tree = render(<SecondaryButton label="Chọn lô" onPress={() => {}} />);
  expect(styleWhenPressed(tree, true).transform).toEqual([{scale: 0.98}]);
});

test('a disabled primary button is not left looking pressable', () => {
  const tree = render(<PrimaryButton label="Đăng nhập" onPress={() => {}} disabled />);
  const resting = styleWhenPressed(tree, false);
  expect(resting.opacity).toBe(0.5);
  expect(resting.transform).toBeUndefined();
});

// -------------------------------- grounds ---------------------------------

test('the gradient ground paints its ramp behind the screen', () => {
  const tree = render(
    <Screen ground="gradient">
      <></>
    </Screen>,
  );
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain(colors.gradient.groundFrom);
  expect(json).toContain(colors.gradient.groundTo);
});

test('the plain grounds stay flat colours, with no ramp behind them', () => {
  for (const [ground, expected] of [
    ['page', colors.surface.page],
    ['card', colors.surface.card],
  ] as const) {
    const tree = render(
      <Screen ground={ground}>
        <></>
      </Screen>,
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(expected);
    expect(json).not.toContain(colors.gradient.groundTo);
  }
});
