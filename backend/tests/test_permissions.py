"""Quyền trên lô đất: ai được tạo, ai chỉ được xem và sửa.

Lô đất là mảnh ruộng đã được đo, đánh mã và giao — nông hộ nhận lô chứ không tự
nghĩ ra lô. Ứng dụng điện thoại đã bỏ nút "thêm lô" (ea4dce2), nhưng nút bị ẩn
không phải là quyền bị chặn: nếu máy chủ vẫn nhận `POST /plots` thì bất kỳ ai có
token cũng tạo được lô bằng một dòng curl. Các test dưới đây khoá cửa đó.

Nông hộ vẫn sửa được lô của mình: người biết ruộng trồng gì và trồng từ bao giờ
chính là họ, và đó mới là dữ liệu ứng dụng cần.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


def login(username: str, password: str) -> dict[str, str]:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="module")
def farmer() -> dict[str, str]:
    return login(settings.seed_farmer_username, settings.seed_farmer_password)


@pytest.fixture(scope="module")
def admin() -> dict[str, str]:
    return login(settings.seed_admin_username, settings.seed_admin_password)


def me(headers: dict[str, str]) -> dict:
    return client.get("/auth/me", headers=headers).json()


def plot_body(**overrides) -> dict:
    body = {
        "code": f"PUC-{uuid.uuid4().hex[:6].upper()}",
        "name": "Lô kiểm thử quyền",
        "region": "Xã Hoà Bình",
        "area": 500.0,
        "area_unit": "m2",
        "crop_type": "tomato",
        "crop_name": "Cà chua",
    }
    body.update(overrides)
    return body


# ------------------------------ tạo lô đất -------------------------------


def test_farmer_cannot_create_a_plot(farmer):
    res = client.post("/plots", headers=farmer, json=plot_body())
    assert res.status_code == 403
    assert "quản trị" in res.json()["detail"].lower()


def test_unauthenticated_cannot_create_a_plot():
    assert client.post("/plots", json=plot_body()).status_code == 401


def test_admin_creates_a_plot_and_assigns_it_to_a_farmer(admin, farmer):
    owner_id = me(farmer)["id"]
    res = client.post("/plots", headers=admin, json=plot_body(owner_id=owner_id))
    assert res.status_code == 201
    created = res.json()
    assert created["owner_id"] == owner_id
    assert created["updated_by"] == me(admin)["id"], "ghi lại ai là người giao lô"

    # Và lô xuất hiện trong danh sách của đúng nông hộ đó.
    codes = {p["code"] for p in client.get("/plots", headers=farmer).json()}
    assert created["code"] in codes


def test_admin_creating_without_owner_keeps_the_plot_for_themselves(admin):
    res = client.post("/plots", headers=admin, json=plot_body())
    assert res.status_code == 201
    assert res.json()["owner_id"] == me(admin)["id"]


def test_admin_cannot_assign_a_plot_to_an_unknown_account(admin):
    res = client.post("/plots", headers=admin, json=plot_body(owner_id="khong-co-that"))
    assert res.status_code == 404


def test_admin_cannot_assign_a_plot_to_a_locked_account(admin):
    new_user = client.post(
        "/users",
        headers=admin,
        json={
            "username": f"nongho_{uuid.uuid4().hex[:8]}",
            "password": "matkhau123",
            "full_name": "Nông hộ đã khoá",
        },
    )
    assert new_user.status_code == 201, new_user.text
    user_id = new_user.json()["id"]
    locked = client.patch(f"/users/{user_id}/status", headers=admin, json={"is_active": False})
    assert locked.status_code == 200

    res = client.post("/plots", headers=admin, json=plot_body(owner_id=user_id))
    assert res.status_code == 400


# --------------------------- sửa và xem lô đất ----------------------------


def test_farmer_can_still_edit_the_plot_they_were_given(admin, farmer):
    owner_id = me(farmer)["id"]
    plot = client.post("/plots", headers=admin, json=plot_body(owner_id=owner_id)).json()

    res = client.patch(
        f"/plots/{plot['id']}",
        headers=farmer,
        json={"crop_name": "Dưa leo", "notes": "Đã xuống giống 12/3"},
    )
    assert res.status_code == 200
    assert res.json()["crop_name"] == "Dưa leo"


def test_farmer_cannot_touch_another_farmers_plot(admin, farmer):
    """404 chứ không phải 403: nông hộ không cần biết lô đó có tồn tại hay không."""
    admin_plot = client.post("/plots", headers=admin, json=plot_body()).json()

    assert client.get(f"/plots/{admin_plot['id']}", headers=farmer).status_code == 404
    assert client.patch(
        f"/plots/{admin_plot['id']}", headers=farmer, json={"name": "Đổi trộm"}
    ).status_code == 404


def test_listing_plots_requires_a_token():
    assert client.get("/plots").status_code == 401
