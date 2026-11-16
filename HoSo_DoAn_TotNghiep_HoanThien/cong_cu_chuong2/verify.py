# -*- coding: utf-8 -*-
"""Kiểm định một tệp docx của báo cáo: đánh số mục, dẫn chiếu chéo, trích dẫn IEEE, mục lục.
usage: verify.py <docx> [--compare <orig.docx>] [--json out.json]
"""
import sys, re, zipfile, json, io
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
def q(t): return '{%s}%s' % (W, t)
sys.stdout.reconfigure(encoding='utf-8')

def load(path):
    z = zipfile.ZipFile(path)
    return etree.fromstring(z.read('word/document.xml')).find(q('body'))

def style(p):
    s = p.find('w:pPr/w:pStyle', NS)
    return s.get(q('val')) if s is not None else '-'

def plain(el):
    """Văn bản hiển thị: bỏ mã trường (instrText), giữ kết quả trường."""
    out = []
    for e in el.iter():
        n = etree.QName(e).localname
        if n == 't': out.append(e.text or '')
        elif n == 'tab': out.append('\t')
    return ''.join(out)

def numbered(p):
    n = p.find('w:pPr/w:numPr/w:numId', NS)
    return not (n is not None and n.get(q('val')) == '0')

def analyse(body, style_ids=None):
    """style_ids: ánh xạ tên vai trò -> id style (tệp do WPS lưu dùng id số)."""
    S = style_ids
    items = []          # (idx, kind, number, text)
    ch = h2 = h3 = 0
    tbl_n = fig_n = 0
    chapter_label = None
    for i, el in enumerate(body):
        tag = etree.QName(el).localname
        if tag == 'tbl':
            items.append((i, 'tbl', None, ' | '.join(plain(tc) for tc in el.iter(q('tc')))))
            continue
        if tag != 'p':
            continue
        st = style(el)
        txt = plain(el)
        if st == S['h1']:
            if numbered(el):
                ch += 1; h2 = h3 = 0; tbl_n = fig_n = 0
                chapter_label = str(ch)
                items.append((i, 'h1', str(ch), txt))
            else:
                chapter_label = 'PL' if txt.startswith('PHỤ LỤC') else None
                tbl_n = fig_n = 0
                items.append((i, 'h1x', None, txt))
        elif st == S['h2']:
            h2 += 1; h3 = 0
            items.append((i, 'h2', '%d.%d' % (ch, h2), txt))
        elif st == S['h3']:
            h3 += 1
            items.append((i, 'h3', '%d.%d.%d' % (ch, h2, h3), txt))
        elif st == S['h4']:
            items.append((i, 'h4', None, txt))
        elif st == S['capt']:
            tbl_n += 1
            items.append((i, 'capt', '%s.%d' % (chapter_label, tbl_n), txt))
        elif st == S['capf']:
            fig_n += 1
            items.append((i, 'capf', '%s.%d' % (chapter_label, fig_n), txt))
        elif st in S['toc']:
            items.append((i, 'toc', st, txt))
        elif st == S['ref']:
            items.append((i, 'ref', None, txt))
        else:
            items.append((i, 'p', st, txt))
    return items

def detect_styles(path):
    z = zipfile.ZipFile(path)
    st = etree.fromstring(z.read('word/styles.xml'))
    m = {}
    for s in st.findall('w:style', NS):
        nm = s.find('w:name', NS)
        if nm is not None:
            m[nm.get(q('val')).lower()] = s.get(q('styleId'))
    g = lambda *names: next((m[n] for n in names if n in m), None)
    return {
        'h1': g('heading 1'), 'h2': g('heading 2'), 'h3': g('heading 3'), 'h4': g('heading 4'),
        'capt': g('chú thích bảng'), 'capf': g('chú thích hình'), 'ref': g('tài liệu tham khảo'),
        'toc': [x for x in (g('toc 1'), g('toc 2'), g('toc 3'), g('table of figures')) if x],
    }

CITE = re.compile(r'\[(\d{1,2})\]')

