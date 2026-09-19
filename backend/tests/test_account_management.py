"""Task 4 — Quản lý tài khoản nông hộ (Admin).

Covers:
- POST /users: tạo thành công, username trùng 409, farmer bị 403
- PATCH /users/{id}/status: khoá/mở khoá, admin tự khoá bị 403, id không tồn tại 404
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
def admin():
    return login(settings.seed_admin_username, settings.seed_admin_password)


@pytest.fixture(scope="module")
def farmer():
    return login(settings.seed_farmer_username, settings.seed_farmer_password)


# ─── Tạo tài khoản ──────────────────────────────────────────────────────────


def test_admin_create_user_success(admin):
    """Admin tạo tài khoản nông hộ mới — trả UserOut, không có password."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "username": f"test_farmer_{unique}",
        "password": "matkhau123",
        "full_name": f"Nong Dan Test {unique}",
        "phone": "0901234567",
        "region": "Dong Nai",
        "role": "farmer",
    }
    res = client.post("/users", json=payload, headers=admin)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["username"] == payload["username"]
    assert data["full_name"] == payload["full_name"]
    assert data["role"] == "farmer"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data


def test_admin_create_user_duplicate_username(admin):
    """Tao tai khoan voi username da ton tai -> 409 Conflict."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "username": f"dup_farmer_{unique}",
        "password": "matkhau123",
        "full_name": "Nong Dan Trung",
    }
    res1 = client.post("/users", json=payload, headers=admin)
    assert res1.status_code == 201, res1.text
    res2 = client.post("/users", json=payload, headers=admin)
    assert res2.status_code == 409
    assert "ton tai" in res2.json()["detail"].lower() or "tồn tại" in res2.json()["detail"]


def test_farmer_cannot_create_user(farmer):
    """Nong ho goi POST /users bi chan 403."""
    payload = {
        "username": f"hack_{uuid.uuid4().hex[:6]}",
        "password": "matkhau123",
        "full_name": "Hacker",
    }
    res = client.post("/users", json=payload, headers=farmer)
    assert res.status_code == 403


def test_create_user_short_password(admin):
    """Password ngan hon 6 ky tu -> 422 Validation Error."""
    payload = {
        "username": f"short_pw_{uuid.uuid4().hex[:6]}",
        "password": "abc",
        "full_name": "Ngan Mat Khau",
    }
    res = client.post("/users", json=payload, headers=admin)
    assert res.status_code == 422


# ─── Khoa / Mo khoa ─────────────────────────────────────────────────────────


def test_admin_lock_and_unlock_user(admin):
    """Admin khoa roi mo khoa tai khoan — is_active thay doi dung."""
    unique = uuid.uuid4().hex[:8]
    created = client.post(
        "/users",
        json={"username": f"lock_test_{unique}", "password": "matkhau123", "full_name": "Lock Test"},
        headers=admin,
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    lock_res = client.patch(f"/users/{user_id}/status", json={"is_active": False}, headers=admin)
    assert lock_res.status_code == 200, lock_res.text
    assert lock_res.json()["is_active"] is False

    unlock_res = client.patch(f"/users/{user_id}/status", json={"is_active": True}, headers=admin)
    assert unlock_res.status_code == 200
    assert unlock_res.json()["is_active"] is True


def test_admin_cannot_lock_self(admin):
    """Admin khong the tu khoa chinh minh -> 403."""
    me = client.get("/auth/me", headers=admin).json()
    res = client.patch(f"/users/{me['id']}/status", json={"is_active": False}, headers=admin)
    assert res.status_code == 403


def test_lock_nonexistent_user(admin):
    """Khoa user id khong ton tai -> 404."""
    res = client.patch(f"/users/{uuid.uuid4()}/status", json={"is_active": False}, headers=admin)
    assert res.status_code == 404


def test_farmer_cannot_lock_user(farmer, admin):
    """Nong ho goi PATCH /users/{id}/status bi chan 403."""
    me = client.get("/auth/me", headers=admin).json()
    res = client.patch(f"/users/{me['id']}/status", json={"is_active": False}, headers=farmer)
    assert res.status_code == 403
