# ADR 0004 — Hệ thiết kế phẳng (v5) và danh mục giống cây 3 cấp

- **Ngày:** 2026-09-13
- **Trạng thái:** Đã áp dụng
- **Liên quan:** [ADR 0003](0003-thu-hep-pham-vi.md) (thu hẹp phạm vi), [ADR 0002](0002-giai-doan-1.md) (đồng bộ)

## Bối cảnh

Cô hướng dẫn yêu cầu (1) làm lại giao diện theo phong cách tiết chế kiểu Stripe / Vercel /
Apple — nền trắng, viền xám mảnh, một màu xanh chủ đạo, không gradient, không neon, không
glassmorphism; (2) cơ cấu lại danh mục giống cây thành 3 cấp *loại cây → loại con → giống*
và mở rộng ra cà phê, dưa leo, ớt với **dữ liệu thật, không bịa**; (3) dựng UI chọn giống
3 bước và danh sách phân bón phân cấp.

Thiết kế cũ (v4, liquid-glass) được dựng bám sát file mock-up; hệ mới thay thế hoàn toàn.

## Quyết định

### 1. Token v5, một nguồn sự thật

`shared/design/tokens.json` được viết lại (phiên bản 5.0.0). Các nhóm `glass`, `gradient`,
`halo`, `spacing` lẻ (3/6/7/8…) bị bỏ. Thêm:

| Nhóm | Nội dung |
|---|---|
| `color.gray` | Thang xám 50–900 (Tailwind) — nền trang `#F9FAFB`, chữ `#111827`, phụ `#6B7280`, viền `#E5E7EB` |
| `color.primary` | `#2E6F40` (giữ màu xanh thương hiệu của v4) + trạng thái nhấn + nền xanh nhạt khi chọn |
| `color.badge` | 6 cặp pastel (vàng / xanh / đỏ / xám / lam / tím) cho nhãn trạng thái |
| `shadow` | Đúng hai bóng: `sm` `0 1px 2px rgba(0,0,0,.05)`, `md` `0 4px 6px rgba(0,0,0,.10)` |
| `space` | Lưới 8pt: 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 |
| `typography.role` | 13 vai trò, từ `display` 34/800 tới `badge` 11.5/700 |

`build-tokens.js` sinh `mobile/src/theme.ts` và `web-admin/src/app/tokens.css` từ file này.
Component **không** hard-code màu; `react-native-linear-gradient` bị gỡ khỏi dependencies để
quy tắc "không gradient" không thể bị phá vô tình.

### 2. Bộ component nền (mobile)

`Screen`, `AppHeader` (nút lùi trong suốt + tiêu đề + hành động phải), `Card` (trắng, viền
1px, shadow-sm, chọn = viền xanh + nền xanh nhạt), `ListRow` (hàng full-width, divider mảnh),
`Badge` (pastel), `EmptyState` (icon + tiêu đề + giải thích + hành động), nút `Primary /
Secondary / Ghost / Danger`, `Field` / `PickerField` / `SelectChip` / `SegmentedControl`.
`GlassSurface`, `ScreenBackground`, `VarietyPicker` (modal cũ) bị xoá.

### 3. Danh mục giống 3 cấp

Cấu trúc file `shared/data/crop_varieties.json`:

```
crop_types[]            loại cây   — id, name, icon, scientific_name, description
└─ categories[]         loại con   — category_id, category_name, description
   └─ varieties[]       giống      — id, name, description, usage, growing_note, badge, source
```

Chỉ **giống** là bản ghi trong CSDL (`crop_varieties`); hai cấp trên là dữ liệu tĩnh, được
denormalise xuống từng dòng (`category_id`, `category_name`, `crop_type`, `crop_name`) để một
giống do nông dân tự thêm — kể cả cho cây chưa có trong danh mục — vẫn tự mô tả được.

