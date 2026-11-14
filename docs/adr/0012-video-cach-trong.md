# ADR 0012 — Video cách trồng cho từng loại cây, trình phát mượt hơn

- **Ngày:** 2026-10-04
- **Trạng thái:** Đã áp dụng (nhánh `fix/doi-tai-khoan-cung-may`)
- **Liên quan:** [ADR 0008](0008-v2-1-canh-tac-media-nhan-cong.md) §4 (video hướng dẫn), [ADR 0009](0009-du-lieu-lam-dong.md) §5–§6 (ảnh cây trồng, ảnh bìa trước trình phát sau)

## Bối cảnh

Yêu cầu: "mỗi giống cây trồng phải có cả video từng loại luôn, là có video tham khảo cách trồng
của riêng nó, và video phải mượt".

Trước đợt này video chỉ có trong *hướng dẫn chăm sóc* do quản trị viên soạn (bảng `care_guides`) —
hai hướng dẫn demo, đều cho cà chua. 33 loại cây còn lại không có video nào. Ảnh của từng loại cây
thì đã có ([ADR 0009](0009-du-lieu-lam-dong.md) §5); yêu cầu này đặt video cạnh ảnh đó.

## Quyết định

### 1. Video nằm trong danh mục, cạnh ảnh của loại cây

- `shared/data/crop_varieties.json`: mỗi loại cây có `video` (`youtube_id`, tiêu đề, tên kênh, đường
  dẫn kênh, `source_kind`, thời lượng, ngày đăng, ngày kiểm tra). Cách chọn ghi ở `$meta.video_policy`.
- **Mức loại cây** (34 video), không phải từng giống (268). Không có kênh nào quay riêng từng giống;
  nhân video của loại cây lên 268 lần rồi gọi là "video của giống" là nói sai. Các giống trong cùng
  loại cây trồng như nhau nên dùng chung video của loại cây.
- **Loại con trồng khác hẳn thì có video riêng** (`video` trong loại con): ớt cay chỉ địa và chỉ
  thiên (trồng ngoài đồng) khác ớt ngọt (nhà màng); cà phê chè (Arabica) khác cà phê vối. Bộ chọn
  giống bước 3, tab Chăm sóc của lô và màn quy trình lấy video của loại con nếu có.
- Không đi qua `/sync`, không thêm bảng: điện thoại đọc danh mục nhúng sẵn, nên tiêu đề, kênh, thời
  lượng hiện cả khi mất sóng; chỉ phần phát video cần mạng.

### 2. Chọn video thế nào

Thứ tự ưu tiên (ghi trong `video_policy`):

1. Kênh chính thức ở Lâm Đồng: Trung tâm Khuyến nông tỉnh, Báo và Phát thanh, Truyền hình Lâm Đồng
   (cả kênh cũ của Đài PT-TH và Lâm Đồng 365), Báo Lâm Đồng — **15 loại cây**.
2. Kênh của cơ quan nhà nước khác: VTC16, Báo Nông nghiệp và Môi trường, đài truyền hình tỉnh, trung
   tâm/trạm khuyến nông — **14 loại cây** và cà phê chè.
3. Chỉ khi không tìm được video chính thức nào nói về **cách trồng** loài đó mới dùng kênh của nhà
   vườn, cửa hàng: hoa salem, cải thảo, đậu Hà Lan, cần tây, atisô — **5 loại cây** — và ớt cay. Ứng
   dụng ghi rõ "Kênh không chính thức" dưới video.

Trong cùng một mức, video dạy cách làm (làm đất, mật độ, bón, tỉa, sâu bệnh) được ưu tiên hơn bản tin
"làm giàu nhờ…". Nhiều clip của Đài Lâm Đồng chỉ là tin ngắn 1–2 phút hoặc một mục trong bản tin
"365 ngày chuyển động" — những clip đó không được chọn khi có video dạy cách trồng của nơi khác.

### 3. Kiểm chứng từng video (ngày 04/10/2026)

- **Còn xem được, cho phát nhúng:** oEmbed của YouTube trả 200 và trang xem báo `playableInEmbed`.
  Hai ứng viên bị loại vì chủ kênh tắt phát nhúng (oEmbed 401): "Rực rỡ sắc hoa Đồng tiền" (Đài
  Lâm Đồng) và "Hướng dẫn kỹ thuật trồng và chăm sóc cây bơ 034" (một nhà vườn).
