# ADR 0003 — Thu hẹp phạm vi: bỏ toàn bộ tính năng chẩn đoán bệnh

- **Ngày:** 07/09/2026
- **Trạng thái:** Đã chốt
- **Thay thế:** ADR 0003 cũ ("Luồng chẩn đoán bệnh qua ảnh") — đã xoá cùng tính năng.

---

## Bối cảnh

Nhóm chốt lại phạm vi đồ án: **không làm chẩn đoán bệnh cây**. Bốn mảng còn lại là

1. Tư vấn & phân loại phân bón (F1–F4)
2. Quy trình chăm sóc theo giai đoạn (F5–F6)
3. Nhập – Xuất kho
4. Thu – Chi

Toàn bộ phần AI chẩn đoán ảnh (Giai đoạn 2) và danh mục bệnh bị loại bỏ.

## Quyết định

Xoá **hết**, không để lại cờ tắt/bật hay mã chết. Lý do: một tính năng bị vô hiệu hoá bằng
cờ vẫn phải được biên dịch, vẫn nằm trong bundle, vẫn xuất hiện khi tìm kiếm mã nguồn, và
vẫn khiến người đọc sau này tưởng nó còn dùng. Bản ghi lịch sử đã nằm trong git, lấy lại
được bằng `git show 365e67a` nếu cần.

## Đã xoá những gì

### Mobile

| Nhóm | Tệp |
|---|---|
| Màn hình | `CaptureImageScreen` · `AnalyzingScreen` · `DiagnosisResultScreen` · `TreatmentRecommendationScreen` · `DiagnosisHistoryScreen` |
| Hàng đợi ảnh | cả thư mục `src/diagnosis/` (`queueProcessor.ts`, `DiagnosisQueueContext.tsx`) |
| Dữ liệu | `db/models/Diagnosis.ts` · `db/models/PendingDiagnosis.ts` · `db/repositories/diagnosisRepository.ts` |
| Mạng | `api/diagnoses.ts` |
| Giao diện | `components/SeverityBadge.tsx` · icon `CameraIcon`, `SunIcon`, `WarningIcon` |
| Tiện ích | `utils/diseases.ts` |

### Backend

`routers/diagnoses.py` · `services/predictor.py` · `schemas/diagnosis.py` ·
`tests/test_diagnoses.py`, cùng các model `Diagnosis` trong `models/farm.py` và mục
`diagnoses` trong `SYNC_MODELS`.

Endpoint bị gỡ: `POST/GET /diagnoses`, `GET/DELETE /diagnoses/{id}`,
`GET /diagnoses/image/{name}`, `GET /diseases`, `GET /diseases/{key}`.

`GET /health` bỏ trường `model_status` (không còn mô hình nào để báo trạng thái).

### Dữ liệu dùng chung

`shared/data/tomato_diseases.json` — xoá. `shared/data/` còn đúng ba danh mục:
`fertilizer_recommendations.json`, `care_protocols.json`, `crop_varieties.json`.

### Thiết kế

Bỏ hai nhóm token `severity` và `diseaseType` khỏi `shared/design/tokens.json` rồi sinh
lại `mobile/src/theme.ts` và `web-admin/src/app/tokens.css`. Màu gốc vẫn tra lại được ở
`docs/design-reference/agrixai-farmer-v4.html` nếu sau này Kho cần một thang màu cảnh báo
tồn thấp — khi đó sẽ đặt tên theo đúng ngữ cảnh kho chứ không tái dùng tên "mức độ bệnh".

### Phụ thuộc và quyền

Gỡ `react-native-image-picker` và `@react-native/new-app-screen`. Bỏ khỏi
`AndroidManifest.xml`: `CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` và
`uses-feature android.hardware.camera`. App giờ chỉ xin đúng một quyền: `INTERNET`.

**Đây là phần đáng giá nhất của việc thu hẹp phạm vi.** Một ứng dụng nông nghiệp xin quyền
máy ảnh và quyền đọc toàn bộ thư viện ảnh mà không dùng đến là thứ khiến người dùng nghi
ngờ, và là thứ cửa hàng ứng dụng hỏi tới.

## Bảng dữ liệu sau khi xoá

| Bảng | Trạng thái | Ghi chú |
|---|---|---|
| `plots` | **giữ** | Lô đất |
| `crop_varieties` | **giữ** | Danh mục giống, mở rộng được qua UI |
| `crop_cycles` | **giữ** | Chu kỳ canh tác — nền cho F5–F6 |
| `change_logs` | **giữ** | Nhật ký thay đổi |
| `diagnoses` | **xoá** | |
| `pending_diagnoses` | **xoá** | Hàng đợi ảnh cục bộ |

`LOCAL_ONLY_TABLES` giờ rỗng — không còn bảng nào chỉ nằm trên máy. Test
`test_local_only_tables_are_declared_on_both_sides` vẫn giữ lại để lần sau thêm bảng cục
bộ thì hai đầu buộc phải khai báo khớp nhau.

## Cách xử lý migration

Schema mobile lên **v3**. WatermelonDB không hỗ trợ `destroyTable` trong migration, nên
hai bảng cũ không bị xoá khỏi file SQLite trên máy đã cài bản trước — chúng chỉ đơn giản
không còn được khai báo, không đọc, không đồng bộ.

Chấp nhận được vì dự án chưa phát hành: máy cài mới sẽ không bao giờ tạo hai bảng đó. Nếu
sau này cần dọn sạch, cách đúng là một migration `unsafeExecuteSql('DROP TABLE ...')`, chứ
không phải xoá file database (sẽ mất dữ liệu nông dân đã nhập offline).

## Hệ quả

- Ba điều không thương lượng ở Mục 2 vẫn còn nguyên giá trị: Điều 1 (ghi cục bộ trước) và
  Điều 3 (không phụ thuộc API ngoài) vẫn chi phối Kho và Thu-chi. Điều 2 (nhập bằng giọng
  nói) chưa làm.
- Đồng bộ hai chiều không đổi, chỉ ít đi một bảng.
- Màn hình "Chi tiết lô đất" còn **4 tab** thay vì 5: Thông tin · Chu kỳ · Chăm sóc · Thay đổi.
- Trang chủ bỏ badge sức khoẻ, thay bằng **badge trạng thái canh tác** (Đang canh tác / Bỏ
  hoá / Đã thu hoạch) — vẫn cho nông dân quét nhanh danh sách, nhưng dựa trên dữ liệu thật
  sự còn tồn tại.