def report(path, compare=None, json_out=None):
    S = detect_styles(path)
    body = load(path)
    items = analyse(body, S)
    res = {}
    secs = {n for (_, k, n, _) in items if k in ('h2', 'h3')}
    chapters = {n for (_, k, n, _) in items if k == 'h1'}
    tables = {n for (_, k, n, _) in items if k == 'capt'}
    figs = {n for (_, k, n, _) in items if k == 'capf'}
    h = [(k, n, t) for (_, k, n, t) in items if k in ('h1', 'h2', 'h3')]
    print('== Số tiêu đề: chương %d, cấp 2: %d, cấp 3: %d | bảng có chú thích %d, hình %d, phần tử bảng %d' % (
        len(chapters), sum(1 for x in h if x[0] == 'h2'), sum(1 for x in h if x[0] == 'h3'),
        len(tables), len(figs), sum(1 for it in items if it[1] == 'tbl')))
    c2 = [x for x in h if x[1].split('.')[0] == '2']
    print('== Chương 2: cấp 2 = %d, cấp 3 = %d' % (sum(1 for x in c2 if x[0] == 'h2'), sum(1 for x in c2 if x[0] == 'h3')))
    for k, n, t in c2:
        print('   %s%s %s' % ('  ' if k == 'h3' else '', n, t))
    res['ch2_headings'] = [(k, n, t) for k, n, t in c2]

    # ---- dẫn chiếu chéo
    bad = []
    nrefs = 0
    for (i, k, n, t) in items:
        if k in ('toc', 'ref'):
            continue
        for m in re.finditer(r'(?:[Cc]ác mục|[Mm]ục)\s+((?:\d+(?:\.\d+)+)(?:\s*(?:–|-|,|và|đến)\s*\d+(?:\.\d+)+)*)', t):
            for num in re.findall(r'\d+(?:\.\d+)+', m.group(1)):
                nrefs += 1
                if num not in secs:
                    bad.append((i, 'mục ' + num, t[:80]))
        for m in re.finditer(r'(Bảng|Hình)\s+((?:\d+|PL)\.\d+)', t):
            if k in ('capt', 'capf') and t.startswith(m.group(0)):
                continue
            nrefs += 1
            pool = tables if m.group(1) == 'Bảng' else figs
            if m.group(2) not in pool:
                bad.append((i, m.group(0), t[:80]))
        for m in re.finditer(r'Chương\s+(\d+)', t):
            nrefs += 1
            if m.group(1) not in chapters:
                bad.append((i, m.group(0), t[:80]))
    print('== Dẫn chiếu chéo: %d dẫn chiếu, %d không tồn tại' % (nrefs, len(bad)))
    for b in bad: print('   !!', b)
    res['bad_xrefs'] = bad

    # mọi bảng/hình có được nhắc?
    alltext = '\n'.join(t for (_, k, _, t) in items if k not in ('toc', 'ref', 'capt', 'capf'))
    un = [('Bảng ' + n) for n in sorted(tables) if not re.search(r'Bảng\s+%s(?!\d)' % re.escape(n), alltext)]
    un += [('Hình ' + n) for n in sorted(figs) if not re.search(r'Hình\s+%s(?!\d)' % re.escape(n), alltext)]
    # dạng "Bảng 3.4–3.7" được coi là đã nhắc: kiểm tra thêm bằng khoảng
    print('== Bảng/hình chưa được nhắc trong thuyết minh (chưa xét dạng khoảng a–b):', un or 'không')

    # ---- trích dẫn IEEE
    order, where = [], {}
    for (i, k, n, t) in items:
        if k in ('toc', 'ref'):
            continue
        for m in CITE.finditer(t):
            c = int(m.group(1))
            if c not in where:
                where[c] = i; order.append(c)
    refs = []
    for (i, k, n, t) in items:
        if k == 'ref':
            m = re.match(r'\[(\d+)\]', t)
            refs.append(int(m.group(1)) if m else None)
    print('== TLTK: %d mục trong danh mục; %d số được trích; thứ tự xuất hiện lần đầu %s' % (
        len(refs), len(order), 'ĐÚNG 1..N' if order == list(range(1, len(order) + 1)) else 'SAI: ' + str(order)))
    print('   trích nhưng không có trong danh mục:', sorted(set(order) - set(refs)) or 'không',
          '| có trong danh mục nhưng không trích:', sorted(set(refs) - set(order)) or 'không')
    res['cite_order'] = order
    # trích dẫn theo mục của chương 2
    cur = None; per = {}
    for (i, k, n, t) in items:
        if k in ('h1', 'h1x'): cur = None
        if k == 'h2': cur = n if n.startswith('2.') else None
        if cur and k in ('p', 'tbl', 'capt'):
            for m in CITE.finditer(t):
                per.setdefault(cur, [])
                c = int(m.group(1))
                if c not in per[cur]: per[cur].append(c)
    for s in sorted(per): print('   %s: %s' % (s, per[s]))
    res['ch2_cites'] = per

    # ---- mục lục so với tiêu đề
    toc = [t for (_, k, n, t) in items if k == 'toc' and n in S['toc'][:3]]
    exp = []
    for (_, k, n, t) in items:
        if k == 'h1': exp.append('CHƯƠNG %s: %s' % (n, t))
        elif k == 'h1x': exp.append(t)
        elif k in ('h2', 'h3'): exp.append('%s. %s' % (n, t))
    got = [re.sub(r'\t.*$', '', x).strip() for x in toc]
    got_n = [re.sub(r'\s+', ' ', x) for x in got]
    exp_n = [re.sub(r'\s+', ' ', x) for x in exp]
    miss = [x for x in exp_n if x not in got_n]
    extra = [x for x in got_n if x not in exp_n]
    print('== Mục lục: %d dòng; tiêu đề thiếu trong mục lục: %d; dòng mục lục không khớp tiêu đề: %d' % (len(got), len(miss), len(extra)))
    for x in miss[:12]: print('   thiếu:', x)
    for x in extra[:12]: print('   thừa :', x)
    res['toc_missing'] = miss; res['toc_extra'] = extra
    pages = [re.search(r'\t(\S+)$', x) for x in toc]
    res['toc'] = toc

    # ---- so với bản gốc: phần ngoài chương 2
    if compare:
        S0 = detect_styles(compare)
        it0 = analyse(load(compare), S0)
        def outside(items_):
            out, inside = [], False
            for (i, k, n, t) in items_:
                if k == 'h1': inside = (n == '2')
                elif k == 'h1x': inside = False
                if inside or k == 'toc':
                    continue
                out.append((k, t))
            return out
        a, b = outside(it0), outside(items)
        print('== So với bản gốc (ngoài Chương 2, không tính mục lục): %d khối -> %d khối' % (len(a), len(b)))
        diffs = [(x, y) for x, y in zip(a, b) if x != y]
        print('   số khối khác nhau: %d%s' % (len(diffs), '' if len(a) == len(b) else '  (!! số khối lệch)'))
        for x, y in diffs:
            # in đoạn khác biệt ngắn gọn
            s0, s1 = x[1], y[1]
            p = 0
            while p < min(len(s0), len(s1)) and s0[p] == s1[p]: p += 1
            print('   - gốc: …%s' % s0[max(0, p - 30):p + 60].replace('\n', ' '))
            print('     mới: …%s' % s1[max(0, p - 30):p + 60].replace('\n', ' '))
        res['outside_diffs'] = len(diffs)
        # bảng trong chương 2 giữ nguyên?
        def ch2tables(items_):
            out, inside = [], False
            for (i, k, n, t) in items_:
                if k == 'h1': inside = (n == '2')
                elif k == 'h1x': inside = False
                if inside and k in ('tbl', 'capt'): out.append((k, t))
            return out
        ta, tb = ch2tables(it0), ch2tables(items)
        print('== Bảng và chú thích bảng của Chương 2 giữ nguyên nội dung:', 'CÓ' if ta == tb else 'KHÔNG', '(%d khối)' % len(tb))
    if json_out:
        json.dump(res, io.open(json_out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

args = sys.argv[1:]
cmp_ = args[args.index('--compare') + 1] if '--compare' in args else None
js = args[args.index('--json') + 1] if '--json' in args else None
report(args[0], cmp_, js)
