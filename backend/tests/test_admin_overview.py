"""GET /admin/overview — tổng quan toàn hệ thống cho trang quản trị.

Chỉ quản trị viên gọi được; số đếm phải khớp với những gì các endpoint từng
phần (`/users`, `/plots`) trả về, và thu - chi của từng hộ phải khớp báo cáo
của chính hộ đó — nếu hai nơi lệch nhau thì trang Tổng quan nói dối.
"""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed
from app.seed_demo import DEMO_PASSWORD

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
def thai():
    return login("lethanhthai", DEMO_PASSWORD)


def test_overview_needs_an_admin(thai):
    assert client.get("/admin/overview").status_code == 401
    assert client.get("/admin/overview", headers=thai).status_code == 403


def test_overview_rejects_a_month_that_does_not_exist(admin):
    assert client.get("/admin/overview", headers=admin, params={"year": 2026, "month": 13}).status_code == 422
    assert client.get("/admin/overview", headers=admin, params={"months": 0}).status_code == 422
    assert client.get("/admin/overview", headers=admin, params={"months": 13}).status_code == 422


def test_counts_match_the_per_resource_endpoints(admin):
    body = client.get("/admin/overview", headers=admin, params={"year": 2026, "month": 9}).json()
    users = client.get("/users", headers=admin).json()
    farmers = [u for u in users if u["role"] == "farmer"]
    plots = client.get("/plots", headers=admin).json()

    assert body["farmers"]["total"] == len(farmers)
    assert body["farmers"]["active"] == sum(1 for f in farmers if f["is_active"])
    assert body["farmers"]["locked"] == sum(1 for f in farmers if not f["is_active"])
    owners = {p["owner_id"] for p in plots}
    assert body["farmers"]["without_plot"] == sum(1 for f in farmers if f["id"] not in owners)

    assert body["plots"]["total"] == len(plots)
    assert sum(body["plots"]["by_status"].values()) == len(plots)
    assert sum(c["plots"] for c in body["plots"]["by_crop"]) == len(plots)
    expected_area = sum(p["area"] * (10_000 if p["area_unit"] == "ha" else 1) for p in plots)
    assert body["plots"]["area_m2"] == pytest.approx(expected_area)


def test_month_series_ends_on_the_chosen_month_and_wraps_the_year(admin):
    body = client.get("/admin/overview", headers=admin, params={"year": 2026, "month": 2, "months": 4}).json()
    assert [(m["year"], m["month"]) for m in body["months"]] == [(2025, 11), (2025, 12), (2026, 1), (2026, 2)]


def test_farm_totals_equal_each_farms_own_report(admin, thai):
    body = client.get("/admin/overview", headers=admin, params={"year": 2026, "month": 9}).json()
    mine = client.get("/auth/me", headers=thai).json()
    report = client.get("/reports/financials", headers=thai, params={"year": 2026, "month": 9}).json()

    row = next(f for f in body["farms"] if f["owner_id"] == mine["id"])
    assert row["income"] == report["total_income"]
    assert row["expense"] == report["total_expense"]

    # The September row of the series is the sum over every farm in the list.
    september = body["months"][-1]
    assert (september["year"], september["month"]) == (2026, 9)
    assert september["income"] == pytest.approx(sum(f["income"] for f in body["farms"]))
    assert september["expense"] == pytest.approx(sum(f["expense"] for f in body["farms"]))


def test_stock_is_the_sum_of_every_farms_stock(admin):
    body = client.get("/admin/overview", headers=admin).json()
    users = client.get("/users", headers=admin).json()
    value = kg = 0.0
    for user in users:
        if user["role"] != "farmer":
            continue
        summary = client.get("/warehouse/summary", headers=admin, params={"owner_id": user["id"]}).json()
        for line in summary["lines"]:
            if line["stock_kg"] > 0:
                value += line["stock_value"]
                kg += line["stock_kg"]
    assert body["stock_value"] == pytest.approx(value)
    assert body["stock_kg"] == pytest.approx(kg)


def test_default_month_is_the_current_month_in_vietnam(admin):
    body = client.get("/admin/overview", headers=admin).json()
    from app.services import ledger_service as ledger

    now = datetime.now(tz=ledger.VN_TZ)
    assert (body["year"], body["month"]) == (now.year, now.month)
    assert len(body["months"]) == 6
