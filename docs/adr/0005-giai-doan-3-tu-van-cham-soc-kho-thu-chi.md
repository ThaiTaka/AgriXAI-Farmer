# ADR 0005 — Giai đoạn 3: tư vấn phân bón, quy trình chăm sóc, kho và thu-chi

- **Ngày:** 2026-09-14
- **Trạng thái:** Đã áp dụng
- **Liên quan:** [ADR 0004](0004-he-thiet-ke-phang-va-danh-muc-giong-3-cap.md) (token v5, danh mục 3 cấp), [ADR 0002](0002-giai-doan-1.md) (đồng bộ)

## Bối cảnh

Giai đoạn 3 dựng sáu tính năng lõi cho nông hộ: F1 tính lượng phân theo diện tích, F3 lọc
phân bón theo ngân sách, F4 kiểm tra kho, F5–F6 quy trình chăm sóc theo giai đoạn, Kho
(nhập / xuất / tồn) và Thu – Chi (ghi chép + lãi/lỗ). Ràng buộc cứng của đề bài: **không bịa
dữ liệu** — quy trình cho cây nào chưa tìm được nguồn chính thức thì phải hiện "Chưa có dữ
liệu"; mọi số liệu mới phải ghi nguồn và ngày tra cứu; toàn bộ phải chạy offline.

## Quyết định

### 1. Dữ liệu quy trình: seed theo cây + file gộp sinh tự động

`shared/data/care_protocol_{tomato,coffee,cucumber,pepper}_seed.json` là nguồn sự thật
(mỗi file: `$meta` với nguồn, `protocols[]`, `unavailable[]`). `build_care_protocols.py`
chỉ **nối** chúng thành `care_protocols.json` — không có phép tính nào ở giữa, nên file gộp
không thể chứa số mà seed không có. `test_static_data.py` dựng lại phép gộp trong bộ nhớ
và so với file đã commit.

Cấu trúc một protocol (format v2):

| Trường | Ý nghĩa |
|---|---|
| `category_ids` | loại con áp dụng; `null` = mọi loại con của cây |
| `source` | title · publisher · url (+ `archive_url` nếu trang gốc đã chết) · published_at · collected_at · section |
| `basis` | `commercial` (nguồn cho kg phân thương phẩm) hoặc `nutrient` (nguồn cho kg N–P₂O₅–K₂O) |
| `reference_area` | diện tích của định mức: 1 ha hoặc 1.000 m² |
| `scenarios[].items[]` | từng loại phân: `min`/`max`, `unit` (kg / tấn), `fertilizer_category`, `price_product_id` |
| `stage_model` | `growth` (cây hàng năm: 4 giai đoạn ánh xạ lên 5 mã giai đoạn của app) hoặc `calendar` (cây lâu năm: 4 đợt bón theo tháng) |
| `stages[].applications[]` | % của từng loại phân bón trong đợt đó |

**Quy tắc phủ:** mỗi cặp (cây, loại con) trong danh mục hoặc có protocol, hoặc nằm trong
`unavailable` kèm lý do và nguồn gợi ý — test chặn cả trường hợp thiếu lẫn trường hợp cả hai.

Kết quả tra cứu (13/09/2026):

| Cây | Nguồn | Kết quả |
|---|---|---|
| Cà chua | giongcaytrong.org (đã có từ Giai đoạn 1) | ✅ 2 phương án, 4 đợt |
| Cà phê vối | Cục Trồng trọt, QĐ 254/QĐ-TT-CCN (20/07/2010), bản đăng tại VICOFA | ✅ Bảng 1 kg/ha/năm cho 5 giai đoạn tuổi; 4 lần bón |
| Cà phê chè | Viện Eakmat/WASI, đăng trên Báo NN&MT 29/07/2026 (căn cứ 10TCN 527-2002) | ✅ Bảng N–P₂O₅–K₂O; 4 lần bón phía Nam, 2 lần phía Bắc |
| Cà phê mít, Excelsa | không có quy trình chính thức | ❌ `unavailable` |
| Dưa leo | Sở NN&MT Lai Châu (16/04/2025); VUSTA / Kinh tế nông thôn (11/2005) | ✅ 2 quy trình (1 ha; 1.000 m²) |
| Ớt cay (chỉ thiên, hiểm, sừng) | Trung tâm Khuyến nông Lâm Đồng (bản lưu Wayback 24/01/2025 vì trang gốc 404) | ✅ lót + 4 đợt thúc |
| Ớt ngọt | Chi cục Trồng trọt & BVTV Ninh Bình | ✅ N–P₂O₅–K₂O, 2 mức |
| Ớt kiểng | không có | ❌ `unavailable` |

