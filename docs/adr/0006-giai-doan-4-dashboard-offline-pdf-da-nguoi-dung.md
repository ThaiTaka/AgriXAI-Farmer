# ADR 0006 — Giai đoạn 4: dashboard nông hộ, sẵn sàng offline, xuất PDF, đồng bộ nhiều tài khoản

- **Ngày:** 2026-09-14
- **Trạng thái:** Đã áp dụng
- **Liên quan:** [ADR 0005](0005-giai-doan-3-tu-van-cham-soc-kho-thu-chi.md) (kho, thu-chi, quy trình), [ADR 0002](0002-giai-doan-1.md) (giao thức đồng bộ)

## Bối cảnh

Giai đoạn 3 để lại một app có đủ nghiệp vụ nhưng trang chủ chỉ là danh sách công cụ. Giai
đoạn 4 phải (1) cho nông hộ thấy tình hình của mình trong 3 con số ngay khi mở app; (2) chịu
được lỗi từng màn hình và mất mạng mà không mất dữ liệu; (3) xuất báo cáo thu – chi ra PDF
để gửi đi; (4) chạy được với nhiều tài khoản trên cùng một server và xử lý trường hợp một
tài khoản dùng hai thiết bị; (5) có bản web tương ứng cho cán bộ quản lý. Vẫn giữ ràng
buộc "không bịa dữ liệu": mọi con số trên dashboard và trong PDF đều là tổng từ bảng ghi
thật của nông hộ.

## Quyết định

### 1. Dashboard tính từ dữ liệu cục bộ, cùng công thức với server

Ba thẻ trên trang chủ là ba hàm thuần trong `mobile/src/domain/dashboard.ts`, được viết
lại y hệt trong `backend/app/services/dashboard_service.py` và có test so khớp:

| Thẻ | Công thức | Nguồn |
|---|---|---|
| Tồn kho | Σ(tồn từng loại × giá nhập bình quân) — tái dùng `stockSummary` của Giai đoạn 3 | `warehouse_in`, `warehouse_out` |
| Tháng này | Σthu − Σchi của tháng hiện tại theo giờ Việt Nam; âm thì chữ đỏ và nhãn "Lỗ" | `income`, `expense` |
| Công việc | số việc **chưa tick** trong giai đoạn hiện tại của từng lô đang canh tác | quy trình chăm sóc + `tasks_history` |

Giai đoạn hiện tại của lô suy ra từ ngày trồng (như tab Chăm sóc); lô không có quy trình
("Chưa có dữ liệu") không góp việc nào — không đoán.

Web-admin đọc cùng ba con số từ `GET /dashboard/summary`; quản trị viên chọn nông hộ qua
`owner_id`, nông hộ tự xem của mình (gửi `owner_id` của người khác nhận 404 để không lộ id).

### 2. Error boundary theo màn hình + bảng `error_logs` chỉ ở máy

`ScreenErrorBoundary` bọc **từng** màn hình qua `screenLayout` của react-navigation, cả
stack lẫn tab. Một màn hình lỗi chỉ hiện thẻ "Oops, điều gì đó sai rồi" ở đúng chỗ đó;
các tab khác vẫn dùng bình thường. "Thử lại" remount màn hình bằng `key`; "Báo lỗi" đánh
dấu bản ghi rồi gửi ngay nếu có mạng.

Lỗi luôn được ghi vào bảng `error_logs` (schema v6) *trước* khi hỏi người dùng: nếu mất
mạng, bản ghi chờ và được đẩy lên `POST /logs` sau lần đồng bộ thành công kế tiếp. Bảng này
**không** nằm trong giao thức sync (`LOCAL_ONLY_TABLES`) vì server không cần đẩy log ngược
về máy; `test_schema_parity.py` được nới đúng một bảng này. Báo lỗi chỉ gửi thông điệp lỗi,
stack, tên màn hình, phiên bản app, nền tảng và thời điểm — không gửi dữ liệu nông hộ.

### 3. Trạng thái mạng suy ra từ kết quả đồng bộ, không từ NetInfo

App không thêm thư viện dò mạng. `runSync` phân loại lỗi: lỗi mạng → `offline`, 401 →
đăng xuất, còn lại → `error`. `OfflineBanner` đọc trạng thái này: màu hổ phách
`#F59E0B` "Chế độ offline — thay đổi sẽ lưu khi online" (tự ẩn sau 8 s, có nút ẩn), xanh
"Đang đồng bộ…" rồi "Cập nhật lúc HH:MM" (tự ẩn sau 3 s). Lý do: dò mạng ở lớp OS hay báo
"có mạng" trong khi server không tới được; kết quả của chính request đồng bộ là tín hiệu
đúng nhất với người dùng.

Trạng thái theo bảng ở Cài đặt (`pendingByTable` đếm `_status != 'synced'`) và nhãn
"Offline · N phiếu chưa đồng bộ" trên bảng tồn, "Lưu offline — sẽ đồng bộ" trên kế hoạch
vừa lưu dùng cùng nguồn.

### 4. PDF: tạo tại chỗ trên máy, tạo ở server cho web — cùng một nội dung

- **Mobile:** `react-native-html-to-pdf` dựng HTML A4 (595×842 pt, lề 57 pt ≈ 20 mm) từ
  `domain/reportPdf.ts`, ghi vào thư mục `files/bao-cao/` của app rồi mở bảng chia sẻ qua
  `react-native-share`. Không cần mạng. File giữ đúng tên
  `bao-cao-thu-chi-{năm}-thang-{m}.pdf` / `-quy-{q}.pdf` nhờ ghi đè
  `res/xml/share_download_paths.xml` (thêm `files-path` và `external-files-path`
  `bao-cao/` cho FileProvider của thư viện share).
