# ADR 0010 — Ghi bằng giọng nói (offline), thông báo, thời tiết và cập nhật giá

- **Ngày:** 2026-10-03
- **Trạng thái:** Đã áp dụng (nhánh `fix/doi-tai-khoan-cung-may`)
- **Liên quan:** [ADR 0002](0002-giai-doan-1.md) (đồng bộ hai chiều), [ADR 0006](0006-giai-doan-4-dashboard-offline-pdf-da-nguoi-dung.md) (dải trạng thái đồng bộ), [ADR 0009](0009-du-lieu-lam-dong.md) (dữ liệu Lâm Đồng, giá phân)

## Bối cảnh

Năm việc được yêu cầu tiếp theo:

1. Nông dân nói vào micro, ứng dụng tự ghi sổ. Ưu tiên chạy được khi không có mạng.
2. Báo cho nông dân biết khi dữ liệu đã đồng bộ.
3. Thông báo đẩy (push notification).
4. Thời tiết.
5. Cập nhật giá phân bón.

Ràng buộc chung vẫn giữ nguyên: dữ liệu phải có nguồn, không bịa, và mọi màn hình vẫn dùng được khi mất sóng (Điều 1).

## Quyết định

### 1. Giọng nói: Vosk chạy trên máy, từ vựng giới hạn theo sổ ruộng

- Thư viện `react-native-vosk@2.1.7`, mô hình `vosk-model-small-vn-0.4` của Alpha Cephei (Apache-2.0, khoảng 32 MB, WER 15,70 trên VIVOS theo trang mô hình của Vosk).
- Mô hình đóng vào APK. `mobile/scripts/fetch-vosk-model.js` tải mô hình lúc `npm install`, nên không chiếm chỗ trong git.
- Âm thanh không rời khỏi máy.
- Bộ nhận dạng chỉ được nghe các từ của việc ghi sổ (`mobile/src/voice/vocabulary.json`). Lý do: khi nghe tự do, mô hình nhỏ hay nhầm, ví dụ "nghìn" thành "nghiện", "hai" thành "hay".
- `domain/voiceEntry.ts` đọc câu nói thành bản nháp: thu / chi / nhập kho / xuất kho, số tiền, số lượng, loại phân, lô, ngày. Nó cũng sửa các lỗi nghe đã đo được ("bốn" đầu câu thành "bón", "lâm" sau số thành "lăm"…).
- Nông dân luôn xem và sửa bản nháp trước khi lưu. Bản ghi đã lưu có nút **Hoàn tác**.
- Đo trên máy tính (`mobile/scripts/asr_check.py`), 16 câu đọc bằng 2 giọng tổng hợp:

  | Cách nghe | Đúng nguyên câu | Đúng loại phiếu | Đúng số tiền | Đúng số lượng | Đúng loại phân |
  |---|---|---|---|---|---|
  | Không giới hạn từ vựng | 0/16 | — | — | — | — |
  | Từ vựng sổ ruộng | 7/16 | 16/16 | 15/16 | 15/16 | 16/16 |

  Giọng tổng hợp sạch hơn giọng người trong nhà màng, nên số này là mức trần, không phải cam kết.

### 2. Thông báo là một bảng đồng bộ, không phải một dịch vụ riêng

- Hai bảng mới, đồng bộ qua `/sync` như mọi bảng khác (schema mobile v8):
  - **`notifications`**: tin của ban quản lý hoặc của máy chủ. `owner_id` để trống nghĩa là gửi cho mọi nông hộ (`_BROADCAST_TABLES` trong `sync_service.py`). Chỉ quản trị viên và máy chủ được ghi.
  - **`notification_reads`**: dấu "đã xem" của từng nông hộ, ghi trên điện thoại.
- Hộp thư vì vậy mở được khi mất sóng. Dấu đã xem cũng đi theo tài khoản sang máy thứ hai.
- Trang quản trị đếm được mỗi tin đã tới bao nhiêu nông hộ (`read_count / audience_size`).
- Tin bị sửa sau khi đã đọc thì hiện là chưa đọc lại, ví dụ bảng giá gộp có thêm dòng. Máy chủ và điện thoại dùng chung quy tắc này.
- Dấu "đã xem" chưa gửi lên được không tính là "thay đổi chưa đồng bộ", và không chặn việc đổi tài khoản trên máy (`BACKGROUND_TABLES`). Mất nó chỉ mất một con số trên chuông, không mất công việc của nông dân.

