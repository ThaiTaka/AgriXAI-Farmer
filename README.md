# AgriLog v2

Ứng dụng ghi chép vật tư và chi phí cho nông hộ: quản lý lô đất theo cây trồng và giống,
tư vấn phân bón, lịch chăm sóc, quản lý kho vật tư và ghi thu chi — kèm trang quản trị web
cho cán bộ quản lý.

> **Trạng thái:** nền tảng (đăng nhập, lô đất, chọn giống 3 cấp, danh mục phân bón, đồng bộ
> hai chiều) chạy được trên hệ thiết kế phẳng v5. Bốn module của Giai đoạn 3 — Tư vấn phân
> bón F1–F4, Chăm sóc F5–F6, Kho, Thu-Chi — **chưa xây**.
> README này sẽ được viết đầy đủ ở Giai đoạn 6; bản hiện tại chỉ đủ để chạy dự án.

![Trang chủ, chọn giống 3 bước và danh mục phân bón](docs/screenshots/01-home.png)

## Phạm vi

Ứng dụng **không** chẩn đoán bệnh cây. Tính năng đó từng có ở Giai đoạn 2 và đã bị gỡ bỏ
hoàn toàn — lý do và danh sách những gì bị xoá nằm ở
[ADR 0003](docs/adr/0003-thu-hep-pham-vi.md).

Bốn mảng nghiệp vụ của dự án:

| # | Mảng | Trạng thái |
|---|---|---|
| 1 | Tư vấn & phân loại phân bón (F1–F4) | Một phần: màn hình **Danh mục phân bón** (6 nhóm → sản phẩm, lọc theo mức giá). F1 tính lượng, F4 kiểm tra kho chưa có |
| 2 | Quy trình chăm sóc theo giai đoạn (F5–F6) | Một phần: tab "Chăm sóc" trong Chi tiết lô đất (mới có quy trình cà chua) |
| 3 | Nhập – Xuất kho | Chưa xây |
| 4 | Thu – Chi | Chưa xây |

Nền cho cả bốn mảng: **danh mục giống cây 3 cấp** (loại cây → loại con → giống) với 4 loại
cây · 17 loại con · 40 giống có nguồn — xem [ADR 0004](docs/adr/0004-he-thiet-ke-phang-va-danh-muc-giong-3-cap.md).

Hệ quả đáng chú ý: app chỉ xin **đúng một quyền** — `INTERNET`. Không còn quyền máy ảnh
hay quyền đọc thư viện ảnh.

## Mục lục

- [Phạm vi](#phạm-vi)
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

Chạy test: `./.venv/Scripts/python.exe -m pytest` (19 test: smoke, sync hai chiều, parity
schema mobile ↔ server, toàn vẹn dữ liệu tĩnh).

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

`shared/design/tokens.json` (v5) là **nguồn sự thật duy nhất** cho màu, font, bo góc, lưới
8pt và hai mức bóng. Hệ thiết kế phẳng: nền trắng / xám-50, viền xám mảnh, một màu xanh chủ
đạo `#2E6F40`, nhãn pastel — không gradient, không glassmorphism (`react-native-linear-gradient`
đã bị gỡ). Không hard-code màu trong component. File mock-up v4 trong `docs/design-reference/`
chỉ còn là tư liệu.

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
| `care_protocols.json` | Lịch bón phân theo giai đoạn cây (mới có cà chua) | `care_protocol_tomato_seed.json` (giongcaytrong.org) |
| `crop_varieties.json` | Danh mục 3 cấp: cà chua 8 · cà phê 17 · dưa leo 9 · ớt 6 giống, **mỗi giống có `source`** | Viện Eakmat/WASI, vista.gov.vn, Rạng Đông, East-West Seed, Phú Điền, Chánh Phong, Rijk Zwaan, sfarm.vn, nguonsinhthai.com, Wikipedia |

Quy tắc bất di bất dịch của `crop_varieties.json`: không bịa dữ liệu. Số liệu chép đúng
nguồn; thiếu thì ghi "Chưa có dữ liệu". `backend/tests/test_static_data.py` từ chối giống
không có nguồn.

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
toàn bộ ứng dụng.

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

## Giới hạn hiện tại

- **Bốn module của Giai đoạn 3 chưa được xây đầy đủ**: F1 tính lượng phân, F3 lọc ngân
  sách (mới có ở danh mục), F4 kiểm tra kho, F5–F6 cho cây ngoài cà chua, Kho, Thu-Chi.
- Quy trình chăm sóc mới có cho cà chua; cà phê, dưa leo, ớt hiển thị "Chưa có dữ liệu"
  cho tới khi có nguồn chính thức (Giai đoạn 3).
- Trang chủ web-admin vẫn là màn hình kiểm tra design token; các trang quản trị thật thuộc
  Giai đoạn 4.
- Backend có `GET /health`, `POST /auth/login`, `GET/PATCH /auth/me`, CRUD `/plots`,
  `/crop-varieties` và `/sync`. Endpoint cho kho và thu-chi sẽ bổ sung ở Giai đoạn 3.
- Bảng `crop_cycles` đã có trong schema nhưng chưa có màn hình nào ghi vào nó, nên tab
  "Chu kỳ canh tác" luôn rỗng.
- Schema mobile đang ở **v4**. Migration v3→v4 đổi id cây (`ca_chua` → `tomato`), thêm cột
  danh mục 3 cấp và drop hẳn hai bảng `diagnoses`, `pending_diagnoses` còn sót. Server tự
  thêm cột thiếu lúc khởi động (`app/core/schema_upgrade.py`) thay cho Alembic.
- Giai đoạn cây ở tab "Chăm sóc" hiện **ước tính từ ngày trồng** theo chu kỳ cà chua; khi
  có bản ghi chu kỳ canh tác thật thì bản ghi đó được ưu tiên.
- Nhận dạng giọng nói chưa có — sẽ dùng `DummyAsrEngine` trước, chọn Vosk hay whisper.cpp
  bằng benchmark ở Giai đoạn 5.
