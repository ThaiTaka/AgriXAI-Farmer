"""Đồng bộ chỉ mang về dữ liệu của chính nông hộ đó.

Lỗi được phát hiện khi kiểm tải Giai đoạn 5: bảng `change_logs` bị xếp vào
nhóm "dùng chung" như danh mục giống, nên mỗi lần kéo dữ liệu, điện thoại của
một hộ tải về nhật ký chỉnh sửa của *mọi* hộ khác trong hệ thống — "Nguyễn Văn
Anh sửa diện tích 800 -> 1200" hiện trên máy người không liên quan. Hai hậu quả:

1. Lộ dữ liệu giữa các hộ. Nhật ký ghi ai sửa gì, lúc nào, trên lô nào.
2. Gói đồng bộ phình theo lịch sử của cả hệ thống chứ không theo một nông hộ,
   nên càng nhiều người dùng thì đồng bộ càng chậm cho tất cả.

Danh mục giống thì ngược lại — cố tình dùng chung, vì giống một hộ khai báo là
thứ hộ khác cần thấy.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed
from app.seed_demo import DEMO_PASSWORD

run_seed()
client = TestClient(app)


def login(username: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="module")
def thai() -> dict[str, str]:
    return login("lethanhthai")


@pytest.fixture(scope="module")
def anh() -> dict[str, str]:
    return login("nguyenvananh")


def me(headers: dict[str, str]) -> dict:
    return client.get("/auth/me", headers=headers).json()


def change_log_row(record_id: str, note: str, author_id: str) -> dict:
    stamp = 1_700_000_000_000
    return {
        "id": record_id,
        "table_name": "plots",
        "record_id": "lo-nao-do",
        "action": "update",
        "field": "area",
        "old_value": "800",
        "new_value": note,
        "changed_by": author_id,
        "changed_by_name": "Máy điện thoại",
        "changed_at": stamp,
        "created_at": stamp,
        "updated_at": stamp,
    }


def pull(headers: dict[str, str], table: str) -> list[dict]:
    body = client.get("/sync", params={"last_pulled_at": 1}, headers=headers).json()
    rows = body["changes"][table]
    return rows["created"] + rows["updated"]


def test_a_farmer_never_pulls_another_farms_audit_trail(thai, anh):
    record_id = str(uuid.uuid4())
    res = client.post(
        "/sync",
        headers=thai,
        json={"change_logs": {"created": [change_log_row(record_id, "1200", me(thai)["id"])], "updated": [], "deleted": []}},
    )
    assert res.status_code == 200
    assert res.json()["applied"]["created"] == 1

    assert record_id in {r["id"] for r in pull(thai, "change_logs")}
    assert record_id not in {r["id"] for r in pull(anh, "change_logs")}


def test_the_server_decides_who_wrote_an_audit_row(thai, anh):
    """Máy khách gửi `changed_by` của người khác — máy chủ phải ghi đè bằng
    tài khoản đang đăng nhập, nếu không thì chỉ cần sửa một trường là ghi được
    nhật ký giả vào máy người khác."""
    record_id = str(uuid.uuid4())
    forged = change_log_row(record_id, "9999", me(anh)["id"])

    res = client.post(
        "/sync",
        headers=thai,
        json={"change_logs": {"created": [forged], "updated": [], "deleted": []}},
    )
    assert res.status_code == 200

    saved = next(r for r in pull(thai, "change_logs") if r["id"] == record_id)
    assert saved["changed_by"] == me(thai)["id"], "tác giả là người đang đăng nhập"
    assert record_id not in {r["id"] for r in pull(anh, "change_logs")}


def test_the_variety_catalogue_stays_shared(thai, anh):
    """Ngược lại với nhật ký: giống cây là của chung, một hộ khai báo thì hộ
    khác phải thấy — đây là điều kiện để danh mục giống lớn dần lên."""
    variety_id = str(uuid.uuid4())
    res = client.post(
        "/crop-varieties",
        headers=thai,
        json={
            "id": variety_id,
            "name": f"Giống thử {variety_id[:6]}",
            "crop_type": "tomato",
            "crop_name": "Cà chua",
        },
    )
    assert res.status_code == 201, res.text

    assert variety_id in {r["id"] for r in pull(anh, "crop_varieties")}


def test_ledger_rows_stay_with_their_farm(thai, anh):
    record_id = str(uuid.uuid4())
    stamp = 1_700_000_000_000
    row = {
        "id": record_id,
        "kind": "product",
        "description": "Bán cà chua",
        "amount": 2_000_000.0,
        "occurred_at": stamp,
        "note": None,
        "plot_id": None,
        "checked": False,
        "owner_id": me(anh)["id"],  # máy khách khai của người khác
        "updated_by": "device",
        "created_at": stamp,
        "updated_at": stamp,
    }
    res = client.post(
        "/sync",
        headers=thai,
        json={"income": {"created": [row], "updated": [], "deleted": []}},
    )
    assert res.status_code == 200

    assert record_id in {r["id"] for r in pull(thai, "income")}
    assert record_id not in {r["id"] for r in pull(anh, "income")}
