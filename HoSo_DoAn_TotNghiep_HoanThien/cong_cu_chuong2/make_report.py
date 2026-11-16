# -*- coding: utf-8 -*-
"""Sinh DanhGia_TaiCauTruc_Chuong2.docx - báo cáo đối chiếu trước/sau khi tái cấu trúc Chương 2.
usage: make_report.py <out.docx> <stats.json> <verify_orig.json> <verify_final.json>
"""
import sys, json, io
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

out, stats_p, vo_p, vf_p = sys.argv[1:5]
ST = json.load(io.open(stats_p, encoding='utf-8'))
VO = json.load(io.open(vo_p, encoding='utf-8'))
VF = json.load(io.open(vf_p, encoding='utf-8'))
o, n = ST['orig'], ST['new']
FONT = 'Times New Roman'
WIDTH = 16.0  # cm: A4 trừ lề trái 3 cm, phải 2 cm

def vn(x):
    """Số theo cách viết tiếng Việt: 15082 -> 15.082"""
    return '{:,}'.format(x).replace(',', '.')

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.left_margin, sec.right_margin, sec.top_margin, sec.bottom_margin = Cm(3.0), Cm(2.0), Cm(2.5), Cm(2.5)

def fix_font(style, size, bold=None, color=True):
    f = style.font
    f.name = FONT; f.size = Pt(size)
    if bold is not None: f.bold = bold
    if color: f.color.rgb = RGBColor(0, 0, 0)
    rpr = style.element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rpr.insert(0, rf)
    for a in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        rf.set(qn(a), FONT)
    for a in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
        if rf.get(qn(a)) is not None: del rf.attrib[qn(a)]

S = doc.styles
fix_font(S['Normal'], 12)
S['Normal'].paragraph_format.space_after = Pt(6)
S['Normal'].paragraph_format.line_spacing = 1.15
for name, size, before, after in (('Heading 1', 14, 14, 6), ('Heading 2', 12.5, 10, 4)):
    fix_font(S[name], size, bold=True)
    pf = S[name].paragraph_format
    pf.space_before, pf.space_after, pf.keep_with_next, pf.line_spacing = Pt(before), Pt(after), True, 1.15
S['Heading 2'].font.italic = False
fix_font(S['List Bullet'], 12)
S['List Bullet'].paragraph_format.space_after = Pt(3)

def para(text, bold=False, italic=False, align=None, size=None, after=None, style=None):
    p = doc.add_paragraph(style=style)
    segs = text.split('**')
    for i, s in enumerate(segs):
        if not s: continue
        r = p.add_run(s)
        r.bold = bold or (i % 2 == 1)
        r.italic = italic
        if size: r.font.size = Pt(size)
    if align is not None: p.alignment = align
    if after is not None: p.paragraph_format.space_after = Pt(after)
    return p

def h1(t): return doc.add_heading(t, level=1)
def h2(t): return doc.add_heading(t, level=2)
def bullet(t): return para(t, style='List Bullet')

def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), fill)
    tcPr.append(shd)

def table(headers, rows, widths, size=10.5):
    assert abs(sum(widths) - WIDTH) < 0.01, sum(widths)
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    tblPr = t._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblPr.append(lay)
    # lề trong ô
    mar = OxmlElement('w:tblCellMar')
    for side, v in (('top', 40), ('left', 85), ('bottom', 40), ('right', 85)):
        e = OxmlElement('w:' + side); e.set(qn('w:w'), str(v)); e.set(qn('w:type'), 'dxa'); mar.append(e)
    tblPr.append(mar)
    # bề rộng bảng và lưới cột (bố cục cố định dùng w:tblGrid, không dùng bề rộng từng ô)
    tblW = tblPr.find(qn('w:tblW'))
    if tblW is None:
        tblW = OxmlElement('w:tblW'); tblPr.append(tblW)
    tblW.set(qn('w:w'), str(int(round(WIDTH / 2.54 * 1440)))); tblW.set(qn('w:type'), 'dxa')
    for i, w in enumerate(widths):
        t.columns[i].width = Cm(w)
    def fill(row, vals, header=False):
        trPr = row._tr.get_or_add_trPr()
        cs = OxmlElement('w:cantSplit'); trPr.append(cs)
        if header:
            th = OxmlElement('w:tblHeader'); trPr.append(th)
        for i, (c, v) in enumerate(zip(row.cells, vals)):
            c.width = Cm(widths[i])
            c.text = ''
            lines = v if isinstance(v, (list, tuple)) else [v]
            for k, line in enumerate(lines):
                p = c.paragraphs[0] if k == 0 else c.add_paragraph()
                p.paragraph_format.space_after = Pt(2 if k < len(lines) - 1 else 0)
                p.paragraph_format.line_spacing = 1.0
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER if header else WD_ALIGN_PARAGRAPH.LEFT
                if header: p.paragraph_format.keep_with_next = True   # hàng tiêu đề đi cùng hàng dữ liệu đầu
                segs = str(line).split('**')
                for j, s in enumerate(segs):
                    if not s: continue
                    r = p.add_run(s)
                    r.font.size = Pt(size)
                    r.bold = header or (j % 2 == 1)
            if header: shade(c, 'D9D9D9')
    fill(t.rows[0], headers, header=True)
    for r in rows:
        fill(t.add_row(), r)
    para('', after=4)
    return t

# chân trang: số trang
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
for kind, txt in (('begin', None), (None, ' PAGE '), ('end', None)):
    r = fp.add_run()
    if kind:
        fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), kind); r._r.append(fc)
    else:
        it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = txt; r._r.append(it)
    r.font.size = Pt(11)

# =============================================================== TIÊU ĐỀ
para('BÁO CÁO ĐỐI CHIẾU TÁI CẤU TRÚC CHƯƠNG 2', bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=16, after=4)
para('Báo cáo đồ án tốt nghiệp AgriLog – Chương 2: Cơ sở lý thuyết và công nghệ sử dụng', align=WD_ALIGN_PARAGRAPH.CENTER, after=2)
para('Ngày thực hiện: 16/11/2026', align=WD_ALIGN_PARAGRAPH.CENTER, italic=True, after=12)

