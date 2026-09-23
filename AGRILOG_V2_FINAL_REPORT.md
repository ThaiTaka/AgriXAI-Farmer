# AgriLog v2 — Hệ thống ghi chép canh tác cho nông hộ, hoạt động không phụ thuộc kết nối mạng

## Báo cáo hoàn thành dự án

| | |
|---|---|
| **Tác giả** | Lê Thành Thái |
| **Ngày báo cáo** | 23/09/2026 |
| **Phạm vi báo cáo** | Giai đoạn 1–5: nền tảng, đồng bộ, nghiệp vụ, vận hành và chuẩn bị triển khai |
| **Mã nguồn** | `github.com/ThaiTaka/AgriXAI-Farmer` |

> **Cách đọc báo cáo này.** Mọi số liệu trong báo cáo đều lấy từ một lần chạy thật, ghi lại
> ngày 23/09/2026, và nêu rõ cách kiểm chứng lại. Ảnh minh hoạ chụp từ máy ảo Pixel 6a đang
> chạy ứng dụng với máy chủ thật, không phải bản dựng thiết kế. Những chỗ chưa đạt được nêu
> thẳng trong phần 5 và phần 7 thay vì để người đọc tự phát hiện.

---

## Tóm tắt

AgriLog v2 là ứng dụng di động giúp nông hộ ghi chép hoạt động canh tác: lô đất được giao,
cây trồng và giống, quy trình chăm sóc theo giai đoạn, kho phân bón và sổ thu – chi. Ràng
buộc thiết kế quan trọng nhất xuất phát từ nơi ứng dụng được dùng: ngoài đồng, sóng chập
chờn, màn hình đọc dưới nắng. Vì vậy hệ thống được xây dựng theo kiến trúc *offline-first* —
mọi thao tác ghi vào cơ sở dữ liệu trên máy trước, đồng bộ hai chiều với máy chủ sau.

Phần khách (client) dùng React Native 0.81 với WatermelonDB (SQLite); phần chủ (server) dùng
FastAPI và SQLAlchemy 2, chạy trên PostgreSQL 16 ở môi trường production. Đồng bộ theo giao
thức WatermelonDB với chiến lược giải quyết xung đột *last-write-wins* dựa trên dấu thời gian
`updated_at`, và mọi bản ghi bị máy chủ giữ lại đều được trả về cho máy khách thay vì bị bỏ
qua trong im lặng.

Kết quả kiểm chứng: 198 test phía di động (phủ 91,0 % câu lệnh) và 163 test phía máy chủ (phủ
95 %, chạy xanh trên cả SQLite lẫn PostgreSQL 16). Quá trình rà soát phát hiện và sửa bốn lỗi
thực chất, trong đó có một lỗi rò rỉ dữ liệu giữa các nông hộ và một lỗ hổng cho phép vượt
quyền qua đường đồng bộ. Kiểm tải với 25, 50 và 100 người dùng đồng thời không ghi nhận lỗi
và không mất bản ghi ở cả ba mức; ngưỡng thời gian phản hồi p95 dưới một giây đạt tới khoảng
50 người đồng thời trên mỗi tiến trình máy chủ.

---

## 1. Giới thiệu

### 1.1 Bối cảnh

Nông hộ quy mô nhỏ ghi chép canh tác bằng sổ giấy hoặc bằng trí nhớ. Hệ quả có thể quan sát
được ở cuối mỗi vụ: không trả lời được câu hỏi vụ này lãi hay lỗ, không biết đã bón loại phân
nào vào ngày nào, không biết trong kho còn bao nhiêu.

Các phần mềm quản lý nông nghiệp hiện có thường giả định ba điều kiện mà thực tế đồng ruộng
không bảo đảm:

1. **Kết nối mạng liên tục.** Phần lớn ứng dụng gọi API cho từng thao tác; mất sóng là mất
   khả năng ghi.
2. **Người dùng thành thạo giao diện số.** Giao diện nhiều tầng, thuật ngữ tiếng Anh, chữ nhỏ.
3. **Điều kiện quan sát trong nhà.** Độ tương phản đủ trên màn hình văn phòng nhưng không đủ
   dưới ánh nắng trực tiếp.

Ba giả định này định hình toàn bộ các quyết định kỹ thuật trình bày ở phần 2.

### 1.2 Mục tiêu

| # | Mục tiêu | Tiêu chí nghiệm thu |
|---|---|---|
| M1 | Ghi chép được khi không có mạng | Toàn bộ chức năng dùng được khi máy chủ ngừng hoạt động |
| M2 | Dữ liệu không mất khi đồng bộ | Số bản ghi đẩy lên bằng số kéo về, kể cả khi nhiều máy cùng ghi |
| M3 | Xung đột không âm thầm ghi đè | Bản ghi bị từ chối phải được báo lại cho người dùng |
| M4 | Dữ liệu của hộ này không lộ sang hộ khác | Kiểm chứng bằng test tự động |
| M5 | Đọc và bấm được ngoài nắng | Độ tương phản đạt WCAG AAA cho chữ nội dung |
| M6 | Không bịa số liệu nông học | Mọi định mức đều dẫn nguồn; thiếu nguồn thì ghi "Chưa có dữ liệu" |

### 1.3 Phạm vi báo cáo

Báo cáo trình bày kết quả của Giai đoạn 1 đến Giai đoạn 5. Các hạng mục **nằm ngoài phạm vi**
và lý do:

