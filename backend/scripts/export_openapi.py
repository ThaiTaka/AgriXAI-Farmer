"""Xuất đặc tả OpenAPI ra file, kèm một bảng endpoint đọc được bằng mắt.

    python -m scripts.export_openapi

Ghi hai file:
  * `docs/api/openapi.json` — nhập được vào Postman, Insomnia, hoặc sinh client.
  * `docs/API_ENDPOINTS.md` — bảng liệt kê toàn bộ endpoint kèm quyền truy cập.

Vì sao cần bản xuất ra file khi đã có `/docs`: `/docs` chỉ xem được khi máy chủ
đang chạy. Bản trong repo thì đọc được lúc review, so sánh được giữa hai commit,
và là thứ mang đi bảo vệ đồ án khi không có mạng.

Chạy lại sau mỗi lần thêm hoặc đổi endpoint.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from fastapi.routing import APIRoute  # noqa: E402

from app.main import app  # noqa: E402
from app.services.auth_service import current_admin  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = REPO_ROOT / "docs" / "api" / "openapi.json"
MD_OUT = REPO_ROOT / "docs" / "API_ENDPOINTS.md"

# Quyền không nằm trong đặc tả OpenAPI (nó là logic trong dependency). Endpoint
# chỉ dành cho quản trị viên được nhận ra tự động qua dependency `current_admin`
# (xem `_admin_only_routes`) — bảng ghi tay từng bỏ sót POST /fertilizer-prices
# và ghi nó là "đã đăng nhập". Bảng dưới chỉ còn những quyền có sắc thái mà
# dependency không nói được.
ADMIN_ONLY = "**chỉ quản trị viên**"
ACCESS = {
    ("POST", "/auth/login"): "công khai (giới hạn 5 lần sai/phút)",
    ("GET", "/health"): "công khai",
    ("GET", "/care-guides"): "đã đăng nhập (bản nháp: chỉ quản trị viên)",
    ("GET", "/care-guides/{guide_id}"): "đã đăng nhập (bản nháp: chỉ quản trị viên)",
    ("GET", "/crops/{crop_type}/care-guides"): "đã đăng nhập (bản nháp: chỉ quản trị viên)",
    ("POST", "/media"): "đã đăng nhập (`public=true`: chỉ quản trị viên)",
    ("GET", "/media/{media_id}"): "ảnh công khai: ai cũng xem; ảnh riêng: chủ hoặc quản trị viên (header hoặc `?t=`)",
    ("DELETE", "/media/{media_id}"): "chủ tệp hoặc quản trị viên",
}
DEFAULT_ACCESS = "đã đăng nhập (chỉ thấy dữ liệu của chính mình)"


def _depends_on(dependant, target) -> bool:
    return any(d.call is target or _depends_on(d, target) for d in dependant.dependencies)


def _admin_only_routes() -> set[tuple[str, str]]:
    """(METHOD, path) of every route that requires `current_admin`."""
    return {
        (method, route.path)
        for route in app.routes
        if isinstance(route, APIRoute) and _depends_on(route.dependant, current_admin)
        for method in route.methods
    }


def main() -> int:
    spec = app.openapi()

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")

    rows: list[tuple[str, str, str, str]] = []
    for path, operations in sorted(spec["paths"].items()):
        for method, operation in operations.items():
            verb = method.upper()
            summary = (operation.get("summary") or "").strip()
            if not summary:
                summary = (operation.get("description") or "").strip().split("\n")[0]
            tag = (operation.get("tags") or ["-"])[0]
            rows.append((verb, path, tag, summary))

    lines = [
        "# Danh sách endpoint — AgriLog v2 API",
        "",
        f"Sinh tự động từ `backend/scripts/export_openapi.py` — phiên bản {spec['info']['version']}.",
        "Đừng sửa tay file này; sửa docstring của endpoint rồi chạy lại script.",
        "",
        f"Tổng cộng **{len(rows)} endpoint**. Đặc tả đầy đủ: `docs/api/openapi.json`,",
        "hoặc mở `/docs` khi máy chủ đang chạy.",
        "",
        "| Phương thức | Đường dẫn | Nhóm | Quyền | Mô tả |",
        "| --- | --- | --- | --- | --- |",
    ]
    admin_only = _admin_only_routes()
    for verb, path, tag, summary in rows:
        access = ACCESS.get((verb, path)) or (ADMIN_ONLY if (verb, path) in admin_only else DEFAULT_ACCESS)
        lines.append(f"| `{verb}` | `{path}` | {tag} | {access} | {summary} |")

    lines += [
        "",
        "## Ghi chú",
        "",
        "* Mọi endpoint ngoài `/health` và `/auth/login` đều cần header",
        "  `Authorization: Bearer <token>`.",
        "* `GET /sync` và `POST /sync` là hợp đồng WatermelonDB: kéo theo",
        "  `last_pulled_at` (epoch ms), đẩy theo lô `{bảng: {created, updated, deleted}}`.",
        "* `POST /sync` trả thêm `conflicts` (bản máy chủ giữ lại) và `rejected`",
        "  (bản máy chủ từ chối, kèm lý do), và header `X-Conflict-Resolution`.",
        "* Nông hộ không tạo được lô đất — cả qua `POST /plots` lẫn qua `POST /sync`.",
        "* Qua `POST /sync`, một bản ghi chỉ được sửa/xoá bởi chủ của nó (hoặc quản trị viên);",
        "  bảng `care_guides` chỉ quản trị viên ghi. Bản bị từ chối có `reason`",
        "  `not_owner` / `admin_only_write` / `admin_only_create`.",
        "* `GET /sync?migration=...` (migration sync): lần kéo đầu sau khi điện thoại nâng",
        "  schema, máy chủ gửi lại nguyên các bảng mới/được thêm cột. Triển khai máy chủ",
        "  trước bản app có schema mới.",
        "* Ảnh/video riêng xem qua `?t=<token>` từ `POST /media/token` (6 giờ, chỉ mở",
        "  được `/media`, không dùng thay đăng nhập được).",
    ]

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"{len(rows)} endpoint")
    print(f"  {JSON_OUT.relative_to(REPO_ROOT)}")
    print(f"  {MD_OUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
