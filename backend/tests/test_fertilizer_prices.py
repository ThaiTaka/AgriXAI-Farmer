"""Task 2 - Quan ly gia phan bon (Admin).

Covers:
- POST /fertilizer-prices: admin tao gia moi thanh cong (201)
- POST /fertilizer-prices: farmer bi chan (403)
- GET /fertilizer-prices/latest: tra danh sach gia hien hanh
- GET /fertilizer-prices/history/{id}: lich su gia cua mot loai phan
- Append-only: nhap gia moi khong xoa gia cu
- Gia moi nhat = dong co effective_from lon nhat
"""

import time
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


def now_ms() -> int:
    return int(time.time() * 1000)


def test_admin_create_price_success(admin):
    """Admin tao gia moi -> 201, tra FertilizerPriceOut."""
    payload = {
        "fertilizer_id": "ure_ca_mau",
        "price_per_kg": 14500.0,
        "effective_from": now_ms(),
    }
    res = client.post("/fertilizer-prices", json=payload, headers=admin)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["fertilizer_id"] == "ure_ca_mau"
    assert data["price_per_kg"] == 14500.0
    assert data["id"] > 0
    assert data["updated_by"] is not None


def test_farmer_cannot_create_price(farmer):
    """Farmer goi POST /fertilizer-prices -> 403."""
    payload = {
        "fertilizer_id": "ure_ca_mau",
        "price_per_kg": 9999.0,
        "effective_from": now_ms(),
    }
    res = client.post("/fertilizer-prices", json=payload, headers=farmer)
    assert res.status_code == 403


def test_create_price_negative_price(admin):
    """Gia am hoac bang 0 -> 422."""
    payload = {
        "fertilizer_id": "ure_ca_mau",
        "price_per_kg": -100.0,
        "effective_from": now_ms(),
    }
    res = client.post("/fertilizer-prices", json=payload, headers=admin)
    assert res.status_code == 422


def test_get_latest_prices(admin, farmer):
    """GET /fertilizer-prices/latest tra duoc ca admin lan farmer."""
    res_admin = client.get("/fertilizer-prices/latest", headers=admin)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert isinstance(data, list)
    assert len(data) > 0

    # Farmer cung doc duoc
    res_farmer = client.get("/fertilizer-prices/latest", headers=farmer)
    assert res_farmer.status_code == 200


def test_latest_returns_newest_price(admin):
    """Gia moi nhat phai la dong co effective_from lon nhat."""
    t1 = now_ms()
    t2 = t1 + 60_000  # 1 phut sau

    client.post("/fertilizer-prices", json={"fertilizer_id": "dap_han_quoc", "price_per_kg": 9000.0, "effective_from": t1}, headers=admin)
    client.post("/fertilizer-prices", json={"fertilizer_id": "dap_han_quoc", "price_per_kg": 9500.0, "effective_from": t2}, headers=admin)

    latest = client.get("/fertilizer-prices/latest", headers=admin).json()
    dap = next((r for r in latest if r["fertilizer_id"] == "dap_han_quoc"), None)
    assert dap is not None
    assert dap["price_per_kg"] == 9500.0, "Phai tra gia moi nhat (t2)"


def test_history_preserves_all_records(admin):
    """Append-only: nhap gia moi KHONG xoa gia cu - lich su phai du."""
    fid = "ure_phu_my"  # ID co trong catalogue JSON
    t_base = now_ms()

    # Nhap 3 lan voi gia tang dan
    prices_in = [10000.0, 11000.0, 12000.0]
    for i, price in enumerate(prices_in):
        res = client.post(
            "/fertilizer-prices",
            json={"fertilizer_id": fid, "price_per_kg": price, "effective_from": t_base + i * 1000},
            headers=admin,
        )
        assert res.status_code == 201, res.text

    history = client.get(f"/fertilizer-prices/history/{fid}", headers=admin).json()
    # Co the co nhieu hon 3 neu test chay lai — nhung pha ti nhat 3 ban ghi
    assert len(history) >= 3, f"Phai co it nhat 3 ban ghi lich su, co {len(history)}"
    history_prices = [r["price_per_kg"] for r in history]
    for p in prices_in:
        assert p in history_prices, f"Gia {p} phai con trong lich su (append-only)"
    # Lich su sap xep: moi nhat truoc
    assert history[0]["effective_from"] >= history[-1]["effective_from"]


def test_unauthenticated_cannot_access(admin):
    """Chua dang nhap khong the truy cap."""
    res = client.get("/fertilizer-prices/latest")
    assert res.status_code == 401
