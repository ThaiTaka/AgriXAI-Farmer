# ADR 0008 — V2.1: lịch sử trồng trọt, ghi chú kèm ảnh/video, tiền công, hướng dẫn có video

- **Ngày:** 2026-09-24
- **Trạng thái:** Đã áp dụng (nhánh `feat/v2.1-canh-tac-media-nhan-cong`)
- **Liên quan:** [ADR 0002](0002-giai-doan-1.md) (giao thức đồng bộ), [ADR 0005](0005-giai-doan-3-tu-van-cham-soc-kho-thu-chi.md) (quy trình chăm sóc, thu chi), [ADR 0007](0007-giai-doan-5-backend-phuong-an-a-postgresql.md) (siết quyền)

## Bối cảnh

Yêu cầu (`PROMPT_CHINH_SUA_CHUC_NANG.md`) nêu năm việc: tách lịch sử công việc khỏi lịch sử
trồng trọt, hướng dẫn chăm sóc có video xem ngay trong app, ghi chú công việc kèm ảnh/video,
gợi ý cây trồng thông minh, và chi phí nhân công. Bản yêu cầu đề xuất năm bảng mới
(`cultivation_history`, `task_notes`, `care_guides`, `labor_costs`, `crop_performance`) và màn
hình gọi thẳng REST (`fetch('/api/...')`).

Hai điểm không khớp với hệ thống đang chạy:

1. Điện thoại **offline-first**: mọi màn đọc và ghi SQLite trên máy, dữ liệu đi qua `/sync`.
   Màn hình gọi REST sẽ trắng trơn giữa đồng không sóng.
2. Hai trong năm bảng đã có sẵn dưới tên khác: `crop_cycles` đã ghi lô, cây, giống, ngày
   xuống giống/kết thúc và sản lượng; `expense` đã có loại chi `labor` ("Công nhân").

## Quyết định

### 1. Mở rộng bảng có sẵn thay vì lập sổ thứ hai (người dùng chọn)

| Bản yêu cầu | Thực tế | Vì sao |
|---|---|---|
| `cultivation_history` | `crop_cycles` + `crop_name`, `season`, `area_m2`, `media_json` | Một vụ chỉ ghi một chỗ; tab "Vụ trồng" và REST đọc cùng một dòng |
| `labor_costs` | `expense` kind `labor` + `task_id`, `workers`, `quantity`, `unit`, `unit_price` | Tiền công là tiền ra khỏi nông hộ: tự vào Thu – Chi, báo cáo, PDF, thẻ lãi/lỗ — không cần cộng sổ thứ hai |
| `crop_performance` | Tính khi cần (`services/cultivation.py`, `domain/cultivation.ts`) | Số dẫn xuất được thì không lưu — lưu là thêm một chỗ để lệch |
| `task_notes` | Bảng mới, đồng bộ theo hộ | Không có chỗ nào sẵn |
| `care_guides` | Bảng mới, dùng chung như danh mục giống, **chỉ quản trị viên ghi** | Đọc được khi không có sóng |
| — | `media_files` (chỉ máy chủ) | Chỉ mục tệp trên đĩa; không đồng bộ |

Đường dẫn REST theo quy ước sẵn có: `PATCH` chứ không `PUT`, `/tasks-history/{id}/...` chứ
không `/tasks/{id}/...`. Danh sách đầy đủ ở [API_ENDPOINTS.md](../API_ENDPOINTS.md).

### 2. Ảnh/video không đi qua `/sync`

Dòng đồng bộ chỉ mang *mã* tệp (`media_json`: `[{id, kind, mime, uploaded}]`). Điện thoại:

- đặt mã khi chụp và chuyển tệp ngay vào thư mục **documents** — thư mục cache của Android có
  thể bị hệ điều hành dọn trong lúc nông hộ còn ở ngoài đồng chưa có sóng;
- sau mỗi lần đồng bộ thành công, tải các tệp chưa lên qua `POST /media` (gửi lại cùng mã là an
  toàn), lật cờ `uploaded`, rồi đồng bộ thêm một lượt để cờ lên máy chủ.

Máy chủ xác định loại tệp bằng **byte đầu** (JPEG/PNG/WebP, MP4/MOV/3GP/WebM), không tin tên
tệp hay Content-Type; từ chối HEIC (chỉ Safari hiển thị được). Ảnh riêng chỉ chủ và quản trị
viên xem; thẻ `<img>`/`<video>`/WebView không gửi được header nên có **token media** đi trên URL
— ngắn hạn (6 giờ), chỉ mở `/media`, và `current_user` từ chối mọi token có `scope` để URL lộ ra
không thành chìa khoá vào API.

### 3. Gợi ý cây: chỉ từ lịch sử của chính lô, không bịa

