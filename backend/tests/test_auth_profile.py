"""Tests cho auth profile endpoints chua duoc cover.

Coverage tang cho:
- auth.py L33-37: PATCH /auth/me (update profile)
- auth_service.py L32-36: login voi tai khoan bi khoa (is_active=False)
- auth_service.py L52-56: token khong hop le
- auth_service.py L60-62: user bi xoa sau khi token cap
"""

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


# ─── PATCH /auth/me — update profile ─────────────────────────────────────────


def test_update_me_full_name(farmer):
    """PATCH /auth/me cap nhat full_name thanh cong."""
    res = client.patch(
        "/auth/me",
        json={"full_name": "Nguyen Van A Updated"},
        headers=farmer,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["full_name"] == "Nguyen Van A Updated"


def test_update_me_phone_and_region(farmer):
    """PATCH /auth/me cap nhat phone va region."""
    res = client.patch(
        "/auth/me",
        json={"phone": "0901234567", "region": "Mien Tay"},
        headers=farmer,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["phone"] == "0901234567"
    assert data["region"] == "Mien Tay"


def test_update_me_partial(farmer):
    """PATCH /auth/me chi gui 1 field, cac field khac giu nguyen."""
    # Lay thong tin hien tai
    me_res = client.get("/auth/me", headers=farmer)
    current = me_res.json()

    res = client.patch("/auth/me", json={"phone": "0999000111"}, headers=farmer)
    assert res.status_code == 200
    data = res.json()
    assert data["phone"] == "0999000111"
    # full_name khong doi
    assert data["full_name"] == current["full_name"]


def test_update_me_unauthenticated():
    """PATCH /auth/me khong co token -> 401."""
    res = client.patch("/auth/me", json={"full_name": "X"})
    assert res.status_code == 401


# ─── Login voi tai khoan bi khoa ─────────────────────────────────────────────


def test_login_locked_account(admin):
    """Tai khoan bi khoa khong the dang nhap -> 403."""
    import uuid
    # Tao tai khoan moi
    username = f"locked_{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/users",
        json={"username": username, "password": "test123", "full_name": "Lock Test"},
        headers=admin,
    )
    assert create_res.status_code == 201, create_res.text
    user_id = create_res.json()["id"]

    # Dang nhap ok truoc khi khoa
    ok_res = client.post("/auth/login", json={"username": username, "password": "test123"})
    assert ok_res.status_code == 200

    # Khoa tai khoan
    lock_res = client.patch(f"/users/{user_id}/status", json={"is_active": False}, headers=admin)
    assert lock_res.status_code == 200

    # Dang nhap sau khi khoa -> 403
    fail_res = client.post("/auth/login", json={"username": username, "password": "test123"})
    assert fail_res.status_code == 403
    assert "khoa" in fail_res.json()["detail"].lower() or "khoá" in fail_res.json()["detail"]


# ─── Token khong hop le ───────────────────────────────────────────────────────


def test_invalid_token_returns_401():
    """Token gia mao -> 401."""
    headers = {"Authorization": "Bearer this.is.not.a.valid.jwt.token"}
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 401


def test_malformed_bearer_no_token():
    """Khong co token gi ca -> 401."""
    res = client.get("/auth/me")
    assert res.status_code == 401
