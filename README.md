# AgriLog v2

**Ứng dụng ghi chép cho nông hộ, dùng được ngoài đồng khi không có sóng.**

Nông hộ ghi vật tư, công việc và tiền nong vào sổ giấy hoặc vào trí nhớ. Cuối vụ, câu hỏi
"vụ này lãi hay lỗ" thường không có câu trả lời. AgriLog v2 thay quyển sổ đó: lô đất, cây
trồng và giống, quy trình chăm sóc theo giai đoạn, kho phân bón, thu và chi — ghi trên điện
thoại (gõ hoặc **nói vào micro, nhận dạng ngay trên máy**), lưu ngay vào máy, tự đồng bộ lên
máy chủ khi có mạng. Ban quản lý xem cùng dữ liệu đó trên trang web quản trị, gửi thông báo và
giá phân bón mới tới mọi điện thoại; máy chủ tự cảnh báo mưa to, rét hại cho làng hoa.

| | |
|---|---|
| **Người dùng** | Nông hộ (ghi trên điện thoại) và cán bộ quản lý (xem trên web) |
| **Nền tảng** | React Native 0.81 (Android/iOS) · FastAPI + PostgreSQL · Next.js 16 |
| **Trạng thái** | V2.2 — ghi bằng giọng nói offline, thông báo, thời tiết, giá phân cập nhật, web quản trị đầy đủ; mobile schema v8 |
| **Kiểm thử** | 456 test mobile (93,6 % câu lệnh) · 338 test backend (95 %; cả bộ chạy xanh trên SQLite lẫn PostgreSQL 16) · web-admin `tsc` + `lint` + `build` sạch — đo 03/10/2026 |
| **Báo cáo** | Giai đoạn 1–5: [AGRILOG_V2_FINAL_REPORT.md](AGRILOG_V2_FINAL_REPORT.md) (số liệu ngày 23/09/2026) · V2.1–V2.2: [ADR 0008](docs/adr/0008-v2-1-canh-tac-media-nhan-cong.md)–[0011](docs/adr/0011-web-quan-tri.md) |

![Trang chủ AgriLog trên điện thoại: ba thẻ tồn kho, lãi lỗ tháng và công việc](docs/screenshots/71-p5-home-dashboard.png)

> Ảnh trong README này chụp từ **emulator Pixel 6a đang chạy thật** ngày 23/09/2026, với dữ
> liệu của tài khoản demo — không phải bản dựng thiết kế.

## Tính năng chính

### 1. Lô đất — nhận từ bên quản lý, không tự tạo

Lô đất là mảnh ruộng đã được đo, đánh mã và giao. Nông hộ **nhận** lô chứ không tự nghĩ ra
lô, nên ứng dụng không có nút "thêm lô", và máy chủ cũng từ chối (`POST /plots` → 403 với
nông hộ, và đường đồng bộ chặn y như vậy). Nông hộ vẫn sửa được thông tin canh tác trên lô
của mình — họ mới là người biết ruộng trồng gì, trồng từ bao giờ.

Nút tròn xanh góc dưới phải là **"Ghi nhanh"** (ghi tiền / ghi kho), không phải nút thêm lô.

![Danh sách lô đất, không có nút thêm lô](docs/screenshots/73-p5-my-lots-no-add-button.png)

### 2. Cây trồng, giống và quy trình chăm sóc — mọi con số đều có nguồn

Danh mục giống ba cấp (loại cây → loại con → giống) **chỉ gồm nông sản của Lâm Đồng, ưu tiên
Đà Lạt và làng hoa Vạn Thành**: **34 loại cây · 60 loại con · 268 giống** — mười loài hoa (bảy
hoa cắt cành cùng hoa salem, lan hồ điệp, lan vũ nữ), rau – củ – quả Đà Lạt (thêm bó xôi, đậu
Hà Lan, củ dền, tỏi tây, cần tây, su su), lúa, ngô, atisô, cà phê, chè, bơ, hồng ăn trái. Mỗi giống ghi rõ trang đã tra cứu,
chủ yếu là bộ 120 quy trình kỹ thuật của UBND tỉnh Lâm Đồng (QĐ 1972/QĐ-UBND ngày
04/11/2025) và Địa chí Đà Lạt. Tám loài bắt buộc của đồ án (cà chua, ớt, dưa leo, cà rốt, rau
muống, bắp cải, lúa, ngô) đều có mặt và đều có nguồn Lâm Đồng. Bấm vào một loại cây là thấy
**ảnh của cây đó** — ảnh Wikimedia Commons giấy phép tự do, nhúng sẵn trong app để xem khi
không có mạng, tác giả và giấy phép ghi ngay dưới ảnh. Nông hộ thêm được cây và giống của
riêng mình (trong ảnh: "Sau rieng · 1 giống tự thêm" do chính người dùng nhập), quản trị viên
duyệt sau. Quyết định và nguồn: [ADR 0009](docs/adr/0009-du-lieu-lam-dong.md); 11 cây thêm ngày
03/10/2026 và lý do **không** thêm thạch thảo, hoàng anh, địa lan: §8 của ADR đó.

Quy trình chăm sóc chia 4 giai đoạn, mỗi việc tick được và có thanh tiến độ. Chỗ nào chưa có
nguồn chính thức thì ghi "Chưa có dữ liệu" kèm nơi tra cứu — **không bịa liều lượng**. Máy
tính lượng phân nhận **sào Lâm Đồng (1.000 m²)** bên cạnh m² và ha.

| Danh mục giống | Nguồn ghi ngay trong màn hình | Quy trình + nguồn |
|---|---|---|
| ![Chọn loại cây](docs/screenshots/81-p5-crop-picker.png) | ![Cây tự thêm và nguồn danh mục](docs/screenshots/82-p5-crop-picker-user-added-and-sources.png) | ![Quy trình chăm sóc với link nguồn](docs/screenshots/83-p5-care-protocol-source-link.png) |

| Hoa thêm 03/10: salem, lan hồ điệp, lan vũ nữ | Cây lâu năm thêm: bơ, hồng ăn trái |
|---|---|
| ![Hoa salem, lan hồ điệp, lan vũ nữ trong danh mục](docs/screenshots/113-new-crops-flowers.png) | ![Bơ và hồng ăn trái trong danh mục](docs/screenshots/114-new-crops-perennial.png) |

### 3. Kho phân bón và thu – chi

Nhập kho tự sinh khoản chi tương ứng; xuất kho tính giá FIFO; bảng tồn và biểu đồ tồn theo
thời gian; báo cáo thu – chi theo tháng/quý kèm biểu đồ và xuất CSV/PDF.

| Ghi phiếu nhập | Bảng tồn | Biểu đồ tồn theo thời gian |
|---|---|---|
| ![Form nhập kho](docs/screenshots/75-p5-warehouse-form-textarea-chips.png) | ![Bảng tồn kho](docs/screenshots/76-p5-stock-summary.png) | ![Biểu đồ tồn kho](docs/screenshots/77-p5-stock-chart-bezier.png) |

| Ghi khoản thu | Báo cáo thu – chi |
|---|---|
| ![Form ghi thu](docs/screenshots/78-p5-income-form-chip-vs-button.png) | ![Biểu đồ thu chi và chi theo loại](docs/screenshots/79-p5-finance-report-charts.png) |

Ba thẻ trên trang chủ là tổng của chính những bảng này: ảnh bìa hiện *Tồn kho 1.508.000đ* và
màn hình kho hiện *Giá trị tồn 1.508.000đ* — cùng một phép tính, viết hai lần (một ở
`mobile/src/domain/dashboard.ts`, một ở `backend/app/services/dashboard_service.py`) và có
test so khớp.

### 4. Offline-first: mất mạng vẫn ghi được

Mọi thao tác ghi vào SQLite trên máy trước, đồng bộ sau. Ảnh dưới chụp khi **máy chủ đã tắt
hẳn** — ứng dụng vẫn hiện đủ số liệu và vẫn ghi tiếp được:

![Ứng dụng chạy bình thường khi máy chủ đã tắt](docs/screenshots/84-p5-works-with-backend-down.png)

Khi có mạng trở lại, dải trên cùng báo trạng thái và lùi xuống dưới thanh hệ thống (không che
đồng hồ, pin, sóng):

![Dải đồng bộ nằm dưới thanh trạng thái](docs/screenshots/72-p5-sync-banner-safe-area.png)

### 5. Giao diện đọc được ngoài nắng

Một màu xanh chủ đạo `#2E6F40`, chữ giải thích 14px `#4A4A4A` (8.8:1 trên nền trắng — WCAG
AAA), nhãn và nút phân biệt rõ, dải chip cuộn ngang thay vì vỡ dòng.

| Công cụ | Chip đơn vị cuộn ngang |
|---|---|
| ![Danh sách công cụ](docs/screenshots/74-p5-tools-menu.png) | ![Chip đơn vị diện tích cuộn ngang](docs/screenshots/80-p5-calculator-unit-chips-scroll.png) |

### 6. Lịch sử trồng trọt, ghi chú kèm ảnh/video, tiền công (V2.1)