Xếp các cây lô **đã từng trồng** theo năng suất trung bình (kg/1.000 m², tính trên diện tích
*lúc trồng*), ưu tiên các vụ cùng mùa; không có vụ cùng mùa thì dùng mọi mùa và nói rõ điều đó.
Mùa vụ mặc định theo tháng xuống giống (Xuân 1–3, Hè 4–6, Thu 7–9, Đông 10–12) — một quy ước để
nhóm, nông hộ đổi được. **Không làm gợi ý trồng xen/khoảng cách** (người dùng chọn): dự án có
quy tắc mọi số liệu nông học phải có nguồn chính thống, và chưa có bộ dữ liệu nào như vậy.

### 4. Video hướng dẫn

YouTube nhúng trong WebView (`youtube-nocookie`, trang tải với `baseUrl` là origin của YouTube
để player nhận referrer — thiếu referrer là "Error 153"). Không có mạng thì khung video nói rõ
"cần có mạng", chữ và các bước vẫn đọc được vì đã đồng bộ về máy. Hai hướng dẫn demo dùng video
đã kiểm chứng qua oEmbed của YouTube; **các bước đọc thẳng từ quy trình có nguồn**, không viết
thêm lời khuyên nào.

### 5. Hai lỗi có sẵn được sửa vì nằm ngay trên đường đi

- **Sync không hỏi chủ sở hữu khi sửa/xoá.** `push_changes` áp mọi `updated`/`deleted` vào bất
  kỳ id nào điện thoại gửi — một hộ xoá được lô của hộ khác chỉ bằng id (id demo đoán được). Nay
  chỉ chủ bản ghi hoặc quản trị viên; giống cây dùng chung chỉ người đề xuất sửa được; bản bị từ
  chối trả về kèm `reason` (`not_owner`, `admin_only_write`). Test: `tests/test_sync_ownership.py`.
- **Migration sync.** App bản cũ (schema v6) kéo các vụ mới về mà không có chỗ chứa cột mới;
  lên v7, cột rỗng mãi vì `last_pulled_at` đã qua. Bật `migrationsEnabledAtVersion: 6` ở điện
  thoại và xử lý tham số `migration` ở `GET /sync`: bảng mới gửi lại dạng "created", bảng được
  thêm cột gửi lại dạng "updated". **Máy chủ phải lên trước app.**

### 6. Làm tròn giống nhau ở hai phía

Tiền công, năng suất và chi phí được tính độc lập ở điện thoại (offline) và máy chủ. `round()`
của Python làm tròn về số chẵn (83.332,5 → 83.332), `Math.round` làm tròn lên (83.333). Cả hai
phía dùng một luật: **nửa lên** (`services/rounding.py`), có test ở cả hai.

### 7. Thư viện native

`react-native-webview` 14.0.1, `react-native-image-picker` 8.2.1, `@dr.pogodin/react-native-fs`
2.35.1 (bản build cho RN 0.81 — dải `^` sẽ kéo bản cho RN 0.87). Ghim chính xác phiên bản.
`react-native-image-picker` được vá bằng `patch-package`: `parseInt(bitrate)` ném lỗi với video
không ghi bitrate (Long.MIN_VALUE) và làm hỏng cả lần chọn.

## Hệ quả

- Schema điện thoại **v7**, migration chỉ cộng thêm; test đối chiếu migration với `schema.ts`.
- Backend 235 test xanh trên SQLite và PostgreSQL 16; điện thoại 236 test; web build sạch.
- Đã chạy thật trên emulator Pixel 6a (Android 13): migration v6→v7 và migration sync, gợi ý
  theo mùa, chụp ảnh → tải lên → cờ `uploaded`, chọn và phát video trong máy, YouTube nhúng,
  tiền công 1 người × 2 giờ × 30.000₫ = 60.000₫ hiện trong Thu – Chi. Ảnh: `docs/screenshots/85…95`.

## Chưa làm / giới hạn

| Việc | Lý do |
|---|---|
| Gợi ý trồng xen, khoảng cách | Chưa có nguồn chính thống (xem mục 3) |
| E2E Detox | Dự án chưa có hạ tầng Detox; thay bằng test Jest cho domain/component + chạy thật trên emulator |
| Build iOS | Máy phát triển là Windows; đã thêm quyền camera/thư viện/micro vào `Info.plist` nhưng chưa build |
| Quay video bằng camera trên emulator | App camera có sẵn của emulator (AOSP) crash khi lưu video — lỗi của emulator; chọn video từ thư viện chạy đúng. Cần thử lại trên máy thật |
| Dọn tệp mồ côi | Xoá ghi chú không xoá tệp trên máy chủ |
| Ảnh lưu trên đĩa một máy | Mở rộng nhiều máy chủ thì chuyển sang S3/MinIO sau `media_service` |
| Giai đoạn của vụ đang mở không tự tiến | Có từ trước V2.1 (`crop_cycles.stage` chỉ đổi khi sửa tay); tab Chăm sóc dùng giai đoạn này thay vì ngày trồng |
