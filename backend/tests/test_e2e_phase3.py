"""End-to-end API cases for Giai đoạn 3, run through the real FastAPI app.

Scenario: nông hộ Nguyễn Văn Cường (xã Hòa Bình, Thanh Trì, Hà Nội), lô
PUC-001-HB, 300 m² cà chua MV1 — the mock-up farm from the brief. Each test
is one user story from the acceptance list; together they walk the full loop
plan → purchase → stock check → issue → report → CSV.
"""

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


def ms(day: str) -> int:
    return int(datetime.fromisoformat(f"{day}T08:00:00+07:00").timestamp() * 1000)


@pytest.fixture(scope="module")
def farmer() -> dict[str, str]:
    res = client.post(
        "/auth/login",
        json={"username": settings.seed_farmer_username, "password": settings.seed_farmer_password},
    )
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="module")
def admin() -> dict[str, str]:
    res = client.post(
        "/auth/login",
        json={"username": settings.seed_admin_username, "password": settings.seed_admin_password},
    )
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="module")
def plot(farmer) -> dict:
    res = client.post(
        "/plots",
        headers=farmer,
        json={
            "code": "PUC-001-HB",
            "name": "Ruộng cà chua nhà ông Cường",
            "region": "Xã Hòa Bình, Huyện Thanh Trì, Hà Nội",
            "area": 300,
            "area_unit": "m2",
            "crop_type": "tomato",
            "crop_name": "Cà chua",
            "variety_id": "seed_ca_chua_mv1",
            "variety_name": "MV1",
        },
    )
    assert res.status_code == 201
    return res.json()


# ------------------------------- F1: plans -------------------------------


def test_e2e_01_save_fertilizer_plan(farmer, plot):
    """F1 — a plan for 300 m² of MV1, scenario 2, is stored with its scaled items."""
    body = {
        "plot_id": plot["id"],
        "crop_type": "tomato",
        "crop_name": "Cà chua",
        "category_id": "tomato_round",
        "variety_id": "seed_ca_chua_mv1",
        "variety_name": "MV1",
        "protocol_id": "tomato_default",
        "scenario_id": "scenario_50_phan_chuong",
        "scenario_name": "Phương án 2 — 50% phân chuồng hoai + 50% vô cơ",
        "area_input": 300,
        "area_unit": "m2",
        "area_m2": 300,
        "items": [
            {"key": "ure", "name": "Urê", "fertilizer_category": "dam", "unit": "kg", "min": 2.25, "max": 2.55, "price_product_id": "ure_ca_mau", "price_per_kg": 13000, "cost_min": 29250, "cost_max": 33150},
        ],
        "cost_min": 29250,
        "cost_max": 33150,
    }
    res = client.post("/plans", headers=farmer, json=body)
    assert res.status_code == 201, res.text
    saved = res.json()
    assert saved["plot_id"] == plot["id"]
    assert '"key": "ure"' in saved["items_json"]

    listed = client.get("/plans", headers=farmer).json()
    assert any(p["id"] == saved["id"] for p in listed)


def test_e2e_02_plan_requires_at_least_one_item(farmer):
    res = client.post(
        "/plans",
        headers=farmer,
        json={
            "crop_type": "tomato",
            "protocol_id": "tomato_default",
            "scenario_id": "x",
            "scenario_name": "x",
            "area_input": 1,
            "area_unit": "m2",
            "area_m2": 1,
            "items": [],
        },
    )
    assert res.status_code == 422


# ----------------------------- Kho: nhập/xuất -----------------------------


def test_e2e_03_purchase_books_stock_and_a_linked_expense(farmer, plot):
    """Kho nhập — Urê Cà Mau 50 kg, 680.000₫, 10/09/2026, 'Mua ở sfarm Hà Nội'."""
    res = client.post(
        "/warehouse/in",
        headers=farmer,
        json={
            "fertilizer_id": "ure_ca_mau",
            "fertilizer_name": "Urê Cà Mau",
            "category": "dam",
            "quantity": 50,
            "unit": "kg",
            "price": 680_000,
            "occurred_at": ms("2026-09-10"),
            "note": "Mua ở sfarm Hà Nội",
            "plot_id": plot["id"],
        },
    )
    assert res.status_code == 201, res.text
    row = res.json()
    assert row["quantity_kg"] == 50
    assert row["unit_price"] == 13_600
    assert row["expense_id"], "mua phân phải sinh một khoản chi 'Phân bón' gắn với phiếu nhập"

    expenses = client.get("/expense", headers=farmer).json()
    linked = next(e for e in expenses if e["id"] == row["expense_id"])
    assert linked["kind"] == "fertilizer"
    assert linked["amount"] == 680_000
    assert linked["warehouse_in_id"] == row["id"]
    assert linked["description"] == "Mua Urê Cà Mau 50 kg"


