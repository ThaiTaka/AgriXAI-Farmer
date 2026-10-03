# ADR 0009 — Dữ liệu Lâm Đồng: danh mục giống, quy trình, sào Lâm Đồng, ảnh cây trồng, video nhẹ

- **Ngày:** 2026-10-02
- **Trạng thái:** Đã áp dụng (nhánh `fix/doi-tai-khoan-cung-may`)
- **Liên quan:** [ADR 0004](0004-he-thiet-ke-phang-va-danh-muc-giong-3-cap.md) (danh mục 3 cấp), [ADR 0005](0005-giai-doan-3-tu-van-cham-soc-kho-thu-chi.md) (quy trình chăm sóc, F1), [ADR 0008](0008-v2-1-canh-tac-media-nhan-cong.md) (hướng dẫn có video)

## Bối cảnh

Ứng dụng phục vụ nông hộ **làng hoa Vạn Thành, Đà Lạt (Lâm Đồng)**. Yêu cầu: nguồn phải chính
xác, không bịa; số liệu nào lệch nguồn uy tín thì sửa ngay; thêm đơn vị diện tích của Lâm Đồng;
lọc dữ liệu cho hợp nông sản Lâm Đồng, cụ thể hơn là Đà Lạt; bấm vào loại cây thì thấy ảnh của
cây đó; video YouTube trong app bị giật.

Trước thay đổi, danh mục có 9 loại cây · 23 loại con · 46 giống, phần lớn lấy từ trang của các
công ty giống bán toàn quốc; quy trình chăm sóc lấy từ nhiều tỉnh khác (Lai Châu, Ninh Bình),
VUSTA 2005 và giongcaytrong.org. Không có loài hoa nào, dù Vạn Thành là làng hoa.

## Quyết định

### 1. Nguồn chính: bộ 120 quy trình của UBND tỉnh Lâm Đồng

