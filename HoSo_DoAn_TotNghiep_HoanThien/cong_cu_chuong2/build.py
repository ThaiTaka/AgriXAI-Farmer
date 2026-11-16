# -*- coding: utf-8 -*-
"""Tái cấu trúc Chương 2 trực tiếp trên word/document.xml của bản sao.
usage: build.py <orig.docx> <out.docx>
"""
import sys, re, copy, zipfile, random, io, json
from lxml import etree

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
import ch2_content as C

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W14 = 'http://schemas.microsoft.com/office/word/2010/wordml'
XML = 'http://www.w3.org/XML/1998/namespace'
def q(t): return '{%s}%s' % (W, t)

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
raw = zin.read('word/document.xml')
root = etree.fromstring(raw)
body = root.find(q('body'))
orig = list(body)                      # ảnh chụp danh sách phần tử gốc

def text_of(el):
    return ''.join(t.text or '' for t in el.iter(q('t')))

# ---- kiểm tra mốc: bảo đảm đang sửa đúng tệp, đúng vị trí
assert text_of(orig[299]) == 'CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG', text_of(orig[299])
assert text_of(orig[378]) == 'PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG', text_of(orig[378])
assert etree.QName(orig[C.CH2_LAST]).localname == 'tbl'

used_ids = set(el.get('{%s}paraId' % W14) for el in root.iter(q('p')))
rnd = random.Random(20261116)
def new_para_id():
    while True:
        v = '%08X' % rnd.randint(0x10000000, 0x7FFFFFFE)
        if v not in used_ids:
            used_ids.add(v)
            return v

def make_run(text, bold=False):
    r = etree.Element(q('r'))
    if bold:
        rpr = etree.SubElement(r, q('rPr'))
        etree.SubElement(rpr, q('b'))
    t = etree.SubElement(r, q('t'))
    t.text = text
    if text != text.strip() or '  ' in text:
        t.set('{%s}space' % XML, 'preserve')
    return r

def make_para(text, style):
    p = etree.Element(q('p'))
    p.set('{%s}paraId' % W14, new_para_id())
    ppr = etree.SubElement(p, q('pPr'))
    ps = etree.SubElement(ppr, q('pStyle'))
    ps.set(q('val'), style)
    parts = re.split(r'\*\*(.+?)\*\*', text)
    for i, part in enumerate(parts):
        if part == '':
            continue
        p.append(make_run(part, bold=(i % 2 == 1)))
    return p

def retitle(el, title, expect_style):
    assert el.find(q('pPr')).find(q('pStyle')).get(q('val')) == expect_style
    ts = list(el.iter(q('t')))
    assert len(ts) == 1, 'tiêu đề có nhiều run'
    old = ts[0].text
    ts[0].text = title
    return old

# ---- dựng dãy phần tử mới
new_seq, log = [], []
used_orig = set()
for blk in C.BLOCKS:
    kind = blk[0]
    if kind == 'p':
        new_seq.append(make_para(blk[1], '176'))
    elif kind == 'p177':
        new_seq.append(make_para(blk[1], '177'))
    elif kind in ('h2', 'h3'):
        el = orig[blk[1]]
        old = retitle(el, blk[2], '3' if kind == 'h2' else '4')
        log.append((kind, blk[1], old, blk[2]))
        new_seq.append(el); used_orig.add(blk[1])
    elif kind == 'orig':
        new_seq.append(orig[blk[1]]); used_orig.add(blk[1])
    else:
        raise ValueError(kind)

# ---- gỡ toàn bộ phần tử cũ của chương 2 rồi chèn dãy mới
removed = []
for i in range(C.CH2_FIRST, C.CH2_LAST + 1):
    el = orig[i]
    body.remove(el)
    if i not in used_orig:
        removed.append((i, el.find(q('pPr')).find(q('pStyle')).get(q('val')) if el.tag == q('p') else 'tbl', text_of(el)))
anchor = orig[299]                     # tiêu đề chương 2
pos = list(body).index(anchor) + 1
for k, el in enumerate(new_seq):
    body.insert(pos + k, el)

# ---- sửa các câu dẫn chiếu ở ngoài chương 2
for idx, old, new in C.OUTSIDE_EDITS:
    el = orig[idx]
    hit = [t for t in el.iter(q('t')) if old in (t.text or '')]
    assert len(hit) == 1, (idx, old)
    hit[0].text = hit[0].text.replace(old, new)

# ---- kiểm tra bookmark: id duy nhất, start/end khớp
starts = [b.get(q('id')) for b in root.iter(q('bookmarkStart'))]
ends = [b.get(q('id')) for b in root.iter(q('bookmarkEnd'))]
assert len(starts) == len(set(starts)) and sorted(starts) == sorted(ends), 'bookmark lệch'

out_xml = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)

zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    if item.filename.endswith('/'):
        continue                        # bỏ mục thư mục trong ZIP
    data = out_xml if item.filename == 'word/document.xml' else zin.read(item.filename)
    zi = zipfile.ZipInfo(item.filename, date_time=item.date_time)
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = item.external_attr
    zout.writestr(zi, data)
zout.close()

json.dump({'retitled': log, 'removed': removed}, io.open(dst + '.buildlog.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('new elements in chapter 2:', len(new_seq), '| old:', C.CH2_LAST - C.CH2_FIRST + 1)
print('removed old elements:', len(removed), '| retitled headings:', len(log))
print('body children:', len(orig), '->', len(body))