def test_e2e_04_purchase_in_tonnes_is_normalised_to_kg(farmer):
    res = client.post(
        "/warehouse/in",
        headers=farmer,
        json={
            "fertilizer_id": "dap_han_quoc",
            "fertilizer_name": "DAP Hàn Quốc (nhập khẩu)",
            "category": "lan",
            "quantity": 0.05,
            "unit": "tan",
            "price": 1_100_000,
            "occurred_at": ms("2026-09-10"),
            "note": "East-West hạt giống",
            "record_expense": False,
        },
    )
    assert res.status_code == 201, res.text
    row = res.json()
    assert row["quantity_kg"] == 50
    assert row["unit_price"] == 22_000
    assert row["expense_id"] is None


def test_e2e_05_stock_check_reports_enough_and_shortfall(farmer):
    """F4 — 30 kg needed of 50 kg in stock: đủ, còn dư 20 kg. 80 kg: thiếu 30 kg."""
    ok = client.get("/warehouse/check", headers=farmer, params={"fertilizer_id": "ure_ca_mau", "needed_kg": 30}).json()
    assert ok["enough"] is True
    assert ok["stock_kg"] == 50
    assert ok["remaining_kg"] == 20
    assert ok["shortfall_kg"] == 0
    assert ok["latest_unit_price"] == 13_600

    short = client.get("/warehouse/check", headers=farmer, params={"fertilizer_id": "ure_ca_mau", "needed_kg": 80}).json()
    assert short["enough"] is False
    assert short["shortfall_kg"] == 30
    assert short["remaining_kg"] == 0


def test_e2e_06_issue_uses_fifo_price_and_reduces_stock(farmer, plot):
    res = client.post(
        "/warehouse/out",
        headers=farmer,
        json={
            "fertilizer_id": "ure_ca_mau",
            "fertilizer_name": "Urê Cà Mau",
            "category": "dam",
            "quantity_kg": 20,
            "occurred_at": ms("2026-09-12"),
            "note": "Bón thúc đợt 1 lô PUC-001-HB",
            "plot_id": plot["id"],
        },
    )
    assert res.status_code == 201, res.text
    row = res.json()
    assert row["unit_price"] == 13_600
    assert row["total_cost"] == 20 * 13_600

    summary = client.get("/warehouse/summary", headers=farmer).json()
    ure = next(l for l in summary["lines"] if l["fertilizer_id"] == "ure_ca_mau")
    assert ure["in_kg"] == 50 and ure["out_kg"] == 20 and ure["stock_kg"] == 30
    assert ure["avg_price"] == 13_600
    assert ure["stock_value"] == 30 * 13_600
    dap = next(l for l in summary["lines"] if l["fertilizer_id"] == "dap_han_quoc")
    assert dap["stock_kg"] == 50
    assert summary["total_value"] == 30 * 13_600 + 50 * 22_000


def test_e2e_07_issue_more_than_stock_is_refused(farmer):
    res = client.post(
        "/warehouse/out",
        headers=farmer,
        json={
            "fertilizer_id": "ure_ca_mau",
            "fertilizer_name": "Urê Cà Mau",
            "quantity_kg": 500,
            "occurred_at": ms("2026-09-13"),
        },
    )
    assert res.status_code == 409
    assert "30 kg" in res.json()["detail"]


def test_e2e_08_stock_csv_export(farmer):
    res = client.get("/warehouse/summary.csv", headers=farmer)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    text = res.text.lstrip("﻿")
    assert text.splitlines()[0].startswith("Phân bón,Nhập (kg)")
    assert "Urê Cà Mau,50,20,30,13.600₫,408.000₫" in text


# ------------------------------- Thu – Chi -------------------------------


def test_e2e_09_record_income_and_expenses(farmer, plot):
    inc = client.post(
        "/income",
        headers=farmer,
        json={
            "kind": "product",
            "description": "Bán cà chua MV1 50kg",
            "amount": 1_500_000,
            "occurred_at": ms("2026-09-01"),
            "note": "Bán cho cửa hàng Kim Hạnh",
            "plot_id": plot["id"],
        },
    )
    assert inc.status_code == 201, inc.text
    assert inc.json()["checked"] is False

    for kind, desc, amount, day in [
        ("labor", "Công bón phân (3 công)", 300_000, "2026-09-05"),
        ("utilities", "Điện nước", 120_000, "2026-09-10"),
    ]:
        res = client.post(
            "/expense",
            headers=farmer,
            json={"kind": kind, "description": desc, "amount": amount, "occurred_at": ms(day)},
        )
        assert res.status_code == 201, res.text

    checked = client.patch(f"/income/{inc.json()['id']}/checked", headers=farmer, json={"checked": True})
    assert checked.status_code == 200
    assert checked.json()["checked"] is True


