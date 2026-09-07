# AgriLog v2

Ứng dụng ghi chú vật tư nông nghiệp cho nông hộ trồng cà chua: nhật ký canh tác, quản lý
lô đất, chẩn đoán bệnh cây qua ảnh, tư vấn phân bón, lịch chăm sóc, quản lý kho vật tư và
ghi thu chi — kèm trang quản trị web cho cán bộ quản lý.

> **Trạng thái: Giai đoạn 2 — luồng chẩn đoán bệnh qua ảnh đã chạy được.**
> README này sẽ được viết đầy đủ ở Giai đoạn 6. Bản hiện tại chỉ đủ để chạy dự án.

| Chụp ảnh | Kết quả chẩn đoán | Gợi ý xử lý | Lịch sử |
|---|---|---|---|
| ![Chụp ảnh](docs/screenshots/g2-01-chup-anh.png) | ![Kết quả](docs/screenshots/g2-02-ket-qua.png) | ![Gợi ý](docs/screenshots/g2-03-goi-y-xu-ly.png) | ![Lịch sử](docs/screenshots/g2-09-lich-su.png) |

**Ba ca đặc biệt bắt buộc** (Mục 5, Giai đoạn 2):

| Nhện hại — thuốc trừ nấm vô dụng | Virus xoăn vàng lá — thuốc trị bọ phấn | Virus khảm — không có thuốc |
|---|---|---|
| ![Nhện](docs/screenshots/g2-04-canh-bao-nhen-hai.png) | ![TYLCV](docs/screenshots/g2-05-thuoc-tri-bo-phan.png) | ![Khảm](docs/screenshots/g2-06-khong-co-thuoc.png) |

**Chụp ảnh khi mất mạng** — xếp hàng, không lỗi; có mạng lại thì tự gửi và tự lưu:

| Mất mạng | Có mạng trở lại |
|---|---|
| ![Offline](docs/screenshots/g2-07-offline-xep-hang.png) | ![Online](docs/screenshots/g2-08-online-tu-luu.png) |

## Mục lục