# =============================================================== 1
h1('1. Phạm vi và cách thực hiện')
table(['Hạng mục', 'Nội dung'], [
    ['Tệp nguồn (không bị sửa)', 'BaoCao_DoAn_TotNghiep_HoanThien.docx – 96 trang; Chương 2 ở trang 7–17.'],
    ['Tệp kết quả', 'BaoCao_DoAn_TotNghiep_Chuong2_Final.docx và .pdf – 95 trang; Chương 2 vẫn ở trang 7–17. Số trang in của Chương 3, 4, 5, Tài liệu tham khảo và Phụ lục không đổi; phần đầu ngắn đi một trang vì mục lục bớt 22 dòng.'],
    ['Phạm vi chỉnh sửa', 'Toàn bộ Chương 2; ba câu ở ngoài Chương 2 có dẫn chiếu tới mục cũ hoặc mô tả Chương 2 (mục 10 của báo cáo này); mục lục. Bốn bảng 2.1–2.4, danh mục tài liệu tham khảo và mọi nội dung khác của báo cáo được giữ nguyên.'],
    ['Nguyên tắc', 'Gộp cấu trúc, không gộp mất kiến thức. Không thêm tài liệu tham khảo, số liệu, DOI hay công nghệ. Mọi câu hoặc vế câu được thêm đều liệt kê ở mục 9 kèm căn cứ; chỗ thiếu căn cứ được nêu ở mục 14, không tự sửa.'],
    ['Trình tự', 'Đọc toàn văn Chương 2 và các Chương 1, 3, 4, 5; đánh giá từng tiểu mục theo ba trường hợp A (nên gộp), B (nên giữ), C (viết lại trước khi quyết định); viết lại; kiểm định tự động; soát bố cục trên PDF; rút gọn và sắp lại một lần nữa sau khi bản viết đầu dài hơn cần thiết và để lại khoảng trắng trước các bảng.'],
    ['Công cụ', 'Biên tập trực tiếp XML của bản sao tệp Word bằng script; cập nhật mục lục, số trang và xuất PDF bằng WPS Office 12.1 qua giao diện tự động hóa (xem mục 15). Script và nhật ký nằm trong thư mục cong_cu_chuong2.'],
], [4.0, 12.0])

# =============================================================== 2
h1('2. Kết quả tổng quát')
pct = lambda a, b: ('%+.1f%%' % (100.0 * (b - a) / a)).replace('.', ',')
table(['Chỉ tiêu của Chương 2', 'Trước', 'Sau', 'Ghi chú'], [
    ['Mục cấp 2', str(o['h2']), str(n['h2']), 'Giữ tám mục và thứ tự; sáu tên mục được đổi cho sát nội dung.'],
    ['Mục cấp 3', str(o['h3']), str(n['h3']), 'Chỉ giữ 2.7.1 và 2.7.2.'],
    ['Đoạn văn (kể cả gạch đầu dòng)', str(o['paras']), str(n['paras']), 'Bảy gạch đầu dòng của mục 2.8 thành hai đoạn văn.'],
    ['Đoạn có từ hai câu trở xuống', str(o['short']), str(n['short']), 'Sáu đoạn còn lại được liệt kê ở mục 13, câu 6.'],
    ['Số ký tự phần văn xuôi', vn(o['chars']), vn(n['chars']), pct(o['chars'], n['chars']) + '; phần tăng là câu nối và nhận xét (mục 9).'],
    ['Số từ phần văn xuôi', vn(o['words']), vn(n['words']), pct(o['words'], n['words'])],
    ['Bảng', str(o['tables']), str(n['tables']), 'Nội dung và chú thích giữ nguyên.'],
    ['Tài liệu được trích trong chương', str(o['ncites']), str(n['ncites']), 'Cùng 35 tài liệu, cùng thứ tự xuất hiện lần đầu.'],
    ['Số trang', '11', '11', 'Trang 7–17.'],
], [5.2, 1.9, 1.9, 7.0])
para('Chương không ngắn đi về số chữ. Sau khi đọc từng đoạn, nội dung gốc được đánh giá là đã cô đọng (mỗi tiểu mục chỉ một đoạn), nên phần dư thừa thực sự chỉ gồm các tiêu đề nhỏ và phần liệt kê thư viện trùng với Bảng 2.3. Phần chữ tăng thêm là các câu nối giữa những khái niệm trước đây đứng riêng và các nhận xét mà yêu cầu chỉnh sửa đòi hỏi ở mục 2.7.')

# =============================================================== 3
h1('3. Kết quả kiểm định tự động')
table(['Phép kiểm', 'Kết quả trên tệp kết quả'], [
    ['Trích dẫn IEEE', '38 tài liệu trong danh mục, 38 tài liệu được trích; thứ tự xuất hiện lần đầu vẫn đúng từ [1] đến [38] nên không phải đánh số lại. Không có trích dẫn trỏ tới số không tồn tại.'],
    ['Dẫn chiếu chéo', '125 dẫn chiếu dạng “mục x.y”, “Bảng x.y”, “Hình x.y”, “Chương x” trong toàn báo cáo: tất cả đều trỏ tới đối tượng tồn tại. Mọi bảng và hình đều được nhắc trong phần thuyết minh.'],
    ['Mục lục', '107 dòng (trước: 129), khớp với toàn bộ tiêu đề cấp 1–3. Số trang của 166 dòng trong mục lục, danh mục hình và danh mục bảng khớp với trang thực tế trong PDF.'],
    ['Nội dung ngoài Chương 2', '467 khối văn bản và bảng được so từng khối với tệp nguồn: chỉ ba khối khác, đều là thay đổi có chủ đích (mục 10).'],
    ['Bảng của Chương 2', 'Bốn bảng và bốn chú thích giống tệp nguồn từng ký tự.'],
    ['Cấu trúc tệp Word', 'Tệp qua được phép kiểm tra lược đồ của bộ công cụ biên tập; số đánh dấu (bookmark) mở và đóng khớp nhau.'],
    ['Bố cục trang', 'Mười trang đầu của chương lấp đầy 93–99% chiều cao vùng chữ, trang cuối 74% (bản gốc: 94–100%, trang cuối 79%). Không có tiêu đề nằm cuối trang tách khỏi nội dung.'],
], [4.0, 12.0])

# =============================================================== 4
h1('4. Danh sách mục trước và sau')
def fmt(hs):
    lines = []
    for k, num, t in hs:
        if k == 'h1': continue
        lines.append(('    ' if k == 'h3' else '**') + num + '. ' + t + ('' if k == 'h3' else '**'))
    return lines