def test_e2e_10_monthly_report_profit_and_loss(farmer):
    """Thu 1.500.000 − Chi (300.000 + 120.000 + 680.000 mua urê) = lỗ 400.000₫ (DAP không ghi chi)."""
    res = client.get("/reports/financials", headers=farmer, params={"year": 2026, "month": 9})
    assert res.status_code == 200
    report = res.json()
    assert report["period"] == "Tháng 9, Năm 2026"
    assert report["total_income"] == 1_500_000
    assert report["total_expense"] == 300_000 + 120_000 + 680_000
    assert report["profit"] == 1_500_000 - 1_100_000
    assert report["expense_by_kind"] == {"fertilizer": 680_000, "labor": 300_000, "utilities": 120_000}
    assert [d["date"] for d in report["daily"]] == ["2026-09-01", "2026-09-05", "2026-09-10"]

    empty = client.get("/reports/financials", headers=farmer, params={"year": 2026, "month": 8}).json()
    assert empty["total_income"] == 0 and empty["total_expense"] == 0


def test_e2e_11_quarterly_report_and_validation(farmer):
    q3 = client.get("/reports/financials", headers=farmer, params={"year": 2026, "quarter": 3}).json()
    assert q3["period"] == "Quý 3, Năm 2026"
    assert q3["total_income"] == 1_500_000

    bad = client.get("/reports/financials", headers=farmer, params={"year": 2026, "month": 13})
    assert bad.status_code == 422


def test_e2e_12_financial_csv_export(farmer):
    res = client.get("/reports/financials.csv", headers=farmer, params={"year": 2026, "month": 9})
    assert res.status_code == 200
    assert "thu-chi-2026-thang-9.csv" in res.headers["content-disposition"]
    lines = res.text.lstrip("﻿").splitlines()
    assert lines[0] == '"Tháng 9, Năm 2026"'
    assert lines[1] == "Thu,1.500.000₫,Chi,1.100.000₫,Lãi lỗ,400.000₫"
    assert lines[-1].endswith("Lãi lỗ 400.000₫")


# ------------------------------ isolation --------------------------------


def test_e2e_13_admin_does_not_see_the_farmers_ledger(admin):
    """Ledgers are per farm: another account, even admin, gets an empty shed."""
    assert client.get("/warehouse/summary", headers=admin).json()["lines"] == []
    assert client.get("/income", headers=admin).json() == []
    assert client.get("/plans", headers=admin).json() == []


def test_e2e_14_ledger_rows_flow_through_sync(farmer):
    """A purchase typed on the phone offline reaches the server through /sync
    and comes back with the same id; the summary counts it."""
    record_id = str(uuid.uuid4())
    changes = {
        "warehouse_in": {
            "created": [
                {
                    "id": record_id,
                    "fertilizer_id": "kali_bot_ca_mau",
                    "fertilizer_name": "Kali bột (MOP) Cà Mau",
                    "category": "kali",
                    "quantity": 25,
                    "unit": "kg",
                    "quantity_kg": 25,
                    "price": 275_000,
                    "unit_price": 11_000,
                    "occurred_at": ms("2026-09-11"),
                    "note": "Nhập offline",
                    "plot_id": None,
                    "expense_id": None,
                    "owner_id": "ignored",
                    "updated_by": "device",
                    "created_at": ms("2026-09-11"),
                    "updated_at": ms("2026-09-11"),
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    res = client.post("/sync", headers=farmer, params={"last_pulled_at": 0}, json=changes)
    assert res.status_code == 200

    pulled = client.get("/sync", headers=farmer).json()["changes"]["warehouse_in"]["created"]
    assert any(r["id"] == record_id for r in pulled)

    summary = client.get("/warehouse/summary", headers=farmer).json()
    kali = next(l for l in summary["lines"] if l["fertilizer_id"] == "kali_bot_ca_mau")
    assert kali["stock_kg"] == 25


def test_e2e_15_care_protocols_endpoint_serves_the_merged_file(farmer):
    res = client.get("/care-protocols", headers=farmer)
    assert res.status_code == 200
    body = res.json()
    ids = {p["id"] for p in body["protocols"]}
    assert {"tomato_default", "coffee_robusta_ctt_2010", "cucumber_laichau_2025", "chili_hot_lamdong"} <= ids
    assert {u["category_id"] for u in body["unavailable"]} == {"coffee_liberica", "coffee_excelsa", "chili_ornamental"}
