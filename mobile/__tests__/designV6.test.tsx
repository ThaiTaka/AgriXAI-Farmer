/**
 * Giai đoạn 5 — hệ thiết kế v6 và ba màn lõi.
 *
 * Hai nhóm test:
 *   1. Bất biến của token — ba quyết định "dung hoà" (chiều cao chạm, font
 *      nhúng, cỡ chữ body) phải KHÔNG bị âm thầm hạ xuống khi ai đó chỉnh
 *      tokens.json lần sau; đây là ràng buộc thực địa, không phải thẩm mỹ.
 *   2. Hành vi của các mảnh mới: SoftGradient, Checkbox, plotSync.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {Checkbox} from '../src/components/Checkbox';
import {bandColors, mixHex, parseHex, SoftGradient} from '../src/components/SoftGradient';
import {pendingCount, plotsSummary, syncBadgeOf} from '../src/domain/plotSync';
import {colors, radius, shadows, size, space, typography} from '../src/theme';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

// --------------------------- token invariants ----------------------------

test('field minimums survive the v6 retune — the Phase 5 spec asked for 44/40', () => {
  // tokens.json calls these "hard minimums for muddy hands and sunlight".
  expect(size.buttonMinHeight).toBe(52);
  expect(size.inputMinHeight).toBe(50);
  expect(size.minTouchTarget).toBe(48);
});

test('the font stays bundled Open Sans, not a system stack', () => {
  expect(typography.fontFamily.sans).toBe('Open Sans');
});

test('body text stays 15px for sunlight readability', () => {
  expect(typography.role.body.size).toBe(15);
});

test('v6 adopts the Phase 5 neutral gray ramp', () => {
  expect(colors.gray['900']).toBe('#1A1A1A');
  expect(colors.gray['700']).toBe('#4A4A4A');
  expect(colors.gray['500']).toBe('#7A7A7A');
  expect(colors.gray['400']).toBe('#A0A0A0');
  expect(colors.gray['300']).toBe('#D0D0D0');
  expect(colors.gray['200']).toBe('#E5E5E5');
  expect(colors.gray['100']).toBe('#F0F4F8');
  expect(colors.gray['50']).toBe('#F8F9FA');
});

test('v6 adopts the Phase 5 text and surface roles', () => {
  expect(colors.text.primary).toBe('#1A1A1A');
  expect(colors.text.secondary).toBe('#4A4A4A');
  expect(colors.text.muted).toBe('#7A7A7A');
  expect(colors.text.placeholder).toBe('#A0A0A0');
  expect(colors.surface.page).toBe('#F8F9FA');
  expect(colors.surface.card).toBe('#FFFFFF');
});

test('v6 adopts the Phase 5 semantic set', () => {
  expect(colors.semantic.error).toBe('#DC3545');
  expect(colors.semantic.warning).toBe('#FFC107');
  expect(colors.semantic.info).toBe('#0D6EFD');
  expect(colors.semantic.success).toBe('#198754');
});

test('the brand green is untouched and gains the darker pressed state', () => {
  expect(colors.primary.default).toBe('#2E6F40');
  expect(colors.primary.pressed).toBe('#1F5227');
  expect(colors.primary.soft).toBe('#E8F5EA');
});

test('radii land on the spec values: input 6, button 8, card 12', () => {
  expect(radius.xs).toBe(6);
  expect(radius.sm).toBe(8);
  expect(radius.md).toBe(12);
  expect(radius.pill).toBe(999);
});

test('the resting shadow is the spec "Subtle" value, converted for RN', () => {
  expect(shadows.sm.shadowOpacity).toBeCloseTo(0.05);
  expect(shadows.sm.shadowOffset).toEqual({width: 0, height: 1});
  // Nothing in the system is allowed to be darker than the heaviest shadow.
  expect(shadows.lg.shadowOpacity).toBeLessThanOrEqual(0.1);
});

test('the 8pt grid is intact', () => {
  expect([space.sm, space.lg, space.xl, space['2xl'], space['3xl'], space['4xl']]).toEqual([8, 16, 24, 32, 40, 48]);
});

test('exactly one gradient exists, and it is one ramp step wide', () => {
  expect(colors.gradient.groundFrom).toBe(colors.gray['50']);
  expect(colors.gradient.groundTo).toBe(colors.gray['100']);
});

// ----------------------------- SoftGradient ------------------------------

test('parseHex reads the three channels', () => {
  expect(parseHex('#F8F9FA')).toEqual([248, 249, 250]);
  expect(parseHex('#000000')).toEqual([0, 0, 0]);
});

test('parseHex rejects anything that is not #RRGGBB', () => {
  expect(() => parseHex('rgb(1,2,3)')).toThrow(/#RRGGBB/);
  expect(() => parseHex('#FFF')).toThrow();
});

test('mixHex returns the endpoints untouched and the midpoint between', () => {
  expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
  expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
});

test('mixHex clamps a ratio outside 0..1 instead of overshooting', () => {
  expect(mixHex('#000000', '#FFFFFF', -2)).toBe('#000000');
  expect(mixHex('#000000', '#FFFFFF', 9)).toBe('#FFFFFF');
});

test('bandColors spans from the first colour to the last', () => {
  const ramp = bandColors('#F8F9FA', '#F0F4F8', 12);
  expect(ramp).toHaveLength(12);
  expect(ramp[0]).toBe('#F8F9FA');
  expect(ramp[ramp.length - 1]).toBe('#F0F4F8');
});

test('bandColors never steps more than one shade at a time', () => {
  const ramp = bandColors('#F8F9FA', '#F0F4F8', 12).map(parseHex);
  for (let i = 1; i < ramp.length; i++) {
    const step = Math.max(...ramp[i].map((c, ch) => Math.abs(c - ramp[i - 1][ch])));
    // Under ~2/255 per band is well below a perceptible edge — no visible banding.
    expect(step).toBeLessThanOrEqual(2);
  }
});

test('bandColors copes with a degenerate band count', () => {
  expect(bandColors('#F8F9FA', '#F0F4F8', 1)).toEqual(['#F8F9FA']);
  expect(bandColors('#F8F9FA', '#F0F4F8', 0)).toEqual(['#F8F9FA']);
});

test('SoftGradient renders its bands and its children', () => {
  const tree = render(
    <SoftGradient bands={4} testID="ground">
      <></>
    </SoftGradient>,
  );
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('#F8F9FA');
  expect(json).toContain('#F0F4F8');
});

// -------------------------------- Checkbox --------------------------------

test('Checkbox shows its label and reports the unchecked state', () => {
  const tree = render(<Checkbox label="Lưu thông tin đăng nhập" checked={false} onChange={() => {}} testID="cb" />);
  const box = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'cb')[0];
  expect(box.props.accessibilityState).toMatchObject({checked: false});
  expect(JSON.stringify(tree.toJSON())).toContain('Lưu thông tin đăng nhập');
});

test('Checkbox toggles to the opposite of its current value', () => {
  const seen: boolean[] = [];
  const tree = render(<Checkbox label="Nhớ tôi" checked={false} onChange={v => seen.push(v)} testID="cb" />);
  const box = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'cb')[0];
  ReactTestRenderer.act(() => box.props.onClick?.() ?? box.props.onPress?.());
  expect(seen).toEqual([true]);
});

test('a checked Checkbox reports checked and would toggle back off', () => {
  const seen: boolean[] = [];
  const tree = render(<Checkbox label="Nhớ tôi" checked onChange={v => seen.push(v)} testID="cb" />);
  const box = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'cb')[0];
  expect(box.props.accessibilityState).toMatchObject({checked: true});
  ReactTestRenderer.act(() => box.props.onClick?.() ?? box.props.onPress?.());
  expect(seen).toEqual([false]);
});

test('a disabled Checkbox says so to the accessibility layer', () => {
  const tree = render(<Checkbox label="Nhớ tôi" checked={false} disabled onChange={() => {}} testID="cb" />);
  const box = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'cb')[0];
  expect(box.props.accessibilityState).toMatchObject({disabled: true});
});

// -------------------------------- plotSync --------------------------------

test('only "synced" counts as reaching the server', () => {
  expect(syncBadgeOf('synced').state).toBe('synced');
  expect(syncBadgeOf('created').state).toBe('pending');
  expect(syncBadgeOf('updated').state).toBe('pending');
});

test('an unknown or missing status is treated as not yet synced', () => {
  expect(syncBadgeOf(null).state).toBe('pending');
  expect(syncBadgeOf(undefined).state).toBe('pending');
  expect(syncBadgeOf('something-new').state).toBe('pending');
});

test('the badge carries a Vietnamese label and a tone', () => {
  expect(syncBadgeOf('synced')).toMatchObject({label: 'Đã đồng bộ', tone: 'green'});
  expect(syncBadgeOf('created')).toMatchObject({label: 'Chưa đồng bộ', tone: 'yellow'});
});

test('pendingCount counts only the rows still waiting', () => {
  expect(pendingCount([])).toBe(0);
  expect(pendingCount([{syncStatus: 'synced'}, {syncStatus: 'synced'}])).toBe(0);
  expect(pendingCount([{syncStatus: 'synced'}, {syncStatus: 'created'}, {syncStatus: 'updated'}])).toBe(2);
});

test('plotsSummary phrases the three cases a farmer can be in', () => {
  expect(plotsSummary([])).toBe('Chưa có lô nào');
  expect(plotsSummary([{syncStatus: 'synced'}, {syncStatus: 'synced'}])).toBe('2 lô · đã đồng bộ đủ');
  expect(plotsSummary([{syncStatus: 'synced'}, {syncStatus: 'created'}])).toBe('2 lô · 1 chưa đồng bộ');
});
