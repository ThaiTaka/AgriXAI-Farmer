/**
 * V2.1 — tiền công, danh sách ảnh/video của một ghi chú, và hướng dẫn chăm sóc.
 */

import {isYoutubeId, parseImageIds, parseSteps, videoPlayerHtml, youtubeEmbedHtml, youtubeWatchUrl} from '../src/domain/careGuide';
import {describeLabor, laborAmount, parseDecimal} from '../src/domain/labor';
import {
  describeMedia,
  extensionFor,
  localMediaPath,
  markUploaded,
  newMediaId,
  parseMediaRefs,
  pendingMedia,
  serializeMediaRefs,
} from '../src/domain/media';

describe('labour', () => {
  test('same figures as the server', () => {
    // The prompt's example: 1 người × 2 giờ × 30.000₫ = 60.000₫.
    expect(laborAmount('hour', 1, 2, 30_000)).toBe(60_000);
    expect(laborAmount('day', 3, 1, 100_000)).toBe(300_000);
    expect(laborAmount('day', 2, 1.5, 180_000)).toBe(540_000);
    expect(laborAmount('lump', null, null, 450_000)).toBe(450_000);
    // 83.332,5₫ rounds half up on both sides (Python's round() would not).
    expect(laborAmount('hour', 1, 2.5, 33_333)).toBe(83_333);
  });

  test('is null until the breakdown is complete', () => {
    expect(laborAmount('hour', null, 2, 30_000)).toBeNull();
    expect(laborAmount('hour', 1, 0, 30_000)).toBeNull();
    expect(laborAmount('day', 1, 1, 0)).toBeNull();
    expect(laborAmount('lump', null, null, -5)).toBeNull();
  });

  test('describes the working', () => {
    expect(describeLabor({unit: 'hour', workers: 2, quantity: 1.5, unitPrice: 30_000})).toBe('2 người × 1,5 giờ × 30.000₫');
    expect(describeLabor({unit: 'day', workers: 3, quantity: 1, unitPrice: 100_000})).toBe('3 người × 1 ngày × 100.000₫');
    expect(describeLabor({unit: 'lump', workers: null, quantity: null, unitPrice: 450_000})).toBe('Khoán trọn gói 450.000₫');
    // A plain expense has no breakdown.
    expect(describeLabor({unit: null, workers: null, quantity: null, unitPrice: null})).toBeNull();
    expect(describeLabor({unit: 'hour', workers: null, quantity: 2, unitPrice: 1})).toBeNull();
  });

  test('reads what the farmer typed', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal(' 2.25 ')).toBe(2.25);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('media refs', () => {
  const raw = JSON.stringify([
    {id: 'a1', kind: 'image', mime: 'image/jpeg', uploaded: true},
    {id: 'v1', kind: 'video', mime: 'video/mp4', uploaded: false},
    {id: 'x', kind: 'weird'},
    {nope: true},
    'rác',
  ]);

  test('parse tolerantly', () => {
    expect(parseMediaRefs(raw)).toEqual([
      {id: 'a1', kind: 'image', mime: 'image/jpeg', uploaded: true},
      {id: 'v1', kind: 'video', mime: 'video/mp4', uploaded: false},
      {id: 'x', kind: 'image', mime: 'image/jpeg', uploaded: false},
    ]);
    expect(parseMediaRefs('{not json')).toEqual([]);
    expect(parseMediaRefs('{"id": "a"}')).toEqual([]);
    expect(parseMediaRefs(null)).toEqual([]);
  });

  test('round-trip, pending and marking uploaded', () => {
    const refs = parseMediaRefs(raw);
    expect(parseMediaRefs(serializeMediaRefs(refs))).toEqual(refs);
    expect(serializeMediaRefs([])).toBeNull();
    expect(pendingMedia(raw).map(r => r.id)).toEqual(['v1', 'x']);
    // The exact text the uploader and the server both search for.
    expect(serializeMediaRefs(refs)).toContain('"uploaded":false');
    const after = markUploaded(raw, 'v1');
    expect(pendingMedia(after).map(r => r.id)).toEqual(['x']);
  });

  test('where a file lives on the phone', () => {
    expect(localMediaPath('/docs', {id: 'abc', kind: 'image', mime: 'image/png'})).toBe('/docs/media/abc.png');
    expect(localMediaPath('/docs', {id: 'abc', kind: 'video', mime: 'video/quicktime'})).toBe('/docs/media/abc.mov');
    expect(extensionFor('application/x-unknown', 'video')).toBe('mp4');
    expect(extensionFor('IMAGE/JPEG', 'image')).toBe('jpg');
  });

  test('ids match the server pattern', () => {
    const id = newMediaId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(newMediaId(() => 0)).toBe('0'.repeat(32));
  });

  test('describe', () => {
    expect(describeMedia(parseMediaRefs(raw))).toBe('2 ảnh · 1 video');
    expect(describeMedia([])).toBeNull();
  });
});

describe('care guides', () => {
  test('steps and images parse tolerantly', () => {
    const steps = JSON.stringify([
      {title: 'Xới gốc', body: 'Cách gốc 10 cm', image_id: 'img1'},
      {title: 'Tưới'},
      {body: 'không có tiêu đề'},
      null,
    ]);
    expect(parseSteps(steps)).toEqual([
      {title: 'Xới gốc', body: 'Cách gốc 10 cm', imageId: 'img1'},
      {title: 'Tưới', body: '', imageId: null},
    ]);
    expect(parseSteps('rác')).toEqual([]);
    expect(parseImageIds('["a", 2, "b"]')).toEqual(['a', 'b']);
    expect(parseImageIds(null)).toEqual([]);
  });

  test('YouTube embed', () => {
    expect(isYoutubeId('dQw4w9WgXcQ')).toBe(true);
    expect(isYoutubeId('short')).toBe(false);
    expect(isYoutubeId(null)).toBe(false);
    const html = youtubeEmbedHtml('dQw4w9WgXcQ');
    expect(html).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1');
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(() => youtubeEmbedHtml('"><script>')).toThrow();
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('video player page quotes its source safely', () => {
    const html = videoPlayerHtml('file:///x/a"b.mp4');
    expect(html).toContain('src="file:///x/a%22b.mp4"');
    expect(html).toContain('controls playsinline');
  });
});