old_l, new_l = fmt(VO['ch2_headings']), fmt(VF['ch2_headings'])
table(['Mục cũ (8 mục cấp 2, 24 mục cấp 3)', 'Mục mới (8 mục cấp 2, 2 mục cấp 3)'], [[old_l, new_l]], [8.0, 8.0], size=10)
doc.tables[-1].rows[1]._tr.get_or_add_trPr().remove(doc.tables[-1].rows[1]._tr.get_or_add_trPr().find(qn('w:cantSplit')))
para('Tên mục được đổi ở sáu chỗ: 2.1 thêm “và đặc thù nông hộ quy mô nhỏ”; 2.2 thêm “và đồng bộ dữ liệu”; 2.3 đổi “phân quyền” thành “kiểm soát truy cập” vì mục gồm cả vai trò lẫn quyền sở hữu; 2.4 thêm “tính toán số tiền” vì phần làm tròn không thuộc khái niệm giao dịch; 2.5 đổi “Công nghệ phần mềm và kiểm thử” thành tên nêu đủ ba nội dung; 2.6 ghi rõ “giao diện” và “nguồn dữ liệu”. Tên 2.7 và 2.8 chỉ sửa câu chữ.')
para('So với phương án gợi ý trong yêu cầu, ba tên mục được chọn khác đi và lý do như sau. Mục 2.3 không dùng “bảo mật dữ liệu” vì chương không bàn đến mã hóa hay bảo vệ đường truyền; mục 2.4 không dùng “dữ liệu tài chính” vì nội dung chỉ là biểu diễn và làm tròn số tiền; mục 2.6 không dùng “độ tin cậy của dữ liệu nông học” vì chính đoạn văn nói rõ gắn nguồn không đồng nghĩa nội dung đã được thẩm định.')

# =============================================================== 5
h1('5. Đối chiếu từng tiểu mục cũ với vị trí mới')
para('Trường hợp A: nội dung ngắn, một khái niệm, gắn trực tiếp với mục liền kề – gộp. Trường hợp B: nhiều đoạn, có bảng riêng, vai trò độc lập – giữ. Trường hợp C: đang là danh sách rời – viết lại rồi mới gộp.')
MAP = [
 ['2.1.1 Khái niệm và chức năng', 'A', '2.1, đoạn 1', 'Giữ đủ bốn ý: định nghĩa FMIS [3]; các chức năng thường gặp; phạm vi chức năng khác nhau và các đặc tính cần có [4]; FMIS trong hệ sinh thái phần mềm nông nghiệp [9]. Hai câu giữa của bản gốc được nối thành một câu.'],
 ['2.1.2 Đặc thù đối với nông hộ quy mô nhỏ', 'A', '2.1, đoạn 2', 'Giữ ba luận điểm [4], [5], [1] và ba định hướng của AgriLog V2. Thêm một câu dẫn sang mục 2.2 và 2.4.'],
 ['2.2.1 Ứng dụng di động trong điều kiện kết nối gián đoạn', 'A', '2.2, đoạn 1', 'Giữ các ý về thách thức của điện toán di động [6], local-first [7], hai thời điểm của thao tác ghi và cách hiểu trạng thái chưa đồng bộ. Thêm một câu nêu quan hệ giữa local-first và kiến trúc ưu tiên ngoại tuyến (offline-first) của đề tài.'],
 ['2.2.2 Mô hình nhất quán và định lý CAP', 'A', '2.2, đoạn 2', 'Giữ [10], [11], [12]. Phát biểu định lý CAP được viết lại cho đủ ba tính chất, khớp với Danh mục từ viết tắt.'],
 ['2.2.3 Xung đột và các chiến lược giải quyết', 'A', '2.2, đoạn 3 và 4', 'Giữ hai đoạn: Bayou [13]; last-write-wins và giới hạn của đồng hồ vật lý [14]; CRDT [15]; lựa chọn của AgriLog V2 cùng lý do. Thêm ký hiệu LWW và dẫn chiếu mục 3.3.'],
 ['2.3.1 Kiến trúc REST', 'A', '2.3, đoạn 1 (phần đầu)', 'Giữ định nghĩa, năm ràng buộc [16], ý nghĩa của tính không trạng thái và câu liên hệ AgriLog V2.'],
 ['2.3.2 Xác thực bằng JSON Web Token', 'A', '2.3, đoạn 1 (phần sau)', 'Giữ [17], [18] và câu liên hệ. Nối với REST bằng quan hệ: dịch vụ không trạng thái nên danh tính phải đi cùng từng yêu cầu.'],
 ['2.3.3 Kiểm soát truy cập theo vai trò', 'A', '2.3, đoạn 2', 'Giữ định nghĩa RBAC [19], lợi ích quản trị, hai vai trò của AgriLog V2. Thêm câu phân biệt xác thực với kiểm soát truy cập và lý do phải kết hợp kiểm tra quyền sở hữu.'],
 ['2.3.4 Cô lập dữ liệu nhiều người dùng và kiểm tra ở phía máy chủ', 'A', '2.3, đoạn 3', 'Giữ [20], [21] và các nguyên tắc: kiểm tra tại máy chủ, trên cả điểm cuối REST lẫn đường đồng bộ, định danh lấy từ ngữ cảnh xác thực. Nhận định dẫn từ [21] được diễn đạt lại (mục 14, điểm 5).'],
 ['2.4.1 Mô hình quan hệ và mô hình thực thể – liên kết', 'A', '2.4, đoạn 1', 'Giữ [22], [23] và câu về 16 bảng. Thêm vế nêu vì sao mô hình quan hệ hợp với dữ liệu sổ sách (lấy từ Bảng 2.4).'],
 ['2.4.2 Giao dịch và tính nguyên tử', 'A', '2.4, đoạn 2', 'Giữ nguyên ba câu: ACID [24], tính nguyên tử, ý nghĩa đối với lô đồng bộ.'],
 ['2.4.3 Biểu diễn số tiền và quy tắc làm tròn', 'A', '2.4, đoạn 3', 'Giữ nguyên: sai số số thực [25]; roundTiesToEven [26]; khác biệt giữa round của Python và Math.round của JavaScript; ví dụ lệch một đồng; yêu cầu quy tắc làm tròn thống nhất, kiểm thử ở hai phía. Thêm lý do về kiến trúc và dẫn chiếu mục 3.3.5.'],
 ['2.5.1 Quy trình phát triển phần mềm', 'A', '2.5, đoạn 1', 'Giữ nguyên: thác nước [27], xoắn ốc [8], cách tiếp cận lặp của đề tài.'],
 ['2.5.2 Đặc tả yêu cầu và mô hình hóa', 'A', '2.5, đoạn 2', 'Giữ đúng phạm vi của ISO/IEC/IEEE 29148 [28] và IEEE 1016 [29], hai loại biểu đồ UML. “Gồm các góc nhìn” sửa thành “trong đó có các góc nhìn” vì danh sách nêu ra không phải toàn bộ. Câu “Chương 3 áp dụng…” ghi rõ mục 3.1 và 3.2.'],
 ['2.5.3 Kiểm thử tự động và độ phủ', 'A', '2.5, đoạn 3', 'Giữ nguyên: ISO/IEC/IEEE 29119-1 [30], khái niệm độ phủ, kết quả thực nghiệm [31], cách báo cáo trình bày độ phủ.'],
 ['2.5.4 Đo hiệu năng và phân vị độ trễ', 'A', '2.5, đoạn 4', 'Giữ nguyên ba câu về phân vị p95, p99 [32] và điều kiện để kết quả kiểm tải có ý nghĩa.'],
 ['2.6.1 Khả năng tiếp cận giao diện', 'A', '2.6, đoạn 1', 'Giữ tiêu chí tương phản của WCAG 2.1 [33] và giới hạn “tự kiểm tra, không phải chứng nhận độc lập”. Thêm một câu mở nêu quan hệ giữa hình thức trình bày và nội dung.'],
 ['2.6.2 Minh bạch nguồn gốc dữ liệu nông học', 'A', '2.6, đoạn 2', 'Giữ nguyên bốn câu ([9], [34], [35], “Chưa có dữ liệu”, liên kết nguồn không đồng nghĩa đã thẩm định). Thêm dẫn chiếu mục 3.7.1.'],
 ['2.7.1 Tổng quan các hướng nghiên cứu và giải pháp', 'B', '2.7.1 (đổi tên)', 'Giữ tiểu mục. Phần mô tả bốn hướng giữ nguyên; ba hướng được thêm nhận xét về giới hạn hoặc giá trị tham khảo. Đoạn về ba cách ghi chép và Bảng 2.1 giữ nguyên.'],
 ['2.7.2 So sánh đối chiếu và điểm mới của đề tài', 'B', '2.7.2 (đổi tên)', 'Giữ tiểu mục. Mở đầu bằng nhận xét tổng hợp bốn hướng rồi mới dẫn Bảng 2.2; Bảng 2.2 giữ nguyên; đoạn kết đổi “điểm mới” thành “điểm khác biệt” và thêm một câu giới hạn phạm vi đóng góp.'],
 ['2.8.1 Nền tảng ứng dụng di động: React Native, WatermelonDB và SQLite', 'C', '2.8, đoạn 2', 'Ba gạch đầu dòng thành một đoạn văn. Giữ phiên bản, [36], hai đặc điểm của WatermelonDB, vai trò của react-native-keychain. Tên sáu thư viện phụ trợ còn lại chỉ để ở Bảng 2.3.'],
 ['2.8.2 Máy chủ và cơ sở dữ liệu: FastAPI, SQLAlchemy và PostgreSQL', 'C', '2.8, đoạn 3', 'Bốn gạch đầu dòng thành một đoạn văn, giữ đủ nội dung và các trích dẫn [16], [22], [24], [17].'],
 ['2.8.3 Trang quản trị web: Next.js, React và Tailwind CSS', 'A', '2.8, đoạn 4', 'Giữ nguyên ba câu; thêm vế liên hệ với nguyên tắc kiểm tra tại máy chủ ở mục 2.3.'],
 ['2.8.4 Tổng hợp và căn cứ lựa chọn công nghệ', 'A', '2.8, đoạn 5 và hai bảng', 'Giữ câu dẫn, Bảng 2.3 và Bảng 2.4; thêm vế cho biết Bảng 2.3 gồm cả công cụ kiểm thử và dữ liệu dùng chung.'],
]
table(['Tiểu mục cũ', 'TH', 'Vị trí mới', 'Xử lý nội dung'], MAP, [4.3, 0.9, 2.6, 8.2], size=10)

