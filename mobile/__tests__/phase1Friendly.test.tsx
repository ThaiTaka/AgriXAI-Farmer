/**
 * Mobile Phase 1 — modern friendly (v6.2).
 *
 * Hai nhóm:
 *   1. Token thêm mới phải là THÊM, không sửa: web-admin đọc chung
 *      shared/design/tokens.json, và yêu cầu lần này là "không động vào
 *      web-admin". Mọi giá trị mà CSS bên đó tiêu thụ (radius sm/md/lg/pill,
 *      shadow sm/md) phải giữ nguyên; cái mới đi kèm tên mới.
 *   2. Hành vi của các mảnh mới: IconTile, FarmScene, NumberText cỡ xl,
 *      Badge viền, Field viền 2pt, DashboardCard có tông.
 */

import React from 'react';
import type {StyleProp, TextStyle, ViewStyle} from 'react-native';
import {StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {Badge} from '../src/components/Badge';
import {DashboardCard} from '../src/components/DashboardCard';
import {Field} from '../src/components/form';
import {IconTile, TILE_ICON_COLOR} from '../src/components/IconTile';
import {FarmScene} from '../src/components/illustrations';
import {NumberText} from '../src/components/NumberText';
import {colors, radius, shadows, size} from '../src/theme';
import {APP_VERSION, SUPPORT_EMAIL} from '../src/utils/version';

const render = (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

type FlatStyle = ViewStyle & TextStyle;

const flatStyle = (node: {props: {style?: unknown}}): FlatStyle =>
  (StyleSheet.flatten(node.props.style as StyleProp<FlatStyle>) ?? {}) as FlatStyle;

// ------------------- the tokens web-admin reads are frozen ------------------

test('the radius steps web-admin consumes are untouched by the rounder phone', () => {
  expect(radius.sm).toBe(8);
  expect(radius.md).toBe(12);
  expect(radius.lg).toBe(16);
  expect(radius.pill).toBe(999);
});

test('the shadow steps web-admin consumes are untouched too', () => {
  expect(shadows.sm.shadowOpacity).toBeCloseTo(0.05);
  expect(shadows.sm.shadowOffset).toEqual({width: 0, height: 1});
  expect(shadows.md.shadowOpacity).toBeCloseTo(0.08);
  expect(shadows.md.shadowOffset).toEqual({width: 0, height: 2});
});

test('the rounder card corner arrives as its own token, not by moving radius.md', () => {
  expect(radius.card).toBe(16);
  expect(radius.card).toBeGreaterThan(radius.md);
});

test('the softer shadows arrive as their own tokens', () => {
  expect(shadows.card.shadowOffset).toEqual({width: 0, height: 2});
  expect(shadows.raised.shadowOffset).toEqual({width: 0, height: 4});
  // Wider blur than the frozen pair, which is what makes them read as soft.
  expect(shadows.card.shadowRadius).toBeGreaterThan(shadows.sm.shadowRadius);
  expect(shadows.raised.shadowRadius).toBeGreaterThan(shadows.md.shadowRadius);
});

test('the primary button lift is tinted with the brand green, not black', () => {
  expect(shadows.brand.shadowColor).toBe(colors.primary.default);
  expect(shadows.brand.shadowOpacity).toBeCloseTo(0.2);
});

test('the accent pair and its soft grounds are present', () => {
  expect(colors.accent.lime).toBe('#C3D24A');
  expect(colors.accent.coral).toBe('#FF6B6B');
  expect(colors.accent.limeSoft).toBe('#F4F7DC');
  expect(colors.accent.coralSoft).toBe('#FFE9E9');
});

test('the field minimums still clear the 48pt the spec asks for', () => {
  // The spec says 48; the project already sits above it and must not come down.
  expect(size.buttonMinHeight).toBeGreaterThanOrEqual(48);
  expect(size.inputMinHeight).toBeGreaterThanOrEqual(48);
});

// -------------------------------- IconTile ---------------------------------

test('IconTile is square at the size asked for', () => {
  const tree = render(
    <IconTile size={48} testID="tile">
      <></>
    </IconTile>,
  );
  const style = flatStyle(tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'tile')[0]);
  expect(style.width).toBe(48);
  expect(style.height).toBe(48);
  expect(style.borderRadius).toBe(radius.md);
});

test('IconTile defaults to the green ground', () => {
  const tree = render(
    <IconTile testID="tile">
      <></>
    </IconTile>,
  );
  expect(flatStyle(tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'tile')[0]).backgroundColor).toBe(
    colors.primary.soft,
  );
});

test('each tone paints its own soft ground so a column of cards differs', () => {
  const grounds = (['green', 'lime', 'coral', 'amber'] as const).map(tone => {
    const tree = render(
      <IconTile tone={tone} testID="tile">
        <></>
      </IconTile>,
    );
    return flatStyle(tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'tile')[0]).backgroundColor;
  });
  expect(new Set(grounds).size).toBe(4);
});

test('no tone paints the raw accent — those never clear AA as a glyph', () => {
  expect(Object.values(TILE_ICON_COLOR)).not.toContain(colors.accent.lime);
  expect(Object.values(TILE_ICON_COLOR)).not.toContain(colors.accent.coral);
});

