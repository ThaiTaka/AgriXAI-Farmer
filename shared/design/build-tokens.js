#!/usr/bin/env node
/**
 * Generates the platform theme files from shared/design/tokens.json.
 *
 *   node shared/design/build-tokens.js
 *
 * Outputs:
 *   mobile/src/theme.ts           - React Native (StyleSheet-ready values)
 *   web-admin/src/app/tokens.css  - CSS custom properties
 *
 * Both files are GENERATED. Edit tokens.json, never the outputs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TOKENS_PATH = path.join(ROOT, 'shared', 'design', 'tokens.json');
const MOBILE_OUT = path.join(ROOT, 'mobile', 'src', 'theme.ts');
const WEB_OUT = path.join(ROOT, 'web-admin', 'src', 'app', 'tokens.css');

const t = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));

const BANNER = [
  '/**',
  ' * GENERATED FILE - DO NOT EDIT BY HAND.',
  ' *',
  ` * Source: shared/design/tokens.json (extracted from "${t.$meta.source}")`,
  ' * Regenerate with: node shared/design/build-tokens.js',
  ' */',
].join('\n');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** "rgba(255,255,255,0.62)" | "#RRGGBB" -> { hex, opacity } */
function splitColor(value) {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (!m) return { hex: value, opacity: 1 };
  const hex =
    '#' +
    [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return { hex, opacity: m[4] === undefined ? 1 : Number(m[4]) };
}

/** "linear-gradient(165deg,rgba(..) 0%,rgba(..) 100%)" -> ordered colour stops */
function gradientColors(css) {
  const inner = css.slice(css.indexOf('(') + 1, css.lastIndexOf(')'));
  const parts = [];
  let depth = 0;
  let buf = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf.trim());
  return parts
    .filter((p) => !/^-?[\d.]+deg$/.test(p) && !/^to /.test(p))
    .map((p) => p.replace(/\s+-?[\d.]+%$/, '').trim());
}

/**
 * CSS box-shadow -> React Native shadow props.
 * RN has no spread/blur parity, so blur maps to shadowRadius/2 and Android
 * elevation is approximated from the vertical offset.
 */
function shadowToRN(css) {
  if (!css || css === 'none') return null;
  const m = /^(-?[\d.]+)px?\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]{3,8})$/.exec(
    css.trim(),
  );
  if (!m) return null;
  const { hex, opacity } = splitColor(m[4]);
  return {
    shadowColor: hex,
    shadowOffset: { width: Number(m[1]), height: Number(m[2]) },
    shadowRadius: Number(m[3]) / 2,
    shadowOpacity: opacity,
    elevation: Math.max(1, Math.round(Math.abs(Number(m[2])) * 0.6)),
  };
}

const j = (v, indent = 2) => JSON.stringify(v, null, indent);

// ---------------------------------------------------------------------------
// mobile/src/theme.ts
// ---------------------------------------------------------------------------

const glassMobile = {};
for (const [name, g] of Object.entries(t.glass)) {
  if (name.startsWith('$')) continue;
  glassMobile[name] = {
    gradientColors: gradientColors(g.gradient),
    gradientStart: { x: 0.18, y: 0 }, // 165deg, top-ish to bottom-ish
    gradientEnd: { x: 0.82, y: 1 },
    borderColor: g.border,
    borderWidth: 1,
    blurAmount: g.blur,
    saturate: g.saturate,
    solidBackground: g.solid,
    shadow: shadowToRN(g.shadow),
  };
}

const gradientsMobile = {};
for (const [name, g] of Object.entries(t.gradient)) {
  if (name.startsWith('$')) continue;
  gradientsMobile[name] = { colors: gradientColors(g.css), css: g.css };
  if (g.stops) gradientsMobile[name].locations = g.stops.map((s) => s.position / 100);
}

const shadowsMobile = {};
for (const [name, css] of Object.entries(t.shadow)) {
  const rn = shadowToRN(css);
  if (rn) shadowsMobile[name] = rn;
}

