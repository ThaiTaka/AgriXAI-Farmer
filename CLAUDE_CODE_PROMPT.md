# PROMPT CHO CLAUDE CODE — DỰ ÁN AGRILOG V2 (BẢN ĐỘC LẬP MỞ RỘNG)

> Copy toàn bộ nội dung dưới đây làm prompt đầu tiên gửi cho Claude Code, kèm 4 file đính kèm:
> 1. `AgriXAI Farmer v4 - Standalone.html` (bản thiết kế mẫu)
> 2. `fertilizers_seed.json` (giá phân bón thật)
> 3. `care_protocol_tomato_seed.json` (lịch bón phân thật cho cà chua)
> 4. `crop_varieties_seed.json` (danh sách giống cà chua thật)

---

## 0. VAI TRÒ VÀ QUY TẮC LÀM VIỆC (đọc kỹ trước khi làm bất cứ điều gì)

Bạn là kỹ sư phần mềm full-stack duy nhất của dự án **AgriLog v2** — ứng dụng ghi chú vật tư nông nghiệp cho nông hộ, gồm app di động, trang quản trị web, và backend. Đây là dự án **độc lập, mới hoàn toàn** (không dùng chung repo với ai khác) — vì vậy khác với tài liệu gốc mà nó dựa theo, **bạn phải tự xây dựng luôn cả phần backend**, không được giả định đã có sẵn.

Quy tắc bắt buộc trong suốt quá trình làm việc:

1. **Làm theo đúng thứ tự giai đoạn ở Mục 5** — không nhảy cóc, không gộp nhiều giai đoạn lại làm một lúc, không tự ý đảo thứ tự dù thấy "làm trước cũng được".
2. **Sau khi xong MỘT giai đoạn, DỪNG LẠI và báo cáo** theo đúng format:
   - **Đã làm gì**: liệt kê file/module mới tạo hoặc đã sửa.
   - **Quyết định kỹ thuật đã chốt**: những lựa chọn cụ thể trong giai đoạn này (vd: đặt tên bảng, cấu trúc field...).
   - **Cần lưu ý / rủi ro / còn thiếu**: nói thật, không giấu vấn đề.
   - **Cách xác nhận "xong"**: lệnh cụ thể để chạy thử (vd: `npx react-native run-android`, `npm run dev`, `pytest`...).
   - Sau đó **CHỜ** — không tự động làm giai đoạn tiếp theo cho tới khi được yêu cầu.
3. **Tự sửa lỗi trong chính giai đoạn đó.** Nếu build lỗi, test đỏ, type lỗi, thiếu dependency... hãy tự chẩn đoán và sửa ngay. Chỉ báo "xong giai đoạn" khi mọi thứ thực sự chạy được — không báo xong rồi để lỗi lại cho giai đoạn sau.
4. **Không dùng dữ liệu giả cho: giá phân bón, danh mục phân bón, danh sách giống cây trồng.** Chi tiết bắt buộc ở Mục 6 — đây là yêu cầu quan trọng nhất mà tài liệu gốc không có.
5. Code/tên biến/comment: tiếng Anh chuẩn. Nội dung hiển thị cho nông dân/admin (UI text): tiếng Việt, đúng chính tả.
6. Nếu một quyết định thực sự cần người dùng chọn (vd: tên package, domain, thông tin tài khoản thật) — hỏi rõ ràng, đừng tự bịa placeholder rồi im lặng.

---

## 1. BỐI CẢNH VÀ PHẠM VI DỰ ÁN

AgriLog v2 gồm 3 phần:

- **Mobile app** (`mobile/`) cho nông hộ: ghi nhật ký canh tác, quản lý lô đất, chẩn đoán bệnh cây cà chua qua ảnh (AI), nhập liệu bằng giọng nói, tư vấn phân bón, lịch chăm sóc, **quản lý kho vật tư (nhập/xuất)**, **ghi thu chi**.
- **Web admin** (`web-admin/`) cho quản trị viên: dashboard thống kê, quản lý tài khoản, xem lịch sử chẩn đoán, **quản lý giá phân bón**, **báo cáo thu chi/kho toàn hệ thống**.
- **Backend** (`backend/`): FastAPI, cung cấp API cho cả hai, dùng SQLite hoặc PostgreSQL (bạn chọn, nêu lý do), có cơ chế đồng bộ hai chiều với mobile.

Cây trồng trọng tâm để chẩn đoán bệnh và tư vấn phân bón: **cà chua**. Các module Kho và Thu-chi phải thiết kế đủ tổng quát để dùng được cho các loại nông sản khác sau này (không hard-code riêng cho cà chua ở tầng dữ liệu kho/tài chính).