| Hạng mục | Lý do loại trừ |
|---|---|
| Chẩn đoán bệnh cây qua ảnh | Đã có ở Giai đoạn 2 và **bị gỡ bỏ có chủ đích**: độ chính xác không đủ để nông hộ ra quyết định phun thuốc, mà một khuyến nghị sai ở đây gây thiệt hại thật |
| Nhận dạng giọng nói | Thuộc phần còn lại của Giai đoạn 5, chưa triển khai |
| Thông báo đẩy | Chức năng "đặt nhắc" hiện lưu ngày nhắc và hiển thị ở trang chủ, chưa có thông báo hệ thống |
| Dự báo thời tiết | Ngoài phạm vi nghiệp vụ đã thống nhất |

Việc gỡ bỏ chức năng chẩn đoán bệnh có một hệ quả kiểm chứng được: ứng dụng hiện chỉ xin
**đúng một quyền hệ thống là `INTERNET`**, không xin quyền máy ảnh hay quyền đọc thư viện ảnh.

---

## 2. Phương pháp

### 2.1 Kiến trúc hệ thống

Hệ thống gồm ba thành phần, dùng chung một tập dữ liệu tĩnh:

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Ứng dụng di động | React Native 0.81.6, React 19.1, WatermelonDB 0.28 (SQLite) | Nơi nông hộ ghi chép; giữ toàn bộ dữ liệu của hộ trên máy |
| Máy chủ API | FastAPI, SQLAlchemy 2.0, PostgreSQL 16 (SQLite khi phát triển) | Lưu trữ tập trung, xác thực, đồng bộ, báo cáo PDF |
| Trang quản trị | Next.js 16, Tailwind CSS 4 | Cán bộ quản lý xem số liệu từng nông hộ |
| Dữ liệu tĩnh dùng chung | Tệp JSON trong `shared/data` | Danh mục giống, quy trình chăm sóc, bảng giá phân bón |

Trạng thái phía di động **không** dùng thư viện quản lý trạng thái ngoài. Dữ liệu được đọc
trực tiếp từ WatermelonDB qua cơ chế observable: khi một bản ghi thay đổi — dù do người dùng
sửa hay do đồng bộ kéo về — màn hình đang mở tự cập nhật. Thêm một lớp trạng thái thứ hai
song song với cơ sở dữ liệu sẽ tạo ra hai nguồn sự thật cần giữ đồng bộ với nhau, đúng vào
chỗ dễ sai nhất.

### 2.2 Cơ chế đồng bộ hai chiều

Đồng bộ chạy nền khi đăng nhập, khi ứng dụng quay lại tiền cảnh, và mỗi 60 giây. Giao thức
gồm hai thao tác: *kéo* (pull) các thay đổi mới hơn mốc thời gian lần đồng bộ trước, và *đẩy*
(push) các thay đổi cục bộ. Mười bảng tham gia đồng bộ: lô đất, giống cây, chu kỳ canh tác,
nhật ký thay đổi, và sáu bảng nghiệp vụ (kế hoạch bón, nhập kho, xuất kho, thu, chi, lịch sử
công việc).

**Chiến lược xử lý xung đột: last-write-wins theo `updated_at`.** Lựa chọn này dựa trên một
đặc điểm của bài toán: mỗi bản ghi ở đây có đúng một tác giả tự nhiên là nông hộ sở hữu lô
đất. Trường hợp hai thiết bị cùng sửa một bản ghi trong cùng một cửa sổ đồng bộ là hiếm, và
khi xảy ra thì bản sửa sau chính là bản người dùng làm sau cùng, tức là bản họ muốn giữ. Hợp
nhất theo từng trường (field-level merge) tinh vi hơn nhưng khó đoán đối với người dùng — họ
đặt diện tích 1200 rồi thấy hiển thị 800 kèm tên mới vừa sửa.

Điểm mấu chốt để chiến lược này không gây mất dữ liệu: **bản ghi thua cuộc không bị bỏ qua
trong im lặng.** Phản hồi của thao tác đẩy liệt kê từng bản ghi bị từ chối kèm bản hiện có
trên máy chủ, để ứng dụng hỏi lại người dùng *"giữ bản của tôi hay lấy bản mới?"*. Ngoài ra
mọi xung đột đều được ghi log ở mức cảnh báo, kèm tên bảng, mã bản ghi và tài khoản — đây là
dòng log cần tra khi có người báo "tôi sửa rồi mà nó không đổi".

Thao tác xoá luôn thắng thao tác sửa đồng thời: một bản ghi đã xoá bỗng xuất hiện lại trên
máy nông hộ gây bối rối hơn là một thao tác xoá phải làm lại.

### 2.3 Nguyên tắc xử lý dữ liệu nông học

Tệp danh mục giống khai báo chính sách dữ liệu ngay trong phần `$meta`: mọi giống đều có
trường `source` trỏ tới trang đã tra cứu; số liệu (kích thước, năng suất, thời gian thu
hoạch, độ cay) chép đúng theo nguồn; chỗ nào nguồn không nói thì ghi "Chưa có dữ liệu" hoặc
để trống.

Nguyên tắc này được thực thi bằng mã chứ không chỉ bằng quy ước: năm loài cây bổ sung ở Giai
đoạn 5 chưa có định mức bón chính thức, nên màn hình quy trình chăm sóc hiển thị trạng thái
"Chưa có dữ liệu" kèm nơi tra cứu, thay vì nội suy liều lượng từ cây khác. Có test tự động
bảo đảm một cây không có quy trình thì vẫn phải chọn được giống có nguồn — thêm cây mà để
màn hình rỗng chỉ tạo ra ngõ cụt cho người dùng.

### 2.4 Quy trình kiểm thử

