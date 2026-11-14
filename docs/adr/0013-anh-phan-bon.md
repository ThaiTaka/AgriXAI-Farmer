# ADR 0013 — Ảnh sản phẩm trên thẻ phân bón

- **Ngày:** 2026-10-04, sửa 2026-10-06
- **Trạng thái:** Đã áp dụng (nhánh `fix/doi-tai-khoan-cung-may`)
- **Liên quan:** [ADR 0009](0009-du-lieu-lam-dong.md) §5 (ảnh cây trồng), [ADR 0012](0012-video-cach-trong.md) (video cách trồng)

## Bối cảnh

Yêu cầu lần 1 (04/10): "cái phần chọn phân theo túi tiền cũng có hình ảnh kèm theo luôn". Thẻ sản
phẩm ở màn **Chọn phân theo túi tiền** (F3) khi đó chỉ có biểu tượng nét của nhóm phân. Danh mục có 17
sản phẩm (`shared/data/fertilizer_recommendations.json`).

Phiên bản đầu dùng 5 ảnh **loại phân** trên Wikimedia Commons (hạt urê, hạt DAP, kali clorua, hạt NPK,
phân trùn quế), sản phẩm cùng loại dùng chung một ảnh. Yêu cầu lần 2 (05/10): "các hình nó cứ bị trùng
lặp tôi muốn hình phải khác nhau và đúng loại phân đó uy tín trên các trang web bạn tham khảo". Ba bao
urê cùng một ảnh lọ urê, năm loại NPK cùng một ảnh hạt NPK — bà con không phân biệt được sản phẩm nào là
sản phẩm nào.

## Quyết định

### 1. Mỗi sản phẩm một ảnh của chính nó, từ trang chính thức của đúng hãng

Ảnh lấy từ trang sản phẩm trên website chính thức của doanh nghiệp có tên trong sản phẩm:

