# ADR 0002 — 4 màn hình lõi mobile (Giai đoạn 1)

- **Ngày:** 07/09/2026
- **Trạng thái:** Đã chốt
- **Phạm vi:** Lưu JWT, sinh mã lô, cấu trúc database cục bộ, chiến lược đồng bộ.

---

## 1. JWT lưu ở Keychain / Keystore, tuyệt đối không AsyncStorage

**Quyết định:** dùng `react-native-keychain` 10, service
`com.thaitaka.agrilogapp.auth`, mức truy cập
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

**Lý do:** AsyncStorage trên Android chỉ là một file SQLite **không mã hoá** nằm trong
sandbox của ứng dụng — bất kỳ ai có quyền adb hoặc máy đã root đều đọc được token của
nông dân. Keychain đẩy việc này xuống keystore của hệ điều hành, có phần cứng bảo vệ
(TEE/StrongBox) khi thiết bị hỗ trợ.

**Chi tiết cài đặt:** Keychain lưu một cặp username/password. Ta đặt **JWT vào ô password**
và **JSON hồ sơ người dùng vào ô username**, gộp trong một entry duy nhất. Nếu tách làm
hai entry sẽ có khoảnh khắc tồn tại token mà không có user (hoặc ngược lại) khi ghi lỗi
giữa chừng.

`WHEN_UNLOCKED_THIS_DEVICE_ONLY` nghĩa là token không theo bản sao lưu sang máy khác —
đúng với ngữ cảnh: một tài khoản nông hộ gắn với một chiếc điện thoại.

---

## 2. Mã lô sinh ngẫu nhiên, không dùng bộ đếm tăng dần

**Quyết định:** định dạng `PUC-YYMM-XXXX` theo thiết kế. Bốn ký tự cuối lấy **ngẫu nhiên**
từ bảng chữ base32 đã bỏ các ký tự dễ đọc nhầm (I, L, O, U).

**Lý do:** bộ đếm tăng dần cần biết toàn bộ mã đã tồn tại, mà điện thoại offline cả tuần
thì không thể biết — hai máy sẽ cùng sinh ra `PUC-2609-0001`. Ngẫu nhiên 4 ký tự cho
~1 triệu tổ hợp mỗi tháng; trước khi lưu vẫn kiểm tra trùng trong bảng cục bộ và thử lại
tối đa 20 lần, sau đó rơi về hậu tố theo millisecond để **không bao giờ lặp vô hạn** trên
máy nông dân.

Bỏ I/L/O/U vì mã này được đọc và chép tay ngoài nắng.

---

## 3. `id` do client sinh — không có cột `server_id`

**Quyết định:** khoá chính là chuỗi do WatermelonDB sinh trên thiết bị; server lưu **đúng
id đó**.

**Lý do:** Điều 1 yêu cầu bản ghi tạo khi offline phải có danh tính ngay. Nếu id do server
cấp thì sau khi đồng bộ phải đổi id và sửa mọi tham chiếu — nguồn lỗi kinh điển.

Ban đầu tôi có thêm cột `server_id` ở mobile. Test `test_schema_parity` bắt ngay lỗi này:
cột đó chỉ tồn tại một phía và hoàn toàn thừa, vì server đã lưu chính id của client. Đã bỏ.

---

## 4. Chiến lược xung đột: last-write-wins theo `updated_at`

**Quyết định:** khi hai bản ghi đụng nhau, bản có `updated_at` lớn hơn thắng. Xoá luôn
thắng update.

**Lý do:** mỗi bản ghi ở đây chỉ có **một tác giả tự nhiên** — chính nông hộ sở hữu lô đất.
Trường hợp hai thiết bị cùng sửa một lô trong cùng một cửa sổ đồng bộ là hiếm, và khi xảy
ra thì bản sửa sau chính là điều nông dân làm sau cùng, tức là điều họ muốn.

Merge theo từng trường (field-level) tinh vi hơn nhưng khó đoán với người dùng: "tôi đặt
diện tích 1200 mà nó hiện 800 kèm tên mới của tôi". Ngoài ra bảng `change_logs` đã giữ lại
nội dung của bên thua, nên không có gì thực sự mất.

Xoá thắng update vì một bản ghi đã xoá bỗng hiện lại trên máy nông dân gây bối rối hơn là
phải xoá lại lần nữa.

**Đã kiểm chứng bằng test** (`backend/tests/test_sync.py`):
- Hai máy cùng sửa một lô khi offline rồi lần lượt lên mạng → bản mới hơn thắng, bản cũ
  hơn bị báo là `conflict` chứ không âm thầm ghi đè.
- Mất mạng giữa chừng khi push → gửi lại đúng batch đó không tạo bản ghi trùng, không lỗi.
- Xoá ở máy này → máy kia nhận được trong danh sách `deleted` khi pull.

---

## 5. WatermelonDB chạy chế độ bridge, chưa bật JSI

**Quyết định:** `SQLiteAdapter({jsi: false})`.

**Lý do:** JSI nhanh hơn nhưng cần đấu nối native riêng cho từng kiến trúc, mà dự án đang
chạy New Architecture của RN 0.81 — thêm một biến số rủi ro. Mã nguồn WatermelonDB ghi rõ
`WatermelonJSI is optional on Android` và bridge tự fallback. Với quy mô dữ liệu của một
nông hộ (vài chục lô, vài trăm bản ghi chẩn đoán), chênh lệch tốc độ không đáng kể.

Có thể bật lại ở Giai đoạn 6 nếu đo được nút thắt thật.

---

## 6. Ghi nhật ký thay đổi trong cùng một transaction

**Quyết định:** `prepareChangeLogs` luôn được gọi trong cùng `database.write()` với chính
thay đổi đó, qua `database.batch(...)`.

**Lý do:** nếu ghi log ở transaction riêng, một log có thể sống sót sau khi thay đổi đã bị
rollback — tệ hơn là không có log, vì nó nói dối. Gộp vào một batch đảm bảo hai thứ cùng
thành công hoặc cùng thất bại.

---

## 7. Giai đoạn cây suy ra từ ngày trồng khi chưa có chu kỳ canh tác

**Quyết định:** `inferGrowthStage()` ánh xạ số ngày kể từ ngày trồng sang 5 giai đoạn
(0–20 cây con, 21–40 sinh trưởng, 41–60 ra hoa, 61–85 đậu quả, 86+ thu hoạch).

**Lý do:** tab "Lịch chăm sóc" cần biết cây đang ở giai đoạn nào mới gợi ý được công việc,
nhưng chu kỳ canh tác là tính năng của giai đoạn sau. Mốc ngày lấy theo chu kỳ 90–100 ngày
của giống MV1 ghi trong `shared/data/crop_varieties.json`.

**Quan trọng:** đây là **ước tính**, không phải kiến thức nông học chính xác. UI luôn ghi
rõ "Ước tính từ ngày trồng · ngày thứ N", và một bản ghi chu kỳ canh tác thật luôn được ưu
tiên hơn hàm này.

---

## 8. Ô đăng nhập nhận cả tên đăng nhập lẫn email

**Quyết định:** giữ nhãn "Tài khoản" đúng như thiết kế, nhưng backend so khớp với
`username` **hoặc** `email`.

**Lý do:** yêu cầu Giai đoạn 1 ghi form là "email + mật khẩu", trong khi file thiết kế —
nguồn sự thật về giao diện theo Mục 3 — ghi "Tài khoản" và các tài khoản seed là
`quanghoc`/`admin`. Cho phép cả hai thoả mãn đồng thời hai ràng buộc mà không phá thiết kế
hay bắt nông dân nhớ thêm thứ gì.