Thiết kế giao diện tham chiếu **bắt buộc** theo file HTML đính kèm: `AgriXAI Farmer v4 - Standalone.html` (bản dựng 12 màn hình).

---

## 2. BA ĐIỀU KHÔNG THƯƠNG LƯỢNG (giữ nguyên như tài liệu gốc — vi phạm là lỗi thiết kế)

- **Điều 1 — Ghi cục bộ trước**: Không màn hình nào của nông hộ được chờ mạng mới ghi được. Mọi thao tác tạo/sửa/xoá commit vào SQLite cục bộ (WatermelonDB) ngay lập tức. UI vẽ lại từ truy vấn observable, không bao giờ từ HTTP response trực tiếp.
- **Điều 2 — Nhập bằng giọng nói**: Không thao tác nào của nông hộ bắt buộc gõ nhiều. Giọng nói là đường nhập liệu thay thế hoàn chỉnh. Mô hình ASR chạy hoàn toàn trên thiết bị — không upload audio, không gọi Google Speech hay bất kỳ SDK đám mây nào.
- **Điều 3 — Không phụ thuộc API ngoài để suy luận**: Không tính năng nào của nông hộ được gọi API bên ngoài để chạy mô hình suy luận (AI chẩn đoán, ASR, NLP). Chỉ chẩn đoán ảnh cần mạng để gửi lên backend riêng của mình — khi mất mạng, ảnh xếp hàng chờ, không chặn thao tác khác.

---

## 3. THIẾT KẾ GIAO DIỆN — BÁM SÁT FILE HTML ĐÍNH KÈM

File `AgriXAI Farmer v4 - Standalone.html` là **nguồn sự thật duy nhất** cho màu sắc, font, bo góc, spacing, style component. Không tự đặt màu/font khác.

Việc đầu tiên: mở file HTML, trích xuất toàn bộ giá trị CSS thực tế (không phải chỉ theo bảng tóm tắt dưới đây — bảng dưới là để đối chiếu, file HTML là nguồn chính) → mã hoá vào `shared/design/tokens.json` → sinh `mobile/src/theme.ts` và `web-admin/src/app/tokens.css` từ file này. Không hard-code màu trong component.

### 3.1. Bảng màu tham khảo (đối chiếu với file HTML)

| Token | Mã màu | Dùng ở đâu |
|---|---|---|
| green.700 | #2E6F40 | Primary — nút chính, tab đang chọn, link |
| green.500 | #54A96A | Đầu sáng của gradient primary |
| green.050 | #EEF2EC | Nền web / nền shell |
| lime.500 | #C3D24A | Nhấn phụ, nhãn nhóm nấm, mức Nhẹ |
| amber.500 | #F2A104 | Thời tiết, nhãn virus, mức Trung bình |
| danger.bg | #C24A12 | Mức Nặng — nền đặc, KHÔNG phải nền mờ |
| text.secondary | #4B5F51 | Mô tả phụ, nhãn eyebrow |
| border.soft | #E2E8E2 | Viền thẻ web |

### 3.2. Ánh xạ mức độ bệnh sang màu

| Mức độ | Nền | Chữ |
|---|---|---|
| Khoẻ mạnh | rgba(84,169,106,.20) | #2E6F40 |
| Nhẹ | rgba(195,210,74,.18) | #4A5810 |
| Trung bình | rgba(242,161,4,.20) | #7A4F00 |
| Nặng | #C24A12 (đặc) | #FFF3E8 |

Lưu ý: mức Nặng cố ý dùng nền đặc để nổi bật khi liếc nhanh ngoài nắng — không thay bằng nền mờ.

### 3.3. Chữ (Open Sans, nhúng kèm app — không tải từ Google Fonts)

| Vai trò | Cỡ | Weight |
|---|---|---|
| Tiêu đề màn hình | 34 | 800 |
| Tiêu đề mục | 21–23 | 800 |
| Tiêu đề thẻ | 16.5–18.5 | 700 |
| Thân văn bản | 15 | 400–500 |
| Phụ / meta | 12.5–13.5 | 600 |
| Ô nhập liệu | 16 (tối thiểu) | 600 — dưới mức này iOS tự phóng to |

### 3.4. Ba ràng buộc ngoài đồng — ưu tiên hơn thẩm mỹ

- Vùng chạm tối thiểu 48dp. Ô nhập cao tối thiểu 50px.
- Tương phản chữ ≥ 4,5:1 so với nền đã tổng hợp — tính trên nền xanh gradient thật.
- Phải có bộ token thay thế đặc (solid) khi backdrop-filter không khả dụng. Bật tự động khi thiết bị yếu hoặc người dùng chọn "Chế độ ngoài nắng".