- **Web:** `GET /reports/financials.pdf` do fpdf2 dựng với font Open Sans nhúng (cùng
  file TTF app dùng) để tiếng Việt hiện đúng; trình duyệt tải về qua `Content-Disposition`
  (server phải `expose_headers`). Đề bài gợi ý pdfkit cho web; chọn tạo ở server để web-admin
  không phải tải thư viện PDF và để admin xuất cho nông hộ bất kỳ bằng cùng một quyền.
- **Nội dung** hai bên khớp nhau: tiêu đề, nông hộ + địa chỉ, kỳ, ngày xuất, tóm tắt thu /
  chi / lãi-lỗ (`[LỖ]` khi âm), chi tiết thu, chi tiết chi, ghi chú, chân trang
  "Được tạo bởi: AgriLog v2 | Hỗ trợ: support@agrilog.vn". Kỳ không có giao dịch → mobile
  hiện EmptyState, server trả 404 với đúng chuỗi "Không có dữ liệu tháng này".
- **Ghi chú trong báo cáo** (`report_notes`) chỉ là phép cộng trên dữ liệu có thật: chi phí
  phân bón liệt kê từng khoản, tồn còn lại theo bảng tồn, và "khuyến nghị" là trung bình chi
  phân bón 3 tháng gần nhất — nói rõ cách tính ngay trong câu.

### 5. Nhiều tài khoản: cô lập theo `owner_id`, xung đột hỏi người dùng

Ba nông hộ demo (`nguyenvancuong` PUC-001-HB cà chua, `nguyenvananh` PUC-002-HB dưa leo,
`nguyenvanhai` PUC-003-HB ớt) được seed với kho/thu-chi riêng; mọi truy vấn sync và REST
lọc theo `owner_id` của token, test `mu_*` chứng minh user A không kéo được dòng của B.

Đồng bộ vẫn là **last-write-wins theo `updated_at`** (ADR 0002), nhưng Giai đoạn 4 thêm
đường hỏi lại: khi server từ chối một dòng vì bản trên server mới hơn, `POST /sync` trả
`conflicts[]` kèm **bản của server**. Máy hiện hộp thoại "Thiết bị khác vừa sửa … bạn muốn
giữ bản trên máy này hay lấy bản mới?":

- *Lấy bản mới* — ghi các cột của server vào bản ghi cục bộ (`takeServerVersion`);
- *Giữ bản của tôi* — chạm lại bản ghi để `updated_at` mới hơn rồi đẩy lại
  (`keepLocalVersion`); lần push sau thắng theo đúng quy tắc LWW.

Không có bước hợp nhất theo từng trường: dữ liệu nông hộ là các phiếu nhỏ, hỏi một câu dễ
hiểu hơn là tự trộn.

### 6. Điều hướng: ba tab, web ba cột

Mobile chuyển sang bottom-tabs (Trang chủ · Công cụ · Cài đặt) bọc trong native-stack. Cài
đặt gom tài khoản, trạng thái đồng bộ theo bảng, nhật ký lỗi, đăng xuất, và (chỉ bản dev)
nút "Thử màn hình lỗi" để kiểm tra boundary trên máy thật.

> **Cập nhật 2026-09-22 — đoạn trên không còn đúng.** Bottom-tabs đã được gỡ; Trang chủ là
> màn gốc của native-stack, mọi màn khác đẩy lên trên nó. Lý do đổi: ba tab chiếm 64pt +
> inset ở mọi màn trong khi nông hộ hầu như chỉ ở Trang chủ. Hai thứ thanh tab đang âm thầm
> gánh phải được thay bằng thứ khác: (1) danh mục phân bón và F4 kiểm tra kho chỉ tới được
> qua màn Công cụ, nay có thẻ "Tất cả công cụ" ở Trang chủ dẫn vào; (2) thanh tab nằm NGOÀI
> `ScreenErrorBoundary` nên luôn là lối thoát khi một màn sập — nay boundary tự có nút "Về
> trang chủ". Không dùng deep linking. `@react-navigation/bottom-tabs` đã gỡ khỏi
> `package.json`.

Web-admin: `/login` → `/dashboard`; trang kiểm tra token cũ chuyển sang `/tokens`. Lưới
`repeat(3, 1fr)` cho ba thẻ, hai cột trên tablet (< 1024 px), một cột trên điện thoại
(< 640 px); thẻ có `:hover`/`:focus-visible` nâng `shadow-md` + `scale(1.02)`, mọi điều
khiển là `button`/`select` thật nên Tab + Enter dùng được, viền focus 3 px màu thương hiệu.

## Hệ quả

- Schema mobile **v6** (thêm `error_logs`); server thêm bảng `error_logs`, endpoint
  `/logs`, `/dashboard/summary`, `/reports/financials.pdf`, `/users`, `/users/version`.
- Thêm phụ thuộc native: `react-native-html-to-pdf`, `react-native-share` (phải build lại
  app Android). Backend thêm `fpdf2`, `pypdf` (test), `pytest-cov`.
- Kiểm thử: backend 80 test (23 mới: 8 đa người dùng, 2 log, 3 dashboard, 5 PDF, 5 e2e),
  phủ 94 %; mobile 69 test (26 mới), phủ 94 % câu lệnh / 96 % dòng trên `domain/` và các
  component Giai đoạn 4; `tsc` và `eslint` sạch ở cả ba gói.
- Chưa làm: đính kèm ảnh chụp màn hình khi báo lỗi (chỉ gửi văn bản); push notification cho
  "Đặt nhắc"; trang web sửa giá phân bón / duyệt giống (đã có API) — để Giai đoạn 5.
