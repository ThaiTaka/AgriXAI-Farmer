/**
 * Ghi bằng giọng nói — the transcript reader. The recogniser writes Vietnamese
 * words with their accents and numbers as words, the way a farmer says them.
 */

import {
  bagSizeKg,
  fertilizerHint,
  findNumbers,
  matchPlot,
  normalizeSpeech,
  parseVietnameseNumber,
  parseVoiceEntry,
  quantityKg,
  repairHeard,
  resolveProduct,
  VOICE_EXAMPLES,
} from '../src/domain/voiceEntry';

const n = (words: string) => parseVietnameseNumber(normalizeSpeech(words).split(' '));

describe('số đọc bằng chữ', () => {
  test.each([
    ['năm', 5],
    ['mười', 10],
    ['mười lăm', 15],
    ['hai mươi', 20],
    ['hai mươi mốt', 21],
    ['hai lăm', 25],
    ['ba mốt', 31],
    ['bốn tư', 44],
    ['ba chục', 30],
    ['một trăm', 100],
    ['một trăm rưỡi', 150],
    ['hai trăm tư', 240],
    ['ba trăm linh năm', 305],
    ['năm trăm năm mươi', 550],
    ['một nghìn', 1_000],
    ['hai nghìn tư', 2_400],
    ['ba nghìn rưỡi', 3_500],
    ['một nghìn lẻ năm', 1_005],
    ['hai mươi lăm nghìn', 25_000],
    ['năm chục nghìn', 50_000],
    ['hai trăm ngàn', 200_000],
    ['một triệu', 1_000_000],
    ['một triệu rưỡi', 1_500_000],
    ['một triệu hai', 1_200_000],
    ['một triệu hai trăm', 1_200_000],
    ['một triệu ba trăm sáu mươi nghìn', 1_360_000],
    ['hai triệu không trăm năm mươi nghìn', 2_050_000],
    ['một củ rưỡi', 1_500_000],
    ['1,5 triệu', 1_500_000],
    ['1.500.000', 1_500_000],
    ['500k', 500_000],
    ['2tr', 2_000_000],
  ])('%s = %d', (words, value) => {
    expect(n(words)).toBe(value);
  });

  test('words that are not numbers give nothing', () => {
    expect(n('hoa cúc')).toBeNull();
  });

  test('"năm nay" is the year, not five; "củ cải" is a radish, not a million', () => {
    expect(findNumbers(normalizeSpeech('năm nay bán củ cải').split(' '))).toEqual([]);
  });
});

describe('khoản thu', () => {
  test('bán hoa, số bó và số tiền', () => {
    const d = parseVoiceEntry('Bán năm mươi bó hoa cúc được một triệu rưỡi');
    expect(d.kind).toBe('income');
    expect(d.incomeKind).toBe('product');
    expect(d.amount).toBe(1_500_000);
    expect(d.quantity).toEqual({value: 50, unit: 'bó', kg: null, bags: null});
    expect(d.description).toBe('Bán 50 bó hoa cúc');
    expect(d.missing).toEqual([]);
  });

  test('giá theo đơn vị nhân với số lượng', () => {
    const d = parseVoiceEntry('bán hai trăm cành hồng mỗi cành ba nghìn');
    expect(d.kind).toBe('income');
    expect(d.unitPrice).toBe(3_000);
    expect(d.amount).toBe(600_000);
  });

  test('"thu hoạch" là thu hoạch, không phải thu tiền', () => {
    const d = parseVoiceEntry('thu hoạch năm mươi ký cà chua');
    expect(d.kind).toBe('unknown');
    expect(d.missing[0]).toMatch(/Chưa rõ/);
  });

  test('typed without accents still reads', () => {
    const d = parseVoiceEntry('ban 30 bo cam chuong 900k');
    expect(d.kind).toBe('income');
    expect(d.amount).toBe(900_000);
  });
});

describe('khoản chi', () => {
  test('tiền công', () => {
    const d = parseVoiceEntry('Trả tiền công ba người sáu trăm nghìn');
    expect(d.kind).toBe('expense');
    expect(d.expenseKind).toBe('labor');
    expect(d.amount).toBe(600_000);
  });

  test('tiền điện hôm qua', () => {
    const d = parseVoiceEntry('Hôm qua đóng tiền điện hai trăm tư nghìn');
    expect(d.kind).toBe('expense');
    expect(d.expenseKind).toBe('utilities');
    expect(d.amount).toBe(240_000);
    expect(d.daysAgo).toBe(1);
  });

  test('cây giống', () => {
    const d = parseVoiceEntry('mua cây giống hoa cúc hai triệu');
    expect(d.kind).toBe('expense');
    expect(d.expenseKind).toBe('seed');
    expect(d.amount).toBe(2_000_000);
  });

  test('phân không nói số lượng là khoản chi phân bón', () => {
    const d = parseVoiceEntry('mua phân urê hết một triệu');
    expect(d.kind).toBe('expense');
    expect(d.expenseKind).toBe('fertilizer');
  });
});

