# ADR 0003 — Luồng chẩn đoán bệnh qua ảnh (Giai đoạn 2)

- **Ngày:** 07/09/2026
- **Trạng thái:** Đã chốt
- **Phạm vi:** Hàng đợi ảnh offline, hợp đồng của DummyPredictor, ánh xạ mức độ bệnh,
  cách trình bày 4 ca đặc biệt.

---

## 1. `POST /diagnoses` KHÔNG tạo bản ghi trong database

**Quyết định:** endpoint này chỉ làm hai việc — lưu ảnh và chạy mô hình, rồi trả kết quả.
Bản ghi `diagnoses` do **mobile tạo** và đi lên server qua đường đồng bộ bình thường.

**Lý do:** ở Giai đoạn 1 chúng ta đã mất thời gian vì đúng lỗi này với danh mục giống cây:
app ghi bản ghi cục bộ, server cũng ghi một bản với **cùng id**, rồi lần pull kế tiếp
server gửi id đó xuống như bản ghi *mới* và WatermelonDB từ chối cả lô với thông báo
"server wants client to create a record that already exists".

Quy tắc rút ra và áp dụng ở đây: **mỗi bản ghi chỉ có đúng một nơi được quyền tạo.** Với
`diagnoses` thì nơi đó là điện thoại, vì Điều 1 yêu cầu bản ghi phải tồn tại ngay cả khi
không có mạng.

---

## 2. Hàng đợi ảnh — bảng `pending_diagnoses`, chỉ nằm trên máy

**Quyết định:** bảng cục bộ, **không** đồng bộ, không có bảng tương ứng ở server.

**Lý do:** `photo_path` trỏ tới một file trong sandbox của app — vô nghĩa với bất kỳ thiết
bị nào khác. Thứ thật sự cần đồng bộ là bản ghi `diagnoses` mà việc gửi ảnh sinh ra.

Điều này khiến `test_schema_parity` cần biết về ngoại lệ, nên schema mobile export thêm
`LOCAL_ONLY_TABLES` và có hẳn một test kiểm tra hai bên khai báo khớp nhau — để lần sau
thêm bảng cục bộ, người sửa không bị test đẩy vào hướng tạo một bảng server vô dụng.

**Cơ chế:**

| Điểm | Lựa chọn | Lý do |
|---|---|---|
| Nhịp | 5 giây/lần, cộng thêm mỗi khi app trở lại foreground | Người vừa đi vào vùng có sóng không phải chờ hết một chu kỳ |
| Số ảnh mỗi lượt | **Đúng 1** | Gửi cả hàng đợi cùng lúc trên máy vừa bắt lại sóng = 5 request 30 giây chạy song song rồi cùng timeout |
| Khi lỗi | Im lặng | Mất mạng là trạng thái *bình thường* của tính năng này. Con số "đang chờ" trên UI là toàn bộ phần báo cáo |
| Thử lại | Backoff nhân đôi 5s → 10s → 20s… tối đa 5 phút, dừng tự động sau 8 lần | Ảnh hỏng không được thử lại mỗi 5 giây mãi mãi và ăn hết pin |
| Chống trùng | Cờ `running` chặn tái nhập | Timer và nút "thử lại" có thể chạm nhau, gửi 2 lần sẽ tạo 2 chẩn đoán cho cùng một lá |

**Lưu ý về nút "Thử lại":** nó gọi `resetQueueRow`, đặt lại **`attempts` về 0** chứ không
chỉ đổi trạng thái. Nếu chỉ đổi trạng thái, một ảnh đã chạm ngưỡng 8 lần sẽ bị bộ lọc
backoff bỏ qua và nút bấm sẽ không làm gì cả.

**Ảnh xếp hàng thì tự lưu, ảnh online thì phải bấm "Lưu chẩn đoán".** Nghe có vẻ bất đối
xứng nhưng đúng với thực tế: người xếp hàng ảnh rồi bỏ máy trong túi không có mặt ở đó để
bấm nút. Việc họ bấm chụp đã là yêu cầu rõ ràng rồi.

---

## 3. DummyPredictor — tất định theo nội dung ảnh, không ngẫu nhiên

**Quyết định:** thứ tự bệnh và độ tin cậy suy ra từ SHA-256 của chính bytes ảnh.

**Lý do:**

- Ảnh xếp hàng offline sẽ được gửi **muộn hơn, có thể sau vài lần thử lại**. Nếu kết quả
  ngẫu nhiên, cùng một chiếc lá có thể ra hai bệnh khác nhau ở hai lần gửi.
- Demo lặp lại được: cùng một ảnh mẫu luôn ra cùng một đáp án.