# =============================================================== 6
h1('6. Tiểu mục được giữ lại, tiểu mục được gộp và lý do')
h2('6.1. Hai tiểu mục được giữ')
table(['Tiểu mục', 'Lý do giữ'], [
    ['2.7.1 Các hướng nghiên cứu và giải pháp liên quan', 'Sáu đoạn văn và Bảng 2.1; là phần khảo sát, có thể tra cứu riêng theo từng hướng nghiên cứu. Nếu gộp, mục 2.7 thành một khối dài hơn hai trang có hai bảng xen giữa.'],
    ['2.7.2 Đối chiếu và phạm vi đóng góp của đề tài', 'Vai trò khác với 2.7.1: không mô tả công trình mà định vị đề tài so với chúng; có Bảng 2.2 riêng và là nơi các chương sau có thể dẫn chiếu khi nói về đóng góp.'],
], [5.0, 11.0])
h2('6.2. Hai mươi hai tiểu mục được gộp')
para('Mười tám tiểu mục của các mục 2.1–2.6 đều chỉ có một đoạn văn (riêng 2.2.3 có hai đoạn) và mỗi tiểu mục giải thích một khái niệm gắn trực tiếp với tiểu mục liền kề: REST dẫn tới JWT, JWT dẫn tới RBAC, RBAC dẫn tới kiểm tra quyền sở hữu. Tiêu đề cấp 3 ở đây cắt đứt đúng những quan hệ cần được nói ra. Bốn tiểu mục của mục 2.8 chia theo thành phần hệ thống nhưng mỗi nhóm chỉ dài một đoạn; tên thành phần được đưa vào câu mở đầu của từng đoạn nên vẫn tra cứu được.')
para('Mục 2.2 là mục lý thuyết trọng tâm và sau khi gộp dài hơn một trang. Phương án giữ hai tiểu mục ở đây đã được cân nhắc nhưng không chọn, vì bốn đoạn của mục là một chuỗi lập luận liên tục: kết nối gián đoạn, lưu cục bộ, cái giá về nhất quán, xung đột, lựa chọn của đề tài.')

