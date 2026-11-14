# ADR 0014 — Giọng nói nghe đúng cả câu (Zipformer trên máy) và giá phân vi sinh

- **Ngày:** 2026-10-07
- **Trạng thái:** Đã áp dụng
- **Liên quan:** [ADR 0010](0010-giong-noi-thong-bao-thoi-tiet.md) §1 (phần giọng nói được thay bằng ADR này),
  [ADR 0013](0013-anh-phan-bon.md) (ảnh phân bón), [ADR 0009](0009-du-lieu-lam-dong.md) (giá phân)

## Bối cảnh

Ba phản hồi của chủ dự án ngày 07/10/2026, thử trên máy ảo:

1. "Nói để ghi" chỉ ghi đúng khoảng 20 % điều đã nói.
2. Ô **Câu đã nghe (sửa được)** không gõ được chữ có dấu, "toàn bị mất chữ".
3. Cập nhật giá phân **vi sinh** theo giá chuẩn nhất, không dùng dữ liệu ảo.

## 1. Vì sao chỉ đúng khoảng 20 %

Hai nguyên nhân, cả hai đo được:

- **Mô hình nhỏ nghe giọng người thật rất kém.** `vosk-model-small-vn-0.4` nghe tự do sai **66,9 %** số từ
  trên 129 câu giọng người thật (FLEURS `vi_vn`, tập dev). Danh sách từ vựng giới hạn (ADR 0010) cứu được
  giọng tổng hợp sạch nhưng sụp khi có tiếng ồn: sai 59,5 % số từ, 0/240 câu đúng nguyên văn.
- **Ngắt hơi là mất nửa câu.** `speech.ts` cũ trả kết quả ngay lần đầu Vosk báo hết một đoạn (sau khoảng
  nửa giây im lặng). Câu "thuê ba người làm cỏ … sáu trăm nghìn" với một khoảng ngắt 0,7 s: app cũ dừng
  nghe ở giây 2,7 và chỉ giữ "thuê ba người làm cỏ" — **mất đúng số tiền**. Có tiếng ồn chợ thì Vosk nghe
  thành "phê người làm cỏ hôm sáu trăm nghìn".

## 2. Quyết định: Zipformer tiếng Việt chạy trên máy, nghe tới khi im khoảng một giây

### Đo trước khi chọn

`mobile/scripts/asr_compare.py`, cùng dữ liệu cho mọi mô hình:

- 24 câu sổ ruộng × 10 giọng (edge-tts HoaiMy, NamMinh; Piper vais1000, 25hours, 6 giọng VIVOS);
- cùng các câu đó trộn tiếng chợ (3 câu nói khác) ở 10 dB, thêm vang;
- 129 câu giọng người thật của FLEURS.

WER là tỉ lệ từ sai, càng thấp càng tốt.

| Mô hình | Câu sổ ruộng, sạch | Có tiếng chợ | Giọng người thật (FLEURS) | Cỡ | Giấy phép |
|---|---|---|---|---|---|
| Vosk small + từ vựng giới hạn (app cũ) | 32,9 % | 59,5 % | — | 32 MB | Apache-2.0 |
| Vosk small nghe tự do | 51,3 % | 83,8 % | 66,9 % | 32 MB | Apache-2.0 |
| Zipformer 30M (hynt, 6.000 giờ) | 25,8 % | 28,8 % | **5,4 %** | 33 MB | CC BY-NC-ND 4.0 |
| **Zipformer 2025-04-20 (zzasdf, ~70.000 giờ)** | 23,9 % | 30,3 % | **5,9 %** | 75 MB | **Apache-2.0** |

Hai giọng Piper chất lượng thấp (25hours, VIVOS x_low) khó nghe với mọi mô hình và kéo số câu sổ ruộng
lên. Chỉ tính các giọng đọc tự nhiên (edge-tts, Piper vais1000), Zipformer 70k sai 2–9 % số từ, Vosk cũ
sai 18–37 %.

