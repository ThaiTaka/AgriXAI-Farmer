"""Task 2 — admin-only sửa/xoá cho thu chi, kho vật tư và kế hoạch vụ mùa.

Web-admin cần sửa/xoá hộ dữ liệu cho nông hộ khi có khiếu nại hoặc nhập nhầm;
điện thoại vẫn đồng bộ qua /sync như cũ. Mọi bản ghi test dùng ở đây thuộc về
một nông hộ "chuột bạch" tạo riêng cho file này — không phải nông hộ demo hay
tài khoản admin — vì test_e2e_phase3 khẳng định ngân sách admin luôn rỗng và
các nông hộ demo có tổng thu-chi cố định bị so sánh ở nơi khác.
"""

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


def ms(day: str) -> int:
    return int(datetime.fromisoformat(f"{day}T08:00:00+07:00").timestamp() * 1000)


def login(username: str, password: str) -> dict[str, str]:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="module")
def farmer():
    """An existing demo farmer, used only to prove a non-admin gets 403 — it
    never owns any row created in this file."""
    return login(settings.seed_farmer_username, settings.seed_farmer_password)


@pytest.fixture(scope="module")
def admin():
    return login(settings.seed_admin_username, settings.seed_admin_password)


@pytest.fixture(scope="module")
def owner():
    """Owns every plan / warehouse / income / expense row this file creates."""
    username, password = "test_admin_crud_owner", "test-only-password"
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(id=str(uuid.uuid4()), username=username)
            db.add(user)
        user.password_hash = hash_password(password)
        user.full_name = "Farmer CRUD Test"
        user.role = UserRole.FARMER
        user.is_active = True
        user.is_deleted = False
        db.commit()
    return login(username, password)


# --------------------------------- plans ----------------------------------


