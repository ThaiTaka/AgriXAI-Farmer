# ADR 0011 — Trang web quản trị hoàn chỉnh

- **Ngày:** 2026-10-03
- **Trạng thái:** Đã áp dụng (nhánh `fix/doi-tai-khoan-cung-may`)
- **Liên quan:** [ADR 0006](0006-giai-doan-4-dashboard-offline-pdf-da-nguoi-dung.md) (dashboard web, sửa/xoá của admin), [ADR 0010](0010-giong-noi-thong-bao-thoi-tiet.md) (thông báo, thời tiết, giá)

## Bối cảnh

Yêu cầu: "Hoàn thiện web admin (design đẹp cho thiệt)", "làm cho chuẩn web thật đẹp".

Trước đợt này, web-admin có sáu trang rời nhau: dashboard một nông hộ, tài khoản, duyệt giống,
hướng dẫn chăm sóc, giá phân bón, cài đặt. Mỗi trang tự kiểm tra đăng nhập, tự vẽ thanh tiêu đề
với các nút "← Dashboard" và "Đăng xuất", và có kiểu riêng. Các việc mới của ADR 0010 (thông báo,
thời tiết) chưa có màn hình nào. Không có trang nào nhìn toàn bộ làng hoa cùng lúc.

## Quyết định

### 1. Một khung chung cho mọi trang

- Mọi trang đã đăng nhập nằm trong nhóm route `src/app/(admin)/`, dùng chung
  `components/AdminShell.tsx`:
  - kiểm tra phiên **một lần** (`/auth/me`), nạp danh sách nông hộ và dự báo thời tiết cho mọi trang
    qua `useAdmin()`;
  - thanh bên chia theo việc: *Nông hộ & đất*, *Danh mục*, *Thông tin tới nông hộ*, *Hệ thống*;
  - thanh trên: vị trí hiện tại, ngày, nhiệt độ làng hoa, chuông;
  - dưới 1024 px thanh bên thành ngăn kéo; ngăn kéo tự đóng khi chuyển trang.
- Đường dẫn cũ giữ nguyên (`/accounts`, `/varieties`…); trang dashboard một nông hộ chuyển sang
  `/farms` (nhận `?owner=<id>`), `/dashboard` thành **Tổng quan**.
- Nông hộ đăng nhập web chỉ thấy `/farms` (sổ sách của mình, chỉ xem) và `/settings`. Mở một
  trang quản trị thì bị đưa về `/farms` **trước khi** trang đó kịp gọi API chỉ dành cho quản trị.
- Khối giao diện dùng chung ở `components/ui.tsx` (PageHeader, Panel, StatCard, Pill, EmptyState,
  Skeleton, Meter, Modal, Segmented, Toast), biểu tượng nét ở `components/icons.tsx`, kiểu ở
  `app/admin.css` (đặt trên `tokens.css` sinh từ `shared/design/tokens.json`). Trang `/tokens`
  trình bày lại chính những khối này.

### 2. Trang mới

| Trang | Dữ liệu |
|---|---|
| Tổng quan | `GET /dashboard/overview` (mới, chỉ quản trị): số hộ, diện tích, thu – chi 6 tháng, cơ cấu cây, tồn kho, việc chờ, giống chờ duyệt, lỗi 7 ngày, bảng từng hộ kèm lần hoạt động gần nhất |
| Lô đất | `/plots` — tạo và giao lô, sửa, xoá; diện tích theo m², sào Lâm Đồng, ha |
| Thông báo | `/notifications` — soạn, gửi tới mọi hộ hoặc một hộ, sửa, thu hồi, tỉ lệ đã xem |
| Thời tiết | `/weather`, `POST /weather/refresh` |
| Nhật ký lỗi | `/logs` |

Các trang cũ làm lại trong khung mới và thêm việc: tài khoản có tìm kiếm, lọc và lần đồng bộ
gần nhất; duyệt giống có thêm danh mục gốc 268 giống; hướng dẫn chăm sóc thành lưới thẻ có ảnh
bìa video và trình soạn **xem trước như trên điện thoại**; giá phân bón hiện giá đang dùng cạnh
khoảng giá khảo sát và nguồn, nhập giá trong hộp thoại, lịch sử giá có cột thay đổi.