---

## 4. KIẾN TRÚC & CÔNG NGHỆ

| Phần | Công nghệ | Lý do chọn |
|---|---|---|
| Mobile | React Native CLI + TypeScript + WatermelonDB | Cần native module (SQLite/JSI, ASR). Không dùng Expo vì Expo không hỗ trợ native module tuỳ chỉnh dễ dàng. |
| Web Admin | Next.js App Router + Tailwind CSS | App Router hỗ trợ Server Component mặc định, tối ưu tải trang. Admin dùng trên PC, không cần offline. |
| Backend | FastAPI + SQLite (dev) / PostgreSQL (khi cần production thật) | Bạn tự dựng mới hoàn toàn theo đúng hợp đồng endpoint ở Mục 7 — vì đây là dự án độc lập, không có ai khác viết backend cho bạn. |
| Đồng bộ | WatermelonDB Sync Adapter + FastAPI | Sync hai chiều thật, xử lý xung đột — xem yêu cầu bắt buộc ở Mục 9. |
| ASR (giọng nói) | Vosk hoặc whisper.cpp (chọn qua benchmark ở Bước 5) | Chạy hoàn toàn offline trên thiết bị. |
| Design token | `shared/design/tokens.json` | Một nguồn sự thật cho cả mobile (`theme.ts`) và web (`tokens.css`). |
| Dữ liệu tĩnh/offline | `shared/data/*.json` | Danh mục bệnh, phân bón, quy trình chăm sóc, giống cây — đọc offline hoàn toàn. |
| Mô hình AI chẩn đoán | `DummyPredictor` ban đầu, thay bằng model thật qua biến môi trường `MODEL_CHECKPOINT` khi có | Không chặn tiến độ vì chưa có model thật. |

---

## 5. THỨ TỰ LÀM — GIAI ĐOẠN (PHẢI ĐÚNG THỨ TỰ NÀY, không đảo)

Mỗi giai đoạn có điều kiện "xong khi nào" — không sang giai đoạn tiếp khi chưa đạt. Sau mỗi giai đoạn: dừng và báo cáo theo Mục 0.

### Giai đoạn 0 — Khởi tạo dự án
- 0.1 Tạo repo Git, nhánh chính `main`, làm việc trên nhánh `feature/...` nếu cần.
- 0.2 Khởi tạo `web-admin/` bằng `npx create-next-app@latest web-admin --typescript --tailwind --app`.
- 0.3 Khởi tạo `mobile/` bằng React Native CLI (không Expo): `npx react-native init agrilogapp --template react-native-template-typescript`. Cài `WatermelonDB`, `react-native-linear-gradient`.
- 0.4 Khởi tạo `backend/` bằng FastAPI (cấu trúc thư mục rõ ràng: `routers/`, `models/`, `schemas/`, `services/`), cài SQLAlchemy hoặc ORM tương đương.
- 0.5 Design token: tạo `shared/design/tokens.json` từ file HTML đính kèm (Mục 3) → sinh `mobile/src/theme.ts` và `web-admin/src/app/tokens.css`.
- 0.6 Dữ liệu tĩnh offline: tạo `shared/data/tomato_diseases.json` (10 bệnh cà chua phổ biến — tự tổng hợp kiến thức nông nghiệp chuẩn, ghi rõ đây là dữ liệu triệu chứng/khuyến cáo tổng hợp, không phải chẩn đoán y tế), `shared/data/fertilizer_recommendations.json` (**khởi tạo từ `fertilizers_seed.json` đính kèm — xem Mục 6**), `shared/data/care_protocols.json` (**khởi tạo từ `care_protocol_tomato_seed.json` đính kèm**), `shared/data/crop_varieties.json` (**khởi tạo từ `crop_varieties_seed.json` đính kèm**).
- 0.7 Dựng backend cục bộ, xác nhận `GET /health`, `POST /auth/login` chạy được với dữ liệu test.
- **Xong khi nào**: `npx react-native run-android` chạy được màn hình mặc định · `next dev` chạy được · backend chạy và `GET /health` trả JSON đúng · `shared/data/` có đủ 4 file · git repo có commit đầu tiên.

