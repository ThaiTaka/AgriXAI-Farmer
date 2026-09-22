"""Giai đoạn 5 — duyệt giống cây trồng trên web-admin.

A farmer's own variety submission arrives unapproved; an admin approves,
un-approves or rejects (deletes) it. The seed catalogue itself is read-only
here — there is nothing to review on a variety nobody submitted.
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
def farmer():
    return login(settings.seed_farmer_username, settings.seed_farmer_password)


@pytest.fixture(scope="module")
def admin():
    return login(settings.seed_admin_username, settings.seed_admin_password)


def submit_variety(headers) -> dict:
    body = {
        "id": str(uuid.uuid4()),
        "name": "Cà chua thử nghiệm",
        "crop_type": "tomato",
        "crop_name": "Cà chua",
        "category_id": "custom",
        "category_name": "Giống tự thêm",
    }
    res = client.post("/crop-varieties", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_farmer_submitted_variety_starts_unapproved(farmer):
    variety = submit_variety(farmer)
    assert variety["approved"] is False
    assert variety["source"] == "user"
    assert variety["is_seed"] is False


def test_admin_created_variety_is_approved_immediately(admin):
    variety = submit_variety(admin)
    assert variety["approved"] is True


def test_farmer_cannot_review_a_variety(farmer):
    variety = submit_variety(farmer)
    res = client.patch(f"/crop-varieties/{variety['id']}", json={"approved": True}, headers=farmer)
    assert res.status_code == 403
    res = client.delete(f"/crop-varieties/{variety['id']}", headers=farmer)
    assert res.status_code == 403


def test_admin_can_approve_then_unapprove(farmer, admin):
    variety = submit_variety(farmer)

    approved = client.patch(f"/crop-varieties/{variety['id']}", json={"approved": True}, headers=admin)
    assert approved.status_code == 200, approved.text
    assert approved.json()["approved"] is True

    unapproved = client.patch(f"/crop-varieties/{variety['id']}", json={"approved": False}, headers=admin)
    assert unapproved.status_code == 200
    assert unapproved.json()["approved"] is False


def test_admin_can_reject_a_pending_variety(farmer, admin):
    variety = submit_variety(farmer)

    res = client.delete(f"/crop-varieties/{variety['id']}", headers=admin)
    assert res.status_code == 204

    listed = client.get("/crop-varieties", headers=admin).json()
    assert all(v["id"] != variety["id"] for v in listed)


def test_review_a_missing_variety_is_404(admin):
    res = client.patch(f"/crop-varieties/{uuid.uuid4()}", json={"approved": True}, headers=admin)
    assert res.status_code == 404


def test_seed_variety_cannot_be_reviewed_or_deleted(admin):
    seed_variety = next(v for v in client.get("/crop-varieties", headers=admin).json() if v["is_seed"])

    res = client.patch(f"/crop-varieties/{seed_variety['id']}", json={"approved": False}, headers=admin)
    assert res.status_code == 400

    res = client.delete(f"/crop-varieties/{seed_variety['id']}", headers=admin)
    assert res.status_code == 400
