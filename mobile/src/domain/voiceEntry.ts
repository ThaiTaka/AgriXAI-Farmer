/**
 * Ghi bằng giọng nói — what a farmer said, turned into a ledger entry.
 *
 * The speech itself is recognised on the phone (Vosk, see src/voice/speech.ts);
 * this module only reads the Vietnamese transcript:
 *
 *   "bán năm mươi bó hoa cúc được một triệu rưỡi"
 *       → khoản thu 1.500.000₫, "Bán 50 bó hoa cúc"
 *   "mua hai bao urê cà mau một triệu ba trăm sáu mươi nghìn"
 *       → nhập kho 100 kg Urê Cà Mau, 1.360.000₫
 *   "hôm qua bón hai mươi ký kali cho lô hoa hồng"
 *       → xuất kho 20 kg kali, lô có cây hoa hồng, ngày hôm qua
 *
 * Nothing here saves anything. The result is a draft the farmer reads and
 * confirms — the app's rule for anything it fills in (care_protocols $meta.note).
 * When a part is missing or unsure the draft says so instead of guessing: an
 * amount it could not read stays null, a fertiliser named without its brand
 * keeps only the group.
 */

import type {ExpenseKind, IncomeKind} from './finance';

export type VoiceDraftKind = 'income' | 'expense' | 'stock_in' | 'stock_out' | 'unknown';

export interface FertilizerHint {
  /** Group code of the price catalogue: dam, lan, kali, npk, huu_co. */
  category: string | null;
  /** Catalogue product id when the words name exactly one product. */
  productId: string | null;
  /** What the farmer said, for the review card. */
  spoken: string;
}

export interface Quantity {
  value: number;
  /** kg when the unit is a weight (ký, tạ, tấn); otherwise the word said (bó, cành…). */
  unit: string;
  /** The amount in kg when the unit is a weight or a fertiliser bag (null if unknown). */
  kg: number | null;
  /** Bags counted ("hai bao"); turned into kg once the product's bag size is known. */
  bags: number | null;
}

export interface VoiceDraft {
  kind: VoiceDraftKind;
  transcript: string;
  /** Total in đồng, or null when no amount was heard. */
  amount: number | null;
  /** Price per unit when said that way ("mười hai nghìn một ký"). */
  unitPrice: number | null;
  quantity: Quantity | null;
  description: string;
  incomeKind: IncomeKind | null;
  expenseKind: ExpenseKind | null;
  fertilizer: FertilizerHint | null;
  /** "lô một" → 1; matched against plot codes by the screen. */
  plotNumber: number | null;
  /** Remaining words that may name the plot ("hoa hồng"), matched by the screen. */
  plotWords: string | null;
  /** Days before today ("hôm qua" = 1). */
  daysAgo: number;
  /** What the draft still lacks before it can be saved, in plain words. */
  missing: string[];
}

/* ------------------------------------------------------------------ text */

/**
 * Lower-case, NFC, single spaces; keeps the diacritics. Punctuation goes,
 * except the separators inside a number ("1.500.000", "1,5"). Typed
 * shorthand is spelled out: "500k" → "500 nghìn", "1tr" → "1 triệu",
 * "ki lô" → "kg" (so that its "lô" is not read as a plot).
 */