### Giai đoạn 1 — 4 màn hình lõi mobile
Xây theo đúng thứ tự, không xây song song: (1) Đăng nhập — JWT lưu Keychain/Keystore, không lưu AsyncStorage; (2) Trang chủ – danh sách lô đất — badge sức khoẻ tính từ severity chẩn đoán gần nhất; (3) Chi tiết lô đất — tab Thông tin · Lịch sử chẩn đoán · Chu kỳ canh tác · Lịch chăm sóc · Lịch sử thay đổi; (4) Thêm/Sửa lô đất — mã lô tự sinh nếu để trống, lưu SQLite trước, sync sau.
**Xong khi nào**: 4 màn hình chạy được, thao tác tạo/sửa lô đất hoạt động offline hoàn toàn (tắt mạng vẫn dùng được).

### Giai đoạn 2 — Luồng chẩn đoán ảnh
5 màn hình liên tiếp: Chụp/chọn ảnh → Đang phân tích (xếp hàng khi offline) → Kết quả (top-3 + heatmap) → Gợi ý xử lý + thuốc → Lịch sử chẩn đoán. Test end-to-end trên `DummyPredictor`.
Trường hợp đặc biệt bắt buộc xử lý đúng:
- `mosaic_virus` và `healthy`: danh sách thuốc rỗng → hiện thông báo "không có thuốc gợi ý", không đề xuất thuốc.
- `yellow_leaf_curl_virus`: thuốc liệt kê là trị bọ phấn trắng (môi giới truyền bệnh), không phải trị virus — câu giải thích này phải hiện ngay trên danh sách thuốc.
- `spider_mites`: đây là nhện hại, không phải nấm → cảnh báo rõ "phun thuốc trừ nấm sẽ không có tác dụng".
**Kiểm tra bắt buộc**: tắt mạng → chụp ảnh → xác nhận ảnh xếp hàng chờ và KHÔNG có thông báo lỗi chặn UI.

### Giai đoạn 3 — Màn hình còn lại + Nhật ký + Tư vấn phân bón + Lịch chăm sóc + Kho + Thu-chi
Đây là bước lớn nhất, gồm cả tính năng gốc và tính năng MỚI. Thứ tự con:
1. Danh mục bệnh (danh sách + chi tiết), Hồ sơ cá nhân.
2. Nhật ký canh tác (form thủ công trước, có nút mic placeholder — giọng nói thật làm ở Giai đoạn 5).
3. Tư vấn & phân loại phân bón (F1–F4, xem chi tiết thật ở Mục 8.1) — dùng `fertilizer_recommendations.json` đã seed.
4. Lịch chăm sóc theo giai đoạn cây (F5–F6, xem Mục 8.2) — dùng `care_protocols.json` đã seed.
5. **[MỚI] Nhập – Xuất kho** (xem Mục 8.3) — mở rộng từ "Vật tư & Tồn kho" gốc thành module đầy đủ.
6. **[MỚI] Thu – Chi** (xem Mục 8.4) — module hoàn toàn mới.
**Xong khi nào**: toàn bộ luồng mobile chạy được kể cả 2 module mới, có thể trình demo đầu tiên.

### Giai đoạn 4 — Web Admin (làm song song hoặc ngay sau Giai đoạn 3)
Người dùng là quản trị viên trên máy tính, có mạng — không cần WatermelonDB/offline. Các trang: Đăng nhập Admin; Dashboard (tổng số lô đất/nông dân/chẩn đoán, biểu đồ — dùng recharts); Quản lý lô đất (chỉ xem); Lịch sử chẩn đoán toàn hệ thống; Quản lý tài khoản (CRUD, khoá/mở, đổi vai trò); Danh mục bệnh (chỉ xem); **[MỚI] Quản lý giá phân bón** (xem Mục 8.1 — sửa giá, xem lịch sử giá); **[MỚI] Báo cáo Kho & Thu-chi** (xem Mục 8.3, 8.4 — biểu đồ, xuất CSV, đây là tính năng bắt buộc chứ không phải tuỳ chọn).
**Xong khi nào**: admin đăng nhập được, dashboard hiển thị đúng số liệu thật từ backend, trang giá phân bón sửa được và lưu lịch sử.