# =============================================================== 7
h1('7. Nội dung đã chuyển vị trí')
table(['Nội dung', 'Vị trí cũ', 'Vị trí mới', 'Lý do'], [
    ['Phần JSON Web Token', 'Tiểu mục riêng 2.3.2', 'Nối liền sau phần REST trong cùng một đoạn', 'JWT được trình bày như hệ quả của ràng buộc không trạng thái.'],
    ['Câu dẫn Bảng 2.2', 'Câu đầu của 2.7.2', 'Cuối đoạn mở đầu của 2.7.2, sau nhận xét tổng hợp', 'Người đọc biết bảng so sánh điều gì trước khi xem bảng.'],
    ['Căn cứ “dữ liệu sổ sách có quan hệ chặt”', 'Chỉ có ở Bảng 2.4', 'Thêm một vế ở mục 2.4, đoạn 1 (Bảng 2.4 không đổi)', 'Nối mô hình quan hệ với bài toán của đề tài ngay ở phần lý thuyết.'],
    ['Căn cứ “dùng chung ngôn ngữ và kiểu dữ liệu với trang quản trị”', 'Chỉ có ở Bảng 2.4', 'Thêm một vế ở mục 2.8, đoạn 2 (Bảng 2.4 không đổi)', 'Nêu lý do chọn React Native ngay khi giới thiệu.'],
    ['“Điều hướng dùng React Navigation 7”', 'Câu cuối gạch đầu dòng React Native', 'Câu đầu của đoạn về ứng dụng di động', 'Gom các thành phần của ứng dụng vào một câu.'],
    ['PyJWT, bcrypt, fpdf2', 'Gạch đầu dòng riêng', 'Câu cuối của đoạn về máy chủ', 'Cùng thuộc phía máy chủ.'],
], [4.2, 3.2, 4.3, 4.3], size=10)
para('Thứ tự tám mục 2.1–2.8, thứ tự bốn bảng và thứ tự xuất hiện lần đầu của các trích dẫn không thay đổi.')

# =============================================================== 8
h1('8. Nội dung bị loại bỏ, rút gọn và nội dung đã cân nhắc nhưng giữ')
h2('8.1. Đã loại bỏ hoặc rút gọn')
table(['Nội dung', 'Căn cứ'], [
    ['22 tiêu đề cấp 3', 'Mỗi tiêu đề chỉ đứng trước một đoạn văn; xem mục 6.2.'],
    ['Tên sáu thư viện phụ trợ trong phần văn xuôi của mục 2.8: react-native-image-picker, @dr.pogodin/react-native-fs, react-native-webview, react-native-html-to-pdf, react-native-share, react-native-svg', 'Trùng với hai hàng “Phiên và tệp”, “Báo cáo trên máy” của Bảng 2.3, nơi tên và phiên bản vẫn đầy đủ. Phần văn xuôi chỉ còn nêu công dụng và dẫn tới Bảng 2.3; riêng react-native-keychain được giữ tên vì liên quan đến bảo mật mã đăng nhập.'],
    ['Hình thức danh sách gạch đầu dòng in đậm tên công nghệ (7 gạch)', 'Yêu cầu không trình bày theo kiểu liệt kê công nghệ; nội dung của các gạch đầu dòng được giữ trong hai đoạn văn.'],
    ['Từ nối “Bên cạnh đó” (2.1.2), “Do đó” (2.4.3)', 'Không còn cần khi các câu đã có quan hệ lập luận rõ.'],
], [7.0, 9.0])
para('Ngoài bốn mục trên, không có luận điểm, số liệu, ví dụ, trích dẫn hay bảng nào của Chương 2 bị bỏ.')
h2('8.2. Đã cân nhắc loại bỏ nhưng giữ lại')
table(['Nội dung', 'Vì sao cân nhắc', 'Vì sao giữ'], [
    ['Mô hình thác nước [27]', 'Kiến thức phổ thông; đề tài không dùng mô hình này.', 'Chỉ một vế câu, làm đối chứng cho lựa chọn cách tiếp cận lặp. Nếu bỏ, [27] không còn được trích, phải xóa khỏi danh mục và đánh số lại [28]–[38] trong cả Chương 3, 4, 5.'],
    ['CRDT [15]', 'Không được áp dụng trong đề tài.', 'Mục 3.3.4 dẫn lại CRDT như hướng thay thế cho last-write-wins; bỏ ở Chương 2 thì câu đó mất cơ sở.'],
    ['Phân vị p99', 'Báo cáo chỉ đo và trình bày p95.', 'Chỉ là một ví dụ trong câu định nghĩa theo [32].'],
    ['Đoạn mô tả trùng giữa phần lý thuyết (2.1, 2.2) và 2.7.1 đối với [3], [4], [5], [7], [13], [15]', 'Cùng một công trình được nhắc hai lần.', 'Hai lần nhắc có vai trò khác nhau: phần lý thuyết dùng khái niệm, mục 2.7.1 nêu tên tác giả và đánh giá công trình. Mỗi lần nhắc ở 2.7.1 chỉ dài một câu.'],
    ['Bảng 2.3', 'Lặp một phần với phần văn xuôi của mục 2.8.', 'Là nơi duy nhất ghi đủ phiên bản; mục 4.1.1 dẫn chiếu tới bảng này.'],
    ['Bảng 2.4', 'Có thể chuyển hết thành văn xuôi.', 'Là nơi duy nhất nêu phương án thay thế của từng lựa chọn. Phần văn xuôi mới không lặp lại cột “Phương án thay thế”.'],
], [3.6, 4.4, 8.0], size=10)

