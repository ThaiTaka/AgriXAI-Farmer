# -*- coding: utf-8 -*-
"""So số trang ghi trong mục lục / danh mục hình / danh mục bảng (docx) với trang thực tế trong PDF.
usage: check_pages.py <docx> <pdf>"""
import sys, re, zipfile, pymupdf
from lxml import etree
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def q(t): return '{%s}%s' % (W, t)
sys.stdout.reconfigure(encoding='utf-8')
z = zipfile.ZipFile(sys.argv[1])
body = etree.fromstring(z.read('word/document.xml')).find(q('body'))
st = etree.fromstring(z.read('word/styles.xml'))
names = {s.get(q('styleId')): s.find(q('name')).get(q('val')).lower() for s in st.findall(q('style')) if s.find(q('name')) is not None}
def plain(el):
    out = []
    for e in el.iter():
        n = etree.QName(e).localname
        if n == 't': out.append(e.text or '')
        elif n == 'tab': out.append('\t')
    return ''.join(out)
entries = []
for el in body:
    if etree.QName(el).localname != 'p': continue
    s = el.find(q('pPr') + '/' + q('pStyle'))
    nm = names.get(s.get(q('val')), '') if s is not None else ''
    if nm in ('toc 1', 'toc 2', 'toc 3', 'table of figures'):
        t = plain(el)
        if '\t' in t:
            a, b = t.rsplit('\t', 1)
            entries.append((nm, a.strip(), b.strip()))
d = pymupdf.open(sys.argv[2])
# nhãn trang in: lấy số ở chân trang (dòng cuối cùng của trang)
labels = []
for p in d:
    words = [w for w in p.get_text('words') if w[1] > p.rect.height - 70]
    labels.append(words[-1][4] if words else '')
norm = lambda s: re.sub(r'\s+', '', s).lower()
pages_text = [norm(p.get_text()) for p in d]
bad = 0
first_body = next(i for i, l in enumerate(labels) if l == '1')
for nm, title, page in entries:
    key = norm(title)
    if nm == 'toc 1' and title.startswith('CHƯƠNG'):
        key = norm(title.replace(':', ': '))
    # tìm trang đầu tiên (sau phần mục lục/danh mục) có chứa tiêu đề
    is_front = not page.isdigit()
    rng = range(0, first_body) if is_front else range(first_body, d.page_count)
    hit = [i for i in rng if key in pages_text[i] and labels[i] == page]
    if not hit:
        real = [labels[i] for i in rng if key in pages_text[i]]
        bad += 1
        print('  LỆCH:', nm, '|', title[:70], '| mục lục ghi', page, '| thực tế', real[:3])
print('số dòng mục lục/danh mục: %d | lệch trang: %d | tổng số trang PDF: %d | trang thân bài đầu tiên: pdf %d' % (len(entries), bad, d.page_count, first_body + 1))