Lịch sử **trồng trọt** (vụ nào, cây gì, được bao nhiêu kg) tách khỏi lịch sử **công việc** (việc
nào đã làm, làm thế nào). Từ các vụ đã ghi sản lượng, ứng dụng gợi ý cây cho vụ tới — chỉ
những cây lô đã từng trồng, xếp theo năng suất thật, không bịa. Mỗi công việc có ghi chú kèm
ảnh/video (lưu trên máy, tự tải lên khi có sóng) và tiền thuê người (số người × giờ/ngày × đơn
giá, hoặc khoán) — tiền công là một khoản chi nên tự vào Thu – Chi. Hướng dẫn chăm sóc có video
YouTube phát ngay trong ứng dụng — khung video chỉ hiện ảnh bìa cho tới khi bấm phát, nên mở và cuộn màn hướng dẫn không còn giật ([ADR 0009](docs/adr/0009-du-lieu-lam-dong.md) §6); quản trị viên soạn trên web. Quyết định và giới hạn:
[ADR 0008](docs/adr/0008-v2-1-canh-tac-media-nhan-cong.md).

| Vụ trồng: gợi ý theo mùa | So sánh năng suất |
|---|---|
| ![Gợi ý cây cho vụ xuân từ lịch sử của lô](docs/screenshots/86-v21-crop-suggestion-spring.png) | ![Lịch sử trồng trọt và biểu đồ năng suất](docs/screenshots/85-v21-cultivation-history-chart.png) |

| Video hướng dẫn trong app | Lịch sử công việc | Tiền công |
|---|---|---|
| ![YouTube phát ngay trong ứng dụng](docs/screenshots/89-v21-youtube-embedded-playing.png) | ![Đã làm kèm ghi chú, ảnh, tiền công](docs/screenshots/90-v21-task-history-done.png) | ![1 người × 2 giờ × 30.000₫](docs/screenshots/92-v21-labor-cost-60000.png) |

### 7. Nói vào micro, ứng dụng tự ghi sổ — không cần mạng

Bấm nút **+** → **Nói để ghi**, nói một câu như "bán năm mươi bó hoa cúc được một triệu rưỡi".
Nhận dạng chạy **ngay trên máy** bằng Vosk (mô hình tiếng Việt `vosk-model-small-vn-0.4`,
Apache-2.0, đóng vào APK) với từ vựng giới hạn theo sổ ruộng — âm thanh không rời khỏi điện
thoại. Câu nghe được thành một **bản nháp** (thu / chi / nhập kho / xuất kho, số tiền, số lượng,
loại phân, lô, ngày); nông dân xem, sửa rồi mới lưu, và có nút **Hoàn tác**. Đo trên 16 câu mẫu
đọc bằng hai giọng tổng hợp: đúng loại phiếu 16/16, số tiền 15/16, số lượng 15/16, loại phân
16/16 (đúng nguyên câu 7/16) — giọng tổng hợp sạch hơn giọng người trong nhà màng nên đây là mức
trần ([ADR 0010](docs/adr/0010-giong-noi-thong-bao-thoi-tiet.md) §1).

| Nút ghi nhanh | Đang nghe | Bản nháp từ câu nói | Đã ghi, có Hoàn tác |
|---|---|---|---|
| ![Menu ghi nhanh có Nói để ghi](docs/screenshots/103-voice-quick-add.png) | ![Đang nghe](docs/screenshots/104-voice-listening.png) | ![Câu nghe được thành khoản thu](docs/screenshots/105-voice-draft-income.png) | ![Đã ghi khoản thu 1.500.000đ](docs/screenshots/106-voice-saved-undo.png) |

### 8. Thông báo, báo đã đồng bộ, thời tiết và giá phân bón

- **Thông báo** là một bảng đồng bộ như mọi bảng khác, nên hộp thư mở được khi mất sóng. Điện
  thoại đổ chuông (Notifee, 4 kênh: cảnh báo thời tiết, tin ban quản lý, nhắc việc, đồng bộ);
  chạm vào thì mở đúng màn hình. Trang quản trị đếm mỗi tin đã tới bao nhiêu hộ.
- **Đã đồng bộ**: dải trên cùng nói rõ "Đã gửi 3 thay đổi lên máy chủ — dữ liệu đã an toàn"
  hoặc "Đã nhận 1 cập nhật từ máy chủ"; nếu đồng bộ chạy lúc app ở nền thì báo bằng thông báo
  im lặng.
- **"Push" không cần Firebase**: Android chạy đồng bộ nền khoảng 15 phút một lần, kể cả khi app
  đã bị vuốt tắt hay máy vừa khởi động lại (`react-native-background-fetch`, kèm bản vá để chạy
  được khi app ở nền — [ADR 0010](docs/adr/0010-giong-noi-thong-bao-thoi-tiet.md) §4). Đẩy tức
  thì qua FCM cần dự án Firebase riêng của chủ sản phẩm, chưa làm.
- **Thời tiết** cho làng hoa Vạn Thành từ Open-Meteo (CC BY 4.0) qua máy chủ, 30 phút làm mới
  một lần. Máy chủ tự gửi cảnh báo **mưa to / mưa rất to / rét hại** theo ngưỡng của
  **QĐ 18/2021/QĐ-TTg**, Điều 5 khoản 17–18 (mưa trên 50 mm và trên 100 mm trong 24 giờ; nhiệt độ
  trung bình ngày dưới 13 °C), chỉ cho hôm nay và 2 ngày tới, mỗi mức mỗi ngày một lần.
- **Giá phân bón**: giá ban quản lý nhập trên web phủ lên giá khảo sát ở mọi chỗ tính tiền (máy
  tính lượng phân, túi tiền, giá trị tồn kho) và hiện ngay dưới khoảng giá khảo sát có nguồn.
  Giá nhập trước cho một ngày sau chỉ áp dụng từ ngày đó. Mỗi lần nhập giá sinh một thông báo,
  nhiều giá nhập liền nhau gộp thành một.

| Trang chủ: chuông + thời tiết | Xin quyền thông báo | Thông báo hệ thống |
|---|---|---|
| ![Trang chủ có thẻ thời tiết Vạn Thành](docs/screenshots/107-home-weather-card.png) | ![Hỏi quyền thông báo](docs/screenshots/108-notification-permission.png) | ![Thông báo giá Urê Cà Mau](docs/screenshots/109-system-notification-price.png) |

| Hộp thư | Giá ban quản lý trên bảng giá | Dự báo 7 ngày |
|---|---|---|
| ![Hộp thư thông báo](docs/screenshots/110-notification-inbox.png) | ![Giá ban quản lý cập nhật dưới giá khảo sát](docs/screenshots/111-live-price-from-admin.png) | ![Màn hình thời tiết](docs/screenshots/112-weather-screen.png) |

### 9. Trang web quản trị

Một khung chung (thanh bên theo nhóm việc; thanh trên có ngày, thời tiết làng hoa và chuông) cho
13 trang; dùng được trên máy tính, máy tính bảng và điện thoại (dưới 1024 px thanh bên thành
ngăn kéo). Biểu đồ vẽ tay bằng SVG, bảng màu đã chạy bộ kiểm tra mù màu, luôn có nút "Xem bảng
số liệu".

| Trang | Việc làm được |
|---|---|
| **Tổng quan** | 4 chỉ số (nông hộ, đất canh tác, lãi tháng, tồn kho), thu – chi 6 tháng, cơ cấu cây trồng, thời tiết, thông báo gần đây kèm tỉ lệ đã xem, bảng nông hộ |
| **Sổ sách nông hộ** | Thu – chi theo tháng/quý, việc đang chờ theo lô, tồn kho, phiếu nhập – xuất, kế hoạch vụ mùa; **Sửa / Xoá** từng dòng; xuất PDF |
| **Lô đất** | Tạo và giao lô cho nông hộ (m², sào Lâm Đồng, ha), cây và giống, ngày trồng; lọc, tìm |
| **Tài khoản** | Tạo tài khoản, khoá / mở khoá, xem lần đồng bộ gần nhất của từng hộ |
| **Duyệt giống cây** | Duyệt / từ chối giống nông hộ thêm; xem danh mục gốc 268 giống |
| **Hướng dẫn chăm sóc** | Soạn bài có video YouTube, ảnh, các bước, nguồn; **xem trước như trên điện thoại** |
| **Giá phân bón** | Giá đang dùng cạnh khoảng giá khảo sát và nguồn; nhập giá mới (kể cả giá cho ngày sau); lịch sử giá |
| **Thông báo** | Soạn và gửi tới mọi hộ hoặc một hộ, mức độ, hết hạn, chạm vào thì mở màn nào; sửa, thu hồi; đếm đã xem |
| **Thời tiết** | Dự báo 7 ngày, cảnh báo đang có, "Làm mới ngay" (gửi cảnh báo mới nếu có) |
| **Nhật ký lỗi** | Lỗi từ điện thoại nông hộ, lọc theo hộ và thời gian, xem stack |
| **Cài đặt · Hệ thiết kế** | Đổi mật khẩu, tình trạng máy chủ; bảng màu, chữ và các khối giao diện dùng chung |

Nông hộ đăng nhập web chỉ thấy sổ sách của mình (chỉ xem) và trang Cài đặt. Quyết định thiết kế:
[ADR 0011](docs/adr/0011-web-quan-tri.md).

