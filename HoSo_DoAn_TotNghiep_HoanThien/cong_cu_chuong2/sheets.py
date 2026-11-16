"""Render PDF pages into 2-up contact sheets. usage: sheets.py <pdf> <outprefix> <first> <last> [dpi]  (1-based pages)"""
import sys, pymupdf
pdf, prefix, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
dpi = int(sys.argv[5]) if len(sys.argv) > 5 else 80
d = pymupdf.open(pdf)
pages = list(range(a - 1, min(b, d.page_count)))
for k in range(0, len(pages), 2):
    pair = pages[k:k + 2]
    pix = [d[p].get_pixmap(dpi=dpi) for p in pair]
    w = sum(p.width for p in pix) + 10 * (len(pix) - 1); h = max(p.height for p in pix)
    sheet = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, w, h), False)
    sheet.set_rect(sheet.irect, (150, 150, 150))
    x = 0
    for p in pix:
        p.set_origin(x, 0); sheet.copy(p, p.irect); x += p.width + 10
    out = '%s_%03d-%03d.png' % (prefix, pair[0] + 1, pair[-1] + 1)
    sheet.save(out); print(out)
