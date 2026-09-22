# Prompt: Backend API + đồng bộ WatermelonDB

> Chạy trong tuần 2–4. Đọc hết mục 0 trước khi gõ dòng lệnh đầu tiên.

---

## 0. ĐỌC TRƯỚC KHI CHẠY — dự án đã có backend chạy được

Đề bài gốc viết "Xây Dựng Django Backend API", như thể bắt đầu từ con số không.
Thực tế trong repo này **đã có một backend hoàn chỉnh và đang chạy**:

| Hạng mục | Hiện trạng trong `backend/` |
|---|---|
| Framework | FastAPI 0.121 + SQLAlchemy 2.0 + Alembic |
| CSDL | SQLite khi phát triển; `DATABASE_URL` đổi sang PostgreSQL là chạy (driver `psycopg` đã ghi sẵn trong `requirements.txt`, chỉ cần bỏ comment) |
| Xác thực | Token Bearer, có khoá tài khoản, đổi mật khẩu, phân vai `farmer` / `admin` |
| Đồng bộ | `GET /sync` (pull) và `POST /sync` (push) đúng hợp đồng WatermelonDB, **đã có xử lý xung đột** trả bản của máy chủ về cho điện thoại |
| Nghiệp vụ | Lô đất, danh mục giống, kế hoạch bón, kho nhập/xuất, thu/chi, lịch sử công việc, nhật ký lỗi, dashboard, xuất PDF và CSV |
| Kiểm thử | **130 test pytest đang xanh**, trong đó có `test_schema_parity.py` khoá chặt schema máy chủ ↔ schema WatermelonDB trên điện thoại |

Viết lại bằng Django theo schema trong đề (`farms`, `crops`, `activities`,
`inventory`, `revenue`) sẽ **phá hợp đồng đồng bộ**: tên bảng và tên cột trong
đề không khớp với model WatermelonDB mà ứng dụng di động đang dùng, nên ứng
dụng sẽ không đồng bộ được nữa và 130 test kia mất hiệu lực.

### Ba hướng — chọn một rồi hãy viết code

**Hướng A — giữ FastAPI, chuyển sang PostgreSQL (khuyến nghị).**
Công việc thật sự còn lại chỉ là hạ tầng: bỏ comment `psycopg`, đổi
`DATABASE_URL`, chạy Alembic trên Postgres, thêm cấu hình sản xuất và giám sát.
Ước lượng: 2–3 ngày, không đụng vào ứng dụng di động, 130 test vẫn là lưới an
toàn. Mọi mục 5–7 dưới đây áp dụng nguyên vẹn.

**Hướng B — chuyển sang Django nhưng GIỮ NGUYÊN hợp đồng.**
Chỉ đổi framework, không đổi tên bảng, tên cột hay hình dạng payload
`/sync`. Phải port lại toàn bộ test sang `pytest-django` và chạy song song hai
backend cho tới khi test xanh hết. Ước lượng: 2–3 tuần. Chỉ chọn hướng này nếu
có lý do bắt buộc phải dùng Django (yêu cầu môn học, đội ngũ chỉ biết Django).

**Hướng C — viết mới theo đúng schema trong đề.**
Kéo theo việc viết lại schema WatermelonDB, toàn bộ tầng repository của ứng
dụng di động, và bỏ dữ liệu người dùng đang có. **Không khuyến nghị.** Nếu vẫn
chọn, phải kèm kế hoạch di trú dữ liệu và sửa `mobile/src/db/schema.ts` cùng
`migrations.ts` trong cùng một lần.

> Mục 1–8 dưới đây viết cho **hướng B** (vì đề yêu cầu Django), và ghi chú
> phần nào **đã có sẵn** nếu chọn hướng A.

---

## 1. Django REST Framework — thiết lập

- Project: `agrilog_backend` (Django 4.2 LTS trở lên)
- CSDL: PostgreSQL 15+
- ORM: Django ORM
- Xác thực: token (`rest_framework.authtoken`)
- CORS: `django-cors-headers`, whitelist đúng origin của web-admin