### 3. Báo khi dữ liệu đã đồng bộ

- Mỗi lần đồng bộ, `domain/syncSummary.ts` đếm hai con số:
  - **gửi đi**: thay đổi của nông dân được máy chủ nhận;
  - **nhận về**: thay đổi do người khác làm.
- Hai loại không được tính: nhật ký thay đổi (mỗi lần sửa đã sinh một dòng) và bản máy chủ gửi lại chính thay đổi nông dân vừa đẩy lên.
- Dải trên cùng nói rõ, ví dụ "Đã gửi 3 thay đổi lên máy chủ — dữ liệu đã an toàn · 14:35".
- Nếu lần đồng bộ chạy lúc ứng dụng ở nền, một thông báo hệ thống im lặng (kênh "Đồng bộ dữ liệu") nói điều tương tự.

### 4. "Push" không cần Firebase: đồng bộ nền 15 phút một lần

- Thông báo hệ thống dùng Notifee (`@notifee/react-native@9.1.8`), với 4 kênh: cảnh báo thời tiết (kêu to), tin ban quản lý, nhắc việc, đồng bộ.
- Đồng bộ nền dùng `react-native-background-fetch@4.4.2` (MIT). Android chạy một lần đồng bộ bình thường khoảng 15 phút một lần, kể cả khi ứng dụng đã bị vuốt tắt (HeadlessJS) hay máy vừa khởi động lại.
- Tin mới kéo về sẽ đổ chuông một lần. Tin lúc đồng bộ lần đầu, tin đã hết hạn và tin cũ hơn 3 ngày thì không đổ chuông.
- Nhắc việc (`tasks_history.remind_at`) được hẹn bằng trigger của Notifee lúc **07:00** ngày đã chọn. Lịch hẹn tự khớp lại khi nhắc việc đổi trên máy này hay máy khác.
- **Bản vá `patches/react-native-background-fetch+4.4.2.patch`:**
  - Khi ứng dụng chỉ đang ở nền (chưa tắt), thư viện gửi sự kiện thẳng vào JS.
  - Với kiến trúc mới, React Native dừng bộ hẹn giờ JS khi Activity tạm dừng. Cả `fetch()` (whatwg-fetch dùng `setTimeout`) lẫn hàng đợi của WatermelonDB đều treo cho tới khi mở lại ứng dụng. Điều này đã thấy trên máy ảo: máy chủ nhận yêu cầu đồng bộ, nhưng chuông chỉ kêu khi mở app.
  - Bản vá chuyển sự kiện ở trạng thái đó sang tác vụ headless, là trạng thái React Native giữ bộ hẹn giờ chạy.
- **Giới hạn so với FCM:** tin tới chậm nhất khoảng một chu kỳ, và Doze có thể kéo dài chu kỳ khi máy nằm yên lâu.
- Muốn tin tới tức thì phải dùng Firebase Cloud Messaging. Việc này cần dự án Firebase của chủ ứng dụng (`google-services.json`, khoá service account cho máy chủ), nên không làm thay được. Khi có:
  1. Thêm `@react-native-firebase/messaging`.
  2. Đăng ký token thiết bị lên máy chủ.
  3. Gửi FCM ngay sau khi tạo `notifications`.

  Mọi phần còn lại (bảng, hộp thư, kênh) giữ nguyên.

### 5. Thời tiết: Open-Meteo qua máy chủ, cảnh báo theo QĐ 18/2021/QĐ-TTg

- **Điểm dự báo:** một điểm cho cả làng, Làng hoa Vạn Thành (11,9473° B; 108,4145° Đ, tra bằng OpenStreetMap Nominatim). Ô lưới của Open-Meteo ở độ cao 1.499 m.
- **Nguồn và điều khoản:** Open-Meteo, không cần khoá. Gói miễn phí dành cho dùng phi thương mại (dưới 10.000 lượt/ngày). Dữ liệu theo CC BY 4.0, nên màn hình nào hiện dữ liệu cũng ghi nguồn "Weather data by Open-Meteo.com".
  - Máy chủ chỉ hỏi 30 phút một lần, tức 48 lượt/ngày, dù có bao nhiêu điện thoại.
  - Điện thoại hỏi máy chủ (`GET /weather`) rồi giữ bản cuối để xem khi mất mạng, kèm giờ cập nhật.
  - Nếu ứng dụng chuyển sang thu phí hoặc quảng cáo thì phải mua gói của Open-Meteo.
