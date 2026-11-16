"""Đo mức lấp đầy từng trang (vị trí đáy của nội dung cuối cùng, không tính chân trang). usage: fill.py <pdf> <first> <last>"""
import sys, pymupdf
d = pymupdf.open(sys.argv[1]); a, b = int(sys.argv[2]), int(sys.argv[3])
for i in range(a - 1, b):
    p = d[i]; H = p.rect.height
    top, bot = 70.9, H - 70.9          # lề trên/dưới 2,5 cm
    ys = [blk[3] for blk in p.get_text('blocks') if blk[3] < bot + 2 and blk[1] > top - 30]
    for dr in p.get_drawings():
        r = dr['rect']
        if r.y1 < bot + 2 and r.y0 > top: ys.append(r.y1)
    last = max(ys) if ys else top
    print('trang %d: lap day %3.0f%%' % (i + 1, 100 * (last - top) / (bot - top)))