### Giai đoạn 5 — Nhận dạng giọng nói & NLP mở rộng
Bắt đầu sau khi đủ các màn hình ở Giai đoạn 3–4 hoạt động.
- 5.1 Benchmark Vosk và whisper.cpp trên cùng thiết bị Android tầm trung thật. Đo WER trên tối thiểu 200 câu nhật ký thật thu ngoài đồng (câu bón phân kiểu "bón 25 ký u rê cho vườn nhà trên" phải được kiểm tra riêng).
- 5.2 Tiêu chí chọn: WER ≤ 25%, độ trễ ≤ 1,5× thời lượng ghi, RAM đỉnh ≤ 400MB, APK tăng ≤ 100MB. Ghi quyết định vào một file ADR (Architecture Decision Record).
- 5.3 Bọc engine theo interface `AsrEngine` chung — tầng UI không biết engine nào đang chạy.
- 5.4 Xây `DummyAsrEngine` trả câu cố định theo hash file trước, test NLP/UI trước khi có model thật.
- 5.5 Pipeline NLP local (6 bước: thu âm → nhận dạng → trích xuất thực thể → điền form → độ tin cậy từng ô → xác nhận). Mở rộng riêng cho câu bón phân: trích `supplyId`, số lượng, đơn vị, lô đất → **preview xuất kho ngay trong form (liên kết trực tiếp với module Kho ở Giai đoạn 3)**. Bộ ngữ liệu vàng ≥ 150 câu.
- 5.6 Tích hợp UI: nút mic tròn nổi, gradient primary, hiệu ứng khi đang ghi, cố định góc phải dưới ở màn hình Nhật ký.
**Kiểm thử bắt buộc**: chế độ máy bay (ghi âm → nhận dạng → điền form → lưu phải chạy trọn vẹn); chặn mạng khi chạy ASR (bất kỳ request nào phát ra là test đỏ); dọn dẹp cache audio sau khi xong/huỷ (thư mục phải rỗng).

### Giai đoạn 6 — Chuẩn bị hoàn thiện, README, đóng gói demo
- 6.1 Test tích hợp toàn bộ luồng trên thiết bị thật với backend thật.
- 6.2 Nếu có checkpoint AI thật: cập nhật `MODEL_CHECKPOINT`.
- 6.3 Đánh version trong `package.json`, lint sạch, `tsc --noEmit` sạch, test schema đồng bộ (`test_schema_parity`) xanh.
- 6.4 Tạo dữ liệu demo: ít nhất 3 tài khoản nông hộ, 5 lô đất, lịch sử đủ 4 mức độ bệnh, 2 chu kỳ canh tác có bón phân, vài phiếu nhập/xuất kho và vài khoản thu/chi để dashboard có dữ liệu thật để demo.
- 6.5 **Viết `README.md`** — xem yêu cầu chi tiết ở Mục 10.
**Xong khi nào**: chạy demo trọn vẹn từ đăng nhập → chẩn đoán → nhật ký giọng nói → tư vấn phân bón → kho/thu-chi → xem trên web admin, không lỗi vỡ luồng.

---

## 6. DỮ LIỆU THẬT — KHÔNG DÙNG DỮ LIỆU GIẢ (yêu cầu quan trọng nhất, khác tài liệu gốc)

Tài liệu gốc dùng `DummyPredictor` và dữ liệu JSON tĩnh cho phần AI/ASR — điều đó **vẫn giữ nguyên và đúng** (vì đó là mô hình AI thật sự chưa train xong, dùng dummy tạm là hợp lý). Nhưng với **giá phân bón, danh mục phân bón, danh sách giống cây trồng** — đây là dữ liệu tra cứu thực tế, **không được bịa số liệu**.

1. Ba file đính kèm (`fertilizers_seed.json`, `care_protocol_tomato_seed.json`, `crop_varieties_seed.json`) chứa dữ liệu THẬT đã thu thập từ nguồn thị trường Việt Nam (có ghi nguồn và ngày thu thập trong từng file). Dùng làm dữ liệu khởi tạo (seed) cho `shared/data/fertilizer_recommendations.json`, `shared/data/care_protocols.json`, và bảng `crop_varieties`.
2. Giá phân bón biến động theo ngày và vùng miền — vì vậy **bắt buộc** xây màn hình Admin "Quản lý giá phân bón" (Giai đoạn 4) cho phép sửa giá tay và lưu **lịch sử giá** (`fertilizer_price_history`, có `changed_at`, `old_price`, `new_price`, `changed_by`). Không hard-code giá trong code ở bất kỳ đâu.
3. Với các nhóm còn thiếu dữ liệu giá đã xác thực trong file seed (vi sinh/vi lượng — xem ghi chú trong `fertilizers_seed.json`): hiển thị UI dạng "Chưa có dữ liệu giá, vui lòng cập nhật" thay vì tự bịa số.
4. Danh sách giống cây trồng: khởi tạo từ `crop_varieties_seed.json` (8 giống cà chua thật). Màn hình "Chọn giống cây" phải có:
   - Danh sách có sẵn từ seed (hiển thị mô tả quả, công dụng, ghi chú).
   - Nút **"+ Thêm giống mới"**: cho phép nhập tên + mô tả tự do khi nông dân dùng giống chưa có trong danh sách. Lưu vào bảng `crop_varieties` cục bộ (SQLite/WatermelonDB) ngay lập tức (đúng Điều 1), rồi đồng bộ lên server để giống mới này dùng chung được cho toàn hệ thống (các nông hộ khác thấy được nếu server cấu hình chia sẻ danh mục chung, hoặc ít nhất admin nhìn thấy và duyệt).
   - Bảng `crop_varieties` phải là dữ liệu có thể mở rộng qua UI/API — không hard-code danh sách cứng trong code nguồn.