- [Kiến trúc thư mục](#kiến-trúc-thư-mục)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Chạy backend](#chạy-backend)
- [Chạy web-admin](#chạy-web-admin)
- [Chạy mobile](#chạy-mobile)
- [Design token và font](#design-token-và-font)
- [Dữ liệu tĩnh offline](#dữ-liệu-tĩnh-offline)
- [Đồng bộ dữ liệu](#đồng-bộ-dữ-liệu)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)

## Kiến trúc thư mục

| Thư mục | Nội dung |
|---|---|
| `mobile/` | Ứng dụng nông hộ — React Native 0.81 CLI + TypeScript + WatermelonDB. |
| `web-admin/` | Trang quản trị — Next.js 16 App Router + Tailwind CSS 4. |
| `backend/` | API — FastAPI + SQLAlchemy 2 (SQLite khi dev, PostgreSQL khi production). |
| `shared/design/` | `tokens.json` (nguồn sự thật của thiết kế) và các script sinh file theme. |
| `shared/data/` | Dữ liệu tĩnh đọc offline: bệnh cà chua, phân bón, quy trình chăm sóc, giống cây. |
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

Chạy test: `./.venv/Scripts/python.exe -m pytest`

## Chạy web-admin

```bash
cd web-admin
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Kiểm tra kiểu: `npx tsc --noEmit` · lint: `npm run lint`

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

Kiểm tra kiểu: `npx tsc --noEmit` · lint: `npx eslint App.tsx src`

Tài khoản demo giống phần backend ở trên. Ô "Tài khoản" nhận **cả tên đăng nhập lẫn email**
(`thaitaka` hoặc `thaitaka@agrilog.local`).

## Design token và font

`shared/design/tokens.json` là **nguồn sự thật duy nhất** cho màu, font, bo góc, spacing,
hiệu ứng kính — trích từ file thiết kế `AgriXAI Farmer v4 - Standalone (1).html`. Không
hard-code màu trong component.

```bash
node shared/design/build-tokens.js     # -> mobile/src/theme.ts, web-admin/src/app/tokens.css
node shared/design/extract-fonts.js    # -> web-admin/public/fonts/*.woff2 + fonts.css
python shared/design/build-mobile-fonts.py   # -> mobile/src/assets/fonts/*.ttf
node shared/design/extract-design.js <thư-mục-đích>   # giải nén lại file thiết kế gốc
```

Font Open Sans được **nhúng kèm** cả hai nền tảng, không tải từ Google Fonts lúc chạy.

## Dữ liệu tĩnh offline

`shared/data/` chứa bốn danh mục mà ứng dụng phải đọc được khi không có mạng:

| File | Nội dung | Nguồn |
|---|---|---|
| `tomato_diseases.json` | 10 bệnh/đối tượng hại trên cà chua | File thiết kế + kiến thức nông nghiệp phổ thông |
| `fertilizer_recommendations.json` | Danh mục và **giá thật** phân bón | `fertilizers_seed.json` (sfarm.vn, giacaphe.com — 06–07/09/2026) |
| `care_protocols.json` | Lịch bón phân theo giai đoạn cây | `care_protocol_tomato_seed.json` (giongcaytrong.org) |
| `crop_varieties.json` | 8 giống cà chua thật | `crop_varieties_seed.json` (sfarm.vn, nguonsinhthai.com) |

**Giá phân bón trong file chỉ là dữ liệu khởi tạo.** Giá biến động theo ngày và vùng miền,
nên nguồn sự thật khi chạy là bảng `fertilizer_prices` trong backend, sửa được ở màn hình
Admin và có lưu lịch sử giá (Giai đoạn 4). Không hard-code giá ở bất kỳ đâu trong mã nguồn.

## Đồng bộ dữ liệu

Đồng bộ **hai chiều** theo giao thức WatermelonDB (Mục 9), chạy nền khi đăng nhập, khi app
quay lại foreground, và mỗi 60 giây.

- `GET /sync?last_pulled_at=` — lấy thay đổi từ server
- `POST /sync?last_pulled_at=` — đẩy thay đổi từ máy lên

Xung đột giải quyết bằng **last-write-wins theo `updated_at`**; xoá luôn thắng update. Lý do
và các test bắt buộc ghi ở [ADR 0002](docs/adr/0002-giai-doan-1.md).

Mọi thao tác của nông dân ghi vào SQLite trước rồi mới đồng bộ — tắt mạng vẫn dùng được
toàn bộ 4 màn hình.

## Chẩn đoán bệnh qua ảnh

Ảnh được thu nhỏ về 600×600 ngay lúc chọn rồi gửi lên `POST /diagnoses`. Backend chạy mô
hình và trả top-3 bệnh kèm độ tin cậy; **không tạo bản ghi** — bản ghi `diagnoses` do
mobile sở hữu và đi lên qua đường đồng bộ.

**Mất mạng thì ảnh xếp hàng, không báo lỗi.** Ảnh vào bảng cục bộ `pending_diagnoses`,
một tiến trình nền cứ 5 giây gửi một ảnh, có backoff nhân đôi khi thất bại. Khi gửi được,
kết quả tự lưu vào lô đất — nông dân không phải chụp lại.

Mô hình hiện là `DummyPredictor`: kết quả **tất định theo nội dung ảnh** (cùng một ảnh luôn
ra cùng đáp án, kể cả khi gửi lại sau khi xếp hàng), độ tin cậy nằm trong khoảng 0,45–0,85
để không tạo ảo giác về độ chính xác. Thay bằng model thật qua biến `MODEL_CHECKPOINT`.
Heatmap trả `null` và UI ẩn hẳn lớp phủ — **không bao giờ vẽ vùng nghi ngờ ngẫu nhiên**.

Chi tiết quyết định: [ADR 0003](docs/adr/0003-giai-doan-2.md).

## Giới hạn hiện tại

- **Giai đoạn 2** đã xong 5 màn hình chẩn đoán. Nhật ký, tư vấn phân bón, kho, thu-chi
  (Giai đoạn 3) và toàn bộ web-admin (Giai đoạn 4) chưa làm. Trang chủ web-admin hiện vẫn
  là màn hình kiểm tra design token.
- Backend có `GET /health`, `POST /auth/login`, `GET/PATCH /auth/me`, CRUD `/plots`,
  `/crop-varieties`, `/diagnoses`, `/diseases` và `/sync`. Các endpoint còn lại theo Mục 7
  sẽ bổ sung dần.
- Nút "Xem chi tiết" của từng bệnh hiện mở màn Gợi ý xử lý; màn **Danh mục bệnh** riêng
  thuộc Giai đoạn 3.
- Tab "Chu kỳ canh tác" đã dựng xong nhưng chưa có dữ liệu vì tính năng sinh ra nó thuộc
  giai đoạn sau.
- Giai đoạn cây ở tab "Lịch chăm sóc" hiện **ước tính từ ngày trồng**; khi có bản ghi chu
  kỳ canh tác thật thì bản ghi đó được ưu tiên.
- Mô hình chẩn đoán ảnh chưa có — sẽ dùng `DummyPredictor`, thay bằng model thật qua biến
  môi trường `MODEL_CHECKPOINT`.
- Nhận dạng giọng nói chưa có — sẽ dùng `DummyAsrEngine` trước, chọn Vosk hay whisper.cpp
  bằng benchmark ở Giai đoạn 5.
