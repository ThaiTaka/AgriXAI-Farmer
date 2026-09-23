"""Một lần đẩy đồng bộ là một giao dịch: được cả, hoặc không được gì.

Tình huống thật: nông hộ ghi chép cả buổi sáng ngoài đồng, về tới chỗ có sóng
thì điện thoại đẩy một lượt vài chục bản ghi. Nếu một bản ghi hỏng mà máy chủ
vẫn lưu những bản trước nó, điện thoại sẽ không biết phần nào đã lên: gửi lại
thì trùng, không gửi lại thì mất. Cả hai đều tệ hơn là báo lỗi và giữ nguyên
hiện trạng để gửi lại nguyên lô.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


@pytest.fixture(scope="module")
def token() -> str:
    res = client.post(
        "/auth/login",
        json={
            "username": settings.seed_farmer_username,
            "password": settings.seed_farmer_password,
        },
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def income_row(record_id: str, description: str, *, amount: float = 500_000.0) -> dict:
    return {
        "id": record_id,
        "kind": "product",
        "description": description,
        "amount": amount,
        "occurred_at": 1_700_000_000_000,
        "note": None,
        "plot_id": None,
        "checked": False,
        "owner_id": "ignored-by-server",
        "updated_by": "device",
        "created_at": 1_700_000_000_000,
        "updated_at": 1_700_000_000_000,
    }


def test_a_broken_row_rolls_the_whole_batch_back(token: str):
    good_id = str(uuid.uuid4())
    broken_id = str(uuid.uuid4())

    broken = income_row(broken_id, "Thiếu số tiền")
    del broken["amount"]  # cột NOT NULL — hàng này không thể lưu

    res = client.post(
        "/sync",
        headers=auth(token),
        json={"income": {"created": [income_row(good_id, "Bán cà chua"), broken], "updated": [], "deleted": []}},
    )

    # 422 chứ không phải 500: lô dữ liệu là thứ máy khách sửa được rồi gửi lại.
    assert res.status_code == 422

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    saved = pulled.json()["changes"]["income"]
    ids = {r["id"] for r in saved["created"] + saved["updated"]}
    assert good_id not in ids, "bản ghi hợp lệ trong cùng lô cũng không được lưu"
    assert broken_id not in ids


def test_resending_the_fixed_batch_works(token: str):
    """Sau khi máy khách sửa bản ghi hỏng, gửi lại nguyên lô phải thành công —
    đây chính là lý do việc quay lui phải sạch."""
    first_id = str(uuid.uuid4())
    second_id = str(uuid.uuid4())

    broken = income_row(second_id, "Hàng hỏng")
    del broken["amount"]
    failed = client.post(
        "/sync",
        headers=auth(token),
        json={"income": {"created": [income_row(first_id, "Bán ớt"), broken], "updated": [], "deleted": []}},
    )
    assert failed.status_code == 422

    fixed = client.post(
        "/sync",
        headers=auth(token),
        json={
            "income": {
                "created": [income_row(first_id, "Bán ớt"), income_row(second_id, "Bán dưa")],
                "updated": [],
                "deleted": [],
            }
        },
    )
    assert fixed.status_code == 200
    assert fixed.json()["applied"]["created"] == 2


def test_push_advertises_its_conflict_strategy(token: str):
    """Chiến lược xử lý xung đột phải đọc được từ chính phản hồi, không phải từ
    tài liệu đâu đó — người đọc log hay người tích hợp mới đều thấy ngay."""
    res = client.post(
        "/sync",
        headers=auth(token),
        json={"income": {"created": [], "updated": [], "deleted": []}},
    )
    assert res.status_code == 200
    assert res.headers["X-Conflict-Resolution"] == "last-write-wins-logged"