5. Với module Kho và Thu-chi (Mục 8.3, 8.4): giá vật tư trong phiếu nhập kho phải lấy từ bảng giá phân bón nói trên (hoặc cho phép nhập giá thực tế đã mua nếu khác giá tham khảo) — không tự sinh giá ngẫu nhiên.

---

## 7. BACKEND — HỢP ĐỒNG ENDPOINT (bạn tự xây, theo đúng cấu trúc này)

### 7.1. Endpoint gốc (giữ nguyên từ tài liệu roadmap)

| Nhóm | Endpoint | Mô tả |
|---|---|---|
| Xác thực | `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me` | Đăng nhập JWT, xem/sửa hồ sơ |
| Lô đất | `GET/POST /plots`, `GET/PATCH/DELETE /plots/{id}` | CRUD lô đất, lịch sử chẩn đoán gần nhất |
| Chẩn đoán | `POST /diagnoses`, `GET /diagnoses`, `GET/PATCH/DELETE /diagnoses/{id}` | Gửi ảnh, lấy kết quả, lịch sử |
| Bệnh | `GET /diseases`, `GET /diseases/{key}` | Danh mục 10 bệnh + chi tiết |
| Vật tư & Phân bón | `GET/POST /supplies`, `GET/PATCH/DELETE /supplies/{id}` | Danh mục vật tư của hộ, tồn kho |
| Nhật ký | `GET/POST /diary-entries`, `GET/PATCH/DELETE /diary-entries/{id}` | Nhật ký canh tác, liên kết vật tư/xuất kho |
| Quy trình chăm sóc | `GET /care-protocols?crop_type=`, `GET /care-protocols/{id}` | Lịch bón phân, phun thuốc theo giai đoạn |
| Phân bón | `GET /fertilizer-recommendations?crop_type=&area=`, `GET /fertilizers` | Gợi ý phân bón theo cây và diện tích |
| Admin | `GET /users`, `POST /users`, `PATCH /users/{id}` | Quản lý tài khoản |
| Thống kê | `GET /stats/dashboard`, `GET /health` | Dashboard + trạng thái mô hình |

### 7.2. Endpoint MỚI cần bổ sung (không có trong tài liệu gốc)

| Nhóm | Endpoint | Mô tả |
|---|---|---|
| Kho (nhập/xuất) | `GET/POST /inventory-transactions`, `GET/PATCH/DELETE /inventory-transactions/{id}` | Phiếu nhập/xuất kho từng loại vật tư |
| Kho — thống kê | `GET /inventory-transactions/summary?plot_id=&from=&to=` | Tổng nhập/xuất theo tháng/loại/lô, tồn kho hiện tại |
| Thu chi | `GET/POST /finance-entries`, `GET/PATCH/DELETE /finance-entries/{id}` | Khoản thu (bán nông sản) và chi (mua vật tư, nhân công...) |
| Thu chi — báo cáo | `GET /finance-entries/summary?plot_id=&from=&to=` | Lãi/lỗ theo lô/vụ/tháng, dữ liệu cho biểu đồ |
| Giá phân bón | `GET/POST/PATCH /fertilizer-prices`, `GET /fertilizer-prices/{id}/history` | Quản lý giá + lịch sử giá |
| Giống cây trồng | `GET/POST /crop-varieties` | Danh sách giống (seed + do người dùng thêm), đồng bộ hai chiều |
| Xuất báo cáo | `GET /reports/export?type=inventory|finance&format=csv` | Xuất CSV báo cáo kho/thu-chi (thay thế UC-A11 "chưa có backend" trong tài liệu gốc — giờ bắt buộc phải có) |

(*) Với `care-protocols` và `fertilizer-recommendations`: nếu chưa kịp làm endpoint thật, đọc trực tiếp từ `shared/data/*.json` — hoạt động offline hoàn toàn, không chặn tiến độ mobile.

---

## 8. CHI TIẾT CÁC TÍNH NĂNG (gốc + mới)