- **Đúng chủ đề:** đọc phụ đề tự động của từng ứng viên, không chọn theo tiêu đề. Ví dụ: "Nông dân Đà
  Lạt bén duyên với cây tỏi tím Israel" nói về tỏi, không phải tỏi tây; "Trồng và chăm sóc lan hồ điệp
  từ A đến Z" (VTC16) là cách chơi lan chậu trong nhà, không phải sản xuất — cả hai bị loại.
- **Chép, không đặt lại:** tiêu đề, tên kênh, thời lượng, ngày đăng lấy từ YouTube (chỉ gộp khoảng
  trắng thừa); ngày kiểm tra ghi ở `checked_at`.
- `python shared/data/check_crop_videos.py` hỏi lại YouTube cho cả 37 video, báo video bị gỡ, bị tắt
  phát nhúng, hay đổi tiêu đề / tên kênh. Cần mạng nên không nằm trong bộ test; test backend và mobile
  kiểm tra cấu trúc (mã YouTube hợp lệ, có kênh, có ngày, không hai loại cây dùng chung một video).

### 4. Hiện ở đâu trong ứng dụng

- **Công cụ → Video cách trồng:** danh sách 34 loại cây, mỗi hàng một ảnh bìa nhỏ và thời lượng.
- **Hàng "Video cách trồng"** (ảnh bìa nhỏ, tiêu đề, kênh): bộ chọn giống bước 2 (dưới ảnh và mô tả
  của loại cây) và bước 3 (video của loại con), tab **Chăm sóc** của lô — kể cả khi tỉnh không có
  quy trình cho cây đó (rau muống) — và màn **Quy trình chăm sóc**.
- Bấm vào đâu cũng mở **màn Video cách trồng**: trình phát, tiêu đề, kênh, thời lượng, ngày đăng, nhãn
  nguồn (Lâm Đồng / cơ quan nhà nước / không chính thức), lời dặn *"Video để tham khảo cách làm.
  Liều lượng phân, thuốc và lịch bón theo quy trình của tỉnh trong ứng dụng"*, liên kết tới kênh. Ớt
  và cà phê có thêm danh sách "Video theo loại" để chuyển.

### 5. Trình phát mượt hơn

Danh sách và các màn có hàng video **không chứa trình phát nào** — chỉ ảnh bìa 320×180 (~15 KB, giải
mã đúng cỡ hiển thị), và danh sách chỉ vẽ khoảng một màn hình mỗi lần. Trình phát (cả một ứng dụng
web) chỉ có trên màn video, và chỉ được tạo **sau khi** màn trượt vào xong (`InteractionManager`),
nên lúc chuyển màn không khựng. Một lần chạm là phát.

`YouTubePlayer` (dùng chung với hướng dẫn chăm sóc) chuyển sang YouTube IFrame Player API
(`domain/youtube.ts`) để ứng dụng biết trình phát đang làm gì:

- Ảnh bìa và vòng xoay **giữ trên khung tới khi video thật sự chạy**, rồi mờ dần trên native driver —
  không còn khung đen trong lúc trình phát khởi động. Sẵn sàng mà 2,5 giây chưa chạy (mạng chậm, máy
  chặn tự phát) thì mở ra để bấm nút phát của YouTube.
- Lỗi nói bằng tiếng Việt: video bị gỡ (100); chủ kênh không cho phát nhúng (101/150) → chỉ còn "Mở
  bằng YouTube"; 15 giây không có phản hồi → "Mạng yếu" kèm **Thử lại**.
- **Một video một lúc:** bật video thứ hai thì video thứ nhất dừng và trình phát của nó được gỡ.
- WebView vẽ trên lớp phần cứng, không tự cuộn, không phóng to, không giành cử chỉ cuộn của màn.
- Bấm logo hay tiêu đề YouTube trong khung thì mở ứng dụng YouTube, không tải cả trang YouTube vào
  khung 16:9.
- Mỗi trang trình phát gắn một mã phiên; tin nhắn còn trên đường đi từ trang đã bị thay (đổi video,
  thử lại) bị bỏ qua.
