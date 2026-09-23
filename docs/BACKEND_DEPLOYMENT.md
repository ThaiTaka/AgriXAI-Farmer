# Triển khai backend AgriLog v2

Hồ sơ vận hành cho người đưa API lên máy chủ và giữ nó chạy. Quyết định kiến trúc đằng sau
nằm ở [ADR 0007](adr/0007-giai-doan-5-backend-phuong-an-a-postgresql.md); danh sách endpoint
ở [API_ENDPOINTS.md](API_ENDPOINTS.md).

---

## 1. Chuẩn bị

| Thứ cần có | Ghi chú |
|---|---|
| Python 3.12 | Đã kiểm thử trên 3.12.10 |
| PostgreSQL 14+ | Đã kiểm thử trên 16.15 |
| Khoá bí mật | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| Tên miền + HTTPS | Token đi trong header, HTTP trần là để lộ nguyên vẹn |

```bash
pip install -r backend/requirements.txt -r backend/requirements-prod.txt
```

Biến môi trường: chép `backend/.env.production.example` rồi điền. Ba giá trị bắt buộc đổi là
`SECRET_KEY`, `DATABASE_URL` và `CORS_ORIGINS` — API sẽ **từ chối khởi động** nếu
`ENVIRONMENT=production` mà còn dùng khoá dev, còn trỏ SQLite, hoặc `DEBUG=true`.

### Quy tắc kích thước pool

```
SỐ_WORKER × (DB_POOL_SIZE + DB_MAX_OVERFLOW)  <  max_connections của PostgreSQL
```

Vi phạm quy tắc này thì lỗi không xuất hiện lúc khởi động mà lúc đông người dùng nhất, dưới
dạng 500 rải rác. Mặc định trong `.env.production.example` (5 + 15, 4 worker = 80) an toàn
với `max_connections=100`.

---

## 2. Chuyển dữ liệu từ SQLite sang PostgreSQL

Tắt API trước — dữ liệu ghi thêm trong lúc chép sẽ không được mang sang.

```bash
cd backend

# 1. Xem trước, không ghi gì
python -m scripts.migrate_sqlite_to_postgres \
  --source "sqlite:///./agrilog.db" \
  --target "postgresql+psycopg://agrilog:...@localhost:5432/agrilog" \
  --dry-run

# 2. Chép thật
python -m scripts.migrate_sqlite_to_postgres \
  --source "sqlite:///./agrilog.db" \
  --target "postgresql+psycopg://agrilog:...@localhost:5432/agrilog"
```

Script tạo bảng và chỉ mục ở đích, chép theo đúng thứ tự khoá ngoại, rồi **tự đối chiếu số
dòng hai bên** và in bảng so sánh. Mặc định nó dừng nếu bảng đích đã có dữ liệu; `--truncate`
để thay thế toàn bộ (xoá sạch đích trước khi chép).

---

## 3. Chạy

### Docker (khuyến nghị — giống nhau ở mọi nơi)

Build từ thư mục gốc của repo, không phải từ `backend/`: API đọc dữ liệu tĩnh trong
`shared/data` và font tiếng Việt trong `mobile/src/assets/fonts`.

```bash
docker build -f backend/Dockerfile -t agrilog-api .
docker run -d --name agrilog-api -p 8000:8000 --env-file backend/.env.production agrilog-api
```

Ảnh chạy 4 tiến trình gunicorn + worker uvicorn, dưới tài khoản thường (không phải root), và
có sẵn `HEALTHCHECK` gọi `/health`.

### VPS không dùng Docker

```bash
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000 --timeout 60
```

Đặt sau nginx hoặc Caddy để lo HTTPS. Số worker lấy theo số lõi, và nhớ quy tắc pool ở trên.

### Render.com / Railway

- Build: `pip install -r backend/requirements.txt -r backend/requirements-prod.txt`
- Start: `cd backend && gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:$PORT`
- Thêm PostgreSQL của nhà cung cấp, dán chuỗi kết nối vào `DATABASE_URL`. Nếu chuỗi bắt đầu
  bằng `postgres://` thì đổi thành `postgresql+psycopg://` — SQLAlchemy cần tên driver.
- Điền toàn bộ biến trong `.env.production.example` vào phần Environment.

### Trên Windows (chỉ để phát triển)