### Chọn gì, và vì sao

- **Mô hình:** `sherpa-onnx-zipformer-vi-int8-2025-04-20`. Chính xác ngang bản 30M, nhưng giấy phép
  Apache-2.0. Bản 30M "không phái sinh, phi thương mại", và bản int8 đã là một bản chuyển đổi. Cái giá
  là 75 MB thay vì 33 MB.
- **Thư viện:** sherpa-onnx 1.13.8 cho Android, gói `.aar` chính thức (onnxruntime liên kết tĩnh,
  Apache-2.0). Mô-đun native viết trong app: `OfflineSpeechModule.kt`, không qua thư viện React Native
  trung gian.
- **Phát hiện tiếng nói:** Silero VAD (MIT). Ngưỡng 0,5; tiếng nói phải kéo dài ít nhất 0,25 s.
- **Giải mã:** greedy.
  - Đã thử *hotwords* (ưu tiên 33 từ của nghề như URÊ, SUPE LÂN, CẨM CHƯỚNG, TRÙN QUẾ) với
    modified beam search. WER câu sổ ruộng chỉ từ 4,2 % xuống 3,9 %, mà lại sinh lỗi mới: "phân trùn quế"
    thành "phân chuồng quế", "nghìn" thành "nghìn đồng".
  - Không dùng hotwords; vài lỗi nghe chắc chắn sai được sửa ở bộ đọc câu (§3).
- **Một câu là một lần nghe:**
  - Micro mở cho tới khi bà con đã nói và **im liền 1 giây**, hoặc bấm dừng.
  - Không nói gì trong 10 giây thì thôi. Câu dài nhất 20 giây.
  - Toàn bộ đoạn ghi được giải mã **một lần ở cuối**, nên một lần ngắt hơi không cắt mất phần sau.
  - Trong lúc nói, chữ nghe được tới đâu hiện tới đó: cứ 0,7 s giải mã lại phần đã nói.
- **Chữ hoa:** mô hình viết hoa, không dấu câu. `tidyTranscript` đổi sang chữ thường trước khi hiện và
  đọc.
- **Nạp sẵn:** mô hình nạp từ lúc mở màn Nói để ghi, để lần bấm micro đầu không phải chờ.
- **Thử trên máy ảo không cần micro:** chỉ bản debug.
  - Đẩy một tệp WAV 16 kHz mono vào `/sdcard/Android/data/com.thaitaka.agrilogapp/files/asr-input.wav`.
  - Lần bấm micro kế tiếp nghe tệp đó thay cho micro, theo đúng thời gian thật, rồi xoá tệp.
  - Logcat ghi `AgriLogSpeech: decoded … ms of speech in … ms`.

### Kết quả trên máy ảo (Android 15, x86_64)

| Câu (giọng tổng hợp, đẩy vào bằng tệp WAV) | App nghe ra | Phiếu |
|---|---|---|
| "Thuê ba người làm cỏ … (ngắt 0,7 s) … sáu trăm nghìn", **có tiếng chợ** | thuê ba người làm cỏ sáu trăm nghìn | Khoản chi, "Thuê 3 người làm cỏ" |
| "Hôm nay bán ba tạ cà chua giá mười hai nghìn một ký" | đúng từng chữ | Khoản thu 3.600.000 (12.000₫/ký × 300 ký) |
| "Mua hai bao urê Cà Mau một triệu ba trăm sáu mươi nghìn" | mua hai bao u rê cà mau một triệu ba trăm sáu mươi nghìn | Nhập kho, Urê Cà Mau |

- **Tốc độ:** khoảng 4 giây lời nói giải mã trong khoảng 100 ms trên máy ảo. Điện thoại tầm trung chậm hơn
  vài lần nhưng vẫn dưới một giây.
- **Bấm dừng, rời màn, nói lại:**
  - Bấm dừng giữa câu thì lấy phần đã nói.
  - Rời màn khi đang nghe thì huỷ câu và giải phóng micro.
  - Vào lại vẫn nói tiếp được.

