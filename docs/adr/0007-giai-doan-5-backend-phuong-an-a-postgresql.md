# ADR 0007 — Giai đoạn 5: chọn phương án A cho backend (giữ FastAPI, lên PostgreSQL)

- **Ngày:** 2026-09-23
- **Trạng thái:** Đã áp dụng
- **Liên quan:** [ADR 0001](0001-nen-tang-ky-thuat.md) (chọn FastAPI), [ADR 0002](0002-giai-doan-1.md) (giao thức đồng bộ), [ADR 0006](0006-giai-doan-4-dashboard-offline-pdf-da-nguoi-dung.md) (đồng bộ nhiều tài khoản)

## Bối cảnh

Backend đã chạy được: FastAPI + SQLAlchemy 2, 130 test xanh, `/sync` hai chiều đúng hợp
đồng WatermelonDB. Nhưng nó vẫn là backend của môi trường phát triển — chạy trên một file
SQLite, không có ai kiểm tra nó chịu được bao nhiêu người cùng lúc, và có ít nhất một quy
tắc nghiệp vụ mới chỉ được thực thi ở giao diện chứ chưa ở máy chủ.

Bản đề xuất đặt ra ba hướng:

| | Phương án A | Phương án B | Phương án C |
|---|---|---|---|
| Nội dung | Giữ FastAPI, chuyển sang PostgreSQL, siết quyền, kiểm tải | Viết lại bằng Django REST | Viết mới hoàn toàn |
| Thời gian | 2–3 ngày | 2–3 tuần | 3–4 tuần |
| 130 test hiện có | Dùng lại | Viết lại | Bỏ |
| Hợp đồng đồng bộ | Giữ nguyên | Viết lại | Viết lại |

## Quyết định

**Chọn phương án A.**

Lý do quyết định không phải là "A nhanh hơn". Nhanh hơn chỉ là hệ quả. Lý do là ba thứ đắt
giá nhất trong hệ thống này — giao thức đồng bộ hai chiều, cách xử lý xung đột, và 130 test
mô tả chúng — đều đã đúng và đã được kiểm chứng. B và C đều bắt đầu bằng việc vứt cả ba đi
để đổi lấy một thứ duy nhất: tên bảng khớp với bản đề xuất (`farms` thay vì `plots`,
`crops` thay vì `plans`). Đổi tên bảng là thứ sửa được bất cứ lúc nào bằng một migration;
một lỗi đồng bộ làm mất sổ ghi chép của nông hộ thì không.

Sự lệch tên vì thế được **giữ lại có chủ ý**, và ghi ở đây để người đọc bản đề xuất không
tưởng là thiếu sót:

| Bản đề xuất | Thực tế trong mã | Ghi chú |
|---|---|---|
| `farms` | `plots` | Một nông hộ có nhiều lô; "farm" là tài khoản, `users` đã đóng vai đó |
| `crops` | `plans` | `plans` là kế hoạch bón phân đã lưu, không phải cây trồng |
| `inventory` | `warehouse_in` + `warehouse_out` | Tách ra vì tồn kho tính theo FIFO, cần giữ từng lần nhập với giá riêng |
| `revenue` | `income` + `expense` | Thu và chi có trường khác nhau (`warehouse_in_id` chỉ có ở chi) |
| `sync_log` | *không có* | WatermelonDB giữ `last_pulled_at` ở máy; bảng này ở server là dữ liệu thừa |

## Những gì đã làm

### 1. Quyền tạo lô đất: chặn ở máy chủ, không chỉ ở giao diện

Commit ea4dce2 gỡ nút "thêm lô" trên điện thoại vì lô đất do bên quản lý đất chia và giao.
Nhưng nút bị ẩn không phải là quyền bị chặn: `POST /plots` vẫn nhận, và một dòng `curl` là
đủ để tạo lô. Giờ endpoint này chỉ quản trị viên gọi được (403 với nông hộ), và quản trị
viên truyền `owner_id` để giao lô cho một nông hộ cụ thể.

Quan trọng không kém: **`POST /sync` cũng chặn** việc nông hộ tạo lô. Nếu chỉ chặn ở REST
thì điện thoại vẫn đẩy lô mới lên qua đường đồng bộ — quy tắc coi như không tồn tại. Bản ghi
bị từ chối trả về trong `rejected` kèm lý do, không bị bỏ im lặng.

Nông hộ **vẫn sửa được** lô của mình (`PATCH /plots/{id}` và qua `/sync`): người biết ruộng
trồng gì, trồng từ bao giờ chính là họ, và đó mới là dữ liệu ứng dụng cần thu.

### 2. Nhật ký thay đổi không còn rò sang hộ khác

Phát hiện khi đọc lại đường đi của dữ liệu lúc kiểm tải. Bảng `change_logs` bị xếp vào nhóm
"dùng chung" như danh mục giống, nên mỗi lần đồng bộ, điện thoại của một hộ tải về nhật ký
chỉnh sửa của *mọi* hộ khác: "Nguyễn Văn Anh sửa diện tích 800 → 1200" hiện trên máy người
không liên quan. Hai hậu quả, một về riêng tư và một về hiệu năng — gói đồng bộ phình theo
lịch sử của cả hệ thống thay vì của một nông hộ.