- **Ngưỡng cảnh báo:** theo Quyết định 18/2021/QĐ-TTg (22/04/2021), Điều 5:
  - khoản 17: *mưa to* khi tổng lượng mưa trên 50 đến 100 mm trong 24 giờ; *mưa rất to* khi trên 100 mm;
  - khoản 18: *rét hại* khi nhiệt độ trung bình ngày dưới 13 °C.
- **Cách áp dụng ngưỡng:**
  - Lượng mưa cả ngày của dự báo được dùng thay cho "24 giờ".
  - Chỉ xét hôm nay và hai ngày tới.
  - Mỗi cảnh báo có mã cố định theo ngày và mức (`weather-2026-10-05-mua-to`), nên làm mới mỗi 30 phút vẫn chỉ báo một lần. Quản trị viên đã xoá thì không báo lại.
  - Nội dung ghi rõ đây là dự báo, không phải số đo, và dẫn tới bản tin của Trung tâm Dự báo Khí tượng Thủy văn Quốc gia.
- Ngưỡng nắng nóng (trên 35 °C) không đưa vào, vì Đà Lạt ở độ cao này không chạm tới.

### 6. Giá phân: giá quản trị viên phủ lên giá khảo sát

- **Trước đây:**
  - Bảng `fertilizer_prices` không đồng bộ, nên điện thoại chỉ có giá khảo sát trong JSON.
  - `/fertilizer-prices/latest` còn coi giá nhập trước cho ngày sau là giá hiện hành.
- **Bây giờ:**
  - `/latest` chỉ trả giá đã tới ngày hiệu lực. Giá nhập trước vẫn có trong `/history`.
  - Sau mỗi lần đồng bộ, điện thoại tải `/latest` (tối đa mỗi giờ, hoặc ngay khi có tin giá) và lưu lại.
  - Sản phẩm có giá quản trị viên dùng giá đó cho mọi ước tính chi phí: tính lượng phân, mức túi tiền, giá trị tồn kho.
  - Trên bảng giá, giá đó hiện dưới khoảng giá khảo sát kèm ngày cập nhật. Giá khảo sát vẫn hiện với nguồn của nó.
- Mỗi giá mới sinh một tin cho mọi nông hộ, trong cùng giao dịch với dòng giá. Các giá một quản trị viên nhập trong vòng 30 phút được gộp vào **một** tin, có dòng tăng/giảm so với giá trước.

## Hệ quả

- Schema mobile lên **v8** (hai bảng mới). Bước migration chỉ tạo bảng, không đụng dữ liệu cũ.
- APK có thêm:
  - quyền `RECORD_AUDIO` và `POST_NOTIFICATIONS` (Android 13+ hỏi một lần);
  - biểu tượng thanh trạng thái `ic_stat_agrilog` (lá "eco" của Material Icons, Apache-2.0);
  - nhãn ứng dụng "AgriLog".
- **Kiểm thử:**
  - Backend: `test_notifications.py` (phạm vi gửi, quyền ghi, dấu đã xem, sửa thì thành chưa đọc, thu hồi, gộp giá, giá nhập trước) và `test_weather.py` (ngưỡng đúng từng mm và độ, chỉ 3 ngày, báo một lần, hết mạng thì trả bản cũ có cờ `stale`, 503 khi chưa có gì). Cả hai không gọi mạng.
  - Mobile: `notifications.test.ts`, `syncSummary.test.ts`, `weatherAndPrices.test.tsx`, `notifier.test.ts`, `backgroundSync.test.ts`, và bước migration v8 trong `taskHistory.test.ts`.
- **Đã thử trên máy ảo Android 15 (API 35):**
  - hỏi quyền thông báo;
  - quản trị viên gửi tin, điện thoại đổ chuông, chuông có số, chạm vào thì mở đúng tin và đánh dấu đã xem, máy chủ đếm 1/4 nông hộ;
  - nhập giá, có tin "Giá Urê Cà Mau mới cập nhật", chạm vào thì mở bảng giá nhóm đạm có dòng giá ban quản lý;
  - thẻ và màn hình thời tiết với dự báo thật của Vạn Thành;
  - chạy tác vụ nền bằng `adb shell cmd jobscheduler run -f com.thaitaka.agrilogapp 999`.