Ảnh chụp: `docs/screenshots/138`, `139`, `142`.

## 3. Bộ đọc câu: giá theo đơn vị, và lỗi nghe của mô hình mới

- **Lỗi có từ trước, không phải lỗi nghe:**
  - "giá mười hai nghìn một ký" bị đọc thành 12.100₫, vì chữ "một" của "một ký" bị nuốt vào con số.
    Giá theo ký cũng chưa được nhân với số ký của "ba tạ".
  - **Cách sửa:** sau "nghìn/triệu" và trước một đơn vị, "một" thuộc về đơn vị. Giá theo đơn vị cân được
    quy đổi theo số lượng: 3 tạ × 12.000₫/ký = 300 × 12.000 = 3.600.000₫.
  - Bản nháp có thêm `unitPriceUnit` và `unitCount`. Gợi ý dưới ô tiền ghi "12.000₫/ký × 300 ký". Cụm
    "một ký" / "mỗi bao" không lặp lại trong nội dung.
- **Lỗi nghe đã đo của Zipformer, chỉ sửa ở chỗ chữ nghe được không thể đúng:**
  - "xốp lân", "xúp lân" thành supe lân;
  - "cẩm trướng", "cẩm trứng" thành cẩm chướng;
  - "trùm quế", "trùng quế" thành trùn quế;
  - "ue" thành urê;
  - "một triệu hay" ở cuối câu thành một triệu hai;
  - "bà bao" thành ba bao; "ba tạng" thành ba tạ; "mỗi canh" thành mỗi cành.
- **Đo ở mức phiếu ghi** (72 câu giọng đọc tự nhiên; so phiếu đọc từ câu máy nghe với phiếu đọc từ câu
  đã nói):

  | | Đúng số tiền | Đúng cả phiếu (loại, tiền, số lượng, loại phân) |
  |---|---|---|
  | Vosk cũ — sạch / có tiếng chợ | 50/72 / 24/72 | 39/72 / **11/72** |
  | Zipformer — sạch / có tiếng chợ | 72/72 / 72/72 | 66/72 / **59/72** |

  Chữ thật của mô hình nằm trong `mobile/__tests__/fixtures/zipformer_ledger.json`, và
  `voiceEntry.test.ts` giữ các con số này. Phần còn sai là những từ nghe nhầm thật, như "kali" thành
  "cay", "phân gà" mất chữ "phân". Bà con vẫn xem và sửa bản nháp trước khi lưu.

## 4. Ô sửa câu: lỗi nằm ở máy ảo, không phải ở app

- **Bàn phím ảo tiếng Việt gõ đúng.** Thêm Gboard Tiếng Việt vào máy ảo, rồi gõ Telex bằng bàn phím ảo
  vào chính ô đó. "thuee nguowif" ra đúng **"thuê người"**. Ô nhập của app xử lý bộ gõ tiếng Việt bình
  thường.
- **Trên máy ảo, chữ đi từ bàn phím PC.** Máy ảo đặt `hw.keyboard=yes`. Khi bấm vào ô, Gboard chỉ hiện
  thanh nhỏ "US" của chế độ bàn phím vật lý, và Gboard lúc đó chỉ có tiếng Anh.
- **Unikey/EVKey gửi ký tự có dấu dạng Unicode; máy ảo bỏ mất những ký tự đó.** Gboard cũng không chạy
  Telex cho phím vật lý: gõ "thuees" ra nguyên "thuees".
- **Câu "thue 3 nguoi 600 nghìn" trong ảnh chụp:** gõ "thue 3 nguoi 600k" không dấu, bấm "Đọc lại câu đã
  sửa", và "600k" được viết thành "600 nghìn".