const mobile = `${BANNER}

import type {TextStyle, ViewStyle} from 'react-native';

export const colors = ${j(t.color)} as const;

export const gradients = ${j(gradientsMobile)} as const;

export const halo = ${j(t.halo)} as const;

/**
 * Liquid-glass surfaces.
 *
 * React Native has no \`backdrop-filter\`. Each level therefore ships both:
 *   - \`gradientColors\` for <LinearGradient> (+ an optional <BlurView> behind), and
 *   - \`solidBackground\`, the opaque fallback required by the field constraints
 *     (weak devices, or when the farmer turns on "Che do ngoai nang").
 * Pick between them with \`surface(level, solid)\`.
 */
export const glass = ${j(glassMobile)} as const;

export const shadows = ${j(shadowsMobile)} as const;

export const radius = ${j(t.radius)} as const;

export const spacing = ${j(t.spacing)} as const;

export const typography = ${j(t.typography)} as const;

/** Disease severity -> colour. \`severe\` is opaque on purpose: it must stay readable in direct sun. */
export const severity = ${j(t.severity)} as const;

export const diseaseType = ${j(t.diseaseType)} as const;

/** Hard minimums from the field constraints - these outrank aesthetics. */
export const size = ${j(t.size)} as const;

export const motion = ${j(t.motion)} as const;

export type GlassLevel = keyof typeof glass;
export type SeverityKey = keyof typeof severity;
export type DiseaseTypeKey = keyof typeof diseaseType;
export type TypographyRole = keyof typeof typography.role;

const FONT = typography.fontFamily.sans;

const FONT_FILES: Record<number, string> = {
  400: 'OpenSans-Regular',
  500: 'OpenSans-Medium',
  600: 'OpenSans-SemiBold',
  700: 'OpenSans-Bold',
  800: 'OpenSans-ExtraBold',
};

/** Text style for a typography role. Open Sans is bundled - never fetched at runtime. */
export function text(role: TypographyRole, color: string = colors.text.primary): TextStyle {
  const r = typography.role[role];
  const style: TextStyle = {
    fontFamily: FONT_FILES[r.weight] ?? FONT,
    fontSize: r.size,
    fontWeight: String(r.weight) as TextStyle['fontWeight'],
    lineHeight: Math.round(r.size * r.lineHeight),
    letterSpacing: r.letterSpacing * r.size,
    color,
  };
  if ('textTransform' in r) {
    style.textTransform = (r as {textTransform: string}).textTransform as TextStyle['textTransform'];
  }
  return style;
}

/**
 * Container style for a glass surface.
 * @param level  which glass recipe
 * @param solid  true => opaque fallback ("Che do ngoai nang" / low-end devices)
 */
export function surface(level: GlassLevel, solid = false): ViewStyle {
  const g = glass[level];
  const base: ViewStyle = {
    borderWidth: g.borderWidth,
    borderColor: g.borderColor,
  };
  if (solid) base.backgroundColor = g.solidBackground;
  if (g.shadow) Object.assign(base, g.shadow);
  return base;
}

export const theme = {
  colors,
  gradients,
  halo,
  glass,
  shadows,
  radius,
  spacing,
  typography,
  severity,
  diseaseType,
  size,
  motion,
  text,
  surface,
} as const;

export default theme;
`;

// ---------------------------------------------------------------------------
// web-admin/src/app/tokens.css
// ---------------------------------------------------------------------------

const css = [];
const push = (k, v) => css.push(`  --${k}: ${v};`);