def make_plan(headers) -> dict:
    body = {
        "crop_type": "tomato",
        "crop_name": "Cà chua",
        "protocol_id": "tomato_default",
        "scenario_id": "scenario_50_phan_chuong",
        "scenario_name": "Phương án gốc",
        "area_input": 100,
        "area_unit": "m2",
        "area_m2": 100,
        "items": [{"key": "ure", "name": "Urê", "unit": "kg", "min": 1, "max": 1}],
        "note": "Kế hoạch test",
    }
    res = client.post("/plans", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_can_update_a_plan(owner, admin):
    plan = make_plan(owner)
    res = client.patch(
        f"/plans/{plan['id']}",
        headers=admin,
        json={"scenario_name": "Phương án đã sửa", "note": "Sửa bởi admin", "cost_min": 10_000},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["scenario_name"] == "Phương án đã sửa"
    assert body["note"] == "Sửa bởi admin"
    assert body["cost_min"] == 10_000
    # Fields left out of the body must survive untouched.
    assert body["crop_type"] == "tomato"


def test_farmer_cannot_update_or_delete_a_plan(owner, farmer):
    plan = make_plan(owner)
    res = client.patch(f"/plans/{plan['id']}", headers=farmer, json={"note": "hack"})
    assert res.status_code == 403
    res = client.delete(f"/plans/{plan['id']}", headers=farmer)
    assert res.status_code == 403


def test_update_or_delete_a_missing_plan_is_404(admin):
    missing = str(uuid.uuid4())
    assert client.patch(f"/plans/{missing}", headers=admin, json={"note": "x"}).status_code == 404
    assert client.delete(f"/plans/{missing}", headers=admin).status_code == 404


def test_admin_can_delete_a_plan(owner, admin):
    plan = make_plan(owner)
    res = client.delete(f"/plans/{plan['id']}", headers=admin)
    assert res.status_code == 204
    remaining = client.get("/plans", headers=owner).json()
    assert all(p["id"] != plan["id"] for p in remaining)


# ------------------------------- warehouse in ------------------------------


def make_warehouse_in(headers, *, fertilizer_id: str) -> dict:
    body = {
        "fertilizer_id": fertilizer_id,
        "fertilizer_name": "Kali test",
        "category": "kali",
        "quantity": 10,
        "unit": "kg",
        "price": 100_000,
        "occurred_at": ms("2026-09-01"),
        "record_expense": False,
    }
    res = client.post("/warehouse/in", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_can_update_a_warehouse_in_row_and_derived_fields_recompute(owner, admin):
    row = make_warehouse_in(owner, fertilizer_id="test_kali_update")
    assert row["quantity_kg"] == 10
    assert row["unit_price"] == 10_000

    res = client.patch(
        f"/warehouse/in/{row['id']}",
        headers=admin,
        json={"quantity": 5, "unit": "tan", "price": 200_000, "note": "sửa lại lô nhập"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["quantity"] == 5
    assert body["unit"] == "tan"
    assert body["quantity_kg"] == 5_000
    assert body["unit_price"] == 40
    assert body["note"] == "sửa lại lô nhập"


def test_farmer_cannot_update_or_delete_a_warehouse_in_row(owner, farmer):
    row = make_warehouse_in(owner, fertilizer_id="test_kali_farmer_blocked")
    assert client.patch(f"/warehouse/in/{row['id']}", headers=farmer, json={"price": 1}).status_code == 403
    assert client.delete(f"/warehouse/in/{row['id']}", headers=farmer).status_code == 403


def test_update_or_delete_a_missing_warehouse_in_row_is_404(admin):
    missing = str(uuid.uuid4())
    assert client.patch(f"/warehouse/in/{missing}", headers=admin, json={"price": 1}).status_code == 404
    assert client.delete(f"/warehouse/in/{missing}", headers=admin).status_code == 404


def test_admin_can_delete_a_warehouse_in_row(owner, admin):
    row = make_warehouse_in(owner, fertilizer_id="test_kali_delete")
    res = client.delete(f"/warehouse/in/{row['id']}", headers=admin)
    assert res.status_code == 204
    remaining = client.get("/warehouse/in", headers=owner).json()
    assert all(r["id"] != row["id"] for r in remaining)


# ------------------------------ warehouse out -------------------------------


def make_warehouse_out(headers, *, fertilizer_id: str) -> dict:
    make_warehouse_in(headers, fertilizer_id=fertilizer_id)
    body = {
        "fertilizer_id": fertilizer_id,
        "fertilizer_name": "Kali test",
        "quantity_kg": 4,
        "occurred_at": ms("2026-09-02"),
    }
    res = client.post("/warehouse/out", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_can_update_a_warehouse_out_row_and_total_cost_recomputes(owner, admin):
    row = make_warehouse_out(owner, fertilizer_id="test_kali_out_update")
    assert row["unit_price"] == 10_000
    assert row["total_cost"] == 40_000

    res = client.patch(
        f"/warehouse/out/{row['id']}",
        headers=admin,
        json={"quantity_kg": 2, "unit_price": 5_000},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["quantity_kg"] == 2
    assert body["unit_price"] == 5_000
    assert body["total_cost"] == 10_000


def test_farmer_cannot_update_or_delete_a_warehouse_out_row(owner, farmer):
    row = make_warehouse_out(owner, fertilizer_id="test_kali_out_farmer_blocked")
    assert client.patch(f"/warehouse/out/{row['id']}", headers=farmer, json={"quantity_kg": 1}).status_code == 403
    assert client.delete(f"/warehouse/out/{row['id']}", headers=farmer).status_code == 403


def test_update_or_delete_a_missing_warehouse_out_row_is_404(admin):
    missing = str(uuid.uuid4())
    assert client.patch(f"/warehouse/out/{missing}", headers=admin, json={"quantity_kg": 1}).status_code == 404
    assert client.delete(f"/warehouse/out/{missing}", headers=admin).status_code == 404


def test_admin_can_delete_a_warehouse_out_row(owner, admin):
    row = make_warehouse_out(owner, fertilizer_id="test_kali_out_delete")
    res = client.delete(f"/warehouse/out/{row['id']}", headers=admin)
    assert res.status_code == 204
    remaining = client.get("/warehouse/out", headers=owner).json()
    assert all(r["id"] != row["id"] for r in remaining)


# --------------------------------- income -----------------------------------


def make_income(headers) -> dict:
    body = {
        "kind": "product",
        "description": "Bán rau test",
        "amount": 500_000,
        "occurred_at": ms("2026-09-03"),
    }
    res = client.post("/income", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_can_update_an_income_row(owner, admin):
    row = make_income(owner)
    res = client.patch(
        f"/income/{row['id']}",
        headers=admin,
        json={"amount": 750_000, "description": "Bán rau đã sửa", "checked": True},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["amount"] == 750_000
    assert body["description"] == "Bán rau đã sửa"
    assert body["checked"] is True


def test_farmer_cannot_update_or_delete_an_income_row(owner, farmer):
    row = make_income(owner)
    assert client.patch(f"/income/{row['id']}", headers=farmer, json={"amount": 1}).status_code == 403
    assert client.delete(f"/income/{row['id']}", headers=farmer).status_code == 403


def test_update_or_delete_a_missing_income_row_is_404(admin):
    missing = str(uuid.uuid4())
    assert client.patch(f"/income/{missing}", headers=admin, json={"amount": 1}).status_code == 404
    assert client.delete(f"/income/{missing}", headers=admin).status_code == 404


def test_admin_can_delete_an_income_row(owner, admin):
    row = make_income(owner)
    res = client.delete(f"/income/{row['id']}", headers=admin)
    assert res.status_code == 204
    remaining = client.get("/income", headers=owner).json()
    assert all(r["id"] != row["id"] for r in remaining)


# --------------------------------- expense -----------------------------------


def make_expense(headers) -> dict:
    body = {
        "kind": "labor",
        "description": "Công làm cỏ test",
        "amount": 200_000,
        "occurred_at": ms("2026-09-04"),
    }
    res = client.post("/expense", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_can_update_an_expense_row(owner, admin):
    row = make_expense(owner)
    res = client.patch(
        f"/expense/{row['id']}",
        headers=admin,
        json={"amount": 250_000, "kind": "utilities", "checked": True},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["amount"] == 250_000
    assert body["kind"] == "utilities"
    assert body["checked"] is True


def test_farmer_cannot_update_or_delete_an_expense_row(owner, farmer):
    row = make_expense(owner)
    assert client.patch(f"/expense/{row['id']}", headers=farmer, json={"amount": 1}).status_code == 403
    assert client.delete(f"/expense/{row['id']}", headers=farmer).status_code == 403


def test_update_or_delete_a_missing_expense_row_is_404(admin):
    missing = str(uuid.uuid4())
    assert client.patch(f"/expense/{missing}", headers=admin, json={"amount": 1}).status_code == 404
    assert client.delete(f"/expense/{missing}", headers=admin).status_code == 404


def test_admin_can_delete_an_expense_row(owner, admin):
    row = make_expense(owner)
    res = client.delete(f"/expense/{row['id']}", headers=admin)
    assert res.status_code == 204
    remaining = client.get("/expense", headers=owner).json()
    assert all(r["id"] != row["id"] for r in remaining)