# =============================================================== 9
h1('9. Câu và vế câu được thêm')
para('Các phần thêm đều là câu nối, câu dẫn chiếu hoặc nhận xét rút ra từ nội dung đã có trong báo cáo. Bảng dưới đây liệt kê đầy đủ để nhóm rà lại; phần nào không phù hợp có thể xóa mà không ảnh hưởng đến trích dẫn hay đánh số.')
table(['Mục', 'Phần được thêm', 'Căn cứ'], [
    ['2.1', '“Định hướng thứ hai là lý do của kiến trúc ưu tiên ngoại tuyến ở mục 2.2; định hướng thứ ba đặt ra yêu cầu về mô hình dữ liệu và giao dịch ở mục 2.4.”', 'Câu chuyển tiếp giữa các mục của chương.'],
    ['2.2', '“Kiến trúc ưu tiên ngoại tuyến (offline-first) của đề tài vận dụng nguyên lý này: ứng dụng đọc và ghi trên cơ sở dữ liệu cục bộ, việc trao đổi với máy chủ diễn ra khi có kết nối.”', 'Mục 1.2.1 và 3.3.1 của báo cáo.'],
    ['2.2', 'Phát biểu đủ ba tính chất của định lý CAP; vế mở “Việc ghi được khi mất kết nối có cái giá về tính nhất quán”.', 'Nội dung của [10]; Danh mục từ viết tắt.'],
    ['2.2', '“và hệ thống phải quyết định thay đổi nào được giữ lại”; “(LWW – bản ghi sau cùng thắng)”; “giao thức đồng bộ và các tình huống xung đột được thiết kế ở mục 3.3”.', 'Danh mục từ viết tắt; mục 3.3.'],
    ['2.3', '“kể cả danh tính người gọi”; “là cơ chế xác thực phù hợp với ràng buộc đó”.', 'Hệ quả trực tiếp của ràng buộc không trạng thái đã nêu.'],
    ['2.3', '“Xác thực chỉ cho biết người gọi là ai; việc người đó được phép làm gì thuộc về kiểm soát truy cập.”; “do vai trò không phân biệt được dữ liệu của nông hộ này với dữ liệu của nông hộ khác”.', 'Mục 3.5.1: RBAC kết hợp kiểm tra quyền sở hữu trên từng bản ghi.'],
    ['2.3', '“Yêu cầu về quyền sở hữu xuất phát từ đặc điểm của…”; “vai trò và” trong câu “vai trò và quyền sở hữu phải được kiểm tra tại máy chủ”; “(mục 3.5)”.', 'Mục 3.5.1.'],
    ['2.4', '“mô hình này phù hợp với dữ liệu sổ sách của nông hộ, vốn gồm nhiều loại bản ghi có quan hệ chặt với nhau”; “Để đi từ nghiệp vụ đến các bảng”.', 'Bảng 2.4, hàng “Cơ sở dữ liệu”.'],
    ['2.4', '“Với dữ liệu tiền tệ, tính đúng đắn còn phụ thuộc vào cách biểu diễn và làm tròn.”; “AgriLog V2 viết các quy tắc nghiệp vụ cần chạy ngoại tuyến ở cả máy chủ và ứng dụng di động”; dẫn chiếu mục 3.3.5.', 'Mục 1.4.2, 3.3.5, 4.2.2.'],
    ['2.5', 'Các cụm dẫn “Về quy trình phát triển”, “Ở bước xác định yêu cầu”, “Ở bước thiết kế”, “Khi đo hiệu năng”; “khi đặc tả yêu cầu (mục 3.1) và mô hình hóa các luồng xử lý (mục 3.2)”.', 'Sắp theo tiến trình phát triển; mục 3.1, 3.2.'],
    ['2.6', '“Thông tin mà ứng dụng cung cấp chỉ có giá trị sử dụng khi người dùng đọc được và biết nó dựa trên căn cứ nào; yêu cầu thứ nhất thuộc về hình thức trình bày, yêu cầu thứ hai thuộc về nội dung.”; “Cả hai yêu cầu được cụ thể hóa thành nguyên tắc thiết kế giao diện ở mục 3.7.1.”', 'Mục 3.7.1, nguyên tắc 3 và 4; mục tiêu M5, M6.'],
    ['2.7.1', 'Hướng 1: “để đề tài xác định phạm vi các phân hệ”. Hướng 2: “Đây là căn cứ cho định hướng giữ hệ thống đơn giản, tập trung vào chức năng cốt lõi.” Hướng 3: “Hai công trình tiếp cận ở tầng hệ sinh thái và hạ tầng; đề tài tiếp nhận từ đó hai ràng buộc thiết kế: thống nhất dữ liệu dùng chung giữa các thành phần và không giả định kết nối luôn sẵn có.” Hướng 4: “cho kiến trúc ở mục 2.2”.', 'Mục 2.1, 2.2, 2.6 của chính chương này; nhan đề và phạm vi của [9], [1].'],
    ['2.7.2', '“Đặt bốn hướng cạnh nhau, có thể thấy trong phạm vi các công trình được khảo sát, nhóm FMIS… Bài toán của đề tài nằm ở phần giao của hai nhóm này.”', 'Tổng hợp các giới hạn đã nêu ở 2.7.1 và các hàng “Vận hành ngoại tuyến”, “Nghiệp vụ vật tư, chi phí” của Bảng 2.2.'],
    ['2.7.2', '“Đóng góp này mang tính vận dụng: đề tài không đề xuất thuật toán đồng bộ mới mà áp dụng các nguyên lý đã có vào một bài toán nghiệp vụ cụ thể.”', 'Mục 3.3.4: đề tài dùng last-write-wins, chưa áp dụng CRDT. Xem mục 14, điểm 8.'],
    ['2.8', '“và dùng chung ngôn ngữ, kiểu dữ liệu với trang quản trị”; “(ORM)”; “đúng với nguyên tắc kiểm tra tại máy chủ ở mục 2.3”; “gồm cả công cụ kiểm thử và dữ liệu dùng chung”.', 'Bảng 2.4; Danh mục từ viết tắt; Bảng 2.3.'],
], [1.2, 9.3, 5.5], size=10)

# =============================================================== 10
h1('10. Thay đổi ở ngoài Chương 2')
table(['Vị trí', 'Trước', 'Sau', 'Lý do'], [
    ['Mục 1.5, dòng mô tả Chương 2', '…kiến trúc ưu tiên ngoại tuyến, dịch vụ REST, phân quyền, cơ sở dữ liệu, công nghệ phần mềm và kiểm thử; khảo sát…', '…kiến trúc ưu tiên ngoại tuyến và đồng bộ dữ liệu, dịch vụ REST và kiểm soát truy cập, cơ sở dữ liệu và giao dịch, quy trình phát triển và kiểm thử, khả năng tiếp cận và minh bạch nguồn dữ liệu nông học; khảo sát…', 'Khớp với tên mục mới; bổ sung mục 2.6 vốn bị bỏ sót trong câu cũ.'],
    ['Mục 3.3.4', '…last-write-wins đã nêu ở mục 2.2.3…', '…last-write-wins đã nêu ở mục 2.2…', 'Tiểu mục 2.2.3 không còn.'],
    ['Mục 4.5.2', '…đã được nêu ở mục 2.5.3 [31].', '…đã được nêu ở mục 2.5 [31].', 'Tiểu mục 2.5.3 không còn.'],
], [2.7, 4.3, 5.6, 3.4], size=10)
para('Dẫn chiếu “Bảng 2.3” ở mục 4.1.1 vẫn đúng vì số bảng không đổi. Dẫn chiếu “mục 2.2” ở mục 2.8 vẫn đúng.')