function walkColors(obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    const name = `${prefix}-${k}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    if (typeof v === 'object' && v !== null) walkColors(v, name);
    else push(name, v);
  }
}

css.push('/**');
css.push(' * GENERATED FILE - DO NOT EDIT BY HAND.');
css.push(` * Source: shared/design/tokens.json (extracted from "${t.$meta.source}")`);
css.push(' * Regenerate with: node shared/design/build-tokens.js');
css.push(' */');
css.push('');
css.push(':root {');

css.push('  /* ---- colour ---- */');
walkColors(t.color, 'color');

css.push('');
css.push('  /* ---- gradients ---- */');
for (const [k, g] of Object.entries(t.gradient)) {
  if (!k.startsWith('$')) push(`gradient-${k.toLowerCase()}`, g.css);
}

css.push('');
css.push('  /* ---- halos (blurred glows behind the glass layer) ---- */');
for (const [k, h] of Object.entries(t.halo)) {
  if (k.startsWith('$')) continue;
  push(`halo-${k}`, h.css);
  push(`halo-${k}-size`, `${h.size}px`);
  push(`halo-${k}-blur`, `${h.blur}px`);
}

css.push('');
css.push('  /* ---- liquid glass ---- */');
for (const [k, g] of Object.entries(t.glass)) {
  if (k.startsWith('$')) continue;
  const kk = k.toLowerCase();
  push(`glass-${kk}-bg`, g.gradient);
  push(`glass-${kk}-border`, g.border);
  push(`glass-${kk}-filter`, `blur(${g.blur}px) saturate(${g.saturate}%)`);
  push(`glass-${kk}-shadow`, g.shadow);
  push(`glass-${kk}-solid`, g.solid);
}

css.push('');
css.push('  /* ---- shadows ---- */');
for (const [k, v] of Object.entries(t.shadow)) push(`shadow-${k.toLowerCase()}`, v);

css.push('');
css.push('  /* ---- radius ---- */');
for (const [k, v] of Object.entries(t.radius)) push(`radius-${k}`, `${v}px`);

css.push('');
css.push('  /* ---- spacing ---- */');
for (const [k, v] of Object.entries(t.spacing)) push(`space-${k}`, `${v}px`);

css.push('');
css.push('  /* ---- typography ---- */');
push('font-sans', `"${t.typography.fontFamily.sans}", ${t.typography.fontFamily.fallback}`);
for (const [k, v] of Object.entries(t.typography.weight)) push(`weight-${k}`, v);
for (const [role, r] of Object.entries(t.typography.role)) {
  const rr = role.replace(/([A-Z])/g, '-$1').toLowerCase();
  push(`text-${rr}-size`, `${r.size}px`);
  push(`text-${rr}-weight`, r.weight);
  push(`text-${rr}-line`, r.lineHeight);
  push(`text-${rr}-tracking`, `${r.letterSpacing}em`);
}

css.push('');
css.push('  /* ---- severity ---- */');
for (const [k, v] of Object.entries(t.severity)) {
  if (k.startsWith('$')) continue;
  push(`severity-${k}-bg`, v.bg);
  push(`severity-${k}-fg`, v.fg);
  push(`severity-${k}-dot`, v.dot);
  push(`severity-${k}-solid`, v.solidBg);
}

css.push('');
css.push('  /* ---- disease type tags ---- */');
for (const [k, v] of Object.entries(t.diseaseType)) {
  if (k.startsWith('$')) continue;
  push(`type-${k}-bg`, v.bg);
  push(`type-${k}-fg`, v.fg);
  push(`type-${k}-dot`, v.dot);
}

css.push('');
css.push('  /* ---- sizes (field constraints: these are hard minimums) ---- */');
for (const [k, v] of Object.entries(t.size)) {
  if (k.startsWith('$')) continue;
  push(`size-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, `${v}px`);
}

css.push('}');
css.push('');
css.push('/* Opaque fallback: no backdrop-filter support, or the user picked "Che do ngoai nang". */');
css.push('@supports not (backdrop-filter: blur(1px)) {');
css.push('  :root {');
for (const [k, g] of Object.entries(t.glass)) {
  if (k.startsWith('$')) continue;
  css.push(`    --glass-${k.toLowerCase()}-bg: ${g.solid};`);
  css.push(`    --glass-${k.toLowerCase()}-filter: none;`);
}
css.push('  }');
css.push('}');
css.push('');
css.push('[data-sunlight-mode="on"] {');
for (const [k, g] of Object.entries(t.glass)) {
  if (k.startsWith('$')) continue;
  css.push(`  --glass-${k.toLowerCase()}-bg: ${g.solid};`);
  css.push(`  --glass-${k.toLowerCase()}-filter: none;`);
}
for (const [k, v] of Object.entries(t.severity)) {
  if (!k.startsWith('$')) css.push(`  --severity-${k}-bg: ${v.solidBg};`);
}
css.push('}');
css.push('');

// ---------------------------------------------------------------------------

function write(file, content) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, 'utf8');
  console.log(`  wrote ${path.relative(ROOT, file)} (${content.split('\n').length} lines)`);
}

console.log('Building design tokens from shared/design/tokens.json');
write(MOBILE_OUT, mobile);
write(WEB_OUT, css.join('\n'));
console.log('Done.');