export function normalizeSpeech(text: string): string {
  return ` ${text.normalize('NFC').toLowerCase()} `
    .replace(/(\d)\.(?=\d)/g, '$1')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(//g, '.')
    .replace(//g, ',')
    .replace(/(\d)\s*k(?=\s)/g, '$1 nghìn')
    .replace(/(\d)\s*(tr|trđ)(?=\s)/g, '$1 triệu')
    .replace(/\s(ki|kí|ký)\slô(\sgam)?(?=\s)/g, ' kg')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip Vietnamese diacritics: "bón" → "bon", "đạm" → "dam". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;

/**
 * Words are matched with their accents when the transcript has accents (the
 * recogniser always writes them), and folded when a farmer typed without
 * them. Folding everything would confuse "bón" (to fertilise) with "bốn"
 * (four), "bán" with "bạn".
 */
function wordMatcher(text: string) {
  // The number words normalizeSpeech spelled out ("500k" → "500 nghìn") do
  // not count: they were not typed with accents.
  const accented = DIACRITIC.test(text.replace(/(^|\s)(nghìn|triệu)(?=\s|$)/g, ' '));
  const haystack = ` ${accented ? text : fold(text)} `;
  return (word: string) => haystack.includes(` ${accented ? word : fold(word)} `);
}

/* --------------------------------------------------------------- numbers */

const DIGITS: Record<string, number> = {
  không: 0,
  một: 1,
  mốt: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  tư: 4,
  năm: 5,
  lăm: 5,
  nhăm: 5,
  sáu: 6,
  bảy: 7,
  bẩy: 7,
  tám: 8,
  chín: 9,
};

const BIG_UNITS: Record<string, number> = {
  tỷ: 1e9,
  tỉ: 1e9,
  triệu: 1e6,
  củ: 1e6,
  nghìn: 1e3,
  ngàn: 1e3,
  k: 1e3,
};

const NUMBER_WORDS = new Set([
  ...Object.keys(DIGITS),
  ...Object.keys(BIG_UNITS),
  'mười',
  'mươi',
  'chục',
  'trăm',
  'linh',
  'lẻ',
  'rưỡi',
]);

/** Words after "củ" that make it a tuber, not slang for a million. */
const CU_VEGETABLES = new Set(['cải', 'dền', 'hành', 'kiệu', 'gừng', 'nghệ', 'sắn', 'năng', 'từ', 'sen']);

function numericToken(token: string): number | null {
  // "1.500.000" or "1,500,000" → thousands separators; "1,5" / "2.5" → decimal.
  if (/^\d{1,3}([.,]\d{3})+$/.test(token)) return Number(token.replace(/[.,]/g, ''));
  if (/^\d+([.,]\d+)?$/.test(token)) return Number(token.replace(',', '.'));
  return null;
}

function digitOf(token: string): number | null {
  if (token in DIGITS) return DIGITS[token];
  return numericToken(token);
}

/** 0–99 from words such as "mười lăm", "hai mươi mốt", "hai lăm", "ba chục". */
function parseTens(tokens: string[]): number | null {
  if (tokens.length === 0) return 0;
  const [a, b, c] = tokens;
  if (tokens.length === 1) {
    if (a === 'mười') return 10;
    return digitOf(a);
  }
  if (a === 'mười' && tokens.length === 2) {
    const u = digitOf(b);
    return u === null ? null : 10 + u;
  }
  const d = digitOf(a);
  if (d === null) return null;
  if ((b === 'mươi' || b === 'chục') && tokens.length === 2) return d * 10;
  if (b === 'mươi' && tokens.length === 3) {
    const u = digitOf(c);
    return u === null ? null : d * 10 + u;
  }
  // Spoken shorthand without "mươi": "hai lăm" = 25, "ba mốt" = 31.
  if (tokens.length === 2 && d >= 2 && d <= 9) {
    const u = digitOf(b);
    if (u !== null && u >= 1 && u <= 9) return d * 10 + u;
  }
  return null;
}

/** 0–999: "hai trăm tư" = 240, "một trăm rưỡi" = 150, "ba trăm linh năm" = 305. */
function parseBelowThousand(tokens: string[]): number | null {
  const at = tokens.indexOf('trăm');
  if (at < 0) return parseTens(tokens);
  const head = tokens.slice(0, at);
  const hundreds = head.length === 0 ? 1 : parseTens(head);
  if (hundreds === null || hundreds > 9) return null;
  const rest = tokens.slice(at + 1);
  if (rest.length === 0) return hundreds * 100;
  if (rest.length === 1 && rest[0] === 'rưỡi') return hundreds * 100 + 50;
  if (rest[0] === 'linh' || rest[0] === 'lẻ') {
    const u = parseTens(rest.slice(1));
    return u === null ? null : hundreds * 100 + u;
  }
  // "hai trăm tư": a lone digit after "trăm" is the tens.
  if (rest.length === 1) {
    const d = digitOf(rest[0]);
    if (d !== null && Number.isInteger(d) && d < 10) return hundreds * 100 + d * 10;
  }
  const tail = parseTens(rest);
  return tail === null ? null : hundreds * 100 + tail;
}

/**
 * A run of number words → its value.
 *
 * Spoken Vietnamese drops the next unit down: "một triệu hai" is 1.200.000,
 * "một triệu hai trăm" is 1.200.000 too (the "nghìn" is implied), "hai nghìn
 * tư" is 2.400 and "một triệu rưỡi" is 1.500.000.
 */
export function parseVietnameseNumber(tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  for (const [word, unit] of Object.entries(BIG_UNITS).sort((x, y) => y[1] - x[1])) {
    const at = tokens.indexOf(word);
    if (at < 0) continue;
    const left = tokens.slice(0, at);
    const right = tokens.slice(at + 1);
    const leftValue = left.length === 0 ? 1 : parseVietnameseNumber(left);
    if (leftValue === null) return null;
    let rightValue = 0;
    if (right.length === 1 && right[0] === 'rưỡi') {
      rightValue = unit / 2;
    } else if (right.length > 0 && (right[0] === 'linh' || right[0] === 'lẻ')) {
      const v = parseVietnameseNumber(right.slice(1));
      if (v === null) return null;
      rightValue = v;
    } else if (right.length === 1 && digitOf(right[0]) !== null && Number.isInteger(digitOf(right[0])) && digitOf(right[0])! < 10) {
      rightValue = digitOf(right[0])! * (unit / 10);
    } else if (right.length > 0) {
      const v = parseVietnameseNumber(right);
      if (v === null) return null;
      const explicit = right.some(t => t in BIG_UNITS);
      rightValue = explicit ? v : v * (unit / 1000);
    }
    return leftValue * unit + rightValue;
  }
  return parseBelowThousand(tokens);
}

interface NumberSpan {
  start: number;
  end: number; // exclusive
  value: number;
  /** The run named a big unit or a currency word: it is money for sure. */
  money: boolean;
}

/** Every run of number words in the transcript, with its value. */
export function findNumbers(tokens: string[]): NumberSpan[] {
  const spans: NumberSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    const isNumberWord = (k: number) => {
      const t = tokens[k];
      if (t === undefined) return false;
      if (numericToken(t) !== null) return true;
      if (t === 'củ') return k > i && !CU_VEGETABLES.has(tokens[k + 1] ?? '');
      return NUMBER_WORDS.has(t);
    };
    if (!isNumberWord(i) || ['linh', 'lẻ', 'rưỡi', 'mươi', 'chục', 'k'].includes(tokens[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < tokens.length && isNumberWord(j)) j += 1;
    let run = tokens.slice(i, j);
    // "năm nay", "năm ngoái": the year, not five.
    if (run.length === 1 && run[0] === 'năm' && ['nay', 'ngoái', 'trước', 'sau', 'tới'].includes(tokens[j] ?? '')) {
      i = j;
      continue;
    }
    // A run ending in "trăm"/"mươi" followed by nothing numeric is fine; one
    // that fails to parse is split at the first word that breaks it.
    let value = parseVietnameseNumber(run);
    while (value === null && run.length > 1) {
      run = run.slice(0, -1);
      value = parseVietnameseNumber(run);
    }
    if (value !== null) {
      const end = i + run.length;
      const currency = ['đồng', 'đ', 'vnđ', 'vnd'].includes(tokens[end] ?? '');
      spans.push({start: i, end, value, money: currency || run.some(t => t in BIG_UNITS)});
      i = end;
    } else {
      i = j;
    }
  }
  return spans;
}

/* ---------------------------------------------------- recogniser slips */

const isDigitWord = (t: string | undefined) => t !== undefined && t in DIGITS && t !== 'không';
const VERBS = new Set(['bón', 'bán', 'mua', 'nhập', 'xuất', 'rải', 'trả', 'chi', 'đóng', 'thuê', 'lấy', 'dùng', 'thu']);

/**
 * Undoes the slips the offline model makes on these sentences (measured on
 * spoken samples, ADR 0010): "mươi" heard as "mười" or "mỹ", "lăm" as "lâm",
 * "lô" as "lúa", "bón" as "bốn". Each fix applies only where the word as heard
 * cannot be right — "hai mỹ" is not Phú Mỹ, "mười lâm" is not Lâm Thao,
 * "lúa số một" is a plot number, a sentence about fertiliser has a verb.
 */
export function repairHeard(tokens: readonly string[]): string[] {
  const out = [...tokens];
  // First, so that "bốn mười lăm" is not read as forty-something below.
  if (out[0] === 'bốn' && !out.slice(1).some(t => VERBS.has(t)) && fertilizerHint(out.join(' '))) out[0] = 'bón';
  for (let i = 0; i < out.length; i++) {
    const prev = out[i - 1];
    const next = out[i + 1];
    if (out[i] === 'mỹ' && isDigitWord(prev) && out[i - 2] !== 'phú') out[i] = 'mươi';
    else if (out[i] === 'mười' && isDigitWord(prev) && (DIGITS[prev!] ?? 0) >= 2) out[i] = 'mươi';
    else if (out[i] === 'lâm' && next !== 'thao' && (prev === 'mười' || prev === 'mươi' || isDigitWord(prev))) out[i] = 'lăm';
    else if (out[i] === 'lúa' && (next === 'số' || isDigitWord(next))) out[i] = 'lô';
  }
  return out;
}

/* ----------------------------------------------------------------- units */

const WEIGHT_UNITS: Record<string, number> = {ký: 1, kí: 1, kg: 1, ki: 1, cân: 1, kilô: 1, kilôgam: 1, tạ: 100, tấn: 1000, yến: 10};
const COUNT_UNITS = new Set(['bó', 'cành', 'thùng', 'két', 'giỏ', 'sọt', 'cây', 'chậu', 'trái', 'quả', 'bịch', 'túi', 'gói', 'xe', 'bao']);

function quantityAfter(tokens: string[], span: NumberSpan): Quantity | null {
  const next = tokens[span.end];
  if (next === undefined) return null;
  if (next in WEIGHT_UNITS) {
    const kg = span.value * WEIGHT_UNITS[next];
    return {value: span.value, unit: next === 'tạ' || next === 'tấn' || next === 'yến' ? next : 'kg', kg, bags: null};
  }
  if (next === 'bao') return {value: span.value, unit: 'bao', kg: null, bags: span.value};
  if (COUNT_UNITS.has(next)) return {value: span.value, unit: next, kg: null, bags: null};
  return null;
}

/* ------------------------------------------------------------ fertiliser */

interface FertilizerRule {
  /** `f` is the folded text with spaces around; `has` matches whole words with accents when there are any. */
  test: (f: string, has: (word: string) => boolean) => boolean;
  category: string;
  /** brand word (folded) → product id */
  brands?: [RegExp, string][];
  /** product id when no brand is needed */
  product?: string;
  label: string;
}

const FERTILIZER_RULES: FertilizerRule[] = [
  {
    test: f => /\b(lan nung chay|van dien)\b/.test(f),
    category: 'lan',
    product: 'lan_nung_chay_van_dien',
    label: 'Lân nung chảy',
  },
  {
    test: (f, has) => /\bu ?re\b/.test(f) || has('đạm'),
    category: 'dam',
    brands: [
      [/\bca mau\b/, 'ure_ca_mau'],
      [/\bphu my\b/, 'ure_phu_my'],
      [/\bha bac\b/, 'ure_ha_bac'],
    ],
    label: 'Urê',
  },
  {
    test: f => /\b(d ?a ?p|di a pe)\b/.test(f),
    category: 'lan',
    brands: [
      [/\bhan quoc\b/, 'dap_han_quoc'],
      [/\bnga\b/, 'dap_nga'],
    ],
    label: 'DAP',
  },
  {
    test: f => /\b(ka ?li|mop)\b/.test(f),
    category: 'kali',
    brands: [
      [/\bca mau\b/, 'kali_bot_ca_mau'],
      [/\bphu my\b/, 'kali_bot_phu_my'],
    ],
    label: 'Kali',
  },
  {
    test: f => /\b(n ?p ?k|en pe ca|en pe ka)\b/.test(f),
    category: 'npk',
    label: 'NPK',
  },
  {
    // "lân" alone only with its accent: folded it is also "lần" (lần hai).
    test: (f, has) => /\b(sieu lan|super lan|supe lan|sup lan|lan super|lam thao)\b/.test(f) || has('lân'),
    category: 'lan',
    product: 'sieu_lan_lam_thao',
    label: 'Super lân',
  },
  {test: f => /\btrun que\b/.test(f), category: 'huu_co', label: 'Phân trùn quế'},
  {test: f => /\bphan ga\b/.test(f), category: 'huu_co', product: 'phan_ga_huu_co', label: 'Phân gà'},
];

const NPK_GRADES: [RegExp, string, Record<string, string>][] = [
  [/\b(16 16 8|muoi sau muoi sau tam)\b/, '16-16-8', {'ca mau': 'npk_16_16_8_ca_mau', 'phu my': 'npk_16_16_8_phu_my', 'dau trau': 'npk_16_16_8_dau_trau', 'binh dien': 'npk_16_16_8_dau_trau'}],
  [/\b(20 20 15|hai muoi hai muoi muoi lam)\b/, '20-20-15', {'binh dien': 'npk_20_20_15_binh_dien', 'dau trau': 'npk_20_20_15_binh_dien'}],
  [/\b(18 8 18|muoi tam tam muoi tam)\b/, '18-8-18', {'ca mau': 'npk_18_8_18_ca_mau'}],
];

/** Which fertiliser the words name, as precisely as they allow. */
export function fertilizerHint(text: string): FertilizerHint | null {
  const normal = normalizeSpeech(text);
  const f = ` ${fold(normal)} `;
  const has = wordMatcher(normal);
  for (const rule of FERTILIZER_RULES) {
    if (!rule.test(f, has)) continue;
    let productId = rule.product ?? null;
    let label = rule.label;
    for (const [re, id] of rule.brands ?? []) {
      if (re.test(f)) productId = id;
    }
    if (rule.category === 'npk') {
      for (const [re, grade, brands] of NPK_GRADES) {
        if (!re.test(f)) continue;
        label = `NPK ${grade}`;
        const brand = Object.keys(brands).find(b => f.includes(` ${b} `));
        // With one product of that grade in the catalogue the brand is not needed.
        const products = Array.from(new Set(Object.values(brands)));
        productId = brand ? brands[brand] : products.length === 1 ? products[0] : null;
      }
    }
    return {category: rule.category, productId, spoken: label};
  }
  return null;
}

/* ----------------------------------------------------------------- draft */

const INCOME_WORDS = ['bán', 'thu tiền', 'thu được', 'được trả', 'khách trả', 'thu về'];
const STOCK_IN_WORDS = ['mua', 'nhập', 'lấy về', 'chở về'];
const STOCK_OUT_WORDS = ['bón', 'xuất', 'rải', 'lấy ra', 'dùng'];
const EXPENSE_WORDS = ['mua', 'trả', 'chi', 'tốn', 'hết', 'thuê', 'tiền', 'đóng'];
const LABOR_WORDS = ['công', 'thuê', 'nhân công', 'người làm', 'thợ', 'tiền công'];
const UTILITY_WORDS = ['điện', 'tiền nước', 'nước tưới', 'tiền điện'];
const SEED_WORDS = ['giống', 'cây giống', 'hạt giống', 'cây con', 'hom'];
const FILLER = new Set(['được', 'hết', 'tổng', 'cộng', 'là', 'giá', 'đồng', 'đ', 'vnđ', 'tiền', 'với', 'ạ', 'nhé', 'nha', 'ờ', 'à', 'thì']);

function phraseIn(has: (w: string) => boolean, words: string[]): boolean {
  return words.some(w => has(w));
}

function daysAgoOf(has: (w: string) => boolean): number {
  if (has('hôm kia')) return 2;
  if (has('hôm qua')) return 1;
  return 0;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Reads one utterance into a draft entry. */
export function parseVoiceEntry(transcript: string): VoiceDraft {
  const heard = normalizeSpeech(transcript);
  const tokens = repairHeard(heard.split(' ').filter(Boolean));
  const text = tokens.join(' ');
  const has = wordMatcher(text);
  const numbers = findNumbers(tokens);
  const fertilizer = fertilizerHint(text);

  // Quantities are the numbers right before a unit word.
  let quantity: Quantity | null = null;
  const quantitySpans = new Set<NumberSpan>();
  for (const span of numbers) {
    const q = quantityAfter(tokens, span);
    if (q && !quantity) {
      quantity = q;
      quantitySpans.add(span);
    }
  }

  // Money: a run that names a big unit or currency, else the largest
  // remaining number of at least 1.000.
  const rest = numbers.filter(s => !quantitySpans.has(s));
  const moneySpan = rest.find(s => s.money) ?? rest.filter(s => s.value >= 1000).sort((a, b) => b.value - a.value)[0] ?? null;
  // "mười hai nghìn một ký", "mỗi bao sáu trăm tám mươi nghìn": a price per unit.
  let amount: number | null = moneySpan?.value ?? null;
  let unitPrice: number | null = null;
  if (moneySpan) {
    const before = tokens[moneySpan.start - 1];
    const after = tokens.slice(moneySpan.end, moneySpan.end + 2).join(' ');
    const perUnit =
      before === 'mỗi' ||
      tokens[moneySpan.start - 2] === 'mỗi' ||
      /^(một|mỗi) (ký|kí|kg|bao|bó|cành|tạ|thùng)$/.test(after);
    if (perUnit && quantity) {
      unitPrice = moneySpan.value;
      amount = quantity.value * moneySpan.value;
    }
  }

  // "lô một", "lô số hai".
  let plotNumber: number | null = null;
  let plotWords: string | null = null;
  let lotSpan: NumberSpan | null = null;
  const lotAt = tokens.indexOf('lô');
  if (lotAt >= 0) {
    const next = tokens[lotAt + 1] === 'số' ? lotAt + 2 : lotAt + 1;
    const span = numbers.find(s => s.start === next);
    if (span && span.value < 1000) {
      plotNumber = span.value;
      lotSpan = span;
    }
    // "lô hoa hồng": the crop names the plot.
    else plotWords = tokens.slice(lotAt + 1, lotAt + 4).join(' ') || null;
  }
  // Words after "cho"/"ở"/"tại" may name the plot too ("cho vườn hoa hồng").
  const forAt = tokens.findIndex(t => t === 'cho' || t === 'ở' || t === 'tại');
  if (forAt >= 0 && plotNumber === null) {
    const place = new Set(['lô', 'vườn', 'ruộng', 'nhà', 'màng', 'kính']);
    const tail = tokens.slice(forAt + 1).filter(t => !place.has(t));
    if (tail.length > 0) plotWords = tail.join(' ');
  }

  let kind: VoiceDraftKind = 'unknown';
  if (fertilizer && phraseIn(has, STOCK_OUT_WORDS)) kind = 'stock_out';
  else if (fertilizer && phraseIn(has, STOCK_IN_WORDS) && (quantity?.kg != null || quantity?.bags != null)) kind = 'stock_in';
  else if (phraseIn(has, INCOME_WORDS) && !has('thu hoạch')) kind = 'income';
  else if (phraseIn(has, EXPENSE_WORDS) || (fertilizer && amount !== null)) kind = 'expense';

  // "bón hai mươi kali": fertiliser put on the field is counted in kilograms
  // when the unit is left out (or lost by the recogniser).
  if (kind === 'stock_out' && !quantity) {
    const bare = numbers.find(s => s !== moneySpan && s !== lotSpan && !s.money && s.value < 1000);
    if (bare) quantity = {value: bare.value, unit: 'kg', kg: bare.value, bags: null};
  }

  let expenseKind: ExpenseKind | null = null;
  if (kind === 'expense') {
    if (phraseIn(has, LABOR_WORDS)) expenseKind = 'labor';
    else if (phraseIn(has, UTILITY_WORDS)) expenseKind = 'utilities';
    else if (fertilizer) expenseKind = 'fertilizer';
    else if (phraseIn(has, SEED_WORDS)) expenseKind = 'seed';
    else expenseKind = 'other';
  }

  // Description: what was said, minus the money and the filler, with the
  // remaining numbers as digits ("Bán 50 bó hoa cúc").
  const skip = new Set<number>();
  if (moneySpan) for (let k = moneySpan.start; k < moneySpan.end; k++) skip.add(k);
  const words: string[] = [];
  for (let k = 0; k < tokens.length; k++) {
    if (skip.has(k)) continue;
    const span = numbers.find(s => s.start === k);
    if (span && !skip.has(k)) {
      words.push(new Intl.NumberFormat('vi-VN').format(span.value));
      k = span.end - 1;
      continue;
    }
    if (FILLER.has(tokens[k])) continue;
    if (['hôm', 'qua', 'kia', 'nay', 'mỗi'].includes(tokens[k]) && (tokens[k] !== 'nay' || tokens[k - 1] === 'hôm')) continue;
    words.push(tokens[k]);
  }
  const description = capitalize(words.join(' ').replace(/\s+/g, ' ').trim());

  const missing: string[] = [];
  if (kind === 'unknown') missing.push('Chưa rõ là khoản thu, khoản chi hay nhập xuất kho');
  if ((kind === 'income' || kind === 'expense' || kind === 'stock_in') && amount === null) missing.push('Chưa nghe rõ số tiền');
  if ((kind === 'stock_in' || kind === 'stock_out') && !fertilizer?.productId) missing.push('Chọn đúng loại phân');
  if (kind === 'stock_out' && quantity?.kg == null && quantity?.bags == null) missing.push('Chưa nghe rõ số ký');

  return {
    kind,
    transcript: heard,
    amount,
    unitPrice,
    quantity,
    description,
    incomeKind: kind === 'income' ? 'product' : null,
    expenseKind,
    fertilizer,
    plotNumber,
    plotWords,
    daysAgo: daysAgoOf(has),
    missing,
  };
}

/**
 * Whether a recognised sentence is worth showing as a draft. A noisy field
 * makes the recogniser emit a stray syllable ("c", "à"); that is "chưa nghe
 * rõ", not an entry to correct.
 */
export function heardSomething(draft: VoiceDraft): boolean {
  if (draft.kind !== 'unknown' || draft.amount !== null || draft.quantity !== null) return true;
  return draft.transcript.split(' ').filter(w => w.length > 1).length >= 3;
}

/* --------------------------------------------------------- resolution */

export interface PlotChoice {
  id: string;
  code: string | null;
  name: string;
  cropName: string | null;
}

/**
 * The plot the words point to, or null when they point to none or to more
 * than one — a draft never files an entry under a plot by guesswork.
 * "lô một" matches the number in the plot code (PUC-001-VT); "lô hoa hồng"
 * matches the crop or the plot's own name.
 */
export function matchPlot(
  draft: Pick<VoiceDraft, 'plotNumber' | 'plotWords'> & {transcript?: string},
  plots: readonly PlotChoice[],
): string | null {
  const cropOf = (p: PlotChoice) => (p.cropName ? fold(p.cropName.toLowerCase()) : '');
  let found: PlotChoice[] = [];
  if (draft.plotNumber !== null) {
    found = plots.filter(p => {
      const digits = /\d+/.exec(p.code ?? '');
      return digits !== null && Number(digits[0]) === draft.plotNumber;
    });
  } else if (draft.plotWords) {
    const words = fold(draft.plotWords);
    found = plots.filter(p => {
      const name = fold(p.name.toLowerCase());
      return (cropOf(p) !== '' && words.includes(cropOf(p))) || name.includes(words);
    });
  } else if (draft.transcript) {
    // "bán năm mươi bó hoa cúc": the crop sold or bought names the plot when
    // exactly one plot grows it.
    const said = ` ${fold(draft.transcript)} `;
    found = plots.filter(p => cropOf(p) !== '' && said.includes(` ${cropOf(p)} `));
  }
  return found.length === 1 ? found[0].id : null;
}

export interface ProductChoice {
  id: string;
  name: string;
  category: string | null;
  unit?: string | null;
}

/**
 * The product a fertiliser hint stands for. A named brand wins; otherwise the
 * only product of that group already in the shed, or the only one in the
 * catalogue. Two candidates → null, and the farmer picks.
 */
export function resolveProduct(
  hint: FertilizerHint | null,
  catalogue: readonly ProductChoice[],
  inStockIds: readonly string[] = [],
): ProductChoice | null {
  if (!hint) return null;
  if (hint.productId) return catalogue.find(p => p.id === hint.productId) ?? null;
  if (!hint.category) return null;
  const group = catalogue.filter(p => p.category === hint.category);
  const stocked = group.filter(p => inStockIds.includes(p.id));
  if (stocked.length === 1) return stocked[0];
  return group.length === 1 ? group[0] : null;
}

/** kg of a spoken quantity once the product is known ("hai bao" × 50 kg). */
export function quantityKg(quantity: Quantity | null, product: ProductChoice | null): number | null {
  if (!quantity) return null;
  if (quantity.kg !== null) return quantity.kg;
  if (quantity.bags !== null) {
    const size = bagSizeKg(product?.unit);
    return size === null ? null : quantity.bags * size;
  }
  return null;
}

/** Bag size in kg from a catalogue unit such as "bao 50kg" (null if not a bag). */
export function bagSizeKg(unit: string | null | undefined): number | null {
  const m = /bao\s*(\d+(?:[.,]\d+)?)\s*kg/i.exec(unit ?? '');
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Example phrases shown on the voice screen — each one parses to a full draft. */
export const VOICE_EXAMPLES: readonly string[] = [
  'Bán năm mươi bó hoa cúc được một triệu rưỡi',
  'Mua hai bao urê Cà Mau một triệu ba trăm sáu mươi nghìn',
  'Bón hai mươi ký kali cho lô hoa hồng',
  'Trả tiền công ba người sáu trăm nghìn',
  'Hôm qua đóng tiền điện hai trăm tư nghìn',
];