### 8.1. Tư vấn & phân loại phân bón (F1–F4, gốc — làm rõ thêm bằng dữ liệu thật)
- **F1** — Tính lượng phân bón cần cho 1 lô/ha: người dùng chọn cây (mặc định cà chua) + nhập diện tích (m² hoặc ha) → tính theo `care_protocol_tomato_seed.json` (2 phương án bón: 25% hữu cơ hoặc 50% phân chuồng). Hiển thị rõ đây là **liều lượng tham khảo**, kèm nguồn.
- **F2** — Phân loại theo nhóm thị trường thực: Đạm, Lân, Kali, NPK tổng hợp (theo tỉ lệ N-P-K cụ thể), Hữu cơ, Vi sinh/vi lượng (nếu có dữ liệu). Mỗi sản phẩm hiển thị: tên thương mại thật, nhóm, tỉ lệ NPK, đơn vị đóng gói thật (bao 50kg, gói 1–5kg...), khoảng giá thật + ngày cập nhật + nguồn — lấy từ `fertilizer_recommendations.json` đã seed.
- **F3** — Xem theo ngân sách (bình dân/trung bình/cao cấp): phân nhóm dựa trên **giá thật** trong bảng phân bón (vd: chia theo phân vị giá, không quy đổi cứng số tiền).
- **F4** — Kiểm tra kho: lọc phân bón đã có trong kho của hộ (liên kết trực tiếp bảng `supplies`/module Kho ở 8.3) phù hợp yêu cầu bón thúc hiện tại, ưu tiên dùng hàng có sẵn trước khi gợi ý mua mới.

### 8.2. Quy trình chăm sóc theo giai đoạn (F5–F6, gốc)
Tab "Lịch chăm sóc" trong Chi tiết lô đất, hiển thị công việc gợi ý theo giai đoạn hiện tại (seedling → vegetative → flowering → fruiting → harvesting), dùng dữ liệu thật từ `care_protocol_tomato_seed.json` (ánh xạ theo `stage_mapping_note` trong file). Nông dân bấm "Đã làm" → form nhật ký điền sẵn, vẫn phải xác nhận trước khi lưu. Không tự động ghi.
(F7 — nhắc lịch local notification: ưu tiên P2, làm sau nếu còn thời gian.)

### 8.3. [MỚI] Nhập – Xuất kho
Mở rộng "Vật tư & Tồn kho" gốc thành module quản lý kho đầy đủ:
- Phiếu **nhập kho**: loại vật tư, số lượng, đơn giá thực tế đã mua (mặc định gợi ý từ bảng giá phân bón, cho sửa tay), nhà cung cấp, ngày.
- Phiếu **xuất kho**: loại vật tư, số lượng, lô đất, ngày, liên kết với nhật ký canh tác (một entry nhật ký "đã bón phân X" tự tạo xuất kho tương ứng — đã có sẵn ý tưởng này trong pipeline giọng nói F8 ở Giai đoạn 5, giờ tổng quát hoá cho cả nhập liệu tay).
- Tồn kho = tổng nhập − tổng xuất, tính tự động, cảnh báo khi tồn thấp (ngưỡng do người dùng đặt).
- **Bảng thống kê**: tổng nhập/xuất theo tháng, theo loại vật tư, theo lô đất; biểu đồ xu hướng tồn kho theo thời gian.
- Đồng bộ 2 chiều đầy đủ như các bảng khác — không làm kiểu chỉ đồng bộ một chiều.

### 8.4. [MỚI] Thu – Chi
Module hoàn toàn mới, không có trong tài liệu gốc:
- Ghi khoản **Thu**: loại nông sản, sản lượng, đơn giá bán, ngày, lô đất.
- Ghi khoản **Chi**: có thể tự động tạo từ phiếu nhập kho (8.3), hoặc nhập tay chi phí khác (nhân công, điện nước, vận chuyển...).
- **Bảng thống kê**: lãi/lỗ theo lô đất, theo vụ canh tác, theo tháng; biểu đồ thu-chi theo thời gian.
- Xuất báo cáo CSV (endpoint `/reports/export` ở Mục 7.2) — tính năng này trong tài liệu gốc ghi "chưa có backend, tuỳ chọn" (UC-A11); trong dự án này nó là **bắt buộc** vì là tính năng lõi của module thu-chi.

### 8.5. Voice-to-Text mở rộng sang nhật ký bón phân (F8–F9, gốc)
- **F8** — Sau khi NLP trích xuất `supplyId`, hiển thị preview xuất kho (tồn trước → sau) ngay trong form xác nhận, liên kết trực tiếp module Kho (8.3). Nông dân bấm Lưu là vừa ghi nhật ký vừa xuất kho.
- **F9** — Nếu nông dân nói tên phân bón chưa có trong kho: hiện chip "Không tìm thấy: [tên]" kèm nút "Tạo vật tư mới" điền sẵn tên.