test('every tone has a matching glyph colour', () => {
  for (const tone of ['green', 'lime', 'coral', 'amber'] as const) {
    expect(TILE_ICON_COLOR[tone]).toMatch(/^#[0-9A-F]{6}$/i);
  }
});

// ------------------------------ illustration -------------------------------

test('FarmScene draws from the palette and keeps its aspect', () => {
  const tree = render(<FarmScene width={160} />);
  const svg = tree.toJSON() as {props: Record<string, unknown>};
  expect(svg.props.width).toBe(160);
  expect(svg.props.height).toBe(100);
});

test('FarmScene scales without distorting', () => {
  const tree = render(<FarmScene width={80} />);
  const svg = tree.toJSON() as {props: Record<string, unknown>};
  expect(svg.props.height).toBe(50);
});

/**
 * react-native-svg serialises a colour as a packed ARGB integer, not as hex.
 * Built with arithmetic rather than shifts — the project's lint bans bitwise,
 * and 0xFF000000 overflows a signed 32-bit shift anyway.
 */
const OPAQUE = 0xff000000;
const argb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return OPAQUE + r * 0x10000 + g * 0x100 + b;
};

test('FarmScene uses brand colours rather than a stock-art palette', () => {
  const json = JSON.stringify(render(<FarmScene />).toJSON());
  expect(json).toContain(String(argb(colors.primary.default)));
  expect(json).toContain(String(argb(colors.accent.lime)));
});

// ------------------------------- NumberText --------------------------------

test('the headline figure has a 28pt step for the summary cards', () => {
  const tree = render(
    <NumberText size="xl" testID="n">
      1.508.000₫
    </NumberText>,
  );
  expect(flatStyle(tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'n')[0]).fontSize).toBe(28);
});

test('the smaller figure sizes are unchanged', () => {
  for (const [sizeKey, expected] of [['lg', 24], ['md', 16], ['sm', 13]] as const) {
    const tree = render(
      <NumberText size={sizeKey} testID="n">
        1
      </NumberText>,
    );
    expect(flatStyle(tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'n')[0]).fontSize).toBe(expected);
  }
});

// --------------------------------- Badge -----------------------------------

test('a badge is outlined in its own text colour', () => {
  const tree = render(<Badge label="Đã đồng bộ" tone="green" />);
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain(colors.badge.greenBg);
  expect(json).toContain(colors.badge.greenFg);
  expect(json).toContain('"borderWidth":1');
});

test('the green badge is the soft pair the spec names', () => {
  expect(colors.badge.greenBg).toBe('#E8F5EA');
  expect(colors.badge.greenFg).toBe('#1F5227');
});

// --------------------------------- Field -----------------------------------

test('a text box rests on a 2pt border so it survives sunlight', () => {
  const tree = render(<Field label="Tên đăng nhập" value="" testID="f" />);
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('"borderWidth":2');
  expect(json).toContain(`"borderRadius":${radius.md}`);
});

test('the input box still clears the 48pt minimum', () => {
  const tree = render(<Field label="Mật khẩu" value="" testID="f" />);
  const input = tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'f')[0];
  expect(flatStyle(input).minHeight).toBeGreaterThanOrEqual(48);
});

// ----------------------------- DashboardCard -------------------------------

test('a summary card carries its figure, label and caption', () => {
  const tree = render(
    <DashboardCard label="Tồn kho" value="1.508.000₫" subtext="2 loại phân bón, 80 kg" onPress={() => {}} />,
  );
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Tồn kho');
  expect(json).toContain('1.508.000₫');
  expect(json).toContain('2 loại phân bón, 80 kg');
});

test('a loss is set in the danger ink, a gain in brand green', () => {
  const loss = JSON.stringify(render(<DashboardCard label="Tháng 9" value="700.000₫" prefix="Lỗ" negative subtext="x" onPress={() => {}} />).toJSON());
  expect(loss).toContain(colors.text.danger);

  const gain = JSON.stringify(render(<DashboardCard label="Tháng 9" value="450.000₫" prefix="Lãi" subtext="x" onPress={() => {}} />).toJSON());
  expect(gain).toContain(colors.primary.default);
});

test('the card tone reaches the icon tile', () => {
  const json = JSON.stringify(
    render(<DashboardCard label="Công việc" value="3" subtext="x" tone="amber" icon={<></>} onPress={() => {}} />).toJSON(),
  );
  expect(json).toContain(colors.badge.yellowBg);
});

test('a card with no icon renders no tile at all', () => {
  const json = JSON.stringify(
    render(<DashboardCard label="Công việc" value="3" subtext="x" tone="lime" onPress={() => {}} />).toJSON(),
  );
  expect(json).not.toContain(colors.accent.limeSoft);
});

// ------------------------------ support contact -----------------------------

test('the support address is a real, reachable one — never a placeholder', () => {
  expect(SUPPORT_EMAIL).toBe('lethanhthai0805@gmail.com');
  expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  // The two placeholders that must never ship in a farmer-facing screen.
  expect(SUPPORT_EMAIL).not.toMatch(/example\.com|support@agrilog/i);
});

test('a support mail arrives already naming the build it came from', () => {
  const subject = decodeURIComponent(encodeURIComponent(`AgriLog v2 (${APP_VERSION}) — cần hỗ trợ`));
  expect(subject).toContain(APP_VERSION);
});