Sửa bằng cách cho mỗi bảng khai báo **cột xác định chủ sở hữu** thay vì một cờ đúng/sai:
`change_logs` thuộc về `changed_by`, các bảng sổ sách thuộc về `owner_id`, còn
`crop_varieties` là `None` — dùng chung có chủ ý, vì giống cây một hộ khai báo là thứ hộ
khác cần thấy. Máy chủ luôn ghi đè cột này bằng tài khoản đang đăng nhập, nên máy khách
không khai gian được tác giả.

### 3. PostgreSQL: chạy được và đã chạy thật

- `DATABASE_URL` đổi một dòng là chuyển toàn bộ backend; mọi thứ riêng của từng loại cơ sở
  dữ liệu gói trong `app/core/database.py`.
- PostgreSQL nhận pool kết nối thật (`pool_pre_ping` để không đưa kết nối chết cho request,
  `pool_recycle` để không bị nhà cung cấp cắt ngang).
- SQLite nhận WAL + `busy_timeout`: không có chúng, người ghi thứ hai lỗi ngay
  "database is locked" và mọi phép đo cục bộ đều sai.
- `add_missing_indexes` tạo chỉ mục mà `create_all` bỏ sót trên cơ sở dữ liệu đã tồn tại.
- Sửa một lỗi chỉ lộ ra trên PostgreSQL: `ALTER TABLE ... DEFAULT 1` trên cột boolean —
  SQLite chấp nhận, PostgreSQL từ chối thẳng.
- **163 test chạy xanh trên cả SQLite lẫn PostgreSQL 16.**

### 4. Chỉ mục ghép cho truy vấn đồng bộ

Mỗi lần kéo dữ liệu chạy đúng một dạng truy vấn cho từng bảng:
`WHERE owner_id = ? AND updated_at > ?`. Với chỉ mục đơn cột như trước, máy chủ quét toàn
bộ lịch sử của nông hộ ở *mỗi* lần đồng bộ. 13 chỉ mục ghép biến nó thành quét khoảng —
khác biệt giữa một app giữ nguyên tốc độ và một app chậm dần theo số ghi chép.

### 5. Một lần đẩy là một giao dịch

Trước đây một lô đẩy hỏng giữa chừng có thể để lại phần đã ghi. Điện thoại không có cách nào
biết phần nào đã lên: gửi lại thì trùng, không gửi lại thì mất. Giờ lô đẩy hoặc vào hết hoặc
không vào gì (422, không phải 500), nên gửi lại nguyên lô luôn an toàn.

### 6. Chặn dò mật khẩu

5 lần sai/phút cho mỗi cặp (người gọi, tài khoản) thì khoá 1 phút. **Chỉ lần sai mới bị
đếm** — nếu lần đúng cũng đếm thì chính nông hộ đăng nhập lại nhiều lần sẽ là người bị khoá.
Bộ đếm nằm trong bộ nhớ tiến trình: cửa sổ chỉ 60 giây, không đáng để dựng thêm Redis.

### 7. Từ chối khởi động khi cấu hình production không an toàn

`ENVIRONMENT=production` mà còn khoá dev, còn trỏ SQLite, hoặc `DEBUG=true` thì API không
khởi động. Cả ba đều là lỗi im lặng cho tới lúc trả giá đắt; đổi thành một lần deploy thất
bại là rẻ hơn nhiều.

## Kết quả kiểm tải

Đo trên máy phát triển (Windows, PostgreSQL 16 trong Docker), 100/50/25 người dùng đồng
thời, mỗi người đẩy 10 bản ghi. Chi tiết và cách chạy lại: `docs/BACKEND_DEPLOYMENT.md`.

| Số người đồng thời | p95 `GET /plots` | p95 `GET /sync` | Lỗi | Mất dữ liệu |
|---|---|---|---|---|
| 25 | 331 ms | 412 ms | 0 | 0 |
| 50 | 672 ms | 795 ms | 0 | 0 |
| 100 | 1194 ms | 1383 ms | 0 | 0 |

**Không mất bản ghi và không có lỗi ở cả ba mức** — đây là điều kiện quan trọng nhất.
Ngưỡng p95 dưới 1 giây đạt tới khoảng 50 người đồng thời cho mỗi tiến trình. Con số 100
người cần 2–3 tiến trình, và phải đo lại trên máy chủ Linux thật trước khi tuyên bố đạt:
số đo trên máy Windows dev không đại diện cho môi trường triển khai.

## Hệ quả

- Tên bảng vẫn lệch bản đề xuất. Chấp nhận, và đã ghi bảng đối chiếu ở trên.
- Chưa dùng Alembic; `schema_upgrade.py` chỉ làm được thay đổi kiểu "thêm vào". Ngày cần đổi
  kiểu cột hay xoá cột thì phải đưa Alembic vào — không né được nữa.
- Giới hạn đăng nhập tính riêng theo từng tiến trình, nên chạy N worker thì hạn mức thực tế
  là 5×N lần/phút. Chấp nhận được ở quy mô hiện tại; muốn chặt hơn thì đặt giới hạn ở reverse
  proxy.
- `uvicorn --workers` **không chạy ổn định trên Windows** (WinError 10022, worker chết rồi
  hồi sinh liên tục). Trên Linux dùng gunicorn với worker uvicorn, đã có sẵn trong Dockerfile.
