/**
 * Plot code (mã vùng trồng) generation.
 *
 * Format from the design: `PUC-YYMM-XXXX`.
 *
 * The suffix is random rather than a running counter on purpose. A counter needs
 * to know every code that already exists, which is impossible on a device that
 * has been offline for a week — two phones would happily mint PUC-2609-0001
 * twice. Four random base-32 characters give ~1M combinations per month, and the
 * caller still checks the local table for a collision before saving.
 */

// Crockford base32 minus I, L, O, U — the characters farmers misread when
// copying a code off a screen in the sun.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 4;

function randomSuffix(): string {
  let out = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generatePlotCode(now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `PUC-${yy}${mm}-${randomSuffix()}`;
}

/**
 * Generates a code that does not collide with `existingCodes`.
 * Falls back to a millisecond-based suffix if random draws keep colliding —
 * that can only happen with an absurd number of plots, but the function must
 * never loop forever on a farmer's phone.
 */
export function generateUniquePlotCode(existingCodes: Iterable<string>, now: Date = new Date()) {
  const taken = new Set(existingCodes);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generatePlotCode(now);
    if (!taken.has(code)) return code;
  }
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `PUC-${yy}${mm}-${now.getTime().toString(36).slice(-4).toUpperCase()}`;
}

const CODE_PATTERN = /^PUC-\d{4}-[0-9A-Z]{4}$/;

export function isWellFormedPlotCode(code: string): boolean {
  return CODE_PATTERN.test(code.trim().toUpperCase());
}