- **Không sửa app.** Cách gõ có dấu trên máy ảo:
  - bấm thanh "US" → chọn Tiếng Việt → **Hiện bàn phím ảo** (Alt+K), rồi gõ Telex trên bàn phím ảo;
  - hoặc chép câu có dấu trên Windows rồi dán vào máy ảo (máy ảo dùng chung bảng nhớ tạm);
  - hoặc thử trên điện thoại thật.

## 5. Giá phân vi sinh: giá niêm yết của sản phẩm có tên, ghi nguồn và ngày

### Không có nguồn nhà nước

- Bản tin giá của Sở Công Thương Đắk Lắk chỉ có nông sản, không có phân bón.
- Không tìm được bản tin giá phân của Lâm Đồng.
- Trang của Sông Gianh, Điền Trang, SFARM ghi giá là **"Liên hệ"**.

### Ba sản phẩm, đều có giá niêm yết xem được ngày 07/10/2026

| Sản phẩm | Quy cách | Giá | Nguồn |
|---|---|---|---|
| Phân vi sinh vật Tricho Điền Trang (PM027: *Trichoderma* spp. và *Bacillus subtilis* 10⁸ cfu/g) | gói 1 kg | 86.400 – 92.000₫ | cửa hàng trực tuyến của chính hãng dientrangmart.vn (86.400₫); chuỗi Nông Nghiệp Phố — TP.HCM, Đà Nẵng, Hà Nội (92.000₫) |
| Trichoderma Plus Humic SFARM | gói 1 kg | 95.000₫ | Nông Nghiệp Phố, cả ba cửa hàng (SFARM không niêm yết) |
| Phân hữu cơ vi sinh Sông Gianh HC-15 (hữu cơ 15 %; *Bacillus*, *Azotobacter*, *Aspergillus* 10⁶ CFU/g) | bao 10 kg | 54.000 – 60.000₫ | trongraudothi.com, Hà Nội (54.000₫); vatlieulamvuon.com, Đà Nẵng (60.000₫) |

- **Giá của Nông Nghiệp Phố** đọc từ dữ liệu sản phẩm máy-đọc-được của cửa hàng (`/products/<mã>.json`),
  cập nhật 06–07/10/2026, có giá riêng từng cửa hàng.
- **Không tìm được giá niêm yết riêng ở Lâm Đồng.** Đại lý ở Đà Lạt có thể cộng thêm phí chở. Điều này ghi
  trong `recheck_note`.

### Đã xem nhưng không đưa vào

| Nguồn | Lý do |
|---|---|
| Phân bò SFARM (bảng giá SFARM) | Bao in "PHÂN BÓN HỮU CƠ SFARM HC01": phân hữu cơ, không phải phân vi sinh. |
| Đầu Trâu HCMK7 hữu cơ Trichoderma (giá ở Nông Nghiệp Phố) | Không thấy trên trang chính thức binhdien.com, nên không kiểm được thành phần và ảnh. |
| Sông Gianh bao 50 kg | Không có giá niêm yết đáng tin. |
| Bài "Giá phân hữu cơ vi sinh 2026" của SFARM | Chỉ có khoảng giá chung theo phân khúc, không có sản phẩm cụ thể. |
| Bảng giá vi sinh của Nông Nghiệp Phố | Bài đăng ngày 06/08/2025, đã quá cũ. |

### Hiện trong app thế nào

- **Mức túi tiền:** ngưỡng 12.300 / 14.500₫/kg giữ nguyên. Tricho rơi vào **Cao cấp** (89–95 nghìn/kg),
  Sông Gianh rơi vào **Bình dân** (5.700₫/kg).
- **Máy tính lượng phân:** các dòng "Chế phẩm Trichoderma", "Phân hữu cơ vi sinh" trong quy trình vẫn
  ghi "chưa có giá", vì chúng không trỏ tới sản phẩm nào. Lý do:
  - quy trình không nêu hãng;
  - giá bao 10 kg bán lẻ cao hơn hẳn giá mua theo tấn mà quy trình tính.
