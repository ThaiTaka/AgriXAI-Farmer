"""Dump body-level structure of a docx's document.xml.
usage: dump.py <document.xml> <out.txt> [start] [end]
"""
import sys, io
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
def q(t): return '{%s}%s' % (W, t)

def para_text(p, show_fields=True):
    out = []
    for el in p.iter():
        tag = etree.QName(el).localname
        if tag == 't':
            out.append(el.text or '')
        elif tag == 'tab':
            out.append('\t')
        elif tag == 'br':
            out.append('<BR:%s>' % (el.get(q('type')) or 'line'))
        elif tag == 'instrText' and show_fields:
            out.append('{{%s}}' % (el.text or ''))
        elif tag == 'fldChar' and show_fields:
            out.append('<%s>' % el.get(q('fldCharType'))[0].upper())
        elif tag == 'fldSimple' and show_fields:
            out.append('{{SIMPLE:%s}}' % el.get(q('instr')))
        elif tag == 'drawing':
            out.append('<DRAWING>')
        elif tag == 'pict':
            out.append('<PICT>')
        elif tag == 'bookmarkStart' and show_fields:
            out.append('<BM:%s>' % el.get(q('name')))
        elif tag == 'footnoteReference':
            out.append('<FN:%s>' % el.get(q('id')))
        elif tag == 'sectPr':
            out.append('<SECTPR>')
    return ''.join(out)

def pstyle(p):
    s = p.find('w:pPr/w:pStyle', NS)
    return s.get(q('val')) if s is not None else '-'

def numinfo(p):
    n = p.find('w:pPr/w:numPr', NS)
    if n is None: return ''
    il = n.find('w:ilvl', NS); ni = n.find('w:numId', NS)
    return ' num(%s,%s)' % (ni.get(q('val')) if ni is not None else '?', il.get(q('val')) if il is not None else '?')

def main():
    src, dst = sys.argv[1], sys.argv[2]
    start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    end = int(sys.argv[4]) if len(sys.argv) > 4 else 10**9
    tree = etree.parse(src)
    body = tree.getroot().find('w:body', NS)
    lines = []
    for i, el in enumerate(body):
        if i < start or i > end: continue
        tag = etree.QName(el).localname
        if tag == 'p':
            lines.append('[%d] P style=%s%s | %s' % (i, pstyle(el), numinfo(el), para_text(el)))
        elif tag == 'tbl':
            lines.append('[%d] TBL' % i)
            for r, tr in enumerate(el.findall('w:tr', NS)):
                cells = []
                for tc in tr.findall('w:tc', NS):
                    cells.append(' / '.join(para_text(p) for p in tc.iter(q('p'))))
                lines.append('     r%d: %s' % (r, ' || '.join(cells)))
        else:
            lines.append('[%d] %s' % (i, tag))
    io.open(dst, 'w', encoding='utf-8').write('\n'.join(lines))
    print('elements:', len(body), 'written lines:', len(lines))

main()