| Lớp | Công cụ | Số lượng | Phạm vi |
|---|---|---|---|
| Di động | Jest + react-test-renderer | 198 test / 20 bộ | Logic nghiệp vụ thuần, hình học biểu đồ, kết xuất từng component, điều hướng |
| Máy chủ | pytest + TestClient | 163 test | Đơn vị, tích hợp qua HTTP thật, và các kịch bản đầu-cuối |
| Đối chiếu lược đồ | pytest | trong 163 test trên | Bảo đảm lược đồ SQLite trên máy và lược đồ máy chủ không lệch nhau |
| Kiểm tải | Kịch bản riêng (`scripts/loadtest.py`) | 3 mức tải | Thời gian phản hồi và toàn vẹn dữ liệu khi nhiều người dùng đồng thời |

Bộ test máy chủ chạy được trên cả hai hệ quản trị cơ sở dữ liệu bằng cách đổi một biến môi
trường, nhờ đó phát hiện được các khác biệt phương ngữ SQL — mục 4.3 mô tả một lỗi thuộc loại
này.

---

## 3. Kết quả

### 3.1 Chức năng nghiệp vụ

Bốn mảng nghiệp vụ đã hoàn thành:

| Mảng | Nội dung | Trạng thái |
|---|---|---|
| Tư vấn phân bón | Tính lượng bón theo diện tích và phương án, lưu kế hoạch; phân loại theo ngân sách; kiểm tra kho đủ hay thiếu trước khi bón; bảng giá sáu nhóm phân | Hoàn thành |
| Quy trình chăm sóc | Bảy quy trình có nguồn chính thức, chia bốn giai đoạn, tick từng việc kèm thanh tiến độ, đặt nhắc | Hoàn thành |
| Kho phân bón | Nhập kho tự sinh khoản chi tương ứng, xuất kho tính giá FIFO, bảng tồn, biểu đồ tồn theo thời gian, xuất CSV | Hoàn thành |
| Thu – chi | Ghi thu và chi, đánh dấu đã đối chiếu, báo cáo tháng/quý, biểu đồ, xuất CSV và PDF | Hoàn thành |

Danh mục giống cây ba cấp làm nền cho cả bốn mảng: **9 loại cây, 23 loại con, 46 giống**, mỗi
giống dẫn nguồn. Danh mục để mở — nông hộ khai báo thêm cây và giống của mình, quản trị viên
duyệt sau; trong dữ liệu trên máy dùng để chụp ảnh minh hoạ có một cây do người dùng tự thêm
(hiển thị nhãn "1 giống tự thêm").

**Hình 1 — Trang chủ và danh mục cây trồng.** Ba thẻ tóm tắt là tổng hợp từ chính các bảng
nghiệp vụ: tồn kho 1.508.000đ, tháng 9 lỗ 700.000đ (thu 1.500.000đ, chi 2.200.000đ), 6 công
việc thuộc giai đoạn hiện tại của hai lô.

| Trang chủ | Danh mục cây trồng |
|---|---|
| ![Trang chủ với ba thẻ tóm tắt](docs/screenshots/71-p5-home-dashboard.png) | ![Màn hình chọn loại cây](docs/screenshots/81-p5-crop-picker.png) |

**Hình 2 — Kho phân bón.** Bảng tồn liệt kê từng loại phân kèm giá nhập trung bình; tổng giá
trị tồn 1.508.000đ trùng khớp với thẻ trên trang chủ. Hai con số này được tính bởi hai đoạn
mã độc lập (một trên máy, một trên máy chủ) và có test so khớp, nên sự trùng khớp là kết quả
kiểm chứng chứ không phải một con số hiển thị lại.

| Bảng tồn | Biểu đồ tồn theo thời gian |
|---|---|
| ![Bảng tồn kho](docs/screenshots/76-p5-stock-summary.png) | ![Biểu đồ tồn kho](docs/screenshots/77-p5-stock-chart-bezier.png) |

**Hình 3 — Báo cáo thu chi và quy trình chăm sóc có dẫn nguồn.** Màn hình quy trình hiển thị
tên cơ quan ban hành, ngày đăng và ngày tra cứu, cùng liên kết "Xem tài liệu tham khảo".

| Báo cáo thu – chi | Quy trình chăm sóc |
|---|---|
| ![Biểu đồ thu chi và cơ cấu chi](docs/screenshots/79-p5-finance-report-charts.png) | ![Quy trình chăm sóc với nguồn](docs/screenshots/83-p5-care-protocol-source-link.png) |

### 3.2 Kiểm chứng hoạt động không phụ thuộc mạng (M1)

Để kiểm chứng mục tiêu M1, máy chủ API được **dừng hoàn toàn**, sau đó ứng dụng được khởi
động lại trên máy ảo. Kết quả: ứng dụng hiển thị đầy đủ số liệu và tiếp tục cho phép ghi
chép, vì toàn bộ dữ liệu của nông hộ nằm trong cơ sở dữ liệu SQLite trên máy.

![Ứng dụng hoạt động đầy đủ khi máy chủ đã dừng](docs/screenshots/84-p5-works-with-backend-down.png)

Khi máy chủ hoạt động trở lại, ứng dụng tự đồng bộ và hiển thị trạng thái ở dải trên cùng.
Dải này nằm **dưới** thanh trạng thái hệ thống, không che đồng hồ, pin và biểu tượng sóng —
đây là một trong tám điểm sửa giao diện nêu ở mục 3.4.

![Dải trạng thái đồng bộ nằm dưới thanh hệ thống](docs/screenshots/72-p5-sync-banner-safe-area.png)