**Nếu chọn hướng A:** mục này đã xong, chỉ đổi `DATABASE_URL` và bỏ comment
`psycopg[binary]==3.2.10` trong `backend/requirements.txt`.

---

## 2. Schema — dùng tên đang chạy, không dùng tên trong đề

Đây là điểm dễ sai nhất. Bảng bên trái là **tên thật đang chạy**; bên phải là
tên trong đề gốc, ghi ra để đối chiếu chứ **không được dùng**.

| Bảng thật (giữ nguyên) | Tên trong đề gốc | Ghi chú |
|---|---|---|
| `users` | users | có `role`, `is_active`, `region`, `phone` |
| `plots` | farms | **chỉ đọc với nông hộ** — xem mục 3 |
| `crop_varieties` | — | danh mục giống, nông hộ thêm được, admin duyệt |
| `crop_cycles` | crops | vụ trên một lô |
| `plans` | — | kế hoạch bón sinh từ máy tính lượng phân |
| `warehouse_in` / `warehouse_out` | inventory | tách nhập và xuất, không gộp một bảng |
| `income` / `expense` | revenue | tách thu và chi, không gộp một bảng |
| `tasks_history` | activities | đánh dấu đã làm theo giai đoạn |
| `change_logs` | — | nhật ký sửa từng trường, phục vụ đối chiếu |
| `error_logs` | — | nhật ký lỗi máy đẩy lên |

Mọi bảng đồng bộ đều mang `id` (chuỗi, do máy sinh), `created_at`, `updated_at`
(mili-giây epoch), `is_deleted`, `deleted_at`, `owner_id`, `updated_by`.

**Bảng `sync_log` trong đề là không cần.** WatermelonDB giữ `last_pulled_at` ở
phía máy, máy chủ không lưu trạng thái đồng bộ theo thiết bị. Thêm bảng này chỉ
tạo ra một nguồn sự thật thứ hai để lệch nhau.

### Quy tắc bắt buộc: `updated_at` phải đổi khi nội dung đổi

Pull lọc theo `updated_at > last_pulled_at`. Sửa nội dung một dòng mà giữ
nguyên `updated_at` thì **thay đổi đó không bao giờ tới được máy đã đồng bộ**.
Lỗi này đã xảy ra thật một lần với dữ liệu demo (xem `DEMO_REVISION` trong
`backend/app/seed_demo.py`). Áp dụng cho cả seeder lẫn mọi lệnh sửa hàng loạt.

---

## 3. Endpoint

### Lô đất — chỉ đọc với nông hộ (việc còn dở, cần làm)

Nông hộ **không lập lô**. Lô do hệ quản lý đất chia và gán; ứng dụng di động
chỉ hiển thị lô được giao. Ứng dụng đã bỏ hết nút "Thêm lô" và bỏ luôn hàm tạo
lô ở tầng dữ liệu (xem `mobile/__tests__/noPlotCreation.test.ts`).

**Nhưng phía máy chủ vẫn hở.** Hiện `POST /plots` trả 201 cho bất kỳ token
hợp lệ nào, kể cả token nông hộ. Việc cần làm:

- `POST /plots` → chỉ cho vai `admin` (hoặc dịch vụ quản lý đất), nông hộ nhận `403`.
- `PATCH /plots/{id}` → nông hộ chỉ được sửa các trường canh tác
  (`crop_type`, `crop_name`, `variety_id`, `variety_name`, `planted_at`,
  `status`, `notes`). Các trường do bên giao đất quyết định (`code`, `name`,
  `region`, `area`, `area_unit`, `owner_id`) phải từ chối.
- `POST /sync` → bỏ qua phần `plots.created` do nông hộ đẩy lên, và không nhận
  thay đổi trên các trường vừa liệt kê.
- Thêm test: token nông hộ gọi `POST /plots` nhận 403; push một lô mới qua
  `/sync` thì lô đó không xuất hiện trong CSDL.

### Bảng đối chiếu 13 endpoint trong đề với thực tế