```bash
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

**Đừng dùng `--workers` trên Windows.** Chế độ nhiều tiến trình của uvicorn hỏng ở đây
(`WinError 10022`): worker chết rồi hồi sinh liên tục, và biểu hiện ra ngoài là lỗi 500 rải
rác với kết nối bị đóng đột ngột — rất dễ tưởng nhầm là lỗi của API.

---

## 4. Kiểm tra sau khi lên

```bash
curl https://api.agrilog.example.com/health
```

Trả về `"status":"ok"` kèm `"database":"ok"` và ba mục `static_data` đều `true`. Nếu
`static_data` có mục `false` thì thư mục `shared/data` chưa được đóng gói theo — báo cáo và
màn hình chăm sóc sẽ thiếu dữ liệu.

Chạy bộ test trên chính cơ sở dữ liệu của môi trường staging (**sẽ xoá sạch dữ liệu**, chỉ
trỏ vào cơ sở dữ liệu dùng một lần):

```bash
cd backend
TEST_DATABASE_URL="postgresql+psycopg://agrilog:...@host:5432/agrilog_test" python -m pytest -q
# 153 passed
```

---

## 5. Kiểm tải

```bash
cd backend
python -m scripts.loadtest --base-url https://api.agrilog.example.com --users 100 --rows 10
```

Script đo bốn đường đi, mỗi đường báo trung vị / p95 / chậm nhất, và **đối chiếu số bản ghi
đẩy lên với số kéo về** để phát hiện mất dữ liệu.

Kết quả đo ngày 23/09/2026 trên máy phát triển (Windows 11, PostgreSQL 16 trong Docker, một
tiến trình uvicorn):

| Số người đồng thời | `GET /plots` p95 | `GET /sync` đầu | `GET /sync` gia tăng | `POST /sync` | Lỗi | Mất dữ liệu |
|---|---|---|---|---|---|---|
| 25 | 331 ms | 412 ms | 339 ms | 410 ms | 0 | 0 |
| 50 | 672 ms | 795 ms | 621 ms | 774 ms | 0 | 0 |
| 100 | 1194 ms | 1383 ms | 1457 ms | 1463 ms | 0 | 0 |

Đọc bảng này cho đúng:

- **Không mất bản ghi và không có lỗi ở cả ba mức.** Đây là điều kiện quan trọng nhất, và nó
  đạt.
- Ngưỡng **p95 dưới 1 giây đạt tới khoảng 50 người đồng thời cho mỗi tiến trình**. Muốn 100
  người thì cần 2–3 tiến trình — đó là lý do Dockerfile đặt `-w 4`.
- Con số đo trên máy Windows dev **không đại diện** cho máy chủ Linux: riêng phần khung ASGI
  ở đây đã tốn khoảng 10 ms mỗi yêu cầu, trong khi truy vấn cơ sở dữ liệu chỉ mất 2 ms.
  **Phải chạy lại lệnh trên ở staging Linux** trước khi tuyên bố đạt mốc 100 người.
- "Đồng bộ đầu" (kéo 24 giờ) nặng hơn "gia tăng" (kéo 60 giây) và mỗi máy chỉ gặp một lần
  sau khi cài. Gộp hai thứ vào một con số sẽ ra một kết quả không mô tả đúng cái gì cả.

---

## 6. Sao lưu

```bash
# Hằng ngày, giữ 7 ngày
pg_dump "$DATABASE_URL" | gzip > /var/backups/agrilog-$(date +%F).sql.gz
find /var/backups -name 'agrilog-*.sql.gz' -mtime +7 -delete
```

**Bản sao lưu chưa từng phục hồi thử thì chưa phải bản sao lưu.** Mỗi tháng một lần, phục hồi
vào một cơ sở dữ liệu tạm rồi chạy `pytest` với `TEST_DATABASE_URL` trỏ vào đó.

---

## 7. Theo dõi

API tự ghi log những thứ cần cho việc chẩn đoán:

| Dòng log | Nghĩa |
|---|---|
| `slow request GET /sync 1240ms` | Yêu cầu vượt `SLOW_REQUEST_MS` — nơi bắt đầu tìm truy vấn chậm |
| `sync conflict table=plots id=... user=...` | Một sửa đổi của nông hộ không được ghi (bản máy chủ mới hơn). Đây là dòng cần tìm khi có người báo "tôi sửa rồi mà nó không đổi" |
| `sync rejected table=plots ... reason=admin_only_create` | Máy khách cố tạo lô đất — có thể là app cũ, cũng có thể là ai đó đang thử |
| `push failed user=... error=IntegrityError` | Một lô đẩy bị quay lui toàn bộ |

Mọi phản hồi đều có header `X-Response-Time-Ms`, nên đo được từ phía máy khách mà không cần
vào máy chủ.

Nên có thêm:
- Theo dõi uptime gọi `/health` mỗi 5 phút (UptimeRobot hoặc tương đương).
- `log_min_duration_statement = 500` trong PostgreSQL để bắt truy vấn chậm.
- Gom log về một chỗ (Sentry hoặc journald + grep) — các dòng ở bảng trên đều đã có sẵn
  định dạng cố định để lọc.

---

## 8. Những chỗ còn giới hạn

| Giới hạn | Ảnh hưởng | Khi nào phải xử lý |
|---|---|---|
| Chưa có Alembic; `schema_upgrade.py` chỉ thêm được cột và chỉ mục | Đổi kiểu cột hoặc xoá cột phải làm tay | Ngay khi cần đổi kiểu một cột đang có dữ liệu |
| Giới hạn đăng nhập đếm theo từng tiến trình | Chạy N worker thì hạn mức thực tế là 5×N lần/phút | Khi cần siết chặt: đặt giới hạn ở nginx/Caddy |
| Token sống 7 ngày, không có refresh | Token lộ thì dùng được 7 ngày | Bù bằng khoá tài khoản (`PATCH /users/{id}/status`) — có hiệu lực ngay ở yêu cầu kế tiếp |
| Kiểm tải mới chạy trên máy Windows dev | Chưa có số đo của môi trường thật | Trước khi tuyên bố đạt mốc 100 người đồng thời |

### Vì sao không có `POST /auth/logout`

Token là JWT tự chứa: máy chủ không giữ phiên nào để mà xoá. Một endpoint `logout` trả 200
rồi không làm gì sẽ **nói dối người gọi** — họ tưởng token đã bị vô hiệu hoá trong khi nó
vẫn dùng được tới lúc hết hạn. Đăng xuất vì thế là việc của máy khách: xoá token khỏi máy.

Khi cần vô hiệu hoá thật (mất điện thoại, nhân viên nghỉ việc), dùng
`PATCH /users/{id}/status` với `is_active=false` — có hiệu lực ngay ở yêu cầu kế tiếp, vì mọi
request đều tra lại tài khoản trong cơ sở dữ liệu. Muốn huỷ toàn bộ token của mọi người thì
đổi `SECRET_KEY` và khởi động lại.