Số liệu chép nguyên từ nguồn (bảng 2–4 của quy trình cà phê chè là ảnh trong bài, được đọc
lại từ ảnh). Tỷ lệ % theo đợt ở các quy trình mà nguồn chỉ cho số kg mỗi đợt (ớt cay, dưa
leo VUSTA) là phép chia của chính các số đó và được ghi rõ trong `extra_rules`.

### 2. Quy đổi dinh dưỡng → phân thương phẩm là phép tính hiển thị, không phải dữ liệu

Hai quy trình có `basis: nutrient`. Nguồn hướng dẫn "căn cứ tỷ lệ nguyên chất của các loại
phân để tính". Hệ số nằm trong `$meta.conversion` (Urê 46 % N, super lân 16 % P₂O₅, KCl
60 % K₂O; công thức của Trung tâm Khảo kiểm nghiệm Phân bón Quốc gia) và app tính lúc chạy,
ghi rõ "quy đổi từ X kg N (46 %)" cạnh kết quả. Không lưu số quy đổi vào seed để không ai
nhầm nó là số của nguồn.

### 3. F1: nhân tuyến tính theo diện tích; giá chỉ từ danh mục

`lượng = định_mức × (diện_tích_m² / reference_area.m²)`. Đơn vị nhập: m², sào Bắc Bộ
(360), sào Trung Bộ (500), công Nam Bộ (1.000), mẫu Bắc Bộ (3.600), ha — luôn hiện quy đổi
m² vì "sào" và "mẫu" khác nhau theo miền. Giá lấy theo `price_product_id` trong danh mục
phân bón; item không có sản phẩm tương ứng (phân chuồng, vôi, SA, calcium nitrat, NPK 5-10-3)
hiện "Chưa có giá" và **bị loại khỏi tổng**, tổng ghi rõ "Chưa gồm: …". Kế hoạch lưu vào
bảng `plans` kèm `items_json` để bản nông dân đã thấy không đổi khi file quy trình đổi sau này.

### 4. F3: mức giá là dải giá/kg đọc từ file, phân loại lúc chạy

`giá_kg = giá_bao / kg_bao`; ngưỡng 12.300 / 14.500 ₫/kg nằm trong `budget_tiers` của
file dữ liệu. Màn hình phân loại lại từ giá chứ không tin nhãn `budget_tier` đã lưu; test
đảm bảo hai cái trùng nhau.

### 5. Kho: FIFO cho giá xuất, giá bình quân cho giá trị tồn

- Tồn = Σ nhập − Σ xuất; giá TB = Σ(kg × giá) / Σ kg; giá trị = tồn × giá TB.
- Giá của một phiếu xuất tính bằng **FIFO** tại thời điểm ghi (lô nhập cũ nhất ra trước,
  các phiếu xuất trước đó được phát lại để không tiêu một lô hai lần; phiếu nhập có ngày sau
  ngày xuất không được tính). Chọn FIFO thay vì bình quân vì đúng với cách bao phân rời khỏi
  kho, và giá đợt mua mới không âm thầm định giá lại phân đã mua từ trước.
- Cùng một luật cài ở hai nơi — `backend/app/services/ledger_service.py` và
  `mobile/src/domain/warehouse.ts` — và cùng được test trên một bộ số (nông hộ mẫu).
