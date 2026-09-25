# Danh sách endpoint — AgriLog v2 API

Sinh tự động từ `backend/scripts/export_openapi.py` — phiên bản 0.1.0.
Đừng sửa tay file này; sửa docstring của endpoint rồi chạy lại script.

Tổng cộng **81 endpoint**. Đặc tả đầy đủ: `docs/api/openapi.json`,
hoặc mở `/docs` khi máy chủ đang chạy.

| Phương thức | Đường dẫn | Nhóm | Quyền | Mô tả |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/change-password` | auth | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Change Password |
| `POST` | `/auth/login` | auth | công khai (giới hạn 5 lần sai/phút) | Login |
| `GET` | `/auth/me` | auth | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Read Me |
| `PATCH` | `/auth/me` | auth | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Me |
| `GET` | `/care-guides` | care-guides | đã đăng nhập (bản nháp: chỉ quản trị viên) | List Guides |
| `POST` | `/care-guides` | care-guides | **chỉ quản trị viên** | Create Guide |
| `GET` | `/care-guides/{guide_id}` | care-guides | đã đăng nhập (bản nháp: chỉ quản trị viên) | Get Guide |
| `PATCH` | `/care-guides/{guide_id}` | care-guides | **chỉ quản trị viên** | Update Guide |
| `DELETE` | `/care-guides/{guide_id}` | care-guides | **chỉ quản trị viên** | Delete Guide |
| `POST` | `/care-guides/{guide_id}/upload-image` | care-guides | **chỉ quản trị viên** | Upload Guide Image |
| `GET` | `/care-protocols` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Care Protocols |
| `GET` | `/crop-varieties` | crop-varieties | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Varieties |
| `POST` | `/crop-varieties` | crop-varieties | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Variety |
| `PATCH` | `/crop-varieties/{variety_id}` | crop-varieties | **chỉ quản trị viên** | Review Variety |
| `DELETE` | `/crop-varieties/{variety_id}` | crop-varieties | **chỉ quản trị viên** | Reject Variety |
| `GET` | `/crops/{crop_type}/care-guides` | care-guides | đã đăng nhập (bản nháp: chỉ quản trị viên) | Guides For Crop |
| `PATCH` | `/cultivation-history/{cycle_id}` | cultivation | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Cultivation |
| `DELETE` | `/cultivation-history/{cycle_id}` | cultivation | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Cultivation |
| `GET` | `/dashboard/summary` | dashboard | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Dashboard Summary |
| `GET` | `/expense` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Expense |
| `POST` | `/expense` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Expense |
| `PATCH` | `/expense/{row_id}` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Expense |
| `DELETE` | `/expense/{row_id}` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Expense |
| `PATCH` | `/expense/{row_id}/checked` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Set Expense Checked |
| `POST` | `/fertilizer-prices` | fertilizer-prices | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Price |
| `GET` | `/fertilizer-prices/history/{fertilizer_id}` | fertilizer-prices | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Get Price History |
| `GET` | `/fertilizer-prices/latest` | fertilizer-prices | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Get Latest Prices |
| `GET` | `/health` | health | công khai | Health |
| `GET` | `/income` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Income |
| `POST` | `/income` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Income |
| `PATCH` | `/income/{row_id}` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Income |
| `DELETE` | `/income/{row_id}` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Income |
| `PATCH` | `/income/{row_id}/checked` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Set Income Checked |
| `PATCH` | `/labor-costs/{cost_id}` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Labor Cost |
| `DELETE` | `/labor-costs/{cost_id}` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Labor Cost |
| `POST` | `/logs` | ops | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Post Logs |
| `GET` | `/logs` | ops | **chỉ quản trị viên** | List Logs |
| `POST` | `/media` | media | đã đăng nhập (`public=true`: chỉ quản trị viên) | Upload Media |
| `POST` | `/media/token` | media | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Media Token |
| `GET` | `/media/{media_id}` | media | ảnh công khai: ai cũng xem; ảnh riêng: chủ hoặc quản trị viên (header hoặc `?t=`) | Get Media |
| `DELETE` | `/media/{media_id}` | media | chủ tệp hoặc quản trị viên | Delete Media |
| `GET` | `/plans` | plans | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Plans |
| `POST` | `/plans` | plans | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Plan |
| `PATCH` | `/plans/{plan_id}` | plans | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Plan |
| `DELETE` | `/plans/{plan_id}` | plans | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Plan |
| `GET` | `/plots` | plots | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Plots |
| `POST` | `/plots` | plots | **chỉ quản trị viên** | Create Plot |
| `GET` | `/plots/{plot_id}` | plots | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Get Plot |
| `PATCH` | `/plots/{plot_id}` | plots | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Plot |
| `DELETE` | `/plots/{plot_id}` | plots | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Plot |
| `GET` | `/plots/{plot_id}/cost-summary` | cultivation | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Plot Cost Summary |
| `GET` | `/plots/{plot_id}/cultivation-history` | cultivation | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Cultivation |
| `POST` | `/plots/{plot_id}/cultivation-history` | cultivation | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Cultivation |
| `GET` | `/plots/{plot_id}/recommend-crops` | cultivation | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Recommend Crops |
| `GET` | `/reports/financials` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Financials |
| `GET` | `/reports/financials.csv` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Financials Csv |
| `GET` | `/reports/financials.pdf` | finance | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Financials Pdf |
| `GET` | `/sync` | sync | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Pull |
| `POST` | `/sync` | sync | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Push |
| `DELETE` | `/task-notes/{note_id}` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Note |
| `GET` | `/tasks-history` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Tasks History |
| `GET` | `/tasks-history/{task_id}/labor-costs` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Labor Costs |
| `POST` | `/tasks-history/{task_id}/labor-costs` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Labor Cost |
| `GET` | `/tasks-history/{task_id}/notes` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Notes |
| `POST` | `/tasks-history/{task_id}/notes` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Note |
| `POST` | `/tasks-history/{task_id}/notes/{note_id}/upload-media` | care-protocols | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Upload Note Media |
| `GET` | `/users` | ops | **chỉ quản trị viên** | List Users |
| `POST` | `/users` | ops | **chỉ quản trị viên** | Create User |
| `GET` | `/users/version` | ops | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | App Version |
| `PATCH` | `/users/{user_id}/status` | ops | **chỉ quản trị viên** | Update User Status |
| `GET` | `/warehouse/check` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Warehouse Check |
| `GET` | `/warehouse/in` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Warehouse In |
| `POST` | `/warehouse/in` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Warehouse In |
| `PATCH` | `/warehouse/in/{row_id}` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Warehouse In |
| `DELETE` | `/warehouse/in/{row_id}` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Warehouse In |
| `GET` | `/warehouse/out` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | List Warehouse Out |
| `POST` | `/warehouse/out` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Create Warehouse Out |
| `PATCH` | `/warehouse/out/{row_id}` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Update Warehouse Out |
| `DELETE` | `/warehouse/out/{row_id}` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Delete Warehouse Out |
| `GET` | `/warehouse/summary` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Warehouse Summary |
| `GET` | `/warehouse/summary.csv` | warehouse | đã đăng nhập (chỉ thấy dữ liệu của chính mình) | Warehouse Summary Csv |

## Ghi chú

* Mọi endpoint ngoài `/health` và `/auth/login` đều cần header
  `Authorization: Bearer <token>`.
* `GET /sync` và `POST /sync` là hợp đồng WatermelonDB: kéo theo
  `last_pulled_at` (epoch ms), đẩy theo lô `{bảng: {created, updated, deleted}}`.
* `POST /sync` trả thêm `conflicts` (bản máy chủ giữ lại) và `rejected`
  (bản máy chủ từ chối, kèm lý do), và header `X-Conflict-Resolution`.
* Nông hộ không tạo được lô đất — cả qua `POST /plots` lẫn qua `POST /sync`.
* Qua `POST /sync`, một bản ghi chỉ được sửa/xoá bởi chủ của nó (hoặc quản trị viên);
  bảng `care_guides` chỉ quản trị viên ghi. Bản bị từ chối có `reason`
  `not_owner` / `admin_only_write` / `admin_only_create`.
* `GET /sync?migration=...` (migration sync): lần kéo đầu sau khi điện thoại nâng
  schema, máy chủ gửi lại nguyên các bảng mới/được thêm cột. Triển khai máy chủ
  trước bản app có schema mới.
* Ảnh/video riêng xem qua `?t=<token>` từ `POST /media/token` (6 giờ, chỉ mở
  được `/media`, không dùng thay đăng nhập được).
