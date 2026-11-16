"""Print raw XML of body elements by index. usage: raw.py <document.xml> idx [idx...] (idx may be a-b)"""
import sys, re
from lxml import etree
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
tree = etree.parse(sys.argv[1])
body = tree.getroot().find('{%s}body' % W)
sys.stdout.reconfigure(encoding='utf-8')
maxlen = 6000
for a in sys.argv[2:]:
    if a.startswith('max='):
        maxlen = int(a[4:]); continue
    if '-' in a:
        lo, hi = map(int, a.split('-'))
    else:
        lo = hi = int(a)
    for i in range(lo, hi + 1):
        s = etree.tostring(body[i], encoding='unicode')
        s = re.sub(r' xmlns:\w+="[^"]+"', '', s)
        print('=== [%d] len=%d' % (i, len(s)))
        print(s[:maxlen])
