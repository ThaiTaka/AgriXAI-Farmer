# AgriLog V2.1 — Lịch sử trồng trọt, ghi chú kèm ảnh/video, tiền công

**Hoàn thành:** 24–25/09/2026 · **Nhánh:** `feat/v2.1-canh-tac-media-nhan-cong` · **PR:**
[#8](https://github.com/ThaiTaka/AgriXAI-Farmer/pull/8) (chờ merge vào `main`)
**Quyết định thiết kế đầy đủ:** [ADR 0008](docs/adr/0008-v2-1-canh-tac-media-nhan-cong.md)

## Vì sao có bản này

Yêu cầu ban đầu (`PROMPT_CHINH_SUA_CHUC_NANG.md`) đề nghị tách lịch sử công việc khỏi lịch sử
trồng trọt, thêm hướng dẫn chăm sóc có video xem ngay trong app, ghi chú công việc kèm ảnh/video,
gợi ý cây trồng thông minh, và tính tiền công nhân công.

## 5 tính năng

### 1. Lịch sử trồng trọt
Tách khỏi lịch sử công việc: mỗi vụ ghi cây trồng, mùa vụ, diện tích lúc trồng, sản lượng và
ảnh thu hoạch. Biểu đồ năng suất (kg/1.000 m²) so sánh giữa các vụ trên cùng một lô. Về mặt dữ
liệu, đây là mở rộng của bảng `crop_cycles` sẵn có (thêm `crop_name`, `season`, `area_m2`,
`media_json`) chứ không phải bảng `cultivation_history` riêng — để một vụ chỉ có một nguồn sự
thật, tab "Vụ trồng" và REST cùng đọc một dòng.

### 2. Hướng dẫn chăm sóc có video
Video YouTube nhúng và phát ngay trong app (qua WebView, domain `youtube-nocookie.com` để
tránh cookie theo dõi), kèm ảnh từng bước. Quản trị viên soạn nội dung trên trang web-admin
`/care-guides`; nông hộ chỉ đọc. Khi không có mạng, khung video báo rõ "cần có mạng" nhưng phần
chữ và các bước vẫn đọc được vì đã đồng bộ về máy.

### 3. Ghi chú công việc kèm ảnh/video
Mỗi công việc ghi chú được kèm ảnh hoặc video quay lại cách làm. Ảnh/video lưu vào thư mục
documents trên máy trước (không dùng cache — hệ điều hành có thể dọn cache khi máy đang ở
ngoài đồng chưa có sóng), tự tải lên `POST /media` sau khi đồng bộ thành công, gắn cờ
`uploaded` khi xong. Máy chủ nhận diện loại tệp bằng byte đầu (JPEG/PNG/WebP, MP4/MOV/3GP/WebM),
không tin tên tệp hay Content-Type; từ chối HEIC vì chỉ Safari hiển thị được.

### 4. Gợi ý cây theo mùa
Xếp hạng các cây **đã từng trồng trên chính lô đó** theo năng suất trung bình thật (không bịa
số liệu, không gợi ý cây mới chưa từng trồng), ưu tiên các vụ cùng mùa. Có chủ đích **không**
gợi ý trồng xen hay khoảng cách giữa các cây, vì dự án yêu cầu mọi số liệu nông học phải có
nguồn chính thống và hiện chưa có bộ dữ liệu như vậy.

### 5. Tiền công nhân công
Tính theo giờ, theo ngày, hoặc khoán (số người × số lượng × đơn giá). Đây là một khoản chi nên
tự vào Thu – Chi thay vì một sổ riêng — mở rộng `expense` kind `labor` (thêm `task_id`,
`workers`, `quantity`, `unit`, `unit_price`) chứ không lập bảng `labor_costs` mới.

## 3 lỗi có sẵn được sửa cùng đợt

Nằm ngay trên đường đi khi làm V2.1, không phải lỗi mới phát sinh:

1. **Quyền trên `/sync`** — trước đây bất kỳ id nào điện thoại gửi lên đều được áp
   `updated`/`deleted`, nên một hộ có thể sửa/xoá bản ghi của hộ khác nếu đoán được id (id demo
   đoán được). Nay chỉ chủ bản ghi hoặc quản trị viên mới sửa/xoá; giống cây dùng chung chỉ
   người đề xuất mới sửa được. Test: `backend/tests/test_sync_ownership.py`.
2. **Mất dữ liệu khi nâng schema** — app bản cũ (schema v6) kéo các vụ mới về mà không có cột
   chứa dữ liệu mới, nên cột đó rỗng vĩnh viễn vì mốc đồng bộ đã qua. Đã thêm cơ chế migration
   sync (`migrationsEnabledAtVersion`, tham số `migration` ở `GET /sync`).
3. **Làm tròn lệch giữa Python và JavaScript** — `round()` của Python làm tròn về số chẵn,
   `Math.round` của JS làm tròn lên; tiền công/năng suất tính độc lập ở điện thoại và máy chủ
   nên ra hai con số khác nhau ở giữa. Thống nhất luật nửa lên ở cả hai phía, có test cho cả hai.

## Kiểm thử

| Thành phần | Kết quả |
|---|---|
| Backend (FastAPI) | 235 test xanh — chạy trên cả SQLite (dev) và PostgreSQL 16 |
| Mobile (React Native) | 236 test / 24 bộ, phủ 94% dòng · `tsc --noEmit` và `eslint` sạch |
| Web-admin | Build sạch |
| Chạy thật | **Emulator Pixel 6a (Android 13)** — không phải thiết bị vật lý. Đã thử: migration v6→v7 và migration sync, gợi ý theo mùa, chụp ảnh → tải lên → cờ `uploaded`, chọn và phát video trong máy, YouTube nhúng, tiền công 1 người × 2 giờ × 30.000₫ = 60.000₫ hiện đúng trong Thu – Chi |

Ảnh chụp thật: `docs/screenshots/85-v21-cultivation-history-chart.png` …
`95-v21-web-admin-care-guide-editor.png` (11 ảnh).

## Thay đổi phá vỡ tương thích

- **Schema điện thoại v6 → v7**: thêm bảng `task_notes`, `care_guides`; thêm cột cho
  `crop_cycles` và `expense`. Có migration sync, chỉ cộng thêm — không đổi hay xoá cột cũ.
- **Giới hạn kích thước upload**: cần nâng `client_max_body_size 110m;` ở nginx (mặc định 1 MB
  sẽ chặn mọi ảnh/video trước khi tới API — nông hộ chỉ thấy "tải lên thất bại" mãi không rõ lý
  do). Caddy: `request_body { max_size 110MB }`.
- **`MEDIA_DIR` phải là ổ gắn ngoài** (Docker volume `-v agrilog-media:/data/media`) — để trong
  container thì mỗi lần triển khai lại mất sạch ảnh.

## Hướng dẫn triển khai

```bash
# 1. Sao lưu CSDL VÀ thư mục media (thiếu thư mục thì ghi chú còn, ảnh mất)
pg_dump agrilog_db > backup_$(date +%Y%m%d).sql
cp -r $MEDIA_DIR $MEDIA_DIR.backup_$(date +%Y%m%d)

# 2. Cập nhật máy chủ TRƯỚC — máy chủ tự thêm cột/bảng còn thiếu lúc khởi động
#    (app/core/schema_upgrade.py), không dùng Alembic
git pull origin main
pip install -r requirements.txt
systemctl restart agrilog-api

# 3. Kiểm tra
curl http://localhost:8000/health

# 4. App cập nhật SAU khi máy chủ đã chạy bản mới
#    (ngược lại: app cũ nâng schema lên v7 nhưng máy chủ chưa hiểu migration mới)
```

Đừng quên nâng `client_max_body_size` ở nginx **trước** khi mở tính năng upload cho người dùng.

## Việc chưa làm / giới hạn đã biết

| Việc | Vì sao |
|---|---|
| Gợi ý trồng xen, khoảng cách giữa các cây | Chưa có nguồn nông học chính thống |
| Build/test trên iOS | Máy phát triển là Windows; đã thêm quyền camera/thư viện/micro vào `Info.plist` nhưng chưa build |
| Quay video bằng camera của emulator | Camera AOSP trên emulator crash khi lưu video (lỗi emulator, không phải app) — chọn video từ thư viện chạy đúng; cần thử trên thiết bị Android thật |
| Dọn tệp media mồ côi | Xoá ghi chú không xoá tệp tương ứng trên máy chủ |
| Rate limiting cho endpoint upload | Hiện chỉ có rate limit cho đăng nhập sai mật khẩu, chưa có cho `/media` |
| E2E Detox | Dự án chưa có hạ tầng Detox — thay bằng test Jest cho domain/component + chạy thật trên emulator |
| Ảnh/video lưu trên đĩa một máy chủ | Mở rộng nhiều máy chủ thì cần chuyển sang S3/MinIO |

## Ghi nhận

- **Thái** (`lethanhthai0805@gmail.com`) — mobile, media handling, tài liệu, ảnh chụp thật.
- **Khoa** (`nhakhoa1004@gmail.com`) — backend, test, migration sync.

## Liên quan

- PR: [#8](https://github.com/ThaiTaka/AgriXAI-Farmer/pull/8)
- Tài liệu: [ADR 0008](docs/adr/0008-v2-1-canh-tac-media-nhan-cong.md),
  [API_ENDPOINTS.md](docs/API_ENDPOINTS.md), [BACKEND_DEPLOYMENT.md](docs/BACKEND_DEPLOYMENT.md)
