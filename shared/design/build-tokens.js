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
  ' * Source: shared/design/tokens.json',
  ' * Regenerate with: node shared/design/build-tokens.js',
  ' */',
].join('\n');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Drops every "$note"-style key, recursively, so notes never reach the outputs. */
function stripNotes(value) {
  if (Array.isArray(value)) return value.map(stripNotes);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$')) continue;
      out[k] = stripNotes(v);
    }
    return out;
  }
  return value;
}

/** "rgba(0,0,0,0.05)" | "#RRGGBB" -> { hex, opacity } */
function splitColor(value) {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (!m) return { hex: value, opacity: 1 };
  const hex =
    '#' +
    [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return { hex, opacity: m[4] === undefined ? 1 : Number(m[4]) };
}

/**
 * CSS box-shadow -> React Native shadow props.
 * iOS takes the values as-is (blur maps to shadowRadius/2); Android only has
 * `elevation`, approximated from the vertical offset so "sm" stays a whisper.
 */
function shadowToRN(css) {
  const m = /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]{3,8})$/.exec(
    css.trim(),
  );
  if (!m) throw new Error(`Unparseable shadow: ${css}`);
  const { hex, opacity } = splitColor(m[4]);
  return {
    shadowColor: hex,
    shadowOffset: { width: Number(m[1]), height: Number(m[2]) },
    shadowRadius: Number(m[3]) / 2,
    shadowOpacity: opacity,
    elevation: Math.max(1, Math.round(Number(m[2]))),
  };
}

const j = (v, indent = 2) => JSON.stringify(v, null, indent);

const clean = stripNotes(t);

// ---------------------------------------------------------------------------
// mobile/src/theme.ts
// ---------------------------------------------------------------------------

const shadowsMobile = {};
for (const [name, css] of Object.entries(clean.shadow)) shadowsMobile[name] = shadowToRN(css);

const mobile = `${BANNER}

import type {TextStyle} from 'react-native';

export const colors = ${j(clean.color)} as const;

export const shadows = ${j(shadowsMobile)} as const;

export const radius = ${j(clean.radius)} as const;

/** 8pt spacing grid. */
export const space = ${j(clean.space)} as const;

export const typography = ${j(clean.typography)} as const;

/** Hard minimums from the field constraints - these outrank aesthetics. */
export const size = ${j(clean.size)} as const;

export const motion = ${j(clean.motion)} as const;

export type TypographyRole = keyof typeof typography.role;

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
    fontFamily: FONT_FILES[r.weight] ?? typography.fontFamily.sans,
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

export const theme = {
  colors,
  shadows,
  radius,
  space,
  typography,
  size,
  motion,
  text,
} as const;

export default theme;
`;

// ---------------------------------------------------------------------------
// web-admin/src/app/tokens.css
// ---------------------------------------------------------------------------

const css = [];
const push = (k, v) => css.push(`  --${k}: ${v};`);

function walk(obj, prefix, format = (v) => v) {
  for (const [k, v] of Object.entries(obj)) {
    const name = `${prefix}-${k}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    if (v && typeof v === 'object') walk(v, name, format);
    else push(name, format(v));
  }
}

css.push('/**');
css.push(' * GENERATED FILE - DO NOT EDIT BY HAND.');
css.push(' * Source: shared/design/tokens.json');
css.push(' * Regenerate with: node shared/design/build-tokens.js');
css.push(' */');
css.push('');
css.push(':root {');

css.push('  /* ---- colour ---- */');
walk(clean.color, 'color');

css.push('');
css.push('  /* ---- shadows ---- */');
walk(clean.shadow, 'shadow');

css.push('');
css.push('  /* ---- radius ---- */');
walk(clean.radius, 'radius', (v) => `${v}px`);

css.push('');
css.push('  /* ---- spacing (8pt grid) ---- */');
walk(clean.space, 'space', (v) => `${v}px`);

css.push('');
css.push('  /* ---- typography ---- */');
push('font-sans', `"${clean.typography.fontFamily.sans}", ${clean.typography.fontFamily.fallback}`);
for (const [k, v] of Object.entries(clean.typography.weight)) push(`weight-${k}`, v);
for (const [role, r] of Object.entries(clean.typography.role)) {
  const rr = role.replace(/([A-Z])/g, '-$1').toLowerCase();
  push(`text-${rr}-size`, `${r.size}px`);
  push(`text-${rr}-weight`, r.weight);
  push(`text-${rr}-line`, r.lineHeight);
  push(`text-${rr}-tracking`, `${r.letterSpacing}em`);
}

css.push('');
css.push('  /* ---- sizes (field constraints: these are hard minimums) ---- */');
for (const [k, v] of Object.entries(clean.size)) {
  push(`size-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, `${v}px`);
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
