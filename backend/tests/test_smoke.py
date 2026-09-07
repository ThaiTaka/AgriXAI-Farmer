"""Smoke checks: /health and /auth/login must actually work."""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


def test_health_returns_json():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    # All three offline catalogues must be present on disk.
    assert all(body["static_data"].values()), body["static_data"]
    assert set(body["static_data"]) == {
        "fertilizer_recommendations",
        "care_protocols",
        "crop_varieties",
    }


def test_login_with_seed_farmer():
    res = client.post(
        "/auth/login",
        json={
            "username": settings.seed_farmer_username,
            "password": settings.seed_farmer_password,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "farmer"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == settings.seed_farmer_username


def test_login_rejects_wrong_password():
    res = client.post(
        "/auth/login",
        json={"username": settings.seed_farmer_username, "password": "sai-mat-khau"},
    )
    assert res.status_code == 401