| Đăng nhập | Tổng quan |
|---|---|
| ![Trang đăng nhập web](docs/screenshots/115-web-login.png) | ![Tổng quan quản trị](docs/screenshots/116-web-overview.png) |

| Sổ sách nông hộ | Thông báo |
|---|---|
| ![Sổ sách của một nông hộ](docs/screenshots/117-web-farm-books.png) | ![Soạn và theo dõi thông báo](docs/screenshots/119-web-notifications.png) |

| Giá phân bón | Soạn hướng dẫn, xem trước như điện thoại |
|---|---|
| ![Bảng giá đang dùng so với khảo sát](docs/screenshots/121-web-fertilizer-prices.png) | ![Trình soạn hướng dẫn chăm sóc](docs/screenshots/123-web-care-guide-editor-preview.png) |

## Phạm vi

Ứng dụng **không** chẩn đoán bệnh cây. Tính năng đó từng có ở Giai đoạn 2 và đã bị gỡ bỏ
hoàn toàn — lý do và danh sách những gì bị xoá nằm ở
[ADR 0003](docs/adr/0003-thu-hep-pham-vi.md).

Bốn mảng nghiệp vụ của dự án:

| # | Mảng | Trạng thái |
|---|---|---|
| 1 | Tư vấn & phân loại phân bón (F1–F4) | ✅ F1 tính lượng theo diện tích & phương án (lưu kế hoạch) · F3 ba tab ngân sách · F4 kiểm tra kho đủ/thiếu · Danh mục 6 nhóm |
| 2 | Quy trình chăm sóc theo giai đoạn (F5–F6) | ✅ 37 quy trình có nguồn: 35 theo QĐ 1972/QĐ-UBND tỉnh Lâm Đồng (8 loài hoa; cà chua, ớt ngọt, ớt cay, dưa leo, bắp cải, cải thảo, súp lơ, xà lách, cà rốt, khoai tây, dâu tây, bó xôi, đậu Hà Lan, củ dền, tỏi tây, cần tây, su su ×2; lúa, ngô; atisô; chè cành ×2; bơ ×2, hồng ăn trái ×2) cùng cà phê vối (Cục Trồng trọt 2010) và cà phê chè (WASI 2026); 6 mục "Chưa có dữ liệu" kèm lý do (chè Đài Loan, rau muống, lan hồ điệp ×3, lan vũ nữ — hai loài lan bón theo nồng độ pha, không tính theo kg/ha). Accordion 4 giai đoạn, ô "Đã làm", đặt nhắc (thông báo 7 giờ sáng) |
| 3 | Nhập – Xuất kho | ✅ Nhập (tự ghi khoản chi), xuất giá FIFO, bảng tồn, biểu đồ tồn theo thời gian, lọc tháng/quý, xuất CSV |
| 4 | Thu – Chi | ✅ Ghi thu/chi, đánh dấu đã kiểm tra, báo cáo tháng/quý (lãi/lỗ, thu-chi theo ngày, chi theo loại), xuất CSV |

Nền cho cả bốn mảng: **danh mục giống cây 3 cấp** (loại cây → loại con → giống) với 34 loại
cây · 60 loại con · 268 giống có nguồn (đếm từ `shared/data/crop_varieties.json`) — xem
[ADR 0004](docs/adr/0004-he-thiet-ke-phang-va-danh-muc-giong-3-cap.md). Nông hộ thêm được
cây/giống riêng; quản trị viên duyệt.

Lớp vận hành (Giai đoạn 4): dashboard, error boundary + `POST /logs`, banner offline và
trạng thái đồng bộ theo bảng, PDF báo cáo tháng/quý, đồng bộ nhiều tài khoản với hộp thoại
xung đột, web-admin `/login` → `/dashboard` — xem [ADR 0006](docs/adr/0006-giai-doan-4-dashboard-offline-pdf-da-nguoi-dung.md).