- Nhập kho có giá > 0 mặc định sinh **một khoản chi "Phân bón"** trong cùng transaction,
  hai dòng tham chiếu nhau (`expense_id` / `warehouse_in_id`); có thể tắt khi phân tự có.
- `occurred_at` (ngày nghiệp vụ) tách khỏi `created_at` (lúc ghi): phiếu nhập gõ thứ Sáu cho
  hàng về thứ Ba phải nằm trong báo cáo của thứ Ba.

### 6. Thu – Chi: báo cáo theo tháng/quý giờ địa phương; CSV qua bảng chia sẻ

Lãi/lỗ = Σ thu − Σ chi trong kỳ. CSV đúng bố cục đề bài (dòng 1 kỳ; dòng 2 Thu/Chi/Lãi lỗ;
chi tiết; dòng tổng), có BOM để Excel mở đúng tiếng Việt. Trên máy, CSV được đưa ra bằng
`Share.share` (Zalo, Gmail, Drive…) thay vì ghi file — không thêm dependency native cho một
nút xuất.

Biểu đồ vẽ bằng `react-native-svg`, không thêm thư viện chart. Bảng màu 4 slot
(`#2E6F40`, `#2A78D6`, `#EB6834`, `#7C3AED`) đã qua bộ kiểm tra dataviz (dải sáng, ngưỡng
sắc độ, phân biệt mù màu, tương phản 3:1); màu gán cố định theo loại chi, không xoay vòng.
Biểu đồ đường có crosshair chạm để đọc giá trị; donut luôn kèm chú giải có số và %.

### 7. Sáu bảng đồng bộ mới, schema mobile v5

`plans`, `warehouse_in`, `warehouse_out`, `income`, `expense`, `tasks_history` — mirror
cột-với-cột giữa `app/models/ledger.py` và `schema.ts` (parity test), đều là bảng "owned"
(lọc theo `owner_id`, server không tin `owner_id` client gửi). Migration v4→v5 chỉ
`createTable`, không đụng bảng cũ. Xung đột vẫn last-write-wins theo `updated_at`.

### 8. F5–F6: nông dân xác nhận, app không tự ghi

`tasks_history` chỉ được ghi khi nông dân bấm ô "Đã làm" hoặc "Đặt nhắc"; một dòng cho mỗi
(quy trình, giai đoạn, công việc, lô). Nhắc việc là ngày lưu trong dòng đó và hiện ở trang
chủ — chưa có push notification (thuộc giai đoạn sau). Giai đoạn hiện tại: cây hàng năm suy
từ ngày trồng (ADR 0002 §7) rồi ánh xạ qua `growth_stages`; cây lâu năm lấy theo tháng
hiện tại qua `months`.

### 9. Picker giống dùng chung

Ba màn hình chọn giống nhận `returnTo` (`PlotForm` | `FertilizerCalculator` | `CareProtocol`)
và trả thêm `categoryId` để chọn đúng quy trình (cà phê vối ≠ cà phê chè).

## Hệ quả

- Backend: 57 test (15 e2e API cho Giai đoạn 3), phủ 92 %. Mobile: 43 test jest, phủ
  97 % dòng cho `src/domain/**` (logic thuần).
- Test render toàn bộ `App` bị bỏ: nó đã hỏng từ trước (react-navigation ESM + native
  module) và mock WatermelonDB trong jest treo; thay bằng test render từng component.
- `python -m app.seed` tạo thêm nông hộ mẫu `nguyenvancuong` / `matkhau123` (lô PUC-001-HB,
  hai phiếu nhập, ba khoản chi, một khoản thu) để demo và chụp màn hình.
- Web-admin chưa có trang cho các bảng mới (Giai đoạn 4); API đã sẵn: `/plans`,
  `/warehouse/*`, `/income`, `/expense`, `/reports/financials[.csv]`, `/care-protocols`,
  `/tasks-history`.