- **Ảnh** lấy theo quy tắc của [ADR 0013](0013-anh-phan-bon.md):
  - gói Tricho 1 kg từ phanbondientrang.vn;
  - gói Trichoderma Plus Humic 1 kg từ sfarm.vn;
  - Sông Gianh HC-15 **bao 10 kg giữ biểu tượng**, vì trang của hãng chỉ có ảnh bao in "50 kg"
    (ghi trong `image_gaps`).

### Cùng ngày phát hiện: bảng giá SFARM là giá ngày 02/04/2026

- Bài "Giá phân bón hôm nay ngày …" trên sfarm.vn **luôn mang ngày hôm nay** trên tiêu đề. Cột giá mới
  nhất của bảng lại ghi **"Ngày 02/04"**.
- Vì vậy, các giá lấy từ sfarm.vn là giá ngày 02/04/2026, chưa phải giá tháng 10.
  `$meta.sources` và `recheck_note` đã ghi lại điều này.
- giacaphe.com (qua vietnambiz.vn) thì cập nhật hằng ngày: lúc 08:34 ngày 07/10/2026.
- Giá các sản phẩm khác **chưa đổi** trong ADR này.

## Hệ quả

- **Phụ thuộc:**
  - bỏ `react-native-vosk` (cùng bản giả lập jest và `scripts/fetch-vosk-model.js`);
  - `scripts/fetch-speech-model.js` (chạy lúc `npm install`) tải mô hình vào
    `android/app/src/main/assets/asr-vi` và `.aar` vào `android/app/libs`;
  - tệp nào cũng **kiểm SHA-256 ghim sẵn**; không có `.aar` thì Gradle dừng và nói chạy script.
- **Từ vựng Vosk cũ** chuyển sang `scripts/vosk_vocabulary.json`, chỉ để tái lập phép so sánh.
- **Kích thước:**
  - mô hình 75 MB, lưu không nén trong APK (`noCompress 'onnx'`) để nạp nhanh;
  - thư viện native mỗi kiến trúc 16–32 MB (arm64-v8a 24 MB);
  - APK debug chỉ x86_64 là 161,6 MB;
  - bản phát hành nên tách APK theo kiến trúc, hoặc dùng AAB.
- **Kiểm thử:**
  - mobile 508 test / 36 bộ: `speech.test.ts` viết lại; `voiceEntry.test.ts` thêm giá theo đơn vị và câu
    Zipformer thật; `fertilizerPhotos.test.tsx` thêm nhóm vi sinh;
  - backend 342 test, gồm kiểm nguồn và giá nhóm vi sinh;
  - `tsc`, `eslint` sạch.
- **Tài liệu tái lập:**
  - `scripts/asr_check.py`: thử nhanh đúng mô hình app đóng gói;
  - `scripts/asr_compare.py`: cả phép so sánh và tệp fixture.

## Chưa làm / giới hạn

| Việc | Lý do |
|---|---|
| Đo với giọng nông dân thật trong nhà màng | Chưa có bản ghi; số đo dùng giọng tổng hợp và FLEURS. Thêm WAV 16 kHz vào `SAMPLES` của `asr_check.py` khi có. |
| iOS | Mô-đun native chỉ viết cho Android. Trên iOS nút micro báo thiếu mô hình. |
| Chợ đông người nói xung quanh | Tiếng người bên cạnh có thể giữ micro mở. Khi đó bấm nút dừng; câu dài nhất 20 giây. |
| Mô hình nhỏ hơn | Bản 30M (33 MB) chính xác tương đương nhưng giấy phép NC-ND; chỉ đổi khi chấp nhận điều đó. |
| Giá vi lượng (Zn, B, Mg) | Chưa có giá niêm yết đã kiểm; nhóm vẫn ghi rõ là chưa có. |
| Đối chiếu lại giá các nhóm khác sau phát hiện sfarm.vn | Ngoài yêu cầu lần này; nên làm ở lần cập nhật giá tới. |