# =============================================================== 11
h1('11. Trích dẫn IEEE theo từng mục')
co, cf = VO['ch2_cites'], VF['ch2_cites']
fmtc = lambda L: ', '.join('[%d]' % c for c in L)
rows = []
for k in sorted(co):
    same = co[k] == cf.get(k)
    rows.append([k, fmtc(co[k]), fmtc(cf.get(k, [])), 'Không đổi' if same else 'CÓ THAY ĐỔI'])
table(['Mục', 'Thứ tự trích dẫn trước', 'Thứ tự trích dẫn sau', 'Kết quả'], rows, [1.4, 6.0, 6.0, 2.6], size=10)
para('Các trích dẫn là số gõ tay, không phải trường EndNote hay trường trích dẫn của Word, nên không có trường động nào cần bảo toàn. Mỗi trích dẫn vẫn đứng ngay sau luận điểm mà nó hỗ trợ trong bản gốc; riêng [26] được giữ ngay sau vế về chuẩn IEEE 754, trước nhận định về hai hàm làm tròn của Python và JavaScript, để không gán cho tiêu chuẩn điều mà nó không nói. Thông tin thư mục của 38 tài liệu không bị sửa.')

# =============================================================== 12
h1('12. Liên kết giữa Chương 2 và các chương khác')
table(['Mục của Chương 2', 'Nơi được dùng ở các chương khác', 'Nhận xét'], [
    ['2.1 FMIS và nông hộ nhỏ', 'Mục 1.1 (bối cảnh); mục 3.1 (yêu cầu chức năng theo phân hệ); Bảng 2.2.', 'Cần thiết.'],
    ['2.2 Ưu tiên ngoại tuyến, CAP, xung đột', 'Mục 3.3.1, 3.3.3, 3.3.4 (dẫn lại [14], [15] và dẫn chiếu mục 2.2); mục 3.7.1 nguyên tắc 2; mục 4.2.1, 4.5.3; mục tiêu M1–M3.', 'Cần thiết; là nền của phần thiết kế đồng bộ.'],
    ['2.3 REST, JWT, RBAC, cô lập dữ liệu', 'Mục 3.3.3 ([16]); mục 3.5.1 ([19], [21]); mục 3.5.2 ([20], [17]); mục 3.6.2; mục 4.5.5 (lỗi vượt quyền qua đường đồng bộ); mục tiêu M4.', 'Cần thiết.'],
    ['2.4 Mô hình quan hệ, ACID, làm tròn', 'Mục 3.4.1 ([22], [23]); mục 3.3.3 và 4.5.5 ([24]); mục 3.3.5 và 4.2.2 ([26]).', 'Cần thiết; phần làm tròn gắn với lỗi lệch một đồng đã gặp ở mục 4.2.2.'],
    ['2.5 Quy trình, yêu cầu, kiểm thử, hiệu năng', 'Mục 1.4.2 ([8]); mục 3.1.3 ([28]); mục 3.2.1 ([29]); mục 4.5.1 ([30]); mục 4.5.2 ([31], dẫn chiếu mục 2.5); mục 4.5.4 ([32]).', 'Cần thiết, trừ mô hình thác nước chỉ làm đối chứng (mục 8.2).'],
    ['2.6 Tương phản màu, nguồn dữ liệu nông học', 'Mục 3.7.1 nguyên tắc 3 và 4 ([33]); mục 4.3.4, 4.3.8, 4.4.5; mục tiêu M5, M6.', 'Cần thiết.'],
    ['2.7 Công trình liên quan', 'Mục 1.1; mục 5.1 và Bảng 5.1 (đối chiếu mục tiêu).', 'Cần thiết để định vị đề tài.'],
    ['2.8 Công nghệ', 'Mục 3.3.2 (kiến trúc phân tầng); mục 4.1.1 (dẫn Bảng 2.3); mục 4.2.', 'Cần thiết.'],
], [4.2, 8.6, 3.2], size=10)
para('Không có mục nào của Chương 2 không được các chương sau sử dụng. Chiều ngược lại cũng được kiểm tra: mọi tài liệu mà Chương 3–5 trích (trừ [37], [38] ở mục 5.3.2) đều đã được giới thiệu ở Chương 1 hoặc Chương 2.')

# =============================================================== 13
h1('13. Tự đánh giá sau chỉnh sửa')
table(['Câu hỏi', 'Đánh giá'], [
    ['1. Các mục lớn có bao quát đúng nội dung không?', 'Có. Sáu tên mục được đổi để nêu đủ nội dung bên trong (mục 4).'],
    ['2. Số tiêu đề nhỏ đã giảm hợp lý chưa?', 'Từ 24 còn 2. Các tiểu mục được gộp đều chỉ có một đoạn, riêng 2.2.3 có hai đoạn và 2.8.1, 2.8.2 là danh sách.'],
    ['3. Tiểu mục được giữ có đủ lý do tồn tại không?', 'Có: mỗi tiểu mục có bảng riêng và vai trò riêng (mục 6.1).'],
    ['4. Các đoạn văn đã liên kết tự nhiên chưa?', 'Các mục 2.2, 2.3, 2.4 nay là chuỗi lập luận. Mục 2.5 yếu hơn: bốn đoạn về bốn chủ đề chỉ được nối bằng trình tự của tiến trình phát triển.'],
    ['5. Còn cảm giác liệt kê kiến thức rời rạc không?', 'Giảm rõ. Còn hai chỗ có tính liệt kê và được giữ có chủ ý: bốn hướng nghiên cứu đánh số ở 2.7.1 (để tra cứu) và đoạn về máy chủ ở 2.8 (đi lần lượt qua bốn nhóm thư viện).'],
    ['6. Có đoạn quá ngắn hoặc lặp ý không?', 'Đoạn từ hai câu trở xuống giảm từ 14 còn 6: câu giới thiệu chương, đoạn lựa chọn của AgriLog V2 ở 2.2 (hai câu dài), câu dẫn bốn hướng và đoạn về ba cách ghi chép ở 2.7.1, câu giới thiệu và đoạn dẫn hai bảng ở 2.8. Về lặp ý, xem hàng thứ tư của bảng ở mục 8.2.'],
    ['7. Có nội dung kỹ thuật nào bị mất không?', 'Không. Phần duy nhất rời khỏi văn xuôi là tên sáu thư viện phụ trợ, vẫn còn ở Bảng 2.3.'],
    ['8. Có nội dung nào bị rút ngắn quá mức không?', 'Không; phần văn xuôi dài hơn bản gốc 18,8%.'],
    ['9. Các trích dẫn IEEE còn chính xác không?', 'Có (mục 11). Một nhận định được diễn đạt lại và cần nhóm xác nhận: [21] (mục 14, điểm 5).'],
    ['10. Chương 2 có tạo nền cho Chương 3 và 4 không?', 'Có (mục 12). Chương 2 nay có thêm dẫn chiếu xuôi tới các mục 3.1, 3.2, 3.3, 3.3.5, 3.5, 3.7.1.'],
], [5.6, 10.4], size=10.5)