### 3.3 Kết quả kiểm thử tự động

| Lớp | Số test | Độ phủ | Ghi chú |
|---|---|---|---|
| Di động | 198 (20 bộ) | 91,0 % câu lệnh · 92,3 % dòng | `tsc` không lỗi; `eslint` 0 lỗi, 4 cảnh báo |
| Máy chủ trên SQLite | 163 | 95 % | Môi trường phát triển |
| Máy chủ trên PostgreSQL 16 | 163 | — | Cùng bộ test, đổi biến môi trường `TEST_DATABASE_URL` |

Bộ test máy chủ bao gồm các nhóm kịch bản: xác thực và đổi mật khẩu; đồng bộ hai chiều kèm
tình huống hai thiết bị sửa cùng một bản ghi; đối chiếu lược đồ giữa máy và máy chủ; toàn vẹn
dữ liệu tĩnh; nghiệp vụ kho và thu chi; 15 kịch bản đầu-cuối của Giai đoạn 3; 23 kịch bản
Giai đoạn 4; và 23 kịch bản Giai đoạn 5 về phân quyền, cô lập dữ liệu giữa các nông hộ, tính
toàn vẹn của lô dữ liệu đẩy lên, và chống dò mật khẩu.

### 3.4 Tám điểm sửa giao diện phục vụ điều kiện sử dụng ngoài đồng

Rà soát giao diện xác định tám vấn đề cản trở việc đọc và thao tác dưới điều kiện thực tế.
Cả tám đã được sửa và có test tự động đi kèm.

| # | Vấn đề quan sát được | Giải pháp | Hệ quả đo được |
|---|---|---|---|
| 1 | Biểu tượng thanh trạng thái tối trên dải màu xanh đậm | Mỗi màn hình khai báo kiểu thanh trạng thái đúng một lần, qua thuộc tính của component khung | Đồng hồ, pin, sóng hiển thị trắng, đọc được |
| 2 | Chữ giải thích cỡ nhỏ, tương phản thấp | Nâng lên 14px, màu `#4A4A4A` | Tỉ lệ tương phản 8,8:1 — đạt WCAG AAA |
| 3 | Nhãn thông tin trông giống nút bấm | Tách hai biến thể: nhãn không viền, nút đặc màu chiếm hết bề ngang thẻ | Người dùng không còn bấm vào nhãn |
| 4 | Ô ghi chú một dòng, chữ trôi mất | Chuyển sang nhiều dòng, cao cố định, viết từ trên xuống | Nhập được ghi chú dài |
| 5 | Dải chip đơn vị vỡ xuống dòng thứ hai | Cuộn ngang thay vì xuống dòng | Sáu đơn vị nằm trên một dòng |
| 6 | Địa chỉ web thô hiển thị nguyên chuỗi | Thay bằng thành phần liên kết: tên cơ quan ban hành kèm chữ "Xem tài liệu tham khảo" | Bấm được, đọc được; địa chỉ thật nằm trong nhãn trợ năng |
| 7 | Đường biểu đồ gãy khúc và vọt quá dữ liệu | Đường cong Bezier bậc ba với tiếp tuyến ngang tại mỗi mốc | Đường không bao giờ vượt ra ngoài khoảng giá trị của hai mốc — biểu đồ tồn kho không vẽ ra số âm |
| 8 | Dải đồng bộ cộng phần lề an toàn hai lần, che thanh trạng thái | Chuyển việc cộng lề về một nơi duy nhất | Dải nằm đúng dưới thanh trạng thái |

Điểm 7 đáng nói thêm, vì nó là một ràng buộc đúng đắn về mặt biểu diễn chứ không chỉ là vấn
đề thẩm mỹ. Với mỗi đoạn giữa hai mốc, hai điểm điều khiển được đặt tại 1/3 và 2/3 bề ngang
và **giữ nguyên độ cao của hai đầu đoạn**. Bao lồi của bốn điểm điều khiển vì thế nằm gọn
trong khoảng giá trị của hai mốc, nên đường cong không thể cao hơn mốc cao hơn hay thấp hơn
mốc thấp hơn. Với dữ liệu tồn kho, điều này có nghĩa là biểu đồ không bao giờ vẽ ra lượng
tồn âm trong khi kho chưa bao giờ âm.

| Chip đơn vị cuộn ngang (điểm 5) | Nhãn và nút phân biệt rõ (điểm 3) |
|---|---|
| ![Chip đơn vị diện tích cuộn ngang](docs/screenshots/80-p5-calculator-unit-chips-scroll.png) | ![Form ghi thu với chip và nút](docs/screenshots/78-p5-income-form-chip-vs-button.png) |

### 3.5 Chuyển đổi cơ sở dữ liệu sang PostgreSQL

Môi trường phát triển dùng SQLite; môi trường production dùng PostgreSQL. Việc chuyển đổi
được kiểm chứng bằng một lần chạy thật với dữ liệu phát triển hiện có:

| Hạng mục | Kết quả |
|---|---|
| Số bản ghi chuyển | 118 dòng trên 13 bảng |
| Đối chiếu số dòng nguồn – đích | Khớp trên toàn bộ 13 bảng |
| Xác thực sau chuyển đổi | Đăng nhập thành công bằng tài khoản đã chuyển (mã băm mật khẩu còn nguyên) |
| Chức năng sau chuyển đổi | Danh sách lô đất, đồng bộ và bảng tổng hợp đều hoạt động |