describe('nhập, xuất kho', () => {
  test('mua theo bao, có hãng', () => {
    const d = parseVoiceEntry('Mua hai bao urê Cà Mau một triệu ba trăm sáu mươi nghìn');
    expect(d.kind).toBe('stock_in');
    expect(d.fertilizer).toEqual({category: 'dam', productId: 'ure_ca_mau', spoken: 'Urê'});
    expect(d.quantity?.bags).toBe(2);
    expect(d.amount).toBe(1_360_000);
    expect(d.missing).toEqual([]);
  });

  test('bón cho lô theo tên cây', () => {
    const d = parseVoiceEntry('Bón hai mươi ký kali cho lô hoa hồng');
    expect(d.kind).toBe('stock_out');
    expect(d.quantity?.kg).toBe(20);
    expect(d.fertilizer?.category).toBe('kali');
    expect(d.fertilizer?.productId).toBeNull();
    expect(d.missing).toEqual(['Chọn đúng loại phân']);
    expect(d.plotWords).toBe('hoa hồng');
  });

  test('bón cho lô theo số', () => {
    const d = parseVoiceEntry('bón mười lăm ký super lân lô số một');
    expect(d.kind).toBe('stock_out');
    expect(d.fertilizer?.productId).toBe('sieu_lan_lam_thao');
    expect(d.quantity?.kg).toBe(15);
    expect(d.plotNumber).toBe(1);
  });

  test('tạ và tấn đổi ra ký', () => {
    expect(parseVoiceEntry('xuất hai tạ npk mười sáu mười sáu tám Cà Mau').quantity?.kg).toBe(200);
    expect(parseVoiceEntry('nhập một tấn phân gà ba triệu').quantity?.kg).toBe(1000);
  });

  test('"ki lô" là ký, không phải lô đất', () => {
    const d = parseVoiceEntry('bón năm ki lô urê');
    expect(d.quantity?.kg).toBe(5);
    expect(d.plotNumber).toBeNull();
    expect(d.plotWords).toBeNull();
  });
});

describe('tên phân bón', () => {
  test.each([
    ['urê Phú Mỹ', 'dam', 'ure_phu_my'],
    ['phân đạm', 'dam', null],
    ['DAP Hàn Quốc', 'lan', 'dap_han_quoc'],
    ['lân nung chảy Văn Điển', 'lan', 'lan_nung_chay_van_dien'],
    ['kali Cà Mau', 'kali', 'kali_bot_ca_mau'],
    ['NPK hai mươi hai mươi mười lăm', 'npk', 'npk_20_20_15_binh_dien'],
    ['npk 16 16 8 đầu trâu', 'npk', 'npk_16_16_8_dau_trau'],
    ['phân gà', 'huu_co', 'phan_ga_huu_co'],
    ['phân trùn quế', 'huu_co', null],
  ])('%s', (words, category, productId) => {
    const hint = fertilizerHint(words);
    expect(hint?.category).toBe(category);
    expect(hint?.productId).toBe(productId);
  });

  test('"lần hai" is not phosphate', () => {
    expect(fertilizerHint('bón thúc lần hai')).toBeNull();
  });

  test('bag size from the catalogue unit', () => {
    expect(bagSizeKg('bao 50kg')).toBe(50);
    expect(bagSizeKg('gói 2kg')).toBeNull();
  });
});

