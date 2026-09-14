/**
 * Render smoke tests for the presentational pieces of Giai đoạn 3 — the
 * parts that can mount without a native database or navigator.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {Badge} from '../src/components/Badge';
import {DonutChart} from '../src/components/charts/DonutChart';
import {LineChart} from '../src/components/charts/LineChart';
import {NumberText} from '../src/components/NumberText';
import {Tabs} from '../src/components/Tabs';
import {formatVnd} from '../src/utils/format';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

test('Tabs render every item and mark the active one', () => {
  const tree = render(
    <Tabs items={[{key: 'a', label: 'Nhập'}, {key: 'b', label: 'Xuất', count: 3}]} value="b" onChange={() => {}} />,
  );
  // Pressable wraps several host views; count by testID, which is set once per tab.
  const tabs = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID?.startsWith('tab-'));
  expect(tabs.map(t => t.props.testID)).toEqual(['tab-a', 'tab-b']);
  expect(tabs[1].props.accessibilityState).toEqual({selected: true});
  expect(JSON.stringify(tree.toJSON())).toContain('"Xuất"," (3)"');
});

test('NumberText and Badge show their text', () => {
  const tree = render(
    <>
      <NumberText size="lg">{formatVnd(1_500_000)}</NumberText>
      <Badge label="Đủ" tone="green" />
    </>,
  );
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('1.500.000₫');
  expect(json).toContain('Đủ');
});

test('DonutChart lists every slice with value and share', () => {
  const tree = render(
    <DonutChart
      slices={[
        {key: 'fertilizer', label: 'Phân bón', value: 680_000, color: '#2E6F40'},
        {key: 'labor', label: 'Công nhân', value: 300_000, color: '#2A78D6'},
      ]}
      formatValue={formatVnd}
    />,
  );
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('680.000₫');
  expect(json).toContain('69%');
  expect(json).toContain('31%');
});

test('LineChart shows a legend for two series and an empty note for none', () => {
  const two = render(
    <LineChart
      series={[
        {key: 'in', label: 'Thu', color: '#2E6F40', points: [{x: 1, y: 10}, {x: 2, y: 20}]},
        {key: 'out', label: 'Chi', color: '#EB6834', points: [{x: 1, y: 5}, {x: 2, y: 7}]},
      ]}
      formatY={String}
      formatX={String}
    />,
  );
  const json = JSON.stringify(two.toJSON());
  expect(json).toContain('Thu');
  expect(json).toContain('Chi');

  const empty = render(<LineChart series={[]} formatY={String} formatX={String} emptyText="Chưa có số liệu" />);
  expect(JSON.stringify(empty.toJSON())).toContain('Chưa có số liệu');
});