Kịch bản chuyển đổi đọc và ghi qua lớp ORM chứ không qua SQL thô, nhờ đó việc chuyển kiểu dữ
liệu do chính thư viện đảm nhiệm — đây là chỗ giá trị `0`/`1` của SQLite trở thành kiểu
`boolean` thật của PostgreSQL thay vì gây lỗi kiểu lúc chạy. Kịch bản đối chiếu lại số dòng
hai bên sau khi chép và báo lỗi nếu lệch.

### 3.6 Kiểm tải

Phương pháp: một kịch bản mô phỏng N người dùng đồng thời, mỗi người thực hiện bốn thao tác
(xem danh sách lô, đồng bộ lần đầu, đồng bộ gia tăng, đẩy 10 bản ghi), sau đó **đối chiếu số
bản ghi đã đẩy lên với số kéo về** để phát hiện mất dữ liệu.

Môi trường đo: máy phát triển Windows 11, PostgreSQL 16 chạy trong Docker, **một tiến trình**
máy chủ.

| Số người đồng thời | p95 xem lô đất | p95 đồng bộ lần đầu | p95 đồng bộ gia tăng | p95 đẩy dữ liệu | Lỗi | Bản ghi mất |
|---|---|---|---|---|---|---|
| 25 | 331 ms | 412 ms | 339 ms | 410 ms | 0 | 0 |
| 50 | 672 ms | 795 ms | 621 ms | 774 ms | 0 | 0 |
| 100 | 1.194 ms | 1.383 ms | 1.457 ms | 1.463 ms | 0 | 0 |

Hai kết luận cần tách bạch:

1. **Về toàn vẹn dữ liệu — đạt.** Ở cả ba mức tải, không có yêu cầu nào lỗi và không bản ghi
   nào thất lạc. Đây là tiêu chí quan trọng hơn, vì một hệ thống chậm còn dùng được, còn một
   hệ thống làm mất sổ ghi chép thì không.
2. **Về thời gian phản hồi — đạt tới khoảng 50 người đồng thời cho mỗi tiến trình.** Mốc 100
   người cần 2–3 tiến trình; ảnh Docker của dự án đã cấu hình sẵn bốn tiến trình.

Số đo trên máy Windows dùng để phát triển **không đại diện** cho máy chủ Linux: đo riêng cho
thấy một truy vấn cơ sở dữ liệu chỉ tốn khoảng 2 ms, trong khi phần khung xử lý HTTP tốn
khoảng 10 ms cho mỗi yêu cầu. Vì vậy báo cáo này **không tuyên bố** đã đạt mốc 100 người đồng
thời dưới một giây; phép đo đó phải được lặp lại trên môi trường triển khai thật.

### 3.7 Đóng gói triển khai

Đã kiểm chứng bằng một lần chạy thật, không chỉ bằng tệp cấu hình:

- Ảnh Docker dựng thành công và chạy được ở chế độ production với bốn tiến trình máy chủ, kết
  nối PostgreSQL, chạy dưới tài khoản thường (không phải `root`).
- Cơ chế bảo vệ cấu hình hoạt động đúng: máy chủ **từ chối khởi động** khi môi trường khai
  báo là production nhưng vẫn dùng khoá bí mật mặc định, vẫn trỏ vào SQLite, hoặc vẫn bật chế
  độ gỡ lỗi. Ba sai sót này đều im lặng cho tới lúc trả giá đắt; biến chúng thành một lần
  triển khai thất bại là cách xử lý rẻ hơn nhiều.
- Đặc tả OpenAPI được xuất ra tệp trong kho mã: **56 endpoint**, kèm bảng liệt kê quyền truy
  cập của từng endpoint.

---

## 4. Lỗi phát hiện và cách xử lý

Bốn lỗi dưới đây được phát hiện trong quá trình rà soát và kiểm tải Giai đoạn 5. Mỗi lỗi
trình bày theo bốn mục: mô tả, nguyên nhân, cách sửa, và ảnh hưởng nếu không sửa.

### 4.1 Rò rỉ nhật ký thay đổi giữa các nông hộ

**Mô tả.** Khi một nông hộ đồng bộ, máy của họ nhận về nhật ký chỉnh sửa của *mọi* nông hộ
khác trong hệ thống — ví dụ dòng "Nguyễn Văn Anh sửa diện tích 800 → 1200" xuất hiện trên máy
của một hộ không liên quan.

**Nguyên nhân.** Bảng ánh xạ các bảng đồng bộ phân loại mỗi bảng bằng một cờ nhị phân
"có chủ sở hữu hay không". Bảng nhật ký thay đổi không có cột `owner_id` — tác giả của bản
ghi được lưu ở cột `changed_by` — nên nó bị xếp nhầm vào nhóm "dữ liệu dùng chung", cùng nhóm
với danh mục giống cây vốn cố ý chia sẻ cho mọi hộ.

**Cách sửa.** Thay cờ nhị phân bằng **tên cột xác định chủ sở hữu** cho từng bảng: các bảng
nghiệp vụ dùng `owner_id`, bảng nhật ký dùng `changed_by`, riêng danh mục giống khai báo
`None` để giữ nguyên tính chất dùng chung có chủ đích. Máy chủ luôn ghi đè cột này bằng tài
khoản đang đăng nhập, nên máy khách không thể khai gian tác giả.

**Ảnh hưởng nếu không sửa.** Hai hậu quả độc lập. Thứ nhất là lộ dữ liệu: nhật ký ghi ai sửa
gì, vào lúc nào, trên lô nào. Thứ hai là hiệu năng suy giảm theo quy mô: gói dữ liệu mỗi lần
đồng bộ phình theo lịch sử của **toàn hệ thống** thay vì của một nông hộ, nên càng nhiều
người dùng thì đồng bộ càng chậm cho tất cả.

