"""Task 5 — Doi mat khau (POST /auth/change-password).

Covers:
- Doi mat khau thanh cong -> 204, dang nhap lai duoc voi mat khau moi
- Mat khau hien tai sai -> 400
- Mat khau moi trung mat khau cu -> 400
- Mat khau moi qua ngan (< 6 ky tu) -> 422
- Chua dang nhap (khong co token) -> 401
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


def make_test_farmer(admin_headers: dict) -> dict:
    """Tao mot nong ho moi voi mat khau biet truoc de test doi mat khau."""
    u = uuid.uuid4().hex[:8]
    res = client.post(
        "/users",
        json={"username": f"pw_test_{u}", "password": "OldPass123", "full_name": "Test PW"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    return {"username": res.json()["username"], "password": "OldPass123"}


def test_change_password_success(admin):
    """Doi mat khau thanh cong - co the dang nhap voi mat khau moi."""
    cred = make_test_farmer(admin)
    headers = login(cred["username"], cred["password"])

    res = client.post(
        "/auth/change-password",
        json={"current_password": cred["password"], "new_password": "NewPass456"},
        headers=headers,
    )
    assert res.status_code == 204, res.text

    # Dang nhap lai voi mat khau moi
    new_login = client.post("/auth/login", json={"username": cred["username"], "password": "NewPass456"})
    assert new_login.status_code == 200, new_login.text

    # Mat khau cu khong con hop le
    old_login = client.post("/auth/login", json={"username": cred["username"], "password": cred["password"]})
    assert old_login.status_code == 401


def test_change_password_wrong_current(admin):
    """Mat khau hien tai sai -> 400."""
    cred = make_test_farmer(admin)
    headers = login(cred["username"], cred["password"])

    res = client.post(
        "/auth/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewPass456"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "khong dung" in res.json()["detail"].lower() or "không đúng" in res.json()["detail"]


def test_change_password_same_as_current(admin):
    """Mat khau moi trung mat khau cu -> 400."""
    cred = make_test_farmer(admin)
    headers = login(cred["username"], cred["password"])

    res = client.post(
        "/auth/change-password",
        json={"current_password": cred["password"], "new_password": cred["password"]},
        headers=headers,
    )
    assert res.status_code == 400


def test_change_password_too_short(admin):
    """Mat khau moi qua ngan -> 422 Validation Error."""
    cred = make_test_farmer(admin)
    headers = login(cred["username"], cred["password"])

    res = client.post(
        "/auth/change-password",
        json={"current_password": cred["password"], "new_password": "abc"},
        headers=headers,
    )
    assert res.status_code == 422


def test_change_password_unauthenticated():
    """Chua dang nhap -> 401."""
    res = client.post(
        "/auth/change-password",
        json={"current_password": "anything", "new_password": "NewPass456"},
    )
    assert res.status_code == 401