describe('khớp lô và loại phân', () => {
  const plots = [
    {id: 'p1', code: 'PUC-001-VT', name: 'Nhà màng hoa cúc', cropName: 'Hoa cúc'},
    {id: 'p4', code: 'PUC-004-VT', name: 'Vườn hoa hồng', cropName: 'Hoa hồng'},
  ];

  test('by the number in the plot code', () => {
    expect(matchPlot({plotNumber: 4, plotWords: null}, plots)).toBe('p4');
    expect(matchPlot({plotNumber: 9, plotWords: null}, plots)).toBeNull();
  });

  test('by the crop, with or without accents', () => {
    expect(matchPlot({plotNumber: null, plotWords: 'hoa hồng'}, plots)).toBe('p4');
    expect(matchPlot({plotNumber: null, plotWords: 'hoa cuc'}, plots)).toBe('p1');
  });

  test('a sale names its plot by the crop when one plot grows it', () => {
    expect(matchPlot({plotNumber: null, plotWords: null, transcript: 'bán năm mươi bó hoa cúc'}, plots)).toBe('p1');
    expect(matchPlot({plotNumber: null, plotWords: null, transcript: 'trả tiền điện'}, plots)).toBeNull();
  });

  test('two plots of the same crop → no guess', () => {
    const twin = [...plots, {id: 'p9', code: 'PUC-009-VT', name: 'Vườn hồng 2', cropName: 'Hoa hồng'}];
    expect(matchPlot({plotNumber: null, plotWords: 'hoa hồng'}, twin)).toBeNull();
  });

  const catalogue = [
    {id: 'ure_ca_mau', name: 'Urê Cà Mau', category: 'dam', unit: 'bao 50kg'},
    {id: 'ure_phu_my', name: 'Urê Phú Mỹ', category: 'dam', unit: 'bao 50kg'},
    {id: 'phan_ga_huu_co', name: 'Phân gà', category: 'huu_co', unit: 'kg'},
  ];

  test('a group without a brand resolves to what is already in the shed', () => {
    const hint = {category: 'dam', productId: null, spoken: 'Urê'};
    expect(resolveProduct(hint, catalogue, ['ure_phu_my'])?.id).toBe('ure_phu_my');
    expect(resolveProduct(hint, catalogue, [])).toBeNull();
  });

  test('bags become kg once the product is known', () => {
    const q = {value: 2, unit: 'bao', kg: null, bags: 2};
    expect(quantityKg(q, catalogue[0])).toBe(100);
    expect(quantityKg(q, null)).toBeNull();
    expect(quantityKg(q, catalogue[2])).toBeNull();
  });
});

describe('câu máy nghe thật (Vosk, mô hình nhỏ tiếng Việt, có giới hạn từ vựng)', () => {
  // Heard by the app's model from spoken samples — see ADR 0010.
  test('"năm mười" là năm mươi', () => {
    const d = parseVoiceEntry('bán năm mười bó hoa cúc được một triệu rưỡi');
    expect(d.kind).toBe('income');
    expect(d.amount).toBe(1_500_000);
    expect(d.quantity?.value).toBe(50);
    expect(d.transcript).toBe('bán năm mười bó hoa cúc được một triệu rưỡi');
  });

  test('"u rê cà mau" and "sáu mười nghìn"', () => {
    const d = parseVoiceEntry('mua hai bao u rê cà mau một triệu ba trăm sáu mười nghìn');
    expect(d.kind).toBe('stock_in');
    expect(d.fertilizer?.productId).toBe('ure_ca_mau');
    expect(d.quantity?.bags).toBe(2);
    expect(d.amount).toBe(1_360_000);
  });

  test('"hai mỹ ka li" — mươi heard as Mỹ, the unit lost', () => {
    const d = parseVoiceEntry('bón hai mỹ ka li cho lúa hoa hồng');
    expect(d.kind).toBe('stock_out');
    expect(d.fertilizer?.category).toBe('kali');
    expect(d.quantity?.kg).toBe(20);
  });

  test('"bốn mười lâm ký súp lân lúa số một"', () => {
    const d = parseVoiceEntry('bốn mười lâm ký súp lân lúa số một');
    expect(d.kind).toBe('stock_out');
    expect(d.quantity?.kg).toBe(15);
    expect(d.fertilizer?.productId).toBe('sieu_lan_lam_thao');
    expect(d.plotNumber).toBe(1);
  });

  test('"bón mười lâm ký xuất tây lân lúa số một"', () => {
    const d = parseVoiceEntry('bón mười lâm ký xuất tây lân lúa số một');
    expect(d.kind).toBe('stock_out');
    expect(d.quantity?.kg).toBe(15);
    expect(d.plotNumber).toBe(1);
  });

  test('Phú Mỹ and Lâm Thao stay brands', () => {
    expect(repairHeard('urê phú mỹ hai bao'.split(' '))).toEqual(['urê', 'phú', 'mỹ', 'hai', 'bao']);
    expect(repairHeard('lân lâm thao mười bao'.split(' '))).toEqual(['lân', 'lâm', 'thao', 'mười', 'bao']);
    expect(repairHeard('bốn bao urê'.split(' '))[0]).toBe('bón');
    expect(repairHeard('bán bốn bao urê'.split(' '))[1]).toBe('bốn');
  });
});

test('every example on the screen reads into a draft with nothing missing but the brand', () => {
  for (const example of VOICE_EXAMPLES) {
    const d = parseVoiceEntry(example);
    expect(d.kind).not.toBe('unknown');
    expect(d.missing.filter(m => m !== 'Chọn đúng loại phân')).toEqual([]);
  }
});