Đã bổ sung bốn test tự động cho lỗi này, trong đó có test kiểm tra rằng một máy khách gửi lên
nhật ký mang danh nghĩa người khác thì máy chủ vẫn ghi đúng tác giả thật.

### 4.2 Vượt quyền tạo lô đất qua đường đồng bộ

**Mô tả.** Quy tắc nghiệp vụ: lô đất do bên quản lý đất đo đạc, đánh mã và giao; nông hộ nhận
lô chứ không tự tạo. Ứng dụng đã gỡ nút "thêm lô", nhưng máy chủ vẫn chấp nhận yêu cầu tạo lô
từ tài khoản nông hộ.

**Nguyên nhân.** Quy tắc mới chỉ được thực thi ở giao diện. Nút bị ẩn không phải là quyền bị
chặn.

**Cách sửa.** Thực thi ở máy chủ trên **cả hai đường ghi**: endpoint REST tạo lô chỉ quản trị
viên gọi được (trả 403 với nông hộ), và đường đồng bộ từ chối các lô do máy khách tạo, trả
bản ghi bị từ chối kèm lý do để ứng dụng hiển thị. Quản trị viên tạo lô kèm mã tài khoản nhận
lô. Quyền **sửa** lô vẫn giữ nguyên cho nông hộ sở hữu.

**Ảnh hưởng nếu không sửa.** Chặn một đường mà bỏ ngỏ đường kia thì quy tắc coi như không tồn
tại: bất kỳ ai có token hợp lệ đều tạo được lô đất bằng một yêu cầu HTTP, hoặc đơn giản là
bằng cách đẩy lô mới qua đường đồng bộ.

![Danh sách lô đất không có lối tạo lô](docs/screenshots/73-p5-my-lots-no-add-button.png)

### 4.3 Câu lệnh riêng của SQLite được gửi tới PostgreSQL

**Mô tả.** Kịch bản chuyển dữ liệu từ SQLite sang PostgreSQL dừng với lỗi cú pháp: PostgreSQL
nhận được câu lệnh `PRAGMA journal_mode=WAL` vốn chỉ SQLite hiểu.

**Nguyên nhân.** Đoạn mã cấu hình SQLite đăng ký một bộ lắng nghe sự kiện *ở mức lớp* đối
tượng kết nối, kèm một điều kiện kiểm tra kiểu cơ sở dữ liệu đọc từ cấu hình chung của tiến
trình. Trong tiến trình của kịch bản chuyển đổi, cấu hình chung trỏ vào SQLite (nguồn), nên
điều kiện vẫn đúng, và bộ lắng nghe bắn cả sang kết nối PostgreSQL (đích) được tạo riêng
trong cùng tiến trình.

**Cách sửa.** Gắn bộ lắng nghe vào **đúng một đối tượng kết nối** của ứng dụng thay vì gắn ở
mức lớp. Mọi kết nối khác tạo trong cùng tiến trình không còn bị ảnh hưởng.

**Ảnh hưởng nếu không sửa.** Không thể chuyển dữ liệu sang PostgreSQL bằng kịch bản tự động —
tức là chặn đúng bước bắt buộc để đưa hệ thống lên môi trường production.

### 4.4 Giá trị mặc định kiểu luận lý không hợp lệ trên PostgreSQL

**Mô tả.** Cơ chế tự bổ sung cột thiếu khi khởi động sinh ra câu lệnh thêm cột kiểu luận lý
với giá trị mặc định là `1`. SQLite chấp nhận (kiểu luận lý được lưu như số nguyên);
PostgreSQL từ chối vì kiểu `boolean` không nhận giá trị số.

**Nguyên nhân.** Hàm sinh giá trị mặc định viết theo phương ngữ của SQLite và không phân biệt
hệ quản trị đang dùng.

**Cách sửa.** Sinh giá trị mặc định theo phương ngữ của kết nối hiện tại: `1`/`0` cho SQLite,
`TRUE`/`FALSE` cho PostgreSQL.

**Ảnh hưởng nếu không sửa.** Lỗi chỉ xuất hiện khi nâng cấp lược đồ trên PostgreSQL, tức là
lúc triển khai bản mới lên production — thời điểm tệ nhất để phát hiện.

### 4.5 Một cải tiến đi kèm: lô dữ liệu đẩy lên là một giao dịch

Không phải lỗi đã xảy ra, nhưng là rủi ro có thật được xử lý cùng đợt. Trước đây, nếu một lô
dữ liệu đẩy lên hỏng ở giữa chừng, phần đã ghi vẫn nằm lại trên máy chủ. Máy khách không có
cách nào biết phần nào đã lên: gửi lại thì trùng, không gửi lại thì mất.

Nay mỗi lô đẩy là **một giao dịch trọn vẹn** — vào hết hoặc không vào gì, và máy chủ trả mã
lỗi 422 thay vì 500 để báo rằng lỗi thuộc về dữ liệu máy khách gửi lên. Nhờ vậy, gửi lại
nguyên lô sau khi sửa luôn an toàn. Tình huống này đúng với thực tế sử dụng: nông hộ ghi chép
cả buổi sáng ngoài đồng, về tới chỗ có sóng thì điện thoại đẩy một lượt vài chục bản ghi.

---

## 5. Thảo luận

### 5.1 Vì sao chọn kiến trúc offline-first thay vì gọi API trực tiếp

Lợi ích rõ ràng: ứng dụng dùng được ở nơi không có sóng, phản hồi tức thì vì dữ liệu đọc từ
máy, và bản thân dữ liệu luôn có một bản sao trên thiết bị.