- **Ứng dụng xuống nền thì video tạm dừng tại chỗ** (lệnh `pauseVideo` gửi vào trang): WebView của
  Android không tự dừng, nên trước đây bấm Home hay khoá màn hình thì video vẫn nói trong túi. Mở lại
  thì video đứng đúng khoảnh khắc đó, không phát lại từ đầu.
- Nút toàn màn hình của YouTube mở video kín màn hình và cho xoay ngang; nút Quay lại thoát toàn màn
  hình trước khi rời màn.

**Lỗi tìm ra khi chạy thật, đã sửa:** chuyển giữa hai video của Ớt thì khung đen một lúc thay vì ảnh
bìa. Nguyên nhân: lớp ảnh bìa dùng chung một `Animated.Value` chạy trên native driver; sau lần mờ dần
đầu, `setValue(1)` không đưa được độ mờ về trên kiến trúc mới (Fabric). Nay mỗi lần ảnh bìa phải phủ
lại khung là một giá trị và một view mới (`cover.key`), và việc đổi video được xử lý ngay trong lúc
render nên không khung hình nào của trình phát cũ chen vào.

## Hệ quả

- Không đổi schema điện thoại, không đổi API, không cần đồng bộ lại: dữ liệu nằm trong danh mục nhúng.
- Test: backend thêm 2 (mọi loại cây có video kèm ghi công; video riêng chỉ ở ba loại con trồng khác
  hẳn) — 340 test; mobile thêm 27 (`__tests__/cropVideos.test.tsx`: dữ liệu, trang trình phát, trạng
  thái trình phát, các màn) — 483 test.
- Chạy thật trên emulator Pixel 6a: mở video hoa cúc → ảnh bìa và vòng xoay → phát (0:02/13:23); ớt
  có hai video, chuyển qua lại vẫn giữ ảnh bìa; quay lại thì máy nhả âm thanh (`abandonAudioFocus`);
  hướng dẫn chăm sóc cũ vẫn phát ngay trong trang; bấm Home thì máy báo trình phát dừng
  (`dumpsys audio`), mở lại vẫn đứng đúng chỗ; toàn màn hình xoay ngang được. Cuộn danh sách 34
  video: 2 % khung hình giật (`dumpsys gfxinfo`). Ảnh: `docs/screenshots/126…133`.

## Chưa làm / giới hạn

| Việc | Lý do |
|---|---|
| Video riêng cho từng giống (268) | Không có nguồn nào quay riêng từng giống; dùng video của loại cây, hoặc của loại con khi cách trồng khác hẳn |
| 5 loại cây dùng kênh không chính thức | Không tìm được video chính thức nói về cách trồng salem, cải thảo, đậu Hà Lan, cần tây, atisô; màn hình ghi rõ |
| Một số video quay ngoài Lâm Đồng | Thời vụ trong video (ví dụ "vụ đông" miền Bắc) có thể khác Đà Lạt; lời dặn dưới video nhắc làm theo quy trình của tỉnh |
| Quản trị viên chưa đổi được video trên web | Danh mục là dữ liệu nhúng; đổi video là sửa `crop_varieties.json` rồi phát hành bản mới. Chạy `check_crop_videos.py` định kỳ để biết video nào hỏng |
| Xem khi không có mạng | YouTube không cho tải video về; khung video báo "Cần có mạng", phần chữ vẫn đọc được |
| Đo độ mượt trên máy thật | Mới đo trên emulator (giải mã video bằng phần mềm); máy thật giải mã bằng phần cứng |

## Danh sách video (kiểm tra 04/10/2026)