Quyền app xin: `INTERNET`, `RECORD_AUDIO` (chỉ hỏi khi bấm nút micro; âm thanh nhận dạng ngay
trên máy) và `POST_NOTIFICATIONS` (Android 13+ hỏi một lần). Không có quyền máy ảnh hay quyền đọc
thư viện ảnh — chọn ảnh/video đi qua bộ chọn của hệ thống.

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Phạm vi](#phạm-vi)
- [Kiến trúc thư mục](#kiến-trúc-thư-mục)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Chạy backend](#chạy-backend)
- [Chạy web-admin](#chạy-web-admin)
- [Chạy mobile](#chạy-mobile)
- [Design token và font](#design-token-và-font)
- [Dữ liệu tĩnh offline](#dữ-liệu-tĩnh-offline)
- [Đồng bộ dữ liệu](#đồng-bộ-dữ-liệu)
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)

## Kiến trúc thư mục

| Thư mục | Nội dung |
|---|---|
| `mobile/` | Ứng dụng nông hộ — React Native 0.81 CLI + TypeScript + WatermelonDB. |
| `web-admin/` | Trang quản trị — Next.js 16 App Router + Tailwind CSS 4. |
| `backend/` | API — FastAPI + SQLAlchemy 2 (SQLite khi dev, PostgreSQL khi production). |
| `shared/design/` | `tokens.json` (nguồn sự thật của thiết kế) và các script sinh file theme. |
| `shared/data/` | Dữ liệu tĩnh đọc offline: phân bón, quy trình chăm sóc, giống cây. |
| `docs/design-reference/` | Bản giải nén của file thiết kế gốc để tra cứu khi dựng màn hình. |
| `docs/adr/` | Nhật ký quyết định kiến trúc. |

## Yêu cầu môi trường

- Node.js ≥ 20 (đã kiểm chứng trên 24.18.0), npm ≥ 10
- Python ≥ 3.12
- JDK 17
- Android SDK: platform 36+, build-tools 36+, **NDK 27.1.12297006**, CMake 3.22.1
- Biến môi trường `ANDROID_HOME` trỏ tới thư mục Android SDK

## Chạy backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS / Linux

cp .env.example .env
./.venv/Scripts/python.exe -m app.seed          # tạo tài khoản demo
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

Kiểm tra: <http://127.0.0.1:8000/health> · tài liệu API: <http://127.0.0.1:8000/docs>

Tài khoản demo (đặt trong `.env`, đổi được):

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin123` | Quản trị viên |
| `thaitaka` | `matkhau123` | Nông dân |

Chạy test: `./.venv/Scripts/python.exe -m pytest --cov=app` — **338 test, phủ 95 %** (đo 03/10/2026, chạy xanh cả trên PostgreSQL 16; smoke, sync hai chiều,
parity schema mobile ↔ server, toàn vẹn dữ liệu tĩnh, kho/thu-chi, 15 ca e2e API của
Giai đoạn 3, 23 test Giai đoạn 4 — đa người dùng, log lỗi, dashboard, PDF, 5 ca e2e —
20 test admin sửa/xoá kế hoạch, kho, thu-chi, và 23 test Giai đoạn 5: quyền trên lô đất,
cô lập dữ liệu giữa các nông hộ, tính toàn vẹn của lô đẩy đồng bộ, chặn dò mật khẩu; và các test
V2.1: vụ trồng, ghi chú kèm ảnh/video, tiền công, hướng dẫn chăm sóc, migration sync; và V2.2:
thông báo (phạm vi gửi, dấu đã xem, gộp giá), thời tiết (ngưỡng QĐ 18/2021 đúng từng mm và độ,
không gọi mạng trong test), tổng quan quản trị, giá nhập trước cho ngày sau, giá kèm khảo sát).

Cùng bộ test đó chạy được trên PostgreSQL — trỏ `TEST_DATABASE_URL` vào một cơ sở dữ liệu
dùng một lần (nó sẽ bị **xoá sạch** khi bắt đầu):

```bash
docker run -d --name agrilog-pg -e POSTGRES_USER=agrilog -e POSTGRES_PASSWORD=agrilog \
  -e POSTGRES_DB=agrilog -p 5443:5432 postgres:16-alpine
TEST_DATABASE_URL="postgresql+psycopg://agrilog:agrilog@127.0.0.1:5443/agrilog" \
  ./.venv/Scripts/python.exe -m pytest -q
```

Đưa lên máy chủ thật: [docs/BACKEND_DEPLOYMENT.md](docs/BACKEND_DEPLOYMENT.md) (PostgreSQL,
Docker, chuyển dữ liệu, kiểm tải, sao lưu, theo dõi). Danh sách đầy đủ 88 endpoint, kèm quyền
truy cập suy ra tự động từ mã (`python -m scripts.export_openapi`):
[docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md).

Ba nông hộ demo ở **làng hoa Vạn Thành, Đà Lạt (Lâm Đồng)**, cùng mật khẩu `matkhau123`, mỗi hộ có lô, kho và thu-chi riêng tháng 9/2026 (mã lô đuôi `-VT`):

| Tài khoản | Lô đất | Cây |
|---|---|---|
| `lethanhthai` | PUC-001-VT, 300 m² · PUC-004-VT, 250 m² | hoa cúc Makoto (nhà màng) · hoa hồng đỏ Ý |
| `nguyenvananh` | PUC-002-VT, 500 m² | cẩm chướng Tundra |
| `nguyenvanhai` | PUC-003-VT, 360 m² | ớt ngọt Bachata RZ F1 |

Lô PUC-001-VT có bốn vụ đã thu (bắp cải, cà chua NT1 ×2, cà rốt) để màn lịch sử trồng trọt và
gợi ý cây có số liệu; hai hướng dẫn chăm sóc demo có video lấy các bước từ quy trình cà chua
của tỉnh.

Endpoint Giai đoạn 4: `GET /dashboard/summary`, `GET /reports/financials.pdf?year&month|quarter`,
`POST /logs` (máy đẩy nhật ký lỗi), `GET /logs` và `GET /users` (admin), `GET /users/version`.
Admin thêm `owner_id=` vào các endpoint danh sách/báo cáo để xem nông hộ bất kỳ.

Admin sửa/xoá hộ nông hộ (khiếu nại, nhập nhầm): `PATCH`/`DELETE` trên `/plans/{id}`,
`/warehouse/in/{id}`, `/warehouse/out/{id}`, `/income/{id}` và `/expense/{id}` — chỉ vai trò
`admin` gọi được (403 với nông dân), 404 nếu bản ghi không tồn tại; sửa kho tự tính lại
`quantity_kg`/`unit_price`/`total_cost` từ số liệu mới. Điện thoại vẫn chỉ đồng bộ qua `/sync`.

**Lô đất do quản trị viên tạo và giao** (Giai đoạn 5): `POST /plots` chỉ vai trò `admin` gọi
được, kèm `owner_id` để giao lô cho một nông hộ; nông hộ gọi nhận 403. Đường đồng bộ cũng
chặn như vậy — lô do máy khách tự tạo bị trả về trong `rejected` chứ không được ghi, nếu
không thì quy tắc coi như không tồn tại. Nông hộ **vẫn sửa được** lô của mình, vì họ mới là
người biết ruộng trồng gì.

## Chạy web-admin

```bash
cd web-admin
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Kiểm tra kiểu: `npx tsc --noEmit` · lint: `npm run lint` · build: `npm run build`

Trang: `/login` → quản trị viên vào `/dashboard` (Tổng quan), nông hộ vào `/farms` (sổ sách của
mình, chỉ xem). Các trang quản trị: `/farms?owner=<id>`, `/plots`, `/accounts`, `/varieties`,
`/care-guides`, `/fertilizer-prices`, `/notifications`, `/weather`, `/logs`, `/settings`,
`/tokens` (hệ thiết kế) — mô tả ở mục [9. Trang web quản trị](#9-trang-web-quản-trị). Mọi trang
nằm trong nhóm route `src/app/(admin)/` dùng chung `AdminShell` (kiểm tra phiên một lần, đưa
nông hộ ra khỏi trang chỉ dành cho quản trị). Khi mở bằng trình duyệt, dùng
`http://localhost:3000` — Next 16 chặn script dev từ origin `127.0.0.1`.

## Chạy mobile

```bash
cd mobile
npm install
npx react-native start                    # Metro, để chạy ở một cửa sổ riêng
cd android && ./gradlew app:installDebug  # cài lên máy ảo / thiết bị
```

> **Lưu ý Windows:** `npx react-native run-android` báo lỗi `'gradlew.bat' is not
> recognized` khi chạy từ Git Bash. Dùng `./gradlew app:installDebug` trong `mobile/android`
> như trên (hoặc chạy `run-android` từ PowerShell/CMD).

Cho phép máy ảo gọi Metro và backend trên máy chủ:

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000
```

Kiểm tra kiểu: `npx tsc --noEmit` · lint: `npx eslint .` · test: `npx jest --coverage`.

Trạng thái đo ngày 23/09/2026: **198 test / 20 bộ, phủ 91,0 % câu lệnh và 92,3 % dòng**;
`tsc` sạch, `eslint` sạch (từ 02/10/2026 bỏ qua thư mục `coverage/` do jest sinh ra — đó là nguồn của 4 cảnh báo cũ). Ngưỡng phủ đặt trong `jest.config.js`. Trong đó có
28 ca hệ thiết kế v6, 12 ca chiều sâu v6.1, 27 ca Phase 1 v6.2 và bộ `uiFixes` +
`chartGeometry` kiểm chứng tám điểm sửa giao diện.

> Giai đoạn 4 thêm hai module native (`react-native-html-to-pdf`, `react-native-share`):
> sau khi `npm install` phải build lại app (`./gradlew app:installDebug`), lần đầu cần mạng
> để Gradle tải `pdfbox-android`.
>
> V2.1 thêm ba module native nữa (`react-native-webview`, `react-native-image-picker`,
> `@dr.pogodin/react-native-fs`, ghim đúng phiên bản) — cũng phải build lại app.
> `npm install` tự áp bản vá `patches/react-native-image-picker+8.2.1.patch` (postinstall
> `patch-package`). Đo ngày 02/10/2026: **259 test / 26 bộ, phủ 93,1 % câu lệnh và 94,2 % dòng**.

> V2.2 thêm `react-native-vosk`, `@notifee/react-native`, `react-native-background-fetch` (kèm bản
> vá `patches/react-native-background-fetch+4.4.2.patch`) — build lại app. `npm install` tự tải
> mô hình giọng nói (~32 MB) vào `mobile/assets/model-vn` (`scripts/fetch-vosk-model.js`; không có
> mạng thì app vẫn chạy, nút micro báo thiếu mô hình). Đo ngày 03/10/2026: **456 test / 34 bộ,
> phủ 93,6 % câu lệnh và 95,5 % dòng**; `tsc` và `eslint` sạch.

Tài khoản demo giống phần backend ở trên. Ô "Tài khoản" nhận **cả tên đăng nhập lẫn email**
(`thaitaka` hoặc `thaitaka@agrilog.local`).

## Design token và font

`shared/design/tokens.json` (**v6**) là **nguồn sự thật duy nhất** cho màu, font, bo góc, lưới
8pt và ba mức bóng. Hệ thiết kế phẳng: nền trắng / xám-50, viền xám mảnh, một màu xanh chủ
đạo `#2E6F40`, nhãn pastel — không glassmorphism. Không hard-code màu trong component.
File mock-up v4 trong `docs/design-reference/` chỉ còn là tư liệu.

v6 giữ nguyên tinh thần v5 và chỉnh lại bảng màu theo spec Giai đoạn 5: thang xám chuyển từ
ngả xanh sang trung tính (`#1A1A1A` → `#F8F9FA`), semantic dùng bộ Bootstrap (`#DC3545`,
`#FFC107`, `#0D6EFD`, `#198754`), bo góc về 6 (ô nhập) / 8 (nút) / 12 (thẻ).

**v6.2 — modern friendly (Phase 1 mobile).** Bảng màu mở rộng bằng **accent** `#C3D24A` /
`#FF6B6B` (chỉ dùng làm nền ô icon, không bao giờ làm chữ — cả hai đều không đạt AA trên nền
trắng), nền chuyển sắc ngả về xanh thương hiệu (`#F0F4F8` → `#E8F5EA`), thẻ bo **16** với
đệm 20 và bộ bóng mềm hơn, ô nhập viền **2pt**, badge có viền, số tổng quan **28px**. Icon
tách khỏi dòng chữ thành `IconTile` 48pt bo góc với bốn tông, và màn đăng nhập có hình minh
hoạ `FarmScene` vẽ bằng chính palette. Quan trọng: token mới là **thêm** (`radius.card`,
`shadow.card/raised/brand`, `color.accent.*`) chứ không sửa `radius.sm/md/lg` hay
`shadow.sm/md` — đó là những giá trị CSS của web-admin đang đọc, nên **web-admin không đổi
một pixel nào**. `__tests__/phase1Friendly.test.tsx` khoá đúng ranh giới đó.

**v6.1 — chiều sâu trên Android.** App từng bị chê "phẳng" trên máy thật, nhưng nguyên nhân
không phải màu: Android bỏ qua `shadowColor/Radius/Opacity` và chỉ vẽ theo `elevation`, mà
`shadowToRN` lại suy elevation từ mỗi độ lệch dọc nên cả ba mức bóng dồn về 1/2/4 — thẻ trắng
trên nền xám-50 gần như không có mép, và cú nhấn "nâng shadow" của thẻ dashboard xê dịch đúng
một nấc không ai thấy. Nay elevation tính cả độ nhoè, cho thang **2 / 4 / 10**. Kèm theo:
`Card` và các nút nhấn xuống 0.98 + nâng lên shadow-md (trước chỉ đổi màu nền), trang chủ có
header dính tự hiện hairline + bóng khi cuộn, và nền chuyển sắc mở rộng từ màn đăng nhập sang
trang chủ qua `Screen ground="gradient"`. Giá trị shadow trong CSS **không đổi**, nên
web-admin giữ nguyên diện mạo. `__tests__/visualPolish.test.tsx` khoá thang elevation lại.

Ba yêu cầu của spec **không** được áp dụng, lý do ghi ngay trong `$meta.v6Note` của
tokens.json: chiều cao nút/ô nhập giữ **52/50** thay vì 44/40 (khối `size` là ràng buộc thực
địa cho tay lấm bùn dưới nắng, không phải thẩm mỹ), font giữ **Open Sans nhúng kèm** thay vì
system stack (app phải hiển thị y hệt khi offline), và cỡ chữ body giữ **15px** cho dễ đọc
ngoài nắng. Nhượng bộ duy nhất là `color.gradient` — một dải chuyển sắc rất nhẹ, chỉ dùng làm
nền màn đăng nhập, dựng bằng các dải View nội suy trong `SoftGradient` chứ không thêm lại
`react-native-linear-gradient` (đã gỡ từ v5). `__tests__/designV6.test.tsx` khoá ba quyết định
này lại để lần chỉnh token sau không âm thầm hạ chúng xuống.

```bash
node shared/design/build-tokens.js     # -> mobile/src/theme.ts, web-admin/src/app/tokens.css
node shared/design/extract-fonts.js    # -> web-admin/public/fonts/*.woff2 + fonts.css
python shared/design/build-mobile-fonts.py   # -> mobile/src/assets/fonts/*.ttf
node shared/design/extract-design.js <thư-mục-đích>   # giải nén lại file thiết kế gốc
```

Font Open Sans được **nhúng kèm** cả hai nền tảng, không tải từ Google Fonts lúc chạy.

## Dữ liệu tĩnh offline

`shared/data/` chứa ba danh mục mà ứng dụng phải đọc được khi không có mạng:

| File | Nội dung | Nguồn |
|---|---|---|
| `fertilizer_recommendations.json` | 6 nhóm phân, 17 sản phẩm có **giá thật**; nhóm vi sinh khai báo rõ "chưa có giá" | `fertilizers_seed.json` (sfarm.vn, giacaphe.com — 06–07/09/2026) |
| `care_protocols.json` | **File sinh tự động** (`python shared/data/build_care_protocols.py`) gộp 34 seed: 37 quy trình 4 giai đoạn + 6 mục "chưa có dữ liệu" (chè Đài Loan, rau muống, lan hồ điệp ×3, lan vũ nữ) | `care_protocol_*_seed.json` — QĐ 1972/QĐ-UBND ngày 04/11/2025 của UBND tỉnh Lâm Đồng (120 quy trình, đăng tại Trung tâm Khuyến nông tỉnh); cà phê: Cục Trồng trọt (QĐ 254/QĐ-TT-CCN 2010) qua VICOFA và WASI qua Báo NN&MT 29/07/2026 |
| `crop_varieties.json` | Danh mục 3 cấp, 34 loại cây · 60 loại con · 268 giống, **mỗi giống có `source`**; mỗi loại cây có `image` (ảnh nhúng ở `mobile/src/assets/crops`, ghi tác giả – giấy phép – trang gốc) | QĐ 1972/QĐ-UBND; Địa chí Đà Lạt; QĐ 704 và 729/QĐ-SNN (sản phẩm nông nghiệp công nghệ cao của tỉnh); Trung tâm Nghiên cứu Khoai tây, Rau và Hoa (PVFC, Đà Lạt); Viện Eakmat/WASI; Báo Lâm Đồng; ảnh: Wikimedia Commons |

Quy tắc bất di bất dịch của `crop_varieties.json` và các file quy trình: không bịa dữ liệu.
Số liệu chép đúng nguồn; thiếu thì ghi "Chưa có dữ liệu". `backend/tests/test_static_data.py`
từ chối giống không có nguồn, quy trình không có URL nguồn, và bắt mỗi (cây, loại con) phải
hoặc có quy trình hoặc được khai báo trong `unavailable`. Quy trình có `basis: nutrient`
(cà phê chè) cho N–P₂O₅–K₂O nguyên chất; app quy đổi ra urê / super lân / KCl lúc
chạy theo hệ số ghi trong `$meta.conversion` và nói rõ đó là quy đổi.

**Giá phân bón trong file chỉ là dữ liệu khởi tạo.** Giá biến động theo ngày và vùng miền,
nên nguồn sự thật khi chạy là bảng `fertilizer_prices` trong backend, sửa được ở màn hình
Admin và có lưu lịch sử giá (Giai đoạn 4). Không hard-code giá ở bất kỳ đâu trong mã nguồn.

## Đồng bộ dữ liệu

Đồng bộ **hai chiều** theo giao thức WatermelonDB (Mục 9), chạy nền khi đăng nhập, khi app
quay lại foreground, và mỗi 60 giây.

- `GET /sync?last_pulled_at=` — lấy thay đổi từ server
- `POST /sync?last_pulled_at=` — đẩy thay đổi từ máy lên

Mười bốn bảng đồng bộ: `plots`, `crop_varieties`, `crop_cycles`, `change_logs`; sáu bảng
Giai đoạn 3 `plans`, `warehouse_in`, `warehouse_out`, `income`, `expense`, `tasks_history`; hai
bảng V2.1 `task_notes`, `care_guides`; và hai bảng V2.2 `notifications` (tin gửi mọi hộ có
`owner_id` rỗng; chỉ quản trị viên và máy chủ ghi) cùng `notification_reads` (dấu đã xem — không
tính là "thay đổi chưa gửi" và không chặn đổi tài khoản). Bảng `error_logs` chỉ ở máy và đi lên
bằng `POST /logs` riêng. Ngoài 60 giây một lần khi app mở, Android còn đồng bộ nền khoảng 15 phút
một lần.

Xung đột giải quyết bằng **last-write-wins theo `updated_at`**; xoá luôn thắng update. Lý do
và các test bắt buộc ghi ở [ADR 0002](docs/adr/0002-giai-doan-1.md). Từ Giai đoạn 4, dòng
bị server từ chối vì bản trên server mới hơn được trả về trong `conflicts[]`; app hiện hộp
thoại "Thiết bị khác vừa sửa" với hai lựa chọn *Lấy bản mới* / *Giữ bản của tôi*
([ADR 0006](docs/adr/0006-giai-doan-4-dashboard-offline-pdf-da-nguoi-dung.md) §5).

**Một máy, một nông hộ tại một thời điểm.** SQLite trên máy chứa dữ liệu của đúng một tài khoản
và WatermelonDB giữ một mốc `last_pulled_at` chung cho cả file. Khi đăng nhập tài khoản khác
(`mobile/src/auth/deviceOwner.ts`): máy đã gửi hết thay đổi thì dữ liệu cục bộ được xoá để lần
đồng bộ đầu kéo đủ dữ liệu của tài khoản mới; còn thay đổi chưa gửi thì **từ chối đăng nhập** và
nhắc đăng nhập lại tài khoản cũ để gửi trước — nếu không, bản ghi của hộ này sẽ bị đẩy lên dưới
token của hộ kia. Hộp thoại đăng xuất báo trước số thay đổi còn chờ.

Mọi thao tác của nông dân ghi vào SQLite trước rồi mới đồng bộ — tắt mạng vẫn dùng được
toàn bộ ứng dụng. Banner trên cùng báo "Chế độ offline — thay đổi sẽ lưu khi online" /
"Đang đồng bộ…" / "Cập nhật lúc HH:MM"; tab Cài đặt liệt kê trạng thái từng bảng.

## Màn hình mobile hiện có

| Màn hình | Ảnh |
|---|---|
| Đăng nhập | `docs/screenshots/00-login.png` |
| Trang chủ (công cụ + lô đất) | `01-home.png` |
| Chi tiết lô đất (4 tab) | `02-plot-detail.png`, `16-plot-care-tab.png` |
| Thêm / sửa lô đất | `03-plot-form.png` |
| Chọn giống — bước 1 loại cây | `04-variety-step1-crop-type.png`, `12-step1-with-user-crop.png` |
| Chọn giống — bước 2 loại con | `05-variety-step2-category.png`, `08-coffee-categories.png` |
| Chọn giống — bước 3 giống | `06-variety-step3-pick.png`, `09-coffee-arabica-varieties.png` |
| Thêm cây trồng khác / giống mới | `10-add-other-crop-sheet.png`, `11-plot-form-custom-crop.png` |
| Danh mục phân bón — nhóm | `13-fertilizer-groups.png` |
| Danh mục phân bón — sản phẩm / chưa có giá | `14-fertilizer-npk-products.png`, `15-fertilizer-no-price.png` |
| Trang chủ với 6 công cụ Giai đoạn 3 | `17-home-tools.png` |
| F1 — form, kết quả, tổng tiền & lưu kế hoạch | `18-f1-calculator-form.png`, `19-f1-result.png`, `20-f1-total-save.png` |
| F4 — kiểm tra kho đủ / thiếu | `21-f4-stock-check-enough.png`, `22-f4-stock-check-short.png` |
| F3 — ba tab ngân sách | `23-f3-budget-tabs.png` |
| F5–F6 — accordion, đã làm, "Chưa có dữ liệu" | `24-f5-care-accordion.png`, `25-f5-task-done.png`, `26-f5-no-data-liberica.png` |
| Kho — bảng tồn + biểu đồ | `27-warehouse-stock-chart.png` |
| Thu – Chi — form, lịch sử, báo cáo, biểu đồ | `28-finance-income-form.png`, `29-finance-expense-history.png`, `30-finance-report.png`, `31-finance-charts.png` |
| Tab "Chăm sóc" của lô đất (dùng chung lịch sử task) | `32-plot-care-tab.png` |
| Dashboard 3 thẻ + banner đồng bộ | `33-dashboard-home.png`, `34-dashboard-tools-synced-banner.png` |
| Error boundary — "Thử lại" / "Báo lỗi" / đã gửi | `35-error-boundary.png`, `36-error-boundary-reported.png`, `42-settings-error-log.png` |
| Banner offline + trạng thái đồng bộ theo bảng | `37-offline-banner.png`, `38-settings-sync-offline.png` |
| Xuất PDF — xem trước, bảng chia sẻ, file mẫu | `39-report-pdf-preview.png`, `40-report-pdf-share.png`, `40-report-pdf-sample.pdf` |
| Hộp thoại xung đột hai thiết bị | `41-conflict-dialog.png` |
| Web-admin — đăng nhập, dashboard desktop / tablet / điện thoại, admin chọn nông hộ | `43-web-login.png`, `44-web-dashboard-desktop.png`, `45-web-dashboard-tablet.png`, `46-web-dashboard-phone.png`, `47-web-dashboard-admin-picker.png` |
| **v6** — Đăng nhập (nền chuyển sắc, thẻ trắng, ô "Lưu thông tin đăng nhập") và lần mở sau đã nhớ tên đăng nhập | `48-v6-login.png`, `49-v6-login-remembered.png` |
| **v6** — Chọn lô (2 tab, nhãn đồng bộ từng lô) | `50-v6-plot-picker.png` |
| **v6** — Trang chủ: 3 thẻ tóm tắt, 6 công cụ 2×3, link "Chọn lô" | `51-v6-home.png`, `52-v6-home-tools.png` |
| **v6.1** — chiều sâu sau khi sửa elevation: đăng nhập, trang chủ, header dính khi cuộn, chọn lô | `53-v61-login-depth.png`, `54-v61-home-depth.png`, `55-v61-home-sticky-header.png`, `56-v61-plot-picker-depth.png` |
| **v6.2** — modern friendly: đăng nhập có minh hoạ, chọn lô, trang chủ 3 tông icon, lưới công cụ | `57-v62-login-friendly.png`, `58-v62-plot-picker-friendly.png`, `59-v62-home-friendly.png`, `60-v62-home-tools-friendly.png` |
| Sáu tính năng lõi sau khi đã mang thiết kế v6.2 (Cài đặt có mục hỗ trợ, F1, F3, F5–F6, Kho, Thu-chi) | `61-p2-settings-support.png`, `62-p2-f1.png`, `63-p2-f3.png`, `64-p2-f5.png`, `65-p2-kho.png`, `66-p2-thuchi.png` |
| Ba điểm sửa 23/09/2026: dải đơn vị cuộn ngang (không vỡ dòng), biểu đồ tồn cong mượt có mảng tô và trục Y mốc tròn, danh mục 9 loại cây đủ dấu | `67-p3-calculator-unit-chips.png`, `68-p3-stock-area-chart.png`, `69-p3-crop-picker-9-crops.png` |
| Lô của tôi sau khi bỏ nút "Thêm lô" — chỉ xem và chọn, lô do bên quản lý đất giao | `70-p3-my-lots-no-add-button.png` |
| **Giai đoạn 5 (23/09/2026)** — chụp lại toàn bộ trên emulator đang chạy, có backend thật: trang chủ 3 thẻ, dải đồng bộ dưới thanh trạng thái, lô đất không nút thêm, danh sách công cụ | `71-p5-home-dashboard.png`, `72-p5-sync-banner-safe-area.png`, `73-p5-my-lots-no-add-button.png`, `74-p5-tools-menu.png` |
| **Giai đoạn 5** — kho (form nhập, bảng tồn, biểu đồ) và thu-chi (form, báo cáo) | `75-p5-warehouse-form-textarea-chips.png`, `76-p5-stock-summary.png`, `77-p5-stock-chart-bezier.png`, `78-p5-income-form-chip-vs-button.png`, `79-p5-finance-report-charts.png` |
| **Giai đoạn 5** — chip đơn vị cuộn ngang, danh mục cây (có cây nông hộ tự thêm + ghi nguồn), quy trình chăm sóc với link nguồn | `80-p5-calculator-unit-chips-scroll.png`, `81-p5-crop-picker.png`, `82-p5-crop-picker-user-added-and-sources.png`, `83-p5-care-protocol-source-link.png` |
| **Giai đoạn 5** — ứng dụng chạy đủ chức năng khi **máy chủ đã tắt** (offline-first) | `84-p5-works-with-backend-down.png` |
| **Dữ liệu Lâm Đồng (02/10/2026)** — chọn loại cây có ảnh, ảnh lớn kèm ghi công Wikimedia Commons, ảnh nhỏ ở bước chọn giống, máy tính phân với đơn vị sào, tab Chăm sóc của nhà màng hoa cúc, video chỉ hiện ảnh bìa đến khi bấm phát rồi phát ngay sau một lần chạm | `96-lamdong-crop-picker-photos.png`, `98-lamdong-crop-hero-credit.png`, `99-lamdong-variety-step3-thumb.png`, `97-lamdong-calculator-sao.png`, `100-lamdong-care-tab-chrysanthemum.png`, `101-youtube-poster-before-play.png`, `102-youtube-playing-after-one-tap.png` |
| **V2.2 (03/10/2026)** — nói để ghi: menu ghi nhanh, đang nghe, bản nháp từ câu nói, đã ghi có Hoàn tác | `103-voice-quick-add.png`, `104-voice-listening.png`, `105-voice-draft-income.png`, `106-voice-saved-undo.png` |
| **V2.2** — trang chủ có thẻ thời tiết, xin quyền thông báo, thông báo hệ thống, hộp thư, giá ban quản lý trên bảng giá, dự báo 7 ngày | `107-home-weather-card.png`, `108-notification-permission.png`, `109-system-notification-price.png`, `110-notification-inbox.png`, `111-live-price-from-admin.png`, `112-weather-screen.png` |
| **V2.2** — 11 cây Đà Lạt thêm vào danh mục | `113-new-crops-flowers.png`, `114-new-crops-perennial.png` |
| **V2.2** — web quản trị: đăng nhập, tổng quan, sổ sách nông hộ, lô đất, thông báo, thời tiết, giá phân bón, hướng dẫn + trình soạn có xem trước, tài khoản, tổng quan trên điện thoại | `115-web-login.png` … `125-web-overview-phone.png` |
| **V2.1 (24/09/2026)** — vụ trồng + biểu đồ năng suất, gợi ý theo mùa, gợi ý trong form vụ mới, tab Chăm sóc có video, YouTube phát trong app, lịch sử công việc, ghi chú chờ tải ảnh, tiền công, Thu – Chi có cách tính tiền công, phát video trong máy, web-admin soạn hướng dẫn | `85-v21-cultivation-history-chart.png` … `95-v21-web-admin-care-guide-editor.png` |

## Tài liệu tham khảo

Mọi con số nông học, giá và ngưỡng cảnh báo trong ứng dụng đều chép từ các nguồn dưới đây; nguồn
của **từng** giống, quy trình và sản phẩm còn được ghi ngay trong dữ liệu (`shared/data/*.json`,
trường `source`) và hiện trên màn hình. Ngày truy cập ghi theo lần đối chiếu gần nhất.

### Quy trình canh tác và danh mục giống (Lâm Đồng)

1. UBND tỉnh Lâm Đồng — **Quyết định 1972/QĐ-UBND ngày 04/11/2025** ban hành 120 quy trình kỹ thuật
   trồng, chăm sóc cây trồng trên địa bàn tỉnh (Sở Nông nghiệp và Môi trường soạn thảo). Đăng tại
   Trung tâm Khuyến nông tỉnh Lâm Đồng:
   <https://khuyennong.lamdong.gov.vn/News/tai-lieu-ky-thuat/ky-thuat-trong-trot/2025/11/1913.aspx>
   · toàn văn: <https://drive.google.com/file/d/1_FypkADF49g9XL6pgtMDVBZAHEnElLxB/view>
   (truy cập 02–03/10/2026). Nguồn chính của 35/37 quy trình và phần lớn danh mục giống.
2. UBND TP Đà Lạt — *Địa chí Đà Lạt*, Phần III, Chương I, mục 4.1 Giống cây trồng:
   <https://lamdong.gov.vn/sites/book/diachidalat/Phan3/c1-4.htm>
3. Sở NN&PTNT Lâm Đồng — QĐ 704/QĐ-SNN ngày 21/12/2020 và QĐ 729/QĐ-SNN ngày 28/12/2021 (sản phẩm
   nông nghiệp công nghệ cao của tỉnh):
   <https://nongsandalatlamdong.vn/pages/QualityManagement/Images/704qd.pdf>,
   <https://nongsandalatlamdong.vn/pages/QualityManagement/Images/729QD.pdf>
4. Trung tâm Nghiên cứu Khoai tây, Rau và Hoa (PVFC, Viện KHKT Nông nghiệp miền Nam), Đà Lạt —
   trang giống của từng sản phẩm (cà chua NT, khoai tây, dâu tây, hoa cúc, cà rốt CR21.36):
   <https://pvfcdalat.vn/>
5. Báo Lâm Đồng — định hướng ngành hoa đến 2030 (13/01/2025):
   <https://baolamdong.vn/giai-phap-phat-trien-nganh-hoa-mang-tam-quoc-te-bai-2-273078.html>;
   mô hình rau nhà lưới có rau muống tại An Nhơn, Đạ Tẻh (07/03/2023):
   <https://baolamdong.vn/kinh-te/202303/trong-rau-trong-nha-luoi-tai-an-nhon-6ef2012/>
6. Rau muống (QĐ 1972 không có quy trình — chỉ dùng làm nguồn tham khảo, app ghi "Chưa có dữ
   liệu"): Chi cục Trồng trọt và BVTV TP.HCM
   <https://chicucttbvtvhcm.gov.vn/chuyen-de-ky-thuat/qui-trinh-trong-rau-muong-nuoc-an-toan-408.html>;
   Cục BVTV <https://www.ppd.gov.vn/FileUpload/Documents/P.%20Ke%20hoach/TBKT/2.1.%20TBKT%20QT%20RAU%20AN%20TOAN.pdf>;
   giống rau muống Mê Kông (Phú Điền) <https://phudienseed.com.vn/san-pham/hat-giong-rau-muong-me-kong/>

### Cà phê

7. Cục Trồng trọt — QĐ 254/QĐ-TT-CCN ngày 20/7/2010, quy trình tái canh cà phê vối, đăng lại tại
   VICOFA: <https://vicofa.org.vn/quy-trinh-tai-canh-ca-phe-voi-bid45.html>; tài liệu đối chiếu của
   WASI (quyết định ban hành quy trình tái canh cà phê vối, 2020):
   <http://wasi.org.vn/wp-content/uploads/2021/11/QUYET-DINH-BAN-HANH-QUY-TRINH-TAI-CANH-CA-PHE-VOI-2020.pdf>
8. Viện KHKT Nông Lâm nghiệp Tây Nguyên (WASI) — quy trình thâm canh bền vững giống cà phê chè
   THA1, đăng trên Báo Nông nghiệp và Môi trường (29/07/2026):
   <https://nongnghiepmoitruong.vn/tri-thuc-nong-dan/quy-trinh-tham-canh-ben-vung-giong-ca-phe-che-tha1-d823494.html>
9. Giống cà phê của WASI: Vista
   <https://www.vista.gov.vn/vi/news/khoa-hoc-nong-nghiep/20-giong-ca-phe-cua-vien-khoa-hoc-ky-thuat-nong-lam-nghiep-tay-nguyen-da-duoc-chuyen-giao-san-xuat-9705.html>;
   Trung tâm giống Eakmat
   <https://giongcaytrongeakmat.myharavan.com/blogs/news/dac-diem-mot-so-giong-ca-phe-de-ba-con-de-nhan-biet-tr4-xanh-lun-t>
10. Trung tâm Khảo kiểm nghiệm Phân bón Quốc gia — công thức quy đổi lượng nguyên chất sang phân
    thương phẩm (18/03/2021):
    <https://phanbonquocgia.gov.vn/quy-trinh-bon-phan-cho-cay-ca-phe-giai-doan-kinh-doanh/>

### Giá phân bón (giá khảo sát khởi tạo)

11. sfarm.vn — bảng giá phân bón hôm nay (06/09/2026, đối chiếu 02/10/2026):
    <https://sfarm.vn/bang-gia-phan-bon-hom-nay-phan-vo-co-huu-co-sll1/>
12. VietnamBiz — giá phân bón, dẫn nguồn giacaphe.com (07/09/2026, đối chiếu 02/10/2026):
    <https://vietnambiz.vn/gia-phan-bon.html>

Đây là giá tham khảo tại thời điểm thu thập; giá chạy thật do ban quản lý nhập trên web
([ADR 0010](docs/adr/0010-giong-noi-thong-bao-thoi-tiet.md) §6).

### Thời tiết và cảnh báo thiên tai

13. Thủ tướng Chính phủ — **Quyết định 18/2021/QĐ-TTg ngày 22/04/2021** quy định về dự báo, cảnh báo,
    truyền tin thiên tai và cấp độ rủi ro thiên tai, Điều 5 khoản 17 (mưa lớn) và khoản 18 (rét hại):
    <https://thuvienphapluat.vn/van-ban/Tai-nguyen-Moi-truong/Quyet-dinh-18-2021-QD-TTg-du-bao-canh-bao-truyen-tin-thien-tai-va-cap-do-rui-ro-thien-tai-471715.aspx>;
    tóm tắt điểm mới của Bộ Nông nghiệp và Môi trường:
    <https://vupc.mae.gov.vn/---khi-tuong-thuy-van/2355/nhung-diem-moi-trong-quyet-dinh-so-18-2021-qd-ttg-ngay-22-4-2021-cua-thu-tuong-chinh-phu-quy-dinh-ve>
14. Open-Meteo — Weather Forecast API, dữ liệu theo giấy phép CC BY 4.0: <https://open-meteo.com/>
15. Trung tâm Dự báo Khí tượng Thủy văn Quốc gia — bản tin chính thức: <https://www.nchmf.gov.vn/kttv/>

### Nhận dạng giọng nói

16. Alpha Cephei — Vosk, mô hình `vosk-model-small-vn-0.4` (Apache-2.0; WER 15,70 trên tập VIVOS
    theo trang mô hình): <https://alphacephei.com/vosk/models>
17. `react-native-vosk` 2.1.7 (MIT): <https://github.com/riderodd/react-native-vosk>

### Video hướng dẫn mẫu

18. Báo Nông nghiệp và Môi trường — "Kỹ thuật trồng cà chua công nghệ cao trong nhà màng":
    <https://www.youtube.com/watch?v=M1fqC6tuXLI>
19. Kênh VTC16 — "Kỹ thuật ủ phân hữu cơ bón cho cây trồng": <https://www.youtube.com/watch?v=nGqGU7yYO-c>

### Công nghệ chính

| Thành phần | Phiên bản | Giấy phép | Trang |
|---|---|---|---|
| React Native | 0.81 | MIT | <https://reactnative.dev/> |
| WatermelonDB | 0.28 | MIT | <https://github.com/Nozbe/WatermelonDB> |
| Notifee (`@notifee/react-native`) | 9.1.8 | Apache-2.0 | <https://github.com/invertase/notifee> |
| react-native-background-fetch | 4.4.2 | MIT | <https://github.com/transistorsoft/react-native-background-fetch> |
| react-native-webview | 14.0.1 | MIT | <https://github.com/react-native-webview/react-native-webview> |
| FastAPI | 0.121 | MIT | <https://fastapi.tiangolo.com/> |
| SQLAlchemy | 2.0 | MIT | <https://www.sqlalchemy.org/> |
| fpdf2 (PDF báo cáo) | 2.8 | LGPL-3.0 | <https://github.com/py-pdf/fpdf2> |
| Next.js | 16.3 | MIT | <https://nextjs.org/> |
| Open Sans (font nhúng kèm) | — | OFL-1.1 | <https://fonts.google.com/specimen/Open+Sans> |

### Ảnh cây trồng (Wikimedia Commons)

Ảnh nhúng sẵn trong app (`mobile/src/assets/crops`) để xem khi không có mạng; tác giả và giấy phép
hiện ngay dưới ảnh. Bảng dưới sinh từ trường `image` của `shared/data/crop_varieties.json`.

<details>
<summary>34 ảnh — tác giả và giấy phép</summary>

| Cây | Tác giả (trang gốc) | Giấy phép |
|---|---|---|
| Hoa cúc | [Satin66Flower](https://commons.wikimedia.org/wiki/File:Dendragrand1_%282%29ra.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Hoa hồng | [Dao Hoang Duong](https://commons.wikimedia.org/wiki/File:Roses_In_Dalat_%28257067009%29.jpeg) | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| Hoa cẩm chướng | [Phương Huy](https://commons.wikimedia.org/wiki/File:%C4%90%C3%A0_L%E1%BA%A1t_n%C4%83m_2018,_tr%E1%BB%93ng_hoa_trong_v%C6%B0%E1%BB%9Dn_k%C3%ADnh_%28hoa_c%E1%BA%A9m_ch%C6%B0%E1%BB%9Bng%29_%281%29.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Hoa đồng tiền | [Fan Wen](https://commons.wikimedia.org/wiki/File:Gerbera_Jamesonii_-_flower_view_01.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Hoa lily | [阿橋 HQ](https://commons.wikimedia.org/wiki/File:%E6%9D%B1%E6%96%B9%E7%99%BE%E5%90%88_Lilium_Sorbonne_-%E5%BB%A3%E5%B7%9E%E5%86%A0%E5%8B%9D%E8%BE%B2%E6%A5%AD%E5%85%AC%E5%9C%92_Guangzhou,_China-_%2845333003971%29.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Hoa lay ơn | [Rudolphous](https://commons.wikimedia.org/wiki/File:20210620_Hortus_botanicus_Leiden_-_Gladiolus_%C3%97_hortulanus.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Hoa cát tường | [阿橋 HQ](https://commons.wikimedia.org/wiki/File:%E6%B4%8B%E6%A1%94%E6%A2%97-%E9%87%8D%E7%93%A3_Eustoma_grandiflorum_-%E9%A6%99%E6%B8%AF%E5%85%AC%E5%9C%92_Hong_Kong_Park-_%289229894606%29.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Hoa salem | [Neelix](https://commons.wikimedia.org/wiki/File:LimoniumSinuatum.jpg) | [Public domain]() |
| Lan hồ điệp | [Phương Huy](https://commons.wikimedia.org/wiki/File:%C4%90%C3%A0_L%E1%BA%A1t_th6n2022,_Ks_Golf_Valley_%28ch%E1%BA%ADu_lan_tr%E1%BA%AFng%29.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Lan vũ nữ | [Pradeepkannamkulath](https://commons.wikimedia.org/wiki/File:Oncidium_cultivars_flowers_in_sunshine.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Cà chua | [NPS](https://commons.wikimedia.org/wiki/File:Several_green_unripe_and_red_ripe_tomatoes_growing_on_the_vine._%28086c449c-117b-44f6-a7c4-e2acbf284092%29.JPG) | [Public domain]() |
| Ớt | [Forest and Kim Starr](https://commons.wikimedia.org/wiki/File:Starr-150326-0872-Capsicum_annuum-green_Bell_fruit_in_Hydroponics_greenhouse-Town_Sand_Island-Midway_Atoll_%2824971458160%29.jpg) | [CC BY 3.0 us](https://creativecommons.org/licenses/by/3.0/us/deed.en) |
| Dưa leo | [Tl0443505](https://commons.wikimedia.org/wiki/File:Hinh-anh-qua-dua-chuot-viet-nam.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Bắp cải | [anthrovik](https://commons.wikimedia.org/wiki/File:Thu_hoach_rau_o_Da_Lat_2.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Cải thảo | [Comedora](https://commons.wikimedia.org/wiki/File:Brassica_rapa_3.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Súp lơ | [Coyau](https://commons.wikimedia.org/wiki/File:Chou-fleur_02.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Xà lách | [Sanja565658](https://commons.wikimedia.org/wiki/File:Lactuca_sativa_01.JPG) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Rau muống | [Bùi Thụy Đào Nguyên](https://commons.wikimedia.org/wiki/File:Hoa_rau_mu%E1%BB%91ng_tr%E1%BA%AFng.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Cà rốt | [woodleywonderworks](https://commons.wikimedia.org/wiki/File:Carrot_harvest.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Khoai tây | [Forest & Kim Starr](https://commons.wikimedia.org/wiki/File:Starr_080914-9946_Solanum_tuberosum.jpg) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| Dâu tây | [Phương Huy](https://commons.wikimedia.org/wiki/File:%C4%90%C3%A0_L%E1%BA%A1t_n%C4%83m_2018,_tr%E1%BB%93ng_rau_trong_v%C6%B0%E1%BB%9Dn_k%C3%ADnh_%28c%C3%A0_chua_bi%29_%282%29.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Bó xôi | [Алексей Тараканов](https://commons.wikimedia.org/wiki/File:Spinacia_oleracea_%2851364931334%29.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Đậu Hà Lan | [Forest & Kim Starr](https://commons.wikimedia.org/wiki/File:Starr_081009-0044_Pisum_sativum_var._macrocarpum.jpg) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| Củ dền | [Frank Schulenburg](https://commons.wikimedia.org/wiki/File:Beta_vulgaris,_San_Francisco_farmers_market.jpg) | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| Tỏi tây | [Rasbak](https://commons.wikimedia.org/wiki/File:Allium_ampeloprasum_var._porrum_%27Farinto%27_%281%29.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Cần tây | [Simon Mannweiler](https://commons.wikimedia.org/wiki/File:Apium_graveolens_var._dulce_%28Staudensellerie%29_2024-07-28_%2801%29.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Su su | [Daniela Magallón](https://commons.wikimedia.org/wiki/File:Sechium_edule_Chayotes_on_the_vine.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Lúa | [Windrain](https://commons.wikimedia.org/wiki/File:Thung_l%C5%A9ng_tr%E1%BB%93ng_l%C3%BAa_%E1%BB%9F_Di_Linh,_L%C3%A2m_%C4%90%E1%BB%93ng.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Ngô | [DXLINH](https://commons.wikimedia.org/wiki/File:Pngo2.jpg) | [Public domain]() |
| Atisô | [Jackeven](https://commons.wikimedia.org/wiki/File:Artichoke_in_Dalat,_Vietnam.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Cà phê | [RG72](https://commons.wikimedia.org/wiki/File:Kafarboj_sur_kampoj_apud_Da_Lat,_Vjetnamio_03.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Chè | [ℍmoong](https://commons.wikimedia.org/wiki/File:%C4%90%E1%BB%93i_ch%C3%A8_C%E1%BA%A7u_%C4%90%E1%BA%A5t,_th%C3%A1ng_11_n%C4%83m_2011_-_1.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Bơ | [B.navez](https://commons.wikimedia.org/wiki/File:Persea_americana_fruits.JPG) | [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) |
| Hồng ăn trái | [Silverije](https://commons.wikimedia.org/wiki/File:Kaki_-_zreli_plodovi_na_stablu.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |

</details>

## Giới hạn hiện tại

- Quy trình chăm sóc: chè Đài Loan (bón theo lứa hái, app chưa mô tả được) và rau muống (QĐ
  1972 không có quy trình) → app hiện "Chưa có dữ liệu quy trình" kèm lý do và nguồn tham
  khảo; không tự suy diễn. Phương án NPK thay thế mà quy trình không ghi cách chia lần (lúa,
  dưa leo) chưa đưa vào máy tính — ghi ở `extra_rules`.
- Giá trong F1 chỉ tính cho item có sản phẩm tương ứng trong danh mục; phân chuồng, hữu cơ vi
  sinh, vôi, borat, canxi – bo, Trichoderma, MgSO₄, SA… hiện "Chưa có giá" và tổng ghi rõ
  "Chưa gồm". Lượng tính bằng m³ (phân chuồng ở nhiều quy trình Lâm Đồng) không bao giờ bị
  nhân với giá theo kg.
- Giai đoạn ước tính từ ngày trồng dùng chung một thang ~90–100 ngày cho mọi cây hằng năm;
  với cây ngắn ngày (dưa leo thu từ 45–48 ngày sau gieo) giai đoạn ước tính sẽ trễ hơn thực
  tế — nông hộ chọn lại giai đoạn hoặc mở vụ để ghi đúng.
- Thông báo tới điện thoại đi qua đồng bộ nền (~15 phút một lần; Android có thể giãn ra khi máy
  tiết kiệm pin), không tức thì. Đẩy tức thì cần Firebase Cloud Messaging — phải có dự án
  Firebase của chủ sản phẩm (`google-services.json` và khoá tài khoản dịch vụ), chưa làm.
- Xuất CSV đưa nội dung qua bảng chia sẻ của máy (Share sheet), không ghi file.
- "Báo lỗi" gửi thông điệp, stack, màn hình, phiên bản và thời điểm — chưa đính kèm ảnh chụp
  màn hình.
- PDF trên web do server tạo (fpdf2) thay vì pdfkit trong trình duyệt; nội dung khớp bản mobile.
- Giai đoạn của một vụ đang trồng (`crop_cycles.stage`) chưa tự tiến theo thời gian — chỉ đổi
  khi sửa tay; lô không có vụ đang mở thì tab "Chăm sóc" **ước tính từ ngày trồng**
  (ADR 0002 §7).
- Gợi ý trồng xen / khoảng cách giữa các cây chưa làm: chưa có nguồn chính thống (ADR 0008).
- Schema mobile ở **v8** (v6→v7: `task_notes`, `care_guides`, thêm cột cho `crop_cycles` và
  `expense`; v7→v8: `notifications`, `notification_reads`), có migration sync — **triển khai máy
  chủ trước app**. Server tự thêm
  cột/bảng/chỉ mục thiếu lúc khởi động (`app/core/schema_upgrade.py`) thay cho Alembic —
  chỉ làm được thay đổi kiểu "thêm vào"; đổi kiểu cột hay xoá cột vẫn phải làm tay.
- Kiểm tải mới chạy trên máy phát triển Windows: 100 nông hộ đồng thời không lỗi và không
  mất bản ghi, nhưng p95 dưới 1 giây mới đạt tới khoảng 50 người cho mỗi tiến trình. Phải đo
  lại trên máy chủ Linux trước khi tuyên bố đạt mốc 100
  ([docs/BACKEND_DEPLOYMENT.md](docs/BACKEND_DEPLOYMENT.md) §5).
- Test render toàn bộ `App` trong jest đã bỏ (cần mock native module; treo với WatermelonDB);
  thay bằng test render từng component và test logic thuần.
- Giọng nói: mô hình nhỏ chỉ nghe tốt từ vựng sổ ruộng; số đo trên giọng tổng hợp là mức trần,
  chưa đo với giọng người trong nhà màng. Câu nói khác mẫu thì bản nháp có thể thiếu trường —
  nông dân luôn xem và sửa trước khi lưu.
- Thời tiết là **dự báo mô hình** cho một điểm ở làng hoa (Open-Meteo, gói miễn phí phi thương
  mại), không phải số đo tại vườn và không thay bản tin chính thức của Trung tâm Dự báo KTTV
  Quốc gia.
