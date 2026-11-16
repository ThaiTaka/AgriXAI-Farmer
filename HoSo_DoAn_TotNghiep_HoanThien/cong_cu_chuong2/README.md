# Công cụ tái cấu trúc Chương 2

Các script trong thư mục này tạo ra `BaoCao_DoAn_TotNghiep_Chuong2_Final.docx/.pdf` và
`DanhGia_TaiCauTruc_Chuong2.docx` từ tệp nguồn `BaoCao_DoAn_TotNghiep_HoanThien.docx`.
Tệp nguồn không bị sửa.

Cần: Python 3 có `lxml`, `python-docx`, `pymupdf`; WPS Office hoặc Microsoft Word đăng ký
COM `Word.Application` (trên máy thực hiện là WPS Office 12.1).

## Làm lại từ đầu

Chạy trong thư mục `HoSo_DoAn_TotNghiep_HoanThien` (PowerShell):

```powershell
# 1. Chèn nội dung mới của Chương 2 (ch2_content.py) vào bản sao tệp Word
python cong_cu_chuong2\build.py BaoCao_DoAn_TotNghiep_HoanThien.docx BaoCao_DoAn_TotNghiep_Chuong2_Final.docx

# 2. Cập nhật mục lục, số trang các danh mục và xuất PDF (dùng đường dẫn tuyệt đối)
cong_cu_chuong2\wps_update.ps1 -Docx "$PWD\BaoCao_DoAn_TotNghiep_Chuong2_Final.docx" -Pdf "$PWD\BaoCao_DoAn_TotNghiep_Chuong2_Final.pdf"

# 3. Kiểm định: đánh số mục, dẫn chiếu chéo, trích dẫn IEEE, mục lục, phần ngoài Chương 2
python cong_cu_chuong2\verify.py BaoCao_DoAn_TotNghiep_Chuong2_Final.docx --compare BaoCao_DoAn_TotNghiep_HoanThien.docx

# 4. So số trang trong mục lục và các danh mục với trang thật của PDF
python cong_cu_chuong2\check_pages.py BaoCao_DoAn_TotNghiep_Chuong2_Final.docx BaoCao_DoAn_TotNghiep_Chuong2_Final.pdf

# 5. Đo mức lấp đầy các trang của Chương 2 (trang PDF 20-30) để phát hiện khoảng trắng trước bảng
python cong_cu_chuong2\fill.py BaoCao_DoAn_TotNghiep_Chuong2_Final.pdf 20 30
```

Muốn sửa câu chữ của Chương 2: sửa trong `ch2_content.py` rồi chạy lại từ bước 1.
Bước 1 luôn dựng lại từ tệp nguồn nên không cộng dồn thay đổi.

## Các tệp

| Tệp | Vai trò |
|---|---|
| `ch2_content.py` | Toàn bộ nội dung mới của Chương 2 và ba câu sửa ở ngoài chương |
| `build.py` | Thay nội dung Chương 2 trong `word/document.xml`, giữ nguyên bảng, chú thích, bookmark |
| `wps_update.ps1` | Dựng lại mục lục, cập nhật số trang danh mục hình/bảng, lưu, xuất PDF |
| `verify.py`, `check_pages.py`, `fill.py` | Kiểm định nội dung, số trang, bố cục |
| `sheets.py` | Xuất trang PDF thành ảnh ghép đôi để soát bố cục |
| `make_report.py` | Sinh `DanhGia_TaiCauTruc_Chuong2.docx` từ `stats.json`, `verify_orig.json`, `verify_final.json` |
| `build_log.json` | Nguyên văn 57 khối của Chương 2 gốc đã bị thay thế |
| `dump.py`, `raw.py` | In cấu trúc và XML của tệp Word để tra cứu |

## Lưu ý

- Chỉ số phần tử trong `ch2_content.py` (300–377, 295, 437, 617) ứng với đúng tệp nguồn nói
  trên; `build.py` kiểm tra mốc và dừng nếu tệp nguồn khác.
- Ba bảng 2.1, 2.2, 2.4 không được ngắt giữa trang. Sau khi sửa câu chữ, chạy bước 5; nếu
  một trang lấp đầy dưới khoảng 90% thì bảng kế tiếp đã bị đẩy sang trang sau.
- Sau bước 2, WPS để lại các mục thư mục trong tệp ZIP của `.docx`; tệp bàn giao đã được gỡ
  các mục này.