| Sản phẩm | Ảnh | Trang |
|---|---|---|
| Urê Cà Mau | Bao Đạm Cà Mau (urê hạt đục) 50 kg | [pvcfc.com.vn](https://www.pvcfc.com.vn/ure-hat-duc) |
| Urê Phú Mỹ | Bao Đạm Phú Mỹ 50 kg | [dpm.vn](https://www.dpm.vn/san-pham/dam-phu-my-28) |
| Urê Hà Bắc | Bao Urê Hà Bắc 50 kg (cắt lấy mặt trước) | [damhabac.com.vn](https://damhabac.com.vn/san-pham/ure-ha-bac/) |
| Siêu lân Lâm Thao | Bao Supe lân *M1 Lâm Thao (supe lân đơn) | [supelamthao.vn](https://supelamthao.vn/san-pham/phan-bon-supe-lanm1-lam-thao/) |
| Lân nung chảy Văn Điển | Bao lân nung chảy Văn Điển dạng viên 15%, 50 kg | [vandienfmp.vn](https://vandienfmp.vn/product/phan-lan-nung-chay-dang-hat-vo-bao-moi-15/) |
| Kali bột (MOP) Cà Mau | Bao Kali Cà Mau 61 MOP (bột đỏ) 50 kg | [pvcfc.com.vn](https://www.pvcfc.com.vn/kali-ca-mau-61-br-bot-do-) |
| Kali bột (MOP) Phú Mỹ | Bao Kali Phú Mỹ MOP loại bột | [dpm.vn](https://www.dpm.vn/san-pham/kali-phu-my-79) |
| NPK 16-16-8 Cà Mau | Bao NPK Cà Mau 16-16-8+TE | [pvcfc.com.vn](https://www.pvcfc.com.vn/npk-16-16-8-te) |
| NPK 16-16-8 Phú Mỹ | Bao NPK Phú Mỹ 16-16-8+13S+TE 50 kg | [dpm.vn](https://www.dpm.vn/san-pham/npk-phu-my-16-16-813ste-43) |
| NPK 16-16-8 Đầu Trâu | Bao Đầu Trâu NPK 16-16-8, 50 kg | [binhdien.com](https://binhdien.com/sanpham/npk-dau-trau/npk-dau-trau-16-16-8.html) |
| NPK 18-8-18 Cà Mau | Bao NPK Cà Mau Gold 18-8-18 (mẫu ở trang có bao 50 kg) | [pvcfc.com.vn](https://www.pvcfc.com.vn/npk-ca-mau-gold-18-8-18-1) |
| NPK 20-20-15 TE Bình Điền | Bao Đầu Trâu NPK 20-20-15+TE, 50 kg | [binhdien.com](https://binhdien.com/sanpham/npk-dau-trau/npk-dau-trau-20-20-15-te.html) |
| Phân trùn quế Pb01 gói 2 kg | Ảnh chụp thực tế phân Pb01 | [sfarm.vn](https://sfarm.vn/phan-trun-que-cao-cap-sfarm-pb01/) |
| Phân trùn quế Pb01 gói 5 kg | Ảnh chụp thực tế phân Pb01 (ảnh khác) | [sfarm.vn](https://sfarm.vn/phan-trun-que-cao-cap-sfarm-pb01/) |
| Phân gà hữu cơ đã qua xử lý | Ảnh chụp thực tế viên phân gà AKIFARM | [sfarm.vn](https://sfarm.vn/phan-ga-huu-co-nhat-ban-sfarm/) |

Cách chọn, khi một hãng có nhiều sản phẩm gần nhau:

- Lấy đúng **dạng** trong dữ liệu: kali **bột** (không lấy kali miểng), lân nung chảy **15 %** (khớp
  ~0-15-0).
- Lấy đúng **quy cách**: NPK Cà Mau Gold 18-8-18 có hai mẫu bao; mẫu hồng nằm ở trang có bao 50 kg, mẫu
  vàng – cam là bao 25 kg.
- Supe lân Lâm Thao có hai loại supe lân đơn: *M1 (thường) và P18 (bổ sung vi sinh). Bảng giá chỉ ghi
  "Lân Lâm Thao" nên lấy loại thường, và ghi chú điều này trên ảnh.
- Pb01 và phân gà là hàng của **SFARM** (sfarm.vn vừa là nguồn giá vừa là nhà sản xuất/phân phối). Dòng
  "Phân gà 1kg — 22.000–25.000đ" trong bảng giá SFARM dẫn tới phân gà Nhật AKIFARM. Trang của SFARM chỉ có
  ảnh bao Pb01 10/25/40 kg (in khối lượng trên bao) và mặt sau gói phân gà 1 kg, nên không dùng — bao in
  "40Kg" trên thẻ gói 2 kg là sai. Thay vào đó là ảnh chụp thực tế của chính sản phẩm, có ghi chú "trang
  chưa có ảnh gói 2 kg". Hai gói Pb01 dùng hai ảnh khác nhau. Không dùng ảnh có người (ảnh khách hàng).

### 2. Không đoán: hai loại DAP nhập khẩu giữ biểu tượng

Bảng giá (giacaphe.com qua vietnambiz.vn) chỉ ghi "DAP Hàn Quốc", "DAP Nga" — tên theo **nước xuất xứ**,
không ghi nhà sản xuất. Trang của Đạm Cà Mau và Đạm Phú Mỹ chỉ có DAP mang nhãn của chính họ, ghi "nhập
khẩu từ Úc, Nga, Trung Quốc" chung cho mọi loại. Lấy bao DAP của một hãng bất kỳ là đoán, nên hai sản
phẩm này nằm trong `$meta.image_gaps` kèm lý do và giữ biểu tượng nhóm.

### 3. Ghi nguồn đầy đủ, kiểm tra lại được

Mỗi `image` ghi: tệp (đặt theo mã sản phẩm), ảnh cho thấy gì, doanh nghiệp sở hữu ảnh, trang sản phẩm,
đường dẫn tệp ảnh gốc, ngày kiểm tra; thêm `changes` khi ảnh bị cắt và `note` khi ảnh không phải đúng
gói đang bán. `python shared/data/check_fertilizer_images.py` hỏi lại cả trang lẫn tệp ảnh gốc — ngày
06/10/2026: 15/15 còn nguyên.

### 4. Hiện ở đâu

- **Chọn phân theo túi tiền** và **Bảng giá phân bón**: ảnh đứng đầu thẻ (72 dp và 64 dp), hiện **trọn
  bao** (không cắt), vì tên hãng và công thức in trên bao mới là thứ phân biệt sản phẩm.
- Bấm vào ảnh: tấm ảnh lớn (khung vuông để bao đứng đọc được chữ), ảnh cho thấy gì, ghi chú nếu có,
  "Ảnh: <doanh nghiệp> · <trang web>" và nút "Xem trang sản phẩm". Cuối hai màn có một dòng nói ảnh lấy
  từ đâu.
- Cạnh ảnh chỉ còn nhóm phân và tên; dòng nguồn giá và giá bao trải hết bề ngang, không giới hạn số
  dòng, nhãn "Bao 50 kg" chuyển xuống cạnh giá mỗi ký. Lý do: giá bao đứng cạnh nhãn "Bao 50 kg" vốn đã
  bị cắt ở mọi thẻ bao 50 kg ("610.000 – 660.0…" — mất đúng giá trần), và cột chữ hẹp đi vì ảnh to sẽ
  cắt mất tên nguồn.
- Ô ảnh nhỏ giải mã đúng cỡ hiển thị (`resizeMethod="resize"`); ảnh nhúng thu về tối đa 900 px.

### 5. Bản quyền

Ảnh bao và ảnh sản phẩm thuộc bản quyền của các doanh nghiệp trên — khác với ảnh cây trồng (Wikimedia
Commons, giấy phép tự do, [ADR 0009](0009-du-lieu-lam-dong.md) §5). Ứng dụng dùng chúng để **nhận diện
sản phẩm** trong đồ án phi thương mại, luôn kèm tên doanh nghiệp và liên kết về trang gốc. Trước khi phát
hành thương mại phải xin phép các doanh nghiệp, hoặc tự chụp bao ở đại lý.

## Hệ quả

- Dữ liệu: 15/17 sản phẩm có `image`; `$meta.image_policy` và `$meta.image_gaps` (2 loại DAP) ghi quy
  tắc. Giá và mọi trường khác giữ nguyên. Backend và web-admin bỏ qua trường mới (chỉ đọc giá).
- Bỏ 5 ảnh Commons dùng chung của phiên bản đầu.
- Test: backend kiểm mỗi ảnh có chủ sở hữu, tệp có thật, đặt theo mã sản phẩm, **không trùng nội dung
  với ảnh sản phẩm khác** (so SHA-256), lấy từ trang của đúng hãng trong tên sản phẩm; mobile thêm 11 bài
  (`__tests__/fertilizerPhotos.test.tsx`), gồm một bài giữ cho giá bao và nguồn giá không bị cắt.
- Ảnh chụp màn hình: `docs/screenshots/134`–`137`.

## Bổ sung 07/10/2026 — nhóm vi sinh

Ba sản phẩm vi sinh có giá ([ADR 0014](0014-giong-noi-zipformer-va-gia-vi-sinh.md) §5) theo cùng quy tắc:

| Sản phẩm | Ảnh | Trang |
|---|---|---|
| Phân vi sinh vật Tricho Điền Trang | Gói Điền Trang – Tricho 1 kg (PM027) | [phanbondientrang.vn](https://www.phanbondientrang.vn/san-pham/pm027-phan-vi-sinh-vat-dien-trang-tricho-1000g-411.html) |
| Trichoderma Plus Humic SFARM | Gói Trichoderma Plus Humic 1 kg | [sfarm.vn](https://sfarm.vn/nam-doi-khang-trichoderma-plus-sfarm/) |
| Phân hữu cơ vi sinh Sông Gianh HC-15, bao 10 kg | — giữ biểu tượng | Trang của Sông Gianh chỉ có ảnh bao in "50 kg" — khai báo trong `image_gaps` |

Ảnh PNG nền trong được đặt lên nền trắng, thu về tối đa 900 px. Thẻ ở bảng giá được sửa cho thành
phần dài ("hữu cơ 15% + vi sinh") đẩy nhãn quy cách xuống dòng thay vì ra ngoài thẻ, và dòng nguồn
không còn bị cắt mất ngày cập nhật.

## Chưa làm / giới hạn

| Việc | Lý do |
|---|---|
| Ảnh DAP Hàn Quốc, DAP Nga | Bảng giá không ghi hãng; cần biết đại lý bán bao của hãng nào (hoặc tự chụp) |
| Ảnh đúng gói Pb01 2 kg, 5 kg và gói phân gà 1 kg (mặt trước) | SFARM chưa đăng; đang dùng ảnh chụp thực tế của chính sản phẩm |
| Xin phép dùng ảnh | Chỉ cần khi phát hành thương mại (§5) |
| Ảnh ở màn tính lượng phân, kiểm tra kho | Yêu cầu chỉ nói màn chọn phân theo túi tiền; bảng giá dùng chung thẻ nên có luôn |
