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

from app.main import app  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = REPO_ROOT / "docs" / "api" / "openapi.json"
MD_OUT = REPO_ROOT / "docs" / "API_ENDPOINTS.md"

# Quyền không nằm trong đặc tả OpenAPI (nó là logic trong dependency), nên ghi
# ra đây để bảng endpoint nói được điều người đọc thật sự cần biết: ai gọi được.
ACCESS = {
    ("POST", "/auth/login"): "công khai (giới hạn 5 lần sai/phút)",
    ("GET", "/health"): "công khai",
    ("POST", "/plots"): "**chỉ quản trị viên**",
    ("PATCH", "/crop-varieties/{variety_id}"): "**chỉ quản trị viên**",
    ("DELETE", "/crop-varieties/{variety_id}"): "**chỉ quản trị viên**",
    ("GET", "/logs"): "**chỉ quản trị viên**",
    ("GET", "/users"): "**chỉ quản trị viên**",
    ("POST", "/users"): "**chỉ quản trị viên**",
    ("PATCH", "/users/{user_id}/status"): "**chỉ quản trị viên**",
}
DEFAULT_ACCESS = "đã đăng nhập (chỉ thấy dữ liệu của chính mình)"


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
    for verb, path, tag, summary in rows:
        access = ACCESS.get((verb, path), DEFAULT_ACCESS)
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
    ]

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"{len(rows)} endpoint")
    print(f"  {JSON_OUT.relative_to(REPO_ROOT)}")
    print(f"  {MD_OUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