Cái giá phải trả cũng rõ: phải có cơ chế đồng bộ và cơ chế giải quyết xung đột, tức là thêm
một lớp logic phức tạp và một lớp trạng thái phải kiểm thử kỹ. Phần lớn các lỗi nghiêm trọng
nêu ở mục 4 đều nằm trong lớp này — điều đó không phải ngẫu nhiên.

Đánh đổi này được chấp nhận vì mất khả năng ghi chép khi mất sóng là hỏng đúng chức năng cốt
lõi, còn độ phức tạp của đồng bộ là thứ kiểm thử được và đã được kiểm thử.

### 5.2 Vì sao giữ FastAPI thay vì chuyển sang khung khác

Giai đoạn 5 có cân nhắc viết lại phần máy chủ bằng một khung web khác để tên bảng khớp với
bản đề xuất ban đầu. Quyết định là **giữ nguyên**, vì ba thứ giá trị nhất trong hệ thống —
giao thức đồng bộ hai chiều, cơ chế xử lý xung đột, và bộ test mô tả chúng — đều đã đúng và
đã được kiểm chứng. Viết lại đồng nghĩa với việc vứt cả ba đi để đổi lấy một lợi ích duy
nhất là tên bảng nhất quán.

Tên bảng lệch nhau là thứ sửa được bất cứ lúc nào bằng một bước chuyển đổi lược đồ; một lỗi
trong cơ chế đồng bộ làm mất sổ ghi chép của nông hộ thì không sửa được sau khi đã xảy ra.
Sự lệch tên vì thế được giữ lại **có chủ đích** và được lập bảng đối chiếu trong tài liệu
quyết định kiến trúc.

### 5.3 Vì sao không có endpoint đăng xuất phía máy chủ

Token xác thực là JWT tự chứa: máy chủ không lưu phiên nào để xoá. Một endpoint đăng xuất trả
về mã thành công rồi không làm gì sẽ **nói dối người gọi** — họ tin rằng token đã bị vô hiệu
hoá trong khi nó vẫn dùng được tới lúc hết hạn.

Vì vậy đăng xuất là việc của máy khách: xoá token khỏi thiết bị. Khi cần vô hiệu hoá thật
(mất điện thoại, thu hồi quyền), quản trị viên khoá tài khoản — thao tác này có hiệu lực ngay
ở yêu cầu kế tiếp, vì mọi yêu cầu đều tra lại tài khoản trong cơ sở dữ liệu.

### 5.4 Thời hạn token và đánh đổi với điều kiện sử dụng

Token có thời hạn bảy ngày, dài hơn thông lệ. Lý do thuộc về bối cảnh sử dụng: nông hộ có thể
ở ngoài vùng phủ sóng nhiều ngày liền, và token ngắn hạn đồng nghĩa với việc bắt họ đăng nhập
lại giữa đồng, nơi không có mạng để đăng nhập.

Rủi ro của token dài hạn được bù bằng hai cơ chế: khoá tài khoản có hiệu lực tức thì như mục
5.3, và giới hạn năm lần đăng nhập sai mỗi phút cho mỗi cặp (người gọi, tài khoản) để chống
dò mật khẩu. Chỉ lần đăng nhập **sai** mới bị đếm — nếu đếm cả lần đúng thì chính người dùng
thật sẽ là người bị khoá.

### 5.5 Giới hạn của phương pháp kiểm chứng đã dùng

Ba giới hạn cần nêu rõ để không đọc kết quả rộng hơn thực tế:

1. **Kiểm tải chạy trên máy phát triển Windows**, không phải máy chủ Linux. Kết luận về toàn
   vẹn dữ liệu không phụ thuộc môi trường, nhưng kết luận về thời gian phản hồi thì có.
2. **Ứng dụng di động đang ở bản gỡ lỗi**, nạp mã nguồn từ máy chủ phát triển qua mạng. Vì
   vậy không thể minh hoạ trạng thái mất sóng bằng cách tắt mạng của máy ảo — thao tác đó
   chặn luôn việc nạp mã. Kiểm chứng offline ở mục 3.2 được thực hiện bằng cách dừng hẳn máy
   chủ API, là phép thử đúng với tình huống nghiệp vụ. Một bản phát hành đóng gói sẵn mã
   nguồn sẽ cho phép kiểm chứng trường hợp mất sóng hoàn toàn.
3. **Chưa có công cụ quản lý phiên bản lược đồ đầy đủ.** Cơ chế hiện tại chỉ bổ sung được cột
   và chỉ mục còn thiếu; việc đổi kiểu cột hoặc xoá cột vẫn phải làm thủ công.

---

## 6. Kết luận

Dự án đã hoàn thành các mục tiêu đặt ra ở mục 1.2, với mức độ kiểm chứng như sau:

| Mục tiêu | Kết quả | Bằng chứng |
|---|---|---|
| M1 — Ghi chép khi không có mạng | Đạt | Ứng dụng hoạt động đầy đủ khi máy chủ đã dừng (mục 3.2) |
| M2 — Không mất dữ liệu khi đồng bộ | Đạt | Không mất bản ghi ở cả ba mức tải; lô đẩy lên là một giao dịch (mục 3.6, 4.5) |
| M3 — Xung đột không âm thầm ghi đè | Đạt | Bản ghi bị từ chối trả về cho máy khách kèm bản của máy chủ, và được ghi log (mục 2.2) |
| M4 — Cô lập dữ liệu giữa các nông hộ | Đạt sau khi sửa lỗi | Lỗi rò rỉ nhật ký đã sửa và có test tự động (mục 4.1) |
| M5 — Đọc được ngoài nắng | Đạt | Tương phản 8,8:1, đạt WCAG AAA (mục 3.4) |
| M6 — Không bịa số liệu nông học | Đạt | Mọi giống dẫn nguồn; thiếu nguồn thì hiển thị "Chưa có dữ liệu" (mục 2.3) |