**Quy tắc dữ liệu:** mỗi giống có trường `source` trỏ đến trang đã tra; số liệu chép đúng
theo nguồn; chỗ nguồn không nói → ghi "Chưa có dữ liệu". Việc gom giống vào "loại con" là
cách phân nhóm của ứng dụng để dễ chọn, không phải phân loại thực vật học (ghi rõ trong app).
Test `backend/tests/test_static_data.py` chặn giống không có nguồn.

Kết quả: 4 loại cây · 17 loại con · 40 giống.

| Loại cây | Loại con | Giống | Nguồn chính |
|---|---|---|---|
| Cà chua | bi · tròn (thường) · leo giàn · trái cây & đặc sản | 8 (giữ nguyên id cũ) | sfarm.vn, nguonsinhthai.com |
| Cà phê | vối (Robusta) · chè (Arabica) · mít (Liberica) · Excelsa | 17 | vista.gov.vn (Cục TT-TK), Viện Eakmat/WASI, Báo NN&MT, Wikipedia |
| Dưa leo | xanh F1 · Nhật (trái dài) · trắng & nếp · baby | 9 | East-West Seed, Rạng Đông, Phú Điền |
| Ớt | chỉ thiên · hiểm · sừng · chuông · kiểng | 6 | Phú Điền, Rạng Đông, Chánh Phong, Rijk Zwaan, Wikipedia (SHU) |

Id loại cây chuyển từ slug tiếng Việt sang id danh mục (`ca_chua` → `tomato`); migration hai
phía đổi dữ liệu cũ.

### 4. Schema v4 (mobile) và nâng cấp server

- `crop_varieties`: thêm `category_id`, `category_name`, `description`, `usage` (giữ),
  `growing_note`, `badge`; bỏ khai báo `fruit`, `note` (nội dung được copy sang cột mới;
  cột vật lý vẫn nằm trên đĩa vì SQLite/WatermelonDB không drop cột an toàn).
- `plots`: thêm `crop_name`.
- Migration v3→v4 dùng `addColumns` + `unsafeExecuteSql` (đổi id cây, copy cột, và **drop**
  hai bảng `diagnoses`, `pending_diagnoses` còn sót từ ADR 0003).
- Server: `app/core/schema_upgrade.py` thêm cột thiếu bằng `ALTER TABLE ADD COLUMN` lúc khởi
  động và khi seed — thay cho Alembic vốn chưa được nối. Chỉ làm thay đổi **cộng thêm**.
- `test_schema_parity.py` vẫn là chốt chặn: schema mobile v4 == model server.

### 5. UI chọn giống 3 bước = 3 route

`VarietyCropType` → `VarietyCategory` → `VarietyPick`, mỗi bước một route để cử chỉ lùi của
hệ điều hành hoạt động tự nhiên. Kết quả trả về `PlotForm` bằng `popTo(..., {merge: true})`
với `pickedVariety`. Bước 1 có ô "Cây trồng khác" (tự đặt tên cây + giống), bước 3 có
"+ Thêm giống mới" và "Không rõ giống — chỉ lưu loại cây". Giống tự thêm ghi SQLite trước,
đồng bộ sau, admin duyệt (Điều 1).

### 6. Danh mục phân bón

`FertilizerGroups` (lưới 6 nhóm) → `FertilizerProducts` (sản phẩm + khoảng giá/bao và /kg +
nhãn mức giá + bộ lọc Bình dân / Trung bình / Cao cấp). Nhóm chưa có giá đã xác thực (vi
sinh) hiển thị nhãn vàng "Chưa có dữ liệu giá" và một EmptyState — không sinh số.

## Hệ quả

- Toàn bộ 4 màn hình cũ (Đăng nhập, Trang chủ, Chi tiết lô, Thêm/sửa lô) được dựng lại
  trên hệ mới; ảnh chụp ở `docs/screenshots/`.
- `docs/design-reference/agrixai-farmer-v4.html` chỉ còn là tư liệu lịch sử.
- Web-admin: `globals.css` và trang kiểm tra token chuyển sang token v5; các trang thật vẫn
  thuộc Giai đoạn 4.
- Giai đoạn 3 (F1–F6, Kho, Thu-Chi) sẽ xây trên bộ component và token này.