# =============================================================== 14
h1('14. Vấn đề chưa xử lý được hoặc cần nhóm quyết định')
table(['#', 'Vấn đề', 'Tình trạng và đề nghị'], [
    ['1', 'Quyết định 1972/QĐ-UBND [34] ở mục 2.6', 'Đã tìm lại trong mã nguồn nhánh V2.1 (shared, backend, mobile, docs, web-admin): không có tệp nào nhắc tới số quyết định này. Quyết định 254/QĐ-TT-CCN [35] thì có trong shared/data/care_protocols.json. Câu văn được giữ nguyên vì không đủ căn cứ để viết thay; nhóm cần chỉ ra tệp dữ liệu có nguồn [34] hoặc sửa câu. Vấn đề này đã được nêu ở báo cáo rà soát ngày 14/11/2026.'],
    ['2', 'Hàm round của Python và Math.round của JavaScript (mục 2.4)', 'Đúng về kỹ thuật nhưng không có tài liệu tham khảo; [26] chỉ hỗ trợ phần roundTiesToEven. Chưa thêm tài liệu của Python và ECMAScript vì chưa xác minh thông tin thư mục.'],
    ['3', 'UML (mục 2.5)', 'Không có tài liệu tham khảo riêng; câu về UML đứng sau [29] nhưng IEEE 1016 không phải đặc tả UML. Nếu hội đồng yêu cầu, bổ sung đặc tả UML của OMG rồi đánh số lại.'],
    ['4', '“trong thực tế nông hộ thường dùng một trong ba cách ghi chép” (mục 2.7.1)', 'Không có nguồn khảo sát. Câu được giữ nguyên; nên thêm nguồn hoặc đổi thành nhận định của nhóm.'],
    ['5', 'Nhận định dẫn từ [21] (mục 2.3)', 'Bản gốc viết “kiểm tra không nhất quán giữa các đường truy cập”; bản mới viết “sự không nhất quán giữa phần kiểm tra ở ứng dụng và phần kiểm tra ở máy chủ”, sát với nhan đề bài báo (Web-to-mobile inconsistencies). Thay đổi này dựa trên nhan đề và hiểu biết chung về bài báo, chưa đối chiếu lại toàn văn; nhóm cần đọc lại [21] để xác nhận.'],
    ['6', '[27] W. W. Royce, 1970', 'Không có DOI, chưa tra được bản gốc (tồn từ lần rà soát trước).'],
    ['7', '“điểm mới” đổi thành “điểm khác biệt” (mục 2.7.2)', 'Đổi vì báo cáo không có phép thử so sánh trực tiếp với công trình khác. Nếu mẫu của Khoa yêu cầu nêu “điểm mới”, nhóm cân nhắc dùng lại từ cũ.'],
    ['8', 'Câu thêm “đề tài không đề xuất thuật toán đồng bộ mới…” (mục 2.7.2)', 'Là nhận định về phạm vi đóng góp do người biên tập thêm, phù hợp với mục 3.3.4. Nhóm xác nhận hoặc xóa.'],
    ['9', 'Phiên bản sản phẩm V2.1 và V2.2', 'Mục 2.8 và Bảng 2.3 mô tả V2.1. Mâu thuẫn với nhánh V2.2 đã nêu ở báo cáo rà soát trước vẫn còn nguyên và nằm ngoài phạm vi lần này.'],
], [0.7, 4.8, 10.5], size=10)

# =============================================================== 15
h1('15. Ghi chú kỹ thuật về tệp Word và PDF')
bullet('Trên máy thực hiện, giao diện tự động hóa “Word.Application” trỏ tới WPS Office 12.1 chứ không phải Microsoft Word, dù máy có cài cả hai. Tệp nguồn và PDF của lần rà soát trước cũng do WPS lưu. Mục lục, số trang và PDF lần này vì vậy được tạo bằng WPS; chưa mở kiểm tra bằng Microsoft Word.')
bullet('Khi mở tệp .docx bằng Microsoft Word, vị trí ngắt dòng có thể lệch đôi chút. Bảng 2.1 đang nằm sát cuối trang 13; nếu lệch một dòng, bảng sẽ nhảy sang trang 14 và để lại khoảng trống khoảng một phần ba trang. Khi đó cần bấm chuột phải vào mục lục, chọn Update Field, Update entire table.')
bullet('Mục lục chính được dựng lại toàn bộ. Danh mục hình ảnh và Danh mục bảng biểu chỉ cập nhật số trang, để giữ phần chữ đã được làm sạch ở lần rà soát trước (WPS và Word chèn hai dấu cách trước dấu “–” khi dựng lại danh mục).')
bullet('Các dẫn chiếu trong câu văn (“mục 3.3”, “Bảng 2.3”) vẫn là chữ gõ tay. Khi thêm hoặc bớt mục, bảng, cần rà lại; script verify.py trong thư mục cong_cu_chuong2 làm việc này tự động.')
bullet('Chương 2 có bốn bảng, trong đó ba bảng không được phép ngắt giữa trang. Vị trí đoạn tổng hợp bốn hướng (đầu mục 2.7.2) và độ dài một số câu đã được chọn có tính đến việc này, để không còn khoảng trắng lớn trước Bảng 2.1 và Bảng 2.2.')
bullet('Thư mục cong_cu_chuong2 chứa: ch2_content.py (toàn bộ nội dung mới của Chương 2), build.py (chèn nội dung vào bản sao tệp Word), wps_update.ps1 (cập nhật mục lục, xuất PDF), verify.py và check_pages.py (kiểm định), make_report.py (sinh báo cáo này), build_log.json (nguyên văn 57 khối đã bị thay thế).')

doc.save(out)
print('saved', out)
