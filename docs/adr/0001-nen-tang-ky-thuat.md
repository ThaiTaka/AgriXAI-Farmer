# ADR 0001 — Nền tảng kỹ thuật (Giai đoạn 0)

- **Ngày:** 07/09/2026
- **Trạng thái:** Đã chốt
- **Phạm vi:** Các lựa chọn phiên bản/công nghệ khoá cứng vào scaffold, sửa sau rất tốn công.

---

## 1. React Native 0.81.6 (không phải 0.87 mới nhất)

**Quyết định:** dùng React Native **0.81.6** cho `mobile/`.

**Lý do:**

- NDK cài sẵn trên máy là `27.1.12297006` — đúng NDK mà RN 0.76–0.81 yêu cầu. RN 0.83+
  cần NDK 28, tức phải tải thêm ~2 GB và có rủi ro lệch CMake.
- WatermelonDB 0.28.0 (bản ổn định mới nhất) biên dịch JSI/C++ trực tiếp trên API của
  RN. Càng nhảy xa khỏi các bản RN đã được WatermelonDB kiểm chứng, rủi ro vỡ build càng cao.
- 0.81 là bản cuối cùng còn **hỗ trợ cả hai kiến trúc** (cũ và New Architecture). Nếu
  WatermelonDB gặp vấn đề với New Architecture ở Giai đoạn 1, có thể lùi về kiến trúc cũ
  bằng một dòng `newArchEnabled=false` — với RN 0.82+ thì không còn đường lùi đó.

**Đã kiểm chứng:** build `assembleDebug` thành công với `newArchEnabled=true`
(`fabric: true` trong log), WatermelonDB biên dịch và đóng gói AAR bình thường.
Tạm thời giữ New Architecture; sẽ tái xác nhận ở Giai đoạn 1 khi thật sự mở database.

**Đánh đổi:** không có tính năng mới của RN 0.82–0.87. Chấp nhận được — dự án không dùng
tính năng nào của các bản đó.

---

## 2. Không dùng `@nozbe/with-observables`

**Quyết định:** dùng React bindings có sẵn trong `@nozbe/watermelondb/react`.

**Lý do:** RN 0.81 kéo theo React 19.1.4. Gói `@nozbe/with-observables` khai báo peer
dependency `react: ^16||^17||^18` nên `npm install` thất bại (ERESOLVE). Từ WatermelonDB
0.27, thư viện đã tự ship `DatabaseProvider`, `useDatabase` và `withObservables` — không
cần gói ngoài, cũng không cần `--legacy-peer-deps`.

---

## 3. `@babel/plugin-proposal-decorators` ghim ở dòng 7.x

**Quyết định:** ghim `^7.25.9`.

**Lý do:** tag `latest` của plugin này giờ là 8.x, yêu cầu `@babel/core ^8`. RN 0.81 dùng
`@babel/core` 7.29. Không ghim thì `npm install` gãy.

---

## 4. Cơ sở dữ liệu: SQLite khi phát triển, PostgreSQL khi production

**Quyết định:** SQLAlchemy 2.0 + SQLite mặc định; đổi sang PostgreSQL chỉ bằng biến
`DATABASE_URL`.

**Lý do:**

- Đây là dự án một người. SQLite không cần cài đặt gì, clone repo là chạy được ngay —
  quan trọng khi cần demo nhanh.
- Toàn bộ truy vấn viết bằng SQLAlchemy ORM, không dùng SQL đặc thù SQLite, nên chuyển
  sang PostgreSQL chỉ là đổi chuỗi kết nối + bật `psycopg` trong `requirements.txt`.
- Alembic đã cài sẵn để quản lý migration từ Giai đoạn 1, tránh việc phải xoá database
  mỗi lần đổi schema.

---

## 5. Thời gian lưu dưới dạng epoch milliseconds (số nguyên)

**Quyết định:** mọi bảng tham gia đồng bộ dùng `created_at`/`updated_at` kiểu `BigInteger`
(epoch ms), kèm `deleted_at` + `is_deleted` cho xoá mềm.

**Lý do:** giao thức đồng bộ của WatermelonDB so sánh mốc thời gian bằng số nguyên
millisecond. Dùng cùng một biểu diễn ở cả hai đầu loại bỏ cả một nhóm lỗi múi giờ và làm
tròn trong đồng bộ hai chiều (Mục 9). Xoá mềm là bắt buộc vì `pullChanges` phải báo được
bản ghi nào đã xoá — `DELETE` cứng không diễn đạt được điều đó.

---

## 6. `id` do client sinh (chuỗi), không dùng auto-increment

**Quyết định:** khoá chính của các bảng đồng bộ là `String(64)` do WatermelonDB sinh ở
thiết bị.

**Lý do:** Điều 1 (ghi cục bộ trước) yêu cầu bản ghi tạo khi mất mạng phải có danh tính
ngay. Nếu id do server cấp, bản ghi offline sẽ phải đổi id sau khi đồng bộ, kéo theo việc
phải sửa mọi tham chiếu — nguồn lỗi kinh điển.

---

## 7. Font Open Sans nhúng kèm, không tải từ Google Fonts

**Quyết định:**

- **Web:** trích 15 file `.woff2` (5 độ đậm × 3 subset latin / latin-ext / vietnamese)
  trực tiếp từ file thiết kế → `web-admin/public/fonts/` (207 KB).
- **Mobile:** cắt 5 file TTF tĩnh từ font biến thiên Open Sans bằng `fonttools`
  → `mobile/src/assets/fonts/` (127 KB mỗi file).

**Lý do:** quy tắc §3.3 yêu cầu nhúng kèm. Ngoài ra React Native trên Android không xử lý
font biến thiên ổn định — nó tra font theo tên family + độ đậm, nên phải có file tĩnh
riêng cho từng độ đậm.

---

## 8. Design token là file sinh tự động, không sửa tay

**Quyết định:** `shared/design/tokens.json` là nguồn sự thật duy nhất.
`mobile/src/theme.ts` và `web-admin/src/app/tokens.css` được **sinh ra** từ nó bằng
`node shared/design/build-tokens.js`.

**Lý do:** §3 cấm hard-code màu trong component. Một nguồn → hai nền tảng đảm bảo mobile
và web không trôi lệch nhau theo thời gian.

**Bổ sung ngoài yêu cầu:** mỗi cấp `glass` có thêm token `solid` — màu đặc tính bằng cách
hợp trắng ở alpha trung bình của gradient lên nền ứng dụng `#B0CBA4`. Đây là bộ token
thay thế bắt buộc ở §3.4 khi `backdrop-filter` không khả dụng hoặc người dùng bật
"Chế độ ngoài nắng".