| Đề gốc | Thực tế |
|---|---|
| `POST /api/auth/token` | `POST /auth/login` — **đã có** |
| `POST /api/auth/logout` | **chưa có**; token hiện không có danh sách thu hồi. Cần bàn: thêm bảng thu hồi token hay chuyển sang JWT hạn ngắn |
| `GET /api/farms` | `GET /plots` — **đã có** |
| `GET /api/farms/{id}/` | `GET /plots/{id}` — **đã có** |
| `GET /api/farms/{id}/crops` | qua `GET /sync` — **đã có** |
| `PUT .../crops/{cropId}/` | `PATCH /plots/{id}` — **đã có** |
| `GET /api/crops/{id}/protocol` | `GET /care-protocols` — **đã có**, kèm danh sách "chưa có dữ liệu" thay vì 404 rỗng |
| `GET/POST .../activities` | `GET /tasks-history` để đọc; đánh dấu "đã làm" đi qua `POST /sync` chứ không có endpoint ghi riêng — **đã có** |
| `GET/POST .../inventory` | `GET/POST /warehouse/in`, `/warehouse/out` — **đã có** |
| `GET/POST .../revenue` | `GET/POST /income`, `/expense` — **đã có** |
| `POST /api/sync/pull` | `GET /sync?last_pulled_at=` — **đã có** |
| `POST /api/sync/push` | `POST /sync` — **đã có** |

Nếu đổi sang tiền tố `/api/` thì phải sửa `mobile/src/api/client.ts` và
`web-admin` trong cùng một lần, kèm một giai đoạn phục vụ song song cả hai
đường dẫn cho tới khi mọi máy đã cập nhật.

---

## 4. Logic đồng bộ — hợp đồng thật

Phía máy dùng `synchronize()` của `@nozbe/watermelondb/sync`, nên hình dạng
payload là do thư viện quy định, **không tự đặt lại được**.

**Pull** — `GET /sync?last_pulled_at=<ms>&schema_version=<n>`:

```json
{
  "changes": {
    "plots":      {"created": [...], "updated": [...], "deleted": ["id"]},
    "plans":      {"created": [...], "updated": [...], "deleted": []},
    "warehouse_in": {...}, "warehouse_out": {...},
    "income": {...}, "expense": {...},
    "tasks_history": {...}, "crop_varieties": {...}
  },
  "timestamp": 1790000000000
}
```

- Chỉ trả dòng có `updated_at > last_pulled_at`.
- `last_pulled_at` rỗng = lần đầu: trả toàn bộ dữ liệu của chủ sở hữu.
- Xoá là **xoá mềm**: `is_deleted = true`, id nằm trong `deleted`.
- Chỉ trả dòng thuộc `owner_id` của người gọi. Admin thêm `owner_id=` để xem hộ khác.

**Push** — `POST /sync?last_pulled_at=<ms>`, thân là đúng khối `changes` trên.
Trả về:

```json
{"ok": true, "applied": {...}, "conflicts": [ { bản của máy chủ } ]}
```

**Giải quyết xung đột — máy chủ thắng, nhưng phải nói ra.**
Nếu `updated_at` của dòng máy gửi lên cũ hơn dòng đang có ở máy chủ thì từ
chối, và trả **nguyên bản của máy chủ** trong `conflicts`. Điện thoại hiện hộp
thoại "giữ bản của tôi / lấy bản mới" (`mobile/src/components/ConflictDialog.tsx`).
Từ chối im lặng là cấm: nông hộ sẽ mất ghi chép mà không biết.

---

## 5. Mã lỗi

| Mã | Khi nào |
|---|---|
| 400 | Thân yêu cầu sai định dạng, thiếu trường bắt buộc |
| 401 | Không có token, token sai hoặc hết hạn |
| 403 | Đụng vào dữ liệu của nông hộ khác; nông hộ gọi endpoint chỉ dành cho admin (gồm cả `POST /plots`) |
| 404 | Không có bản ghi, hoặc có nhưng `is_deleted` |
| 409 | Xung đột đồng bộ — kèm bản của máy chủ trong thân phản hồi |
| 422 | Dữ liệu đúng định dạng nhưng sai nghiệp vụ (xuất kho nhiều hơn tồn, diện tích ≤ 0) |
| 500 | Lỗi máy chủ — ghi log kèm `request_id`, **không** trả chi tiết nội bộ ra ngoài |

