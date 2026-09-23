"""Kiểm tải: 100 nông hộ đồng thời kéo và đẩy dữ liệu.

    python -m scripts.loadtest --base-url http://127.0.0.1:8000 --users 100

Mục tiêu nghiệm thu (Giai đoạn 5): 100 người dùng đồng thời, p95 dưới 1 giây, và
**không mất bản ghi** — số dòng đẩy lên phải bằng số dòng kéo về.

Vì sao đo p95 chứ không đo trung bình: trung bình che mất đúng thứ người dùng
cảm nhận. Chín mươi lăm phần trăm yêu cầu nhanh hơn con số này; nếu p95 là 1,2
giây thì cứ 20 lần đồng bộ lại có một lần nông hộ phải đứng chờ ngoài nắng.

Hai kiểu kéo dữ liệu được đo riêng, vì chúng khác nhau một trời một vực:

* **đồng bộ đầu** (`last_pulled_at` = 24 giờ trước) kéo cả danh mục giống và
  toàn bộ lịch sử của nông hộ — nặng, nhưng mỗi máy chỉ gặp một lần sau khi cài;
* **đồng bộ gia tăng** (60 giây trước) chỉ kéo phần vừa đổi — đây mới là thứ
  điện thoại chạy vài phút một lần, suốt ngày.

Gộp hai thứ này vào một con số sẽ ra một kết quả không mô tả đúng cái gì cả.

Script chỉ dùng httpx và thư viện chuẩn — không cần cài thêm gì so với môi
trường chạy test.
"""

import argparse
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import httpx


# Bảng điều khiển Windows mặc định dùng cp1252, không in được tiếng Việt.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class Result:
    label: str
    durations: list[float] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def add(self, seconds: float) -> None:
        self.durations.append(seconds * 1000)

    @property
    def p95(self) -> float:
        if not self.durations:
            return 0.0
        ordered = sorted(self.durations)
        return ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]

    def line(self) -> str:
        if not self.durations:
            return f"{self.label:<26} không có yêu cầu nào thành công"
        return (
            f"{self.label:<26}"
            f"n={len(self.durations):<5}"
            f"trung vị={statistics.median(self.durations):>7.0f}ms  "
            f"p95={self.p95:>7.0f}ms  "
            f"chậm nhất={max(self.durations):>7.0f}ms  "
            f"lỗi={len(self.errors)}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=100, help="số người dùng đồng thời")
    parser.add_argument("--rows", type=int, default=10, help="số bản ghi mỗi lần đẩy")
    parser.add_argument("--username", default="thaitaka")
    parser.add_argument("--password", default="matkhau123")
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument(
        "--budget-ms", type=float, default=1000.0, help="ngưỡng p95 coi là đạt"
    )
    return parser.parse_args()


def income_row(record_id: str, stamp: int) -> dict:
    return {
        "id": record_id,
        "kind": "product",
        "description": "Kiểm tải",
        "amount": 100_000.0,
        "occurred_at": stamp,
        "note": None,
        "plot_id": None,
        "checked": False,
        "owner_id": "server-quyet-dinh",
        "updated_by": "loadtest",
        "created_at": stamp,
        "updated_at": stamp,
    }


def login(base_url: str, username: str, password: str, timeout: float) -> str:
    res = httpx.post(
        f"{base_url}/auth/login",
        json={"username": username, "password": password},
        timeout=timeout,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def run(args: argparse.Namespace) -> int:
    token = login(args.base_url, args.username, args.password, args.timeout)
    headers = {"Authorization": f"Bearer {token}"}

    plots_read = Result("GET /plots")
    sync_pull = Result("GET /sync (đồng bộ đầu)")
    sync_delta = Result("GET /sync (gia tăng)")
    sync_push = Result("POST /sync")
    results = (plots_read, sync_pull, sync_delta, sync_push)
    pushed_ids: set[str] = set()

    def one_user(index: int) -> None:
        stamp = int(time.time() * 1000)
        with httpx.Client(base_url=args.base_url, headers=headers, timeout=args.timeout) as client:
            for result, call in (
                (plots_read, lambda: client.get("/plots")),
                (sync_pull, lambda: client.get("/sync", params={"last_pulled_at": stamp - 86_400_000})),
                (sync_delta, lambda: client.get("/sync", params={"last_pulled_at": stamp - 60_000})),
            ):
                started = time.perf_counter()
                try:
                    res = call()
                    res.raise_for_status()
                    result.add(time.perf_counter() - started)
                except Exception as exc:  # noqa: BLE001 — mọi lỗi đều là lỗi tải
                    result.errors.append(f"{exc.__class__.__name__}: {exc}")

            rows = [income_row(str(uuid.uuid4()), stamp) for _ in range(args.rows)]
            started = time.perf_counter()
            try:
                res = client.post(
                    "/sync",
                    json={"income": {"created": rows, "updated": [], "deleted": []}},
                )
                res.raise_for_status()
                sync_push.add(time.perf_counter() - started)
                if res.json()["applied"]["created"] == len(rows):
                    pushed_ids.update(r["id"] for r in rows)
            except Exception as exc:  # noqa: BLE001
                sync_push.errors.append(f"{exc.__class__.__name__}: {exc}")

    print(f"Kiểm tải {args.base_url} — {args.users} người dùng đồng thời, {args.rows} dòng/lần đẩy\n")
    wall_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.users) as pool:
        list(pool.map(one_user, range(args.users)))
    wall = time.perf_counter() - wall_start

    # Không mất dữ liệu: mọi dòng đã đẩy phải kéo về được.
    with httpx.Client(base_url=args.base_url, headers=headers, timeout=args.timeout) as client:
        pulled = client.get("/sync", params={"last_pulled_at": 1}).json()
    income = pulled["changes"]["income"]
    on_server = {r["id"] for r in income["created"] + income["updated"]}
    missing = pushed_ids - on_server

    print("\n".join(r.line() for r in results))
    print(f"\ntổng thời gian: {wall:.1f}s")
    print(f"đã đẩy: {len(pushed_ids)} dòng — thiếu khi kéo về: {len(missing)}")

    failures: list[str] = []
    for result in results:
        if result.errors:
            failures.append(f"{result.label}: {len(result.errors)} lỗi ({result.errors[0]})")
        if result.p95 > args.budget_ms:
            failures.append(f"{result.label}: p95 {result.p95:.0f}ms > {args.budget_ms:.0f}ms")
    if missing:
        failures.append(f"mất {len(missing)} dòng dữ liệu")

    if failures:
        print("\nKHÔNG ĐẠT:\n  - " + "\n  - ".join(failures))
        return 1

    print("\nĐẠT: p95 dưới ngưỡng, không lỗi, không mất dữ liệu.")
    return 0


if __name__ == "__main__":
    sys.exit(run(parse_args()))