---

## 9. ĐỒNG BỘ DỮ LIỆU — PHẢI LÀM THẬT, KHÔNG NỬA VỜI

Đây là dự án cá nhân, không bị áp lực chia việc/thời gian như nhóm gốc — vì vậy **mặc định làm đồng bộ hai chiều đầy đủ ngay từ đầu**, không dùng phương án dự phòng "pull-only sync" trừ khi thực sự bế tắc kỹ thuật (nếu vậy phải nêu rõ lý do kỹ thuật cụ thể trong báo cáo giai đoạn và đề xuất kế hoạch nâng cấp sau).

Yêu cầu cụ thể:
- Dùng WatermelonDB Sync Adapter ở mobile, endpoint sync chuẩn ở backend (`pullChanges`/`pushChanges`).
- Đồng bộ phải bao gồm **tất cả** các bảng, kể cả bảng mới: `inventory_transactions`, `finance_entries`, `crop_varieties`, `fertilizer_prices` (nếu cần đồng bộ xuống mobile để dùng offline).
- Xử lý xung đột: định nghĩa rõ chiến lược (vd: last-write-wins theo `updated_at`, hoặc field-level merge nếu cần) — nêu rõ chiến lược đã chọn và lý do trong báo cáo giai đoạn.
- **Test bắt buộc**: 2 thiết bị cùng sửa 1 bản ghi khi cả hai offline, sau đó lần lượt lên mạng và đồng bộ — xác nhận không mất dữ liệu và xung đột được xử lý theo đúng chiến lược đã định. Mất mạng giữa chừng khi đang đồng bộ — xác nhận resume/retry đúng, không đồng bộ trùng hoặc mất dữ liệu.
- Ghi log đồng bộ (ít nhất ở mức debug) để dễ chẩn đoán lỗi sau này.

---

## 10. YÊU CẦU VIẾT README.md

Ở Giai đoạn 6 (có thể cập nhật dần từ các giai đoạn trước), viết `README.md` ở thư mục gốc, tiếng Việt, dễ hiểu cho người mới, chuẩn Markdown để hiển thị đẹp trên GitHub, gồm:

1. Giới thiệu ngắn gọn dự án (AgriLog v2 là gì, giải quyết vấn đề gì cho nông hộ).
2. Mục lục.
3. Ảnh chụp màn hình (để chỗ trống `![screenshot](docs/screenshot-x.png)` — tự chèn ảnh thật sau).
4. Kiến trúc thư mục (`mobile/`, `web-admin/`, `backend/`, `shared/`) kèm giải thích ngắn từng phần.
5. Hướng dẫn cài đặt và chạy riêng biệt cho từng phần (mobile, web, backend), kể cả prerequisites (Node version, Android SDK...).
6. Danh sách biến môi trường cần thiết (`.env.example` đi kèm).
7. Lệnh chạy test, lint.
8. Giới hạn hiện tại (đang dùng `DummyPredictor`/`DummyAsrEngine`, cách thay bằng model thật).
9. Ghi chú về nguồn dữ liệu thật (giá phân bón, giống cây) và cách cập nhật khi giá thị trường thay đổi.
10. Lộ trình tiếp theo / việc chưa làm.

---

## 11. NHỮNG GÌ KHÔNG LÀM (ranh giới đã chốt, giữ nguyên từ tài liệu gốc)

| Không làm | Lý do |
|---|---|
| API Gateway / tích hợp hệ thống khác | Ngoài phạm vi dự án |
| Gọi LLM/API ngoài ở bất kỳ đâu trong đường chạy suy luận | Vi phạm Điều 3 |
| Upload audio lên máy chủ để nhận dạng giọng nói | Vi phạm Điều 2 |
| Chẩn đoán bệnh trên cây trồng khác ngoài cà chua (ở module AI) | Ngoài phạm vi mô hình đã có — nhưng module Kho/Thu-chi/Giống cây vẫn phải tổng quát cho nhiều loại nông sản |
| Bịa số liệu giá phân bón hoặc giống cây trồng | Vi phạm yêu cầu dữ liệu thật ở Mục 6 |

---

## 12. BẮT ĐẦU

Bắt đầu ngay từ **Giai đoạn 0** theo Mục 5. Khi hoàn thành và xác nhận đủ điều kiện "xong khi nào", dừng lại và báo cáo đúng format ở Mục 0. Chờ prompt tiếp theo trước khi làm Giai đoạn 1.