Mức độ sẵn sàng triển khai: phần máy chủ đã có ảnh Docker chạy được ở chế độ production, quy
trình chuyển dữ liệu đã kiểm chứng trên dữ liệu thật, tài liệu vận hành và tài liệu API đã
hoàn chỉnh. Điều kiện còn lại trước khi phục vụ 100 nông hộ đồng thời là lặp lại phép kiểm
tải trên máy chủ Linux của môi trường triển khai.

---

## 7. Công việc tiếp theo

| Ưu tiên | Hạng mục | Lý do |
|---|---|---|
| Cao | Lặp lại kiểm tải trên máy chủ Linux | Điều kiện để khẳng định năng lực phục vụ 100 người đồng thời |
| Cao | Đưa công cụ quản lý phiên bản lược đồ vào | Bắt buộc khi cần đổi kiểu cột đang có dữ liệu |
| Trung bình | Dựng bản phát hành di động đóng gói sẵn mã nguồn | Cho phép kiểm chứng trường hợp mất sóng hoàn toàn |
| Trung bình | Giới hạn truy cập ở tầng proxy | Bộ đếm hiện đặt trong bộ nhớ tiến trình nên hạn mức nhân lên theo số tiến trình |
| Thấp | Nhận dạng giọng nói, thông báo đẩy | Phần còn lại của Giai đoạn 5 |

---

## Phụ lục A — Danh mục ảnh minh hoạ

Toàn bộ ảnh chụp từ máy ảo Pixel 6a (1080×2400) ngày 23/09/2026, ứng dụng kết nối máy chủ
thật, dữ liệu của tài khoản demo. Tệp gốc nằm trong `docs/screenshots/`.

| Tệp | Nội dung |
|---|---|
| `71-p5-home-dashboard.png` | Trang chủ: ba thẻ tồn kho, lãi/lỗ tháng, công việc |
| `72-p5-sync-banner-safe-area.png` | Dải trạng thái đồng bộ nằm dưới thanh hệ thống |
| `73-p5-my-lots-no-add-button.png` | Danh sách lô đất, không có lối tạo lô |
| `74-p5-tools-menu.png` | Danh sách công cụ |
| `75-p5-warehouse-form-textarea-chips.png` | Form nhập kho: ô ghi chú nhiều dòng, dải chip |
| `76-p5-stock-summary.png` | Bảng tồn kho theo từng loại phân |
| `77-p5-stock-chart-bezier.png` | Biểu đồ tồn theo thời gian, đường cong không vọt quá dữ liệu |
| `78-p5-income-form-chip-vs-button.png` | Form ghi thu: phân biệt chip và nút hành động |
| `79-p5-finance-report-charts.png` | Báo cáo thu – chi và cơ cấu chi theo loại |
| `80-p5-calculator-unit-chips-scroll.png` | Dải chip đơn vị diện tích cuộn ngang |
| `81-p5-crop-picker.png` | Danh mục loại cây |
| `82-p5-crop-picker-user-added-and-sources.png` | Cây do nông hộ tự thêm và ghi chú nguồn danh mục |
| `83-p5-care-protocol-source-link.png` | Quy trình chăm sóc kèm nguồn và thanh tiến độ |
| `84-p5-works-with-backend-down.png` | Ứng dụng hoạt động khi máy chủ đã dừng |

## Phụ lục B — Cách kiểm chứng lại các số liệu trong báo cáo

```bash
# 198 test di động + độ phủ
cd mobile && npx jest --coverage

# 163 test máy chủ trên SQLite, kèm độ phủ
cd backend && ./.venv/Scripts/python.exe -m pytest -q --cov=app

# 163 test máy chủ trên PostgreSQL (cơ sở dữ liệu đích sẽ bị xoá sạch)
docker run -d --name agrilog-pg -e POSTGRES_USER=agrilog -e POSTGRES_PASSWORD=agrilog \
  -e POSTGRES_DB=agrilog -p 5443:5432 postgres:16-alpine
cd backend && TEST_DATABASE_URL="postgresql+psycopg://agrilog:agrilog@127.0.0.1:5443/agrilog" \
  ./.venv/Scripts/python.exe -m pytest -q

# Kiểm tải: thay --users để lặp lại ba mức trong bảng 3.6
cd backend && ./.venv/Scripts/python.exe -m scripts.loadtest \
  --base-url http://127.0.0.1:8000 --users 50 --rows 10
```

## Phụ lục C — Tài liệu liên quan trong kho mã

| Tài liệu | Nội dung |
|---|---|
| `README.md` | Giới thiệu, ảnh màn hình, hướng dẫn cài và chạy |
| `docs/BACKEND_DEPLOYMENT.md` | Hồ sơ vận hành: cấu hình, chuyển dữ liệu, triển khai, sao lưu, theo dõi |
| `docs/API_ENDPOINTS.md` | Bảng 56 endpoint kèm quyền truy cập |
| `docs/api/openapi.json` | Đặc tả OpenAPI đầy đủ |
| `docs/adr/0001`–`0007` | Bảy tài liệu quyết định kiến trúc, mỗi tài liệu nêu bối cảnh, quyết định và hệ quả |