| Loại cây | Video | Kênh | Nguồn | Dài |
|---|---|---|---|---|
| Hoa cúc | [Hướng dẫn kỹ thuật trồng và chăm sóc cây hoa cúc](https://www.youtube.com/watch?v=nwGvgJdZjmY) | khuyến nông | Nhà nước | 13:23 |
| Hoa hồng | [Trồng hoa hồng theo quy trình hữu cơ I Lâm Đồng TV](https://www.youtube.com/watch?v=q79ifi6rBVk) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 3:21 |
| Hoa cẩm chướng | ["Hái" tiền tỷ nhờ trồng hoa cẩm chướng 4.0 xuất ngoại / VTC16](https://www.youtube.com/watch?v=oa1h34Zp2lk) | KÊNH VTC16 | Nhà nước | 4:07 |
| Hoa đồng tiền | [Trồng hoa đồng tiền ở Tân Văn](https://www.youtube.com/watch?v=y0PPxOxfPYM) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 2:00 |
| Hoa lily | [Trồng hoa ly không nhà kính / Lâm Đồng TV](https://www.youtube.com/watch?v=v6HuU5Rs-3I) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 3:24 |
| Hoa lay ơn | [Chia Sẻ Kinh Nghiệm Trồng Hoa Lay Ơn HTX Hoa Mây Sanh I Trạm Khuyến Nông An Dương](https://www.youtube.com/watch?v=co07iTu1Tck) | Sổ Tay Nông Nghiệp - Hải Phòng | Nhà nước | 6:36 |
| Hoa cát tường | [Thêm lựa chọn mới cho người trồng hoa cát tường](https://www.youtube.com/watch?v=fyUOc3N2IPw) | Báo Lâm Đồng | Lâm Đồng | 4:11 |
| Hoa salem | [Chia Sẻ Kĩ Thuật Trồng Và Chăm Sóc Hoa Salem / Cách gieo trồng và chăm sóc salem](https://www.youtube.com/watch?v=Nl0yx4cwb1E) | Siêu Thị Hạt Giống | Không chính thức | 7:11 |
| Lan hồ điệp | [Kỹ thuật trồng và chăm sóc lan hồ điệp](https://www.youtube.com/watch?v=nBLxGdpd6ZI) | Quảng Ninh TV | Nhà nước | 15:02 |
| Lan vũ nữ | [Kỹ thuật trồng và chăm sóc hoa lan vũ nữ / QTV](https://www.youtube.com/watch?v=h-hfhOsz_Z8) | Quảng Ninh TV | Nhà nước | 15:20 |
| Cà chua | [Nâng cao thu nhập từ cà chua giống mới Boxer](https://www.youtube.com/watch?v=9npHCv9WvGI) | KHUYẾN NÔNG LÂM ĐỒNG | Lâm Đồng | 20:04 |
| Ớt | [Trồng ớt ngọt công nghệ cao I Lâm Đồng TV](https://www.youtube.com/watch?v=B7n_rTvt1CI) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 4:16 |
| Ớt › Ớt cay chỉ địa | [A5. Kỹ thuật trồng ớt, quy trình chuẩn Khuyến Nông](https://www.youtube.com/watch?v=uv_uWBCwQIA) | NPP VTNN Cứu Hộ Nông Nghiệp (Đà Lạt) | Không chính thức | 15:46 |
| Ớt › Ớt cay chỉ thiên | [A5. Kỹ thuật trồng ớt, quy trình chuẩn Khuyến Nông](https://www.youtube.com/watch?v=uv_uWBCwQIA) | NPP VTNN Cứu Hộ Nông Nghiệp (Đà Lạt) | Không chính thức | 15:46 |
| Dưa leo | [Kỹ thuật trồng dưa leo công nghệ cao trong nhà màng](https://www.youtube.com/watch?v=KusSxEN3omc) | Báo Nông nghiệp và Môi trường | Nhà nước | 15:00 |
| Bắp cải | [Kỹ thuật trồng và chăm sóc cây bắp cải vụ thu đông](https://www.youtube.com/watch?v=K1_bv17C1A8) | Truyền hình Hải Phòng (THP3) | Nhà nước | 5:43 |
| Cải thảo | [Làm vườn trồng và chăm sóc cây cải thảo, thời vụ trồng cây cải thảo, trồng rau cải thảo bằng cây con](https://www.youtube.com/watch?v=eMP-r6E5_Hs) | Giải Trí Nhà Nông Channel | Không chính thức | 5:16 |
| Súp lơ | [Trồng cây súp lơ xanh đúng cách](https://www.youtube.com/watch?v=kMrwsXhwqj0) | Báo Nông nghiệp và Môi trường | Nhà nước | 3:43 |
| Xà lách | [Nâng cao hiệu quả canh tác xà lách thủy canh](https://www.youtube.com/watch?v=hBNnVlss-WA) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 5:00 |
| Rau muống | [Trồng rau muống VietGAP lãi 20 triệu đồng mỗi tháng / VTC16](https://www.youtube.com/watch?v=qH06FoOzuP8) | KÊNH VTC16 | Nhà nước | 15:00 |
| Cà rốt | [Trồng cà rốt giống mới / Lâm Đồng TV](https://www.youtube.com/watch?v=cB87v0ZVvP4) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 3:13 |
| Khoai tây | [Chăm sóc cây khoai tây vấn đề cần lưu ý](https://www.youtube.com/watch?v=fjrefDNOvvw) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 2:58 |
| Dâu tây | [Chăm sóc cây dâu tây - Những vấn đề cần lưu ý](https://www.youtube.com/watch?v=3-Ucjhtgh5c) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 3:43 |
| Bó xôi | [Trồng cải bó xôi 1 tháng cho thu hoạch](https://www.youtube.com/watch?v=Q7ooFWVNY4s) | Báo Nông nghiệp và Môi trường | Nhà nước | 2:29 |
| Đậu Hà Lan | [khuyến nông - kỹ thuật trồng và chăm sóc đậu Hà Lan](https://www.youtube.com/watch?v=3Q6I6IztabQ) | DŨN | Không chính thức | 6:02 |
| Củ dền | [Trồng củ dền, thương lái đến tận ruộng thu mua / VTC16](https://www.youtube.com/watch?v=BBNAaFZ7Q18) | KÊNH VTC16 | Nhà nước | 4:50 |
| Tỏi tây | [Trồng tỏi tây trái vụ, nông dân lãi chục triệu mỗi sào / VTC16](https://www.youtube.com/watch?v=b91rQktHINg) | KÊNH VTC16 | Nhà nước | 2:48 |
| Cần tây | [Kỹ Thuật Trồng Cần Tây Và Những Điểm Cần Lưu Ý Khi Trồng Cần Tây / Su Hào TV](https://www.youtube.com/watch?v=na_qytHvC5Q) | Su Hào TV | Không chính thức | 11:05 |
| Su su | [Trồng SuSu baby cho hiệu quả cao / Nông Nghiệp Lâm Đồng TV](https://www.youtube.com/watch?v=lR2tObIXV8Y) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 4:13 |
| Lúa | [Kỹ sư Hồ Quang Cua hướng dẫn trồng lúa an toàn đúng kỹ thuật](https://www.youtube.com/watch?v=v04iyw18Gmo) | Báo Nông nghiệp và Môi trường | Nhà nước | 4:38 |
| Ngô | [KỸ THUẬT TRỒNG VÀ CHẾ BIẾN NGÔ SINH KHỐI](https://www.youtube.com/watch?v=sUOM1M6xxvg) | KHUYẾN NÔNG LÂM ĐỒNG | Lâm Đồng | 8:08 |
| Atisô | [Hướng dẫn kỹ thuật trồng và chăm sóc cây dược liệu Atiso](https://www.youtube.com/watch?v=b7fPw5d14Qw) | Nông nghiệp Lào Cai | Không chính thức | 9:27 |
| Cà phê | [QUY TRÌNH SẢN XUẤT CÀ PHÊ VỖI HỮU CƠ](https://www.youtube.com/watch?v=WrsiwFjqb3U) | KHUYẾN NÔNG LÂM ĐỒNG | Lâm Đồng | 12:19 |
| Cà phê › Cà phê chè (Arabica) | [VIDEO 3: KỸ THUẬT TRỒNG MỚI VÀ TÁI CANH CÀ PHÊ ARABICA](https://www.youtube.com/watch?v=jYALu3TXveI) | Trung tâm Khuyến nông và Chuyển đổi số tỉnh Sơn La | Nhà nước | 8:36 |
| Chè | [Hướng dẫn cách đốn chè đúng kỹ thuật / VTC16](https://www.youtube.com/watch?v=RMndqmYHLZc) | KÊNH VTC16 | Nhà nước | 15:22 |
| Bơ | [Chăm sóc cây bơ như thế nào để đạt năng suất cao ?](https://www.youtube.com/watch?v=FDXqElm2Woc) | Lâm Đồng 365 | Lâm Đồng | 5:27 |
| Hồng ăn trái | [Trồng hồng ăn trái nghịch vụ / Lâm Đồng TV](https://www.youtube.com/watch?v=aSJSKQwcxiA) | Báo và Phát thanh, Truyền hình Lâm Đồng | Lâm Đồng | 3:50 |