Thông điệp lỗi trả cho ứng dụng di động phải là tiếng Việt, viết cho nông hộ
đọc, không phải cho lập trình viên.

---

## 6. Kiểm thử

**Lưới an toàn có sẵn: 130 test trong `backend/tests/`.** Với hướng B, chuẩn
"xong" là port hết số test này sang Django và chạy xanh — không phải viết bộ
test mới rồi tự tuyên bố đạt.

- Đơn vị: ràng buộc model, quy tắc nghiệp vụ (tồn kho, lãi lỗ, quy đổi diện tích).
- Tích hợp: endpoint + CSDL thật, không mock ORM.
- Đồng bộ: pull/push, xoá mềm, xung đột hai thiết bị, đẩy khi offline lâu.
- Phân quyền: nông hộ A không đọc/ghi được dữ liệu nông hộ B; nông hộ không tạo được lô.
- Toàn vẹn dữ liệu tĩnh: mỗi giống phải có `source`, mỗi loại con phải có quy
  trình hoặc được khai báo "chưa có dữ liệu" (`test_static_data.py`).
- Tải: 100 người dùng đồng thời, 1.000 lô. Đo riêng `/sync` vì đây là endpoint
  nặng nhất và chạy mỗi lần mở ứng dụng.

---

## 7. Triển khai

- [ ] PostgreSQL: tạo CSDL, chạy Alembic (hướng A) hoặc `migrate` (hướng B)
- [ ] Biến môi trường trong `.env.production`: `DATABASE_URL`, `SECRET_KEY`,
      `CORS_ORIGINS`, `SEED_FARMER_PASSWORD`. **Không commit file này.**
- [ ] Đổi mọi mật khẩu demo trước khi mở ra ngoài (`matkhau123`, `admin123`)
- [ ] `DEBUG=False`, `ALLOWED_HOSTS` đúng tên miền
- [ ] HTTPS bắt buộc — token Bearer đi qua HTTP là lộ
- [ ] Tài liệu API: OpenAPI (FastAPI có sẵn `/docs`; Django cần `drf-spectacular`)
- [ ] Sao lưu CSDL định kỳ, và **thử phục hồi một lần** trước khi chạy thật
- [ ] Giám sát: tỷ lệ lỗi, thời gian phản hồi `/sync`, dung lượng CSDL

---

## 8. Tiến độ

### Tuần 2
- [ ] Chốt hướng A / B / C ở mục 0 — **làm trước mọi thứ khác**
- [ ] PostgreSQL + migration chạy được ở môi trường staging
- [ ] Khoá `POST /plots` về vai admin, chặn `plots.created` trong push (mục 3)
- [ ] Thêm test phân quyền cho hai việc trên

### Tuần 3
- [ ] `POST /auth/logout` (chốt cách thu hồi token trước khi code)
- [ ] Đo và tối ưu `/sync` khi dữ liệu lớn: đánh chỉ mục `(owner_id, updated_at)`
- [ ] Test tải, sửa những chỗ chậm mà test chỉ ra

### Tuần 4
- [ ] Tài liệu API sinh tự động, xuất bản cho người dùng API
- [ ] Cấu hình sản xuất, sao lưu, giám sát
- [ ] Diễn tập triển khai trên staging, gồm một lần phục hồi từ bản sao lưu
- [ ] Sẵn sàng chạy thật

---

## Ba điều không được đánh đổi

1. **Không bịa số liệu nông học.** Mọi giống và mọi định mức phải có `source`.
   Không có nguồn thì hiện "chưa có dữ liệu", không suy diễn từ cây khác.
2. **Ứng dụng phải dùng được khi mất mạng.** Máy chủ không bao giờ nằm trên
   đường đi của một thao tác ghi chép. Ghi vào máy trước, đồng bộ sau.
3. **Không nuốt xung đột.** Nông hộ phải được biết và được chọn khi hai máy ghi
   khác nhau trên cùng một bản ghi.