**Dải độ tin cậy: top-1 nằm trong 0,45–0,85.** Một mô hình giả luôn trả "99,7%" sẽ dạy
người xem demo tin vào con số đó — đúng ngược với điều một mô hình chưa train xong nên làm.
Có test khoá khoảng này lại (`test_confidences_are_believable_and_ordered`).

---

## 4. Heatmap: null, không bao giờ bịa

**Quyết định:** `DummyPredictor` trả `heatmap: null`. UI **ẩn hẳn** lớp phủ và cả nút
bật/tắt khi không có dữ liệu.

**Lý do:** vẽ vài hình ellipse ngẫu nhiên lên ảnh sẽ chỉ cho nông dân nhìn vào một chỗ bất
kỳ trên lá mà không có căn cứ nào. Thà không có còn hơn có mà sai.

**Hợp đồng dữ liệu** (đã dựng sẵn để model thật cắm vào): danh sách ellipse toạ độ chuẩn
hoá 0..1 — `{cx, cy, rx, ry, weight}` — nên app vẽ đúng vị trí ở bất kỳ kích thước hiển
thị nào mà không cần biết độ phân giải model đã thấy.

---

## 5. Ánh xạ mức độ bệnh

Đề bài liệt kê `powdery_mildew` và `bacterial_speck` — **cả hai đều không có** trong danh
mục 10 bệnh của dự án — và bỏ sót `leaf_mold`, `target_spot`, `bacterial_spot`.

Mọi khoá đề bài có nêu đều được ánh xạ **đúng như yêu cầu**. Ba khoá còn lại tôi chọn theo
chính mô tả trong danh mục:

| Khoá | Mức độ | Nguồn |
|---|---|---|
| `healthy` | Khoẻ | Đề bài |
| `mosaic_virus` | Nhẹ | Đề bài |
| `yellow_leaf_curl_virus` | Trung bình | Đề bài |
| `spider_mites` | Trung bình | Đề bài |
| `late_blight` | Nặng | Đề bài |
| `early_blight` | Nặng | Đề bài |
| `septoria_leaf_spot` | Nặng | Đề bài |
| `bacterial_spot` | Nặng | Đề bài ghi `bacterial_speck`; khoá của ta là `bacterial_spot` |
| `leaf_mold` | Trung bình | **Tự chọn** — xử lý được bằng thông gió, không lan nhanh như mốc sương |
| `target_spot` | Trung bình | **Tự chọn** — chậm hơn đốm vòng, cùng nhóm nấm nhưng ít phá huỷ hơn |

Mức độ này lưu thành trường `severity` trong `shared/data/tomato_diseases.json` — một nguồn
sự thật cho cả mobile lẫn backend, không hard-code hai nơi.

**Quan trọng:** đây là mức độ **điển hình của bệnh**, không phải mức độ đo được trên tấm
ảnh cụ thể. Mô hình cho biết *bệnh gì*, không cho biết *nặng tới đâu*.

---

## 6. Bốn ca đặc biệt — vì sao đặt ở đúng chỗ đó

Tất cả đọc từ `shared/data/tomato_diseases.json` (nhúng trong app, đọc được khi mất mạng).

| Ca | Cách hiển thị | Vì sao |
|---|---|---|
| `mosaic_virus`, `healthy` | **Không có danh sách thuốc**, thay bằng thẻ "Không có thuốc gợi ý" + câu giải thích | Không có gì để bán, và nói thẳng ra mới đúng. Nhồi vài cái tên thuốc vào cho đỡ trống là đẩy nông dân đi mua thứ vô ích |
| `yellow_leaf_curl_virus` | Ghi chú đặt **PHÍA TRÊN** danh sách thuốc | Thuốc liệt kê trị **bọ phấn trắng** — môi giới truyền virus, không trị virus. Đặt dưới thì người ta đã đọc xong ba cái tên và kết luận là thuốc chữa được rồi |
| `spider_mites` | Cảnh báo đỏ **trên cùng màn hình**, trước cả "Cần làm ngay" | Đây là nhện, không phải nấm. Phun thuốc trừ nấm sẽ không có tác dụng — phải dùng acaricide |

---

## 7. Ảnh thu nhỏ về 600×600 ngay lúc chọn

**Quyết định:** `maxWidth`/`maxHeight` = 600, `quality` 0.8, ngay trong `react-native-image-picker`.

**Lý do:** camera điện thoại hiện nay cho file 4–8 MB. Gửi ngần ấy qua một vạch sóng ở nông
thôn là khác biệt giữa "có kết quả" và "timeout". Ở 600×600 chất lượng 0.8, một tấm lá còn
khoảng 60–90 KB. Backend vẫn chặn cứng ở 10 MB như ghi chú trong file thiết kế.

Dùng luôn tuỳ chọn của image-picker thay vì thêm thư viện resize riêng — bớt một native
module là bớt một nguồn lỗi build.