### 3. Biểu đồ: tự vẽ SVG, màu đã kiểm

- Không thêm thư viện biểu đồ: hai biểu đồ (cột nhóm, vành khuyên) vẽ tay trong
  `components/charts.tsx`, nhẹ và chạy trong mạng LAN không có internet.
- Bảng màu phân loại theo thứ tự cố định đã chạy bộ kiểm tra (dải độ sáng, độ bão hoà, khoảng cách
  với người mù màu giữa các màu liền nhau); loại thứ chín trở đi gộp vào "Khác", không lặp màu.
  Thu – chi dùng cặp riêng `#2E6F40` / `#E9725F`; cặp này đạt kiểm tra mù màu nhưng độ tương phản
  chỉ ở mức cảnh báo, nên biểu đồ luôn có chú thích, số khi rê chuột và nút **"Xem bảng số liệu"**.
- Biểu đồ cột vẽ theo bề rộng thật của khung (`ResizeObserver`), nên chữ trục vẫn 12 px trên
  điện thoại thay vì bị thu nhỏ cùng hình.

### 4. Sửa kèm vì nằm trên đường đi

- **Sai mật khẩu trên web báo "Phiên đăng nhập đã hết hạn".** `lib/api.ts` coi mọi 401 là hết
  phiên; nay 401 của chính `/auth/login` trả lời nhắn của máy chủ.
- **`plots.area_unit` dài 8 ký tự** trong khi mã `sao_lam_dong` có 12: lô tạo với đơn vị sào bị
  từ chối. Cột nới lên 16 ở model, schema và `schema_upgrade.py` (`ALTER` trên PostgreSQL), có
  test hồi quy.
- **`care_guides.source_name` dài 160 ký tự** trong khi hai hướng dẫn mẫu trích đầy đủ QĐ
  1972/QĐ-UBND (~300 ký tự). SQLite không kiểm độ dài nên không ai thấy; chạy bộ test trên
  PostgreSQL 16 thì seed hỏng ngay, và trình soạn trên web nhận 422 khi lưu lại chính bài mẫu.
  Cột và schema nới lên 500; `schema_upgrade.WIDENED_COLUMNS` nới cột trên cơ sở dữ liệu
  PostgreSQL đã có (đã thử: 160 → 500, `area_unit` 8 → 16, chạy lần hai không làm gì). Có test
  hồi quy `test_a_demo_guide_saves_back_unchanged_from_the_editor`.
- **`/fertilizer-prices/latest` trả cả giá nhập cho ngày sau** như giá hiện hành; nay chỉ lấy giá
  đã tới ngày (ADR 0010 §6). Mỗi dòng giá còn kèm tên nhóm và khoảng giá khảo sát có nguồn, ngày
  (`group_name`, `survey_min/max/avg`, `survey_source`, `survey_date`, `pack`), có test so với
  `fertilizer_recommendations.json`.
- Luật lint React Compiler (`react-hooks/set-state-in-effect`, `react-hooks/purity`): không gọi
  `Date.now()` lúc vẽ (dùng `lib/useNow.ts`), không đặt lại state đồng bộ trong effect (dữ liệu
  mang theo khoá của bộ lọc nó trả lời).

## Hệ quả

- 15 route, `npm run build` dựng tĩnh toàn bộ; `tsc` và `lint` sạch.
- Kiểm tra bằng trình duyệt thật (Chrome headless qua `puppeteer-core`) ở 1440, 1280, 1100, 1024,
  768 và 390 px, với tài khoản quản trị, nông hộ và chưa đăng nhập: không trang nào tràn ngang;
  bảng rộng cuộn trong khung của nó.
- Backend thêm `GET /dashboard/overview`; tổng số endpoint 88 (`docs/API_ENDPOINTS.md`). Bộ test
  backend 338 ca chạy xanh trên cả SQLite lẫn PostgreSQL 16 (03/10/2026).

## Chưa làm / giới hạn

- Chưa có chế độ tối.
- Biểu đồ không có bản in riêng; in trang dùng kiểu màn hình.
- Danh sách lớn (nhật ký lỗi lấy 500 dòng gần nhất) chưa phân trang phía máy chủ.