**Quyết định 1972/QĐ-UBND ngày 04/11/2025** của UBND tỉnh Lâm Đồng ban hành 120 quy trình kỹ
thuật trồng, chăm sóc cây trồng (Sở Nông nghiệp và Môi trường soạn), đăng tại Trung tâm Khuyến
nông tỉnh: <https://khuyennong.lamdong.gov.vn/News/tai-lieu-ky-thuat/ky-thuat-trong-trot/2025/11/1913.aspx>
(tệp gốc: <https://drive.google.com/file/d/1_FypkADF49g9XL6pgtMDVBZAHEnElLxB/view>). Mỗi quy
trình trong `care_protocols.json` ghi phụ lục, số thứ tự và mục đã chép (`source.section`).

Nguồn bổ trợ: Địa chí Đà Lạt (UBND TP Đà Lạt, Phần III, Chương I, mục 4.1); QĐ 704/QĐ-SNN
(21/12/2020) và QĐ 729/QĐ-SNN (28/12/2021) — 20 sản phẩm nông nghiệp công nghệ cao của tỉnh;
trang giống của Trung tâm Nghiên cứu Khoai tây, Rau và Hoa (PVFC, Thái Phiên, Đà Lạt); Báo Lâm
Đồng; Viện Eakmat/WASI cho cà phê.

### 2. Danh mục: 23 loại cây · 44 loại con · 193 giống

- **Hoa (Vạn Thành, Đà Lạt):** cúc, hồng, cẩm chướng, đồng tiền, lily, lay ơn, cát tường.
- **Rau – củ – quả:** cà chua, ớt (ớt ngọt; ớt cay chỉ địa, chỉ thiên), dưa leo, bắp cải, cải
  thảo, súp lơ, xà lách, rau muống, cà rốt, khoai tây, dâu tây.
- **Cây lương thực:** lúa, ngô. **Đặc sản, cây lâu năm:** atisô, cà phê, chè.

Tám loài bắt buộc của đồ án (cà chua, ớt, dưa leo, cà rốt, rau muống, bắp cải, lúa, ngô) **được
giữ** — cả tám đều trồng ở Lâm Đồng: lúa (Phụ lục II, quy trình 1), ngô (II.2), dưa chuột (III.23)
và ớt cay (III.14) có quy trình riêng trong QĐ 1972; rau muống được Báo Lâm Đồng (07/03/2023) ghi
nhận trồng trong mô hình nhà lưới ở xã An Nhơn, huyện Đạ Tẻh. Có test khoá tám loài này ở cả
backend (`test_the_eight_required_crops_are_in_the_catalogue`) và mobile (`cropIdentity.test.ts`).

Giống lấy theo tên ghi trong quy trình của tỉnh; chỗ nguồn chỉ nêu tên mà không mô tả, trường mô
tả ghi "Nguồn không mô tả đặc điểm riêng của giống". Bị gỡ vì không có nguồn Lâm Đồng: ớt kiểng,
cà phê mít (Liberica), cà phê Excelsa, và các danh sách giống cũ lấy từ công ty giống ngoài tỉnh
(8 giống cà chua gồm MV1, 9 giống dưa leo F1, ớt chỉ thiên/hiểm/sừng, ngô nếp HN88, lúa Khang
dân 18).

Giống seed bị gỡ khỏi file được máy chủ **xoá mềm** khi seed lại (`app/seed.py`), nên điện thoại
nhận trong danh sách `deleted` ở lần đồng bộ sau; lô đã gắn giống cũ vẫn giữ tên giống đã lưu.

### 3. Số liệu cũ lệch nguồn — đã sửa

| Mục | Bản cũ | Nguồn nói | Đã sửa |
|---|---|---|---|
| Cà phê TRS1 | 100 nhân ~19–20 g; loại 1 > 85 %; tươi/nhân ~4,1 (dẫn VISTA) | Eakmat: tươi/nhân 4,6; 100 nhân 19,1 g; hạt loại 1 > 85,3 % | Số liệu theo Eakmat; phần "lai tổng hợp từ TR4, TR9, TR11, TR12, công nhận 2015" ghi rõ là theo VISTA |
| Cà phê THA1 | "Khối lượng 100 **hạt** 17,3 g" | "Trọng lượng 100 **nhân** 17,3 g" | Sửa chữ; phần canh tác viết lại đúng theo trang đã dẫn |
| "Thiện Trường (TS1)" | Một giống | Eakmat mô tả **hai giống riêng** (Hình 5 Thiện Trường, Hình 6 TS1) | Gỡ — gộp nhầm, và không có nguồn Lâm Đồng |
| Cà rốt "PHUDI 1.0" | Nguồn trỏ tới trang giống **PD789** | Tên và trang nguồn không khớp | Gỡ; cà rốt dùng giống của PVFC và QĐ 1972 |

### 4. Đơn vị diện tích: sào Lâm Đồng = 1.000 m²

Hai nguồn báo chí uy tín, độc lập, mô tả đúng cách nông dân Đà Lạt tính:

- Báo Nhân Dân, 06/01/2019, "Giá hoa cúc 'chạm đáy', nhà nông Đà Lạt ngậm ngùi nhổ bỏ": "để canh
  tác một sào (1.000m2) hoa cúc"; "hơn ba sào (3.000m2) hoa cúc".
- TTXVN (VietnamPlus/Báo Tin tức), 18/09/2026, "Nông dân Đà Lạt 'nhàn nhã' nhờ ứng dụng nông
  nghiệp thông minh": "hơn 6 sào (1.000 m2/sào) nhà kính … phường Xuân Trường – Đà Lạt".

Con số "sào Tây Nguyên = 497 m²" chỉ có trên blog bất động sản, không có nguồn chính thống, và
trái với cách người trồng ở Đà Lạt tính — không dùng. QĐ 1972 nhắc "sào" đúng một lần (quy trình
dưa hấu) mà không định nghĩa.

Máy tính phân bón giờ chỉ mời chọn **m² · sào · ha**. Các đơn vị vùng miền khác (sào Bắc Bộ, sào
Trung Bộ, công Nam Bộ, mẫu Bắc Bộ) vẫn đọc được để kế hoạch đã lưu không sai số, nhưng không còn
được mời chọn — một nông hộ Lâm Đồng bấm nhầm "sào Bắc Bộ" là sai gần ba lần. Bảng quy đổi ở
`mobile/src/domain/areaUnits.ts` và `backend/app/services/cultivation.py`; web-admin hiện tên đơn
vị thay vì mã.

Nhiều quy trình Lâm Đồng ghi phân chuồng theo **m³**. Đơn vị này được thêm vào kiểu dữ liệu, và
máy tính không bao giờ nhân một thể tích với giá theo kg (dòng đó luôn "Chưa có giá").

### 5. Ảnh cây trồng

23 ảnh từ Wikimedia Commons, giấy phép tự do (CC0, CC BY, CC BY-SA, public domain), thu về 900 px
và **nhúng trong app** (`mobile/src/assets/crops`) để xem được khi không có mạng. Ưu tiên ảnh chụp
ở Đà Lạt – Lâm Đồng (hồng, cẩm chướng, bắp cải, dâu tây, atisô, cà phê, chè Cầu Đất, lúa Di Linh).
`crop_varieties.json` ghi cho mỗi loại cây tác giả, giấy phép, trang gốc và — nếu có — phần đã
sửa (ảnh lúa được cắt khung quanh cánh đồng, ghi rõ như CC BY-SA yêu cầu).

Bước 1 của bộ chọn giống: mỗi ô loại cây có ảnh; bước 2: ảnh lớn kèm dòng ghi công và liên kết
"Xem ảnh gốc trên Wikimedia Commons"; bước 3: ảnh nhỏ cạnh tên nhóm. Ô và ảnh nhỏ yêu cầu Android
giải mã ở đúng kích thước hiển thị (`resizeMethod="resize"`) để lưới hơn hai mươi ô không giữ
hơn hai mươi ảnh cỡ đầy đủ trong bộ nhớ. Cây nông hộ tự thêm không có ảnh thì giữ icon.

### 6. Video YouTube: ảnh bìa trước, trình phát sau

Trình phát YouTube là cả một ứng dụng web (vài MB script). Gắn ngay khi mở màn hướng dẫn, nó tải
đúng lúc màn đang trượt vào và lúc cuộn lần đầu — đó là chỗ giật — rồi sống tiếp qua mọi màn hướng
dẫn đã đi qua. Nay khung video chỉ hiện ảnh bìa của YouTube (~30 KB) và nút phát; bấm thì mới tạo
WebView với `autoplay` (một lần chạm là phát), vẽ trên lớp phần cứng (`androidLayerType="hardware"`),
và bị gỡ khi màn hình mất focus — đồng thời tắt tiếng.

### 7. Sửa kèm vì nằm ngay trên đường đi

- **Hướng dẫn theo giai đoạn:** web-admin gắn hướng dẫn theo giai đoạn chung của app (cây con…
  thu hoạch), còn quy trình mới đặt tên đợt theo cây (`tillering`, `panicle`, `harvest`). Hướng dẫn
  giờ khớp một đợt khi mang mã của đợt **hoặc** một giai đoạn mà đợt đó bao trùm
  (`guidesForStage`), nếu không hướng dẫn gắn "Thu hoạch" sẽ không bao giờ hiện.
- **Chọn quy trình:** hai quy trình cùng nguồn (ớt ngọt / ớt cay; chè kiến thiết cơ bản / kinh
  doanh) từng hiện hai nhãn giống hệt "UBND tỉnh Lâm Đồng 2025"; nay nhãn nói quy trình dùng cho
  việc gì (`protocolChoiceLabel`).
- **Dữ liệu demo:** ba hộ ở Vạn Thành chuyển sang hoa cúc Makoto, hoa hồng đỏ Ý, cẩm chướng
  Tundra và ớt ngọt Bachata; vụ cũ dùng cà chua NT1; hướng dẫn demo lấy bước từ quy trình cà
  chua của tỉnh. Mọi dòng đổi nội dung được đóng mốc `DEMO_REVISION` để máy đã đồng bộ kéo bản mới.

### 8. Bổ sung ngày 03/10/2026: 11 cây Đà Lạt còn thiếu → 34 loại cây · 60 loại con · 268 giống

Yêu cầu "mở rộng nguồn dữ liệu cây trồng". Chỉ thêm cây vừa **trồng ở Đà Lạt** vừa **có quy trình
trong QĐ 1972/QĐ-UBND** — cùng nguồn với phần còn lại, nên giống, liều lượng và lịch chăm sóc
đều chép từ văn bản của tỉnh, không suy diễn:

| Nhóm | Cây thêm | Quy trình trong QĐ 1972 |
|---|---|---|
| Hoa | hoa salem (limonium), lan hồ điệp, lan vũ nữ | Phụ lục IV, quy trình 9, 11, 7 |
| Rau | bó xôi, đậu Hà Lan, củ dền, tỏi tây, cần tây, su su | Phụ lục III, quy trình 3, 18, 30, 28, 10, 24 |
| Cây lâu năm | bơ, hồng ăn trái | Phụ lục I, quy trình 1, 6 |

- `care_protocols.json` lên **37 quy trình**, **6 mục "chưa có dữ liệu"**: ngoài rau muống và chè
  Đài Loan, hai loài lan được khai báo là không tính được bằng máy tính phân theo kg/ha vì quy
  trình bón theo **nồng độ pha và theo chậu** (lan hồ điệp: NPK 9-45-15 pha 4 g/l; lan vũ nữ: 30-10-10
  một muỗng cà phê/4 lít, 5 ngày một lần). Màn chăm sóc vẫn hiện lời dặn đó nguyên văn kèm nguồn.
- Su su có hai quy trình (lấy quả / lấy ngọn); bơ và hồng ăn trái có hai (kiến thiết cơ bản /
  kinh doanh) — tách đúng như văn bản gốc.
- **Không thêm** — có quy trình nhưng không hợp hoặc không đủ: thạch thảo và hoàng anh (quy trình ghi
  hợp độ cao 800–1.000 m và 650–900 m, thấp hơn Đà Lạt ~1.500 m, và không nêu tên giống); địa lan
  (quy trình không nêu tên giống nào, mà danh mục cần ít nhất một giống có nguồn).
- 11 ảnh mới cùng quy tắc §5 (Wikimedia Commons, giấy phép tự do, ghi công ngay dưới ảnh).
- Lịch ngày bắt đầu giai đoạn (`START_DAYS`) của các cây mới lấy theo mốc trong quy trình; test
  `test_a_month_belongs_to_one_stage_at_most` bắt hai giai đoạn không được chồng tháng.
- Tám loài bắt buộc vẫn nguyên, test khoá vẫn chạy.

## Hệ quả

- `care_protocols.json`: 25 quy trình (23 theo QĐ 1972, 2 cà phê), 2 mục "chưa có dữ liệu" —
  sau §8 (03/10/2026): **37 quy trình, 6 mục "chưa có dữ liệu"**.
- Điện thoại đã đồng bộ trước đây: giống cũ bị xoá khỏi danh mục ở lần kéo sau; kế hoạch đã lưu
  với đơn vị cũ vẫn hiện đúng diện tích.
- Test: backend 239 (thêm test tám loài bắt buộc, danh mục chỉ cây Lâm Đồng, ảnh có ghi công,
  đơn vị sào Lâm Đồng, việc chờ làm theo ngày cố định); mobile 259 (ảnh cây trồng, trình phát
  YouTube, khớp hướng dẫn theo giai đoạn, nhãn chọn quy trình, đơn vị, m³).

## Chưa làm / giới hạn

- **Rau muống** (QĐ 1972 không có quy trình) và **chè Đài Loan** (bón theo lứa hái) hiện "Chưa
  có dữ liệu" kèm lý do — không tự suy liều lượng.
- Phương án NPK thay thế mà quy trình không ghi cách chia lần (lúa, dưa leo) chưa đưa vào máy tính;
  ghi ở `extra_rules` của từng quy trình.
- Thang ngày ước tính giai đoạn (~90–100 ngày) dùng chung cho mọi cây hằng năm, nên với cây ngắn
  ngày như dưa leo giai đoạn ước tính trễ hơn thực tế; mở vụ hoặc chọn lại giai đoạn để ghi đúng.
- Giá phân bón trong `fertilizers_seed.json` là dữ liệu khởi tạo ghi ngày 06–07/09/2026; bảng giá
  tra lại ngày 02/10/2026 lệch nhẹ. Không sửa file vì giá chạy thật là bảng `fertilizer_prices` do
  quản trị viên cập nhật ([ADR 0006](0006-giai-doan-4-dashboard-offline-pdf-da-nguoi-dung.md)).
