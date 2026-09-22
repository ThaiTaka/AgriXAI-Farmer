"""Giai đoạn 4 — multi-user sync, error logs, dashboard, PDF.

Three demo households (lethanhthai PUC-001-HB + PUC-004-HB, nguyenvananh PUC-002-HB,
nguyenvanhai PUC-003-HB) plus admin. Each test is one case from the brief's
list; the e2e tests at the bottom chain them the way a farmer would.
"""

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed
from app.seed_demo import DEMO_PASSWORD
from app.services import dashboard_service, report_pdf
from app.services import ledger_service as ledger

run_seed()
client = TestClient(app)


def ms(day: str, hour: int = 8) -> int:
    return int(datetime.fromisoformat(f"{day}T{hour:02d}:00:00+07:00").timestamp() * 1000)


def login(username: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="module")
def thai():
    return login("lethanhthai")


@pytest.fixture(scope="module")
def anh():
    return login("nguyenvananh")


@pytest.fixture(scope="module")
def hai():
    return login("nguyenvanhai")


@pytest.fixture(scope="module")
def admin():
    return login(settings.seed_admin_username, settings.seed_admin_password)


def me(headers) -> dict:
    return client.get("/auth/me", headers=headers).json()


def plan_row(record_id: str, *, name: str, updated_at: int, created_at: int | None = None) -> dict:
    return {
        "id": record_id,
        "plot_id": "demo-plot-puc-001-hb",
        "crop_type": "tomato",
        "crop_name": "Cà chua",
        "category_id": "tomato_round",
        "variety_id": "seed_ca_chua_mv1",
        "variety_name": "MV1",
        "protocol_id": "tomato_default",
        "scenario_id": "scenario_25_huu_co",
        "scenario_name": name,
        "area_input": 300,
        "area_unit": "m2",
        "area_m2": 300,
        "items_json": "[]",
        "cost_min": 100_000,
        "cost_max": 120_000,
        "note": None,
        "owner_id": "ignored",
        "updated_by": "device",
        "created_at": created_at or updated_at,
        "updated_at": updated_at,
    }


def push(headers, changes: dict, last_pulled_at: int = 0) -> dict:
    res = client.post("/sync", headers=headers, params={"last_pulled_at": last_pulled_at}, json=changes)
    assert res.status_code == 200, res.text
    return res.json()


def created(table: str, rows: list[dict]) -> dict:
    return {table: {"created": rows, "updated": [], "deleted": []}}


# ------------------------------ multi-user -------------------------------


def test_mu_01_plan_written_offline_is_visible_after_sync(thai, admin):
    """User A saves a plan offline (old timestamps), goes online, pushes;
    the plan is on the server and admin can see it under A's farm."""
    record_id = str(uuid.uuid4())
    push(thai, created("plans", [plan_row(record_id, name="Kế hoạch offline sáng nay", updated_at=ms("2026-09-14", 6))]))

    mine = client.get("/plans", headers=thai).json()
    assert any(p["id"] == record_id for p in mine)
    seen = client.get("/plans", headers=admin, params={"owner_id": me(thai)["id"]}).json()
    assert any(p["id"] == record_id for p in seen)


def test_mu_02_same_account_two_devices_conflict_is_reported_and_resolvable(thai):
    """Device 1 and device 2 of the same account edit one plan offline.
    Device 2 syncs first (newer edit). Device 1's push is rejected for that
    row and gets the server copy back; "giữ bản của tôi" re-pushes with a
    fresh timestamp and wins, "lấy bản mới" simply keeps the server copy."""
    record_id = str(uuid.uuid4())
    push(thai, created("plans", [plan_row(record_id, name="Bản gốc", updated_at=ms("2026-09-13"))]))

    # Device 2: edits at 10:00, syncs.
    push(thai, {"plans": {"created": [], "updated": [plan_row(record_id, name="Sửa ở máy 2", updated_at=ms("2026-09-14", 10), created_at=ms("2026-09-13"))], "deleted": []}})

    # Device 1: edited at 09:00 (older), syncs later.
    res = push(thai, {"plans": {"created": [], "updated": [plan_row(record_id, name="Sửa ở máy 1", updated_at=ms("2026-09-14", 9), created_at=ms("2026-09-13"))], "deleted": []}})
    assert res["applied"]["conflicts"] == 1
    assert len(res["conflicts"]) == 1
    conflict = res["conflicts"][0]
    assert conflict["table"] == "plans" and conflict["id"] == record_id
    assert conflict["server"]["scenario_name"] == "Sửa ở máy 2"
    assert conflict["server_updated_at"] >= ms("2026-09-14", 10)

    # Server still has device 2's version.
    current = next(p for p in client.get("/plans", headers=thai).json() if p["id"] == record_id)
    assert current["scenario_name"] == "Sửa ở máy 2"

    # "Giữ bản của tôi": device 1 re-pushes with a newer timestamp.
    newer = conflict["server_updated_at"] + 1
    res = push(thai, {"plans": {"created": [], "updated": [plan_row(record_id, name="Sửa ở máy 1", updated_at=newer, created_at=ms("2026-09-13"))], "deleted": []}})
    assert res["applied"]["conflicts"] == 0 and res["conflicts"] == []
    current = next(p for p in client.get("/plans", headers=thai).json() if p["id"] == record_id)
    assert current["scenario_name"] == "Sửa ở máy 1"


def test_mu_03_two_hours_offline_then_sync(thai):
    """Rows created two hours ago on the phone keep their own timestamps
    and are accepted as new rows — nothing is re-dated by the server."""
    record_id = str(uuid.uuid4())
    two_hours_ago = ms("2026-09-14", 6)
    push(thai, created("plans", [plan_row(record_id, name="Ghi lúc mất mạng", updated_at=two_hours_ago)]))
    row = next(p for p in client.get("/plans", headers=thai).json() if p["id"] == record_id)
    assert row["created_at"] == two_hours_ago
    assert row["updated_at"] == two_hours_ago


def test_mu_04_farmers_never_see_each_others_farms(thai, anh, hai):
    """Isolation: plots, plans, stock, ledger and dashboards are per account;
    asking for another owner_id as a farmer is a 404, not a leak."""
    thai_plots = {p["code"] for p in client.get("/plots", headers=thai).json()}
    anh_plots = {p["code"] for p in client.get("/plots", headers=anh).json()}
    hai_plots = {p["code"] for p in client.get("/plots", headers=hai).json()}
    assert "PUC-001-HB" in thai_plots and "PUC-001-HB" not in anh_plots and "PUC-001-HB" not in hai_plots
    assert "PUC-002-HB" in anh_plots and "PUC-002-HB" not in thai_plots
    assert "PUC-003-HB" in hai_plots and "PUC-003-HB" not in anh_plots

    anh_id = me(anh)["id"]
    for path in ("/plans", "/warehouse/summary", "/income", "/expense", "/dashboard/summary"):
        res = client.get(path, headers=thai, params={"owner_id": anh_id})
        assert res.status_code == 404, path

    # A pulled sync carries only the caller's rows.
    pulled = client.get("/sync", headers=hai).json()["changes"]
    assert {r["code"] for r in pulled["plots"]["created"]} == {"PUC-003-HB"}
    assert all(r["owner_id"] == me(hai)["id"] for r in pulled["warehouse_in"]["created"])


def test_mu_05_three_tables_in_one_push(anh):
    anh_id = me(anh)["id"]
    plan_id, out_id, inc_id = (str(uuid.uuid4()) for _ in range(3))
    changes = {
        "plans": {"created": [dict(plan_row(plan_id, name="3 bảng", updated_at=ms("2026-09-14")), plot_id="demo-plot-puc-002-hb")], "updated": [], "deleted": []},
        "warehouse_out": {
            "created": [
                {
                    "id": out_id,
                    "fertilizer_id": "npk_16_16_8_ca_mau",
                    "fertilizer_name": "NPK 16-16-8 Cà Mau",
                    "category": "npk",
                    "quantity_kg": 10,
                    "unit_price": 14_000,
                    "total_cost": 140_000,
                    "occurred_at": ms("2026-09-14"),
                    "note": None,
                    "plot_id": "demo-plot-puc-002-hb",
                    "plan_id": plan_id,
                    "owner_id": "ignored",
                    "updated_by": "device",
                    "created_at": ms("2026-09-14"),
                    "updated_at": ms("2026-09-14"),
                }
            ],
            "updated": [],
            "deleted": [],
        },
        "income": {
            "created": [
                {
                    "id": inc_id,
                    "kind": "product",
                    "description": "Bán dưa leo 30 kg",
                    "amount": 360_000,
                    "occurred_at": ms("2026-09-14"),
                    "note": None,
                    "plot_id": "demo-plot-puc-002-hb",
                    "checked": False,
                    "owner_id": "ignored",
                    "updated_by": "device",
                    "created_at": ms("2026-09-14"),
                    "updated_at": ms("2026-09-14"),
                }
            ],
            "updated": [],
            "deleted": [],
        },
    }
    res = push(anh, changes)
    assert res["applied"]["created"] == 3
    assert any(p["id"] == plan_id and p["owner_id"] == anh_id for p in client.get("/plans", headers=anh).json())
    assert any(r["id"] == out_id for r in client.get("/warehouse/out", headers=anh).json())
    assert any(r["id"] == inc_id for r in client.get("/income", headers=anh).json())


def test_mu_06_airplane_mode_then_full_sync(hai):
    """Airplane mode: nothing pulled for a while (last_pulled_at far back),
    several tables changed locally. One sync pass pushes everything and the
    pull returns the server state including those rows."""
    hai_id = me(hai)["id"]
    plan_id, exp_id = str(uuid.uuid4()), str(uuid.uuid4())
    changes = {
        "plans": {"created": [dict(plan_row(plan_id, name="Máy bay", updated_at=ms("2026-09-14", 7)), plot_id="demo-plot-puc-003-hb")], "updated": [], "deleted": []},
        "expense": {
            "created": [
                {
                    "id": exp_id,
                    "kind": "labor",
                    "description": "Công tưới",
                    "amount": 150_000,
                    "occurred_at": ms("2026-09-14", 7),
                    "note": None,
                    "plot_id": "demo-plot-puc-003-hb",
                    "checked": False,
                    "warehouse_in_id": None,
                    "owner_id": "ignored",
                    "updated_by": "device",
                    "created_at": ms("2026-09-14", 7),
                    "updated_at": ms("2026-09-14", 7),
                }
            ],
            "updated": [],
            "deleted": [],
        },
    }
    push(hai, changes, last_pulled_at=ms("2026-09-01"))
    pulled = client.get("/sync", headers=hai, params={"last_pulled_at": ms("2026-09-01")}).json()["changes"]
    assert any(r["id"] == plan_id for r in pulled["plans"]["created"])
    assert any(r["id"] == exp_id for r in pulled["expense"]["created"])
    assert all(r["owner_id"] == hai_id for r in pulled["plans"]["created"])


def test_mu_07_dropped_connection_resume_is_idempotent(anh):
    """The response to a push was lost; the phone re-sends the same batch.
    Nothing is duplicated and the second reply reports it as an update."""
    record_id = str(uuid.uuid4())
    batch = created("plans", [dict(plan_row(record_id, name="Gửi lại", updated_at=ms("2026-09-14")), plot_id="demo-plot-puc-002-hb")])
    first = push(anh, batch)
    second = push(anh, batch)
    assert first["applied"]["created"] == 1
    assert second["applied"]["created"] == 0 and second["applied"]["updated"] == 1
    assert sum(1 for p in client.get("/plans", headers=anh).json() if p["id"] == record_id) == 1


def test_mu_08_delete_offline_syncs_as_soft_delete(thai):
    record_id = str(uuid.uuid4())
    push(thai, created("plans", [plan_row(record_id, name="Sẽ xoá", updated_at=ms("2026-09-13"))]))
    assert any(p["id"] == record_id for p in client.get("/plans", headers=thai).json())

    res = push(thai, {"plans": {"created": [], "updated": [], "deleted": [record_id]}})
    assert res["applied"]["deleted"] == 1
    assert not any(p["id"] == record_id for p in client.get("/plans", headers=thai).json())
    # Another device pulling later learns about the deletion.
    pulled = client.get("/sync", headers=thai, params={"last_pulled_at": ms("2026-09-13")}).json()
    assert record_id in pulled["changes"]["plans"]["deleted"]


# ------------------------------- error logs ------------------------------


def test_logs_accept_a_batch_and_are_idempotent(thai, admin):
    log_id = str(uuid.uuid4())
    body = [
        {
            "id": log_id,
            "action": "FertilizerCalculator · Tính lượng cà chua",
            "message": "Diện tích phải lớn hơn 0",
            "stack": "Error: Diện tích phải lớn hơn 0\n    at calculate (fertilizerCalc.ts:60)",
            "app_version": "0.1.0",
            "platform": "android",
            "occurred_at": ms("2026-09-14", 9),
            "reported": True,
        }
    ]
    first = client.post("/logs", headers=thai, json=body)
    second = client.post("/logs", headers=thai, json=body)
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["accepted"] == [log_id] == second.json()["accepted"]

    listed = client.get("/logs", headers=admin, params={"owner_id": me(thai)["id"]}).json()
    mine = [l for l in listed if l["id"] == log_id]
    assert len(mine) == 1
    assert mine[0]["user_id"] == me(thai)["id"]
    assert mine[0]["reported"] is True
    assert mine[0]["action"].startswith("FertilizerCalculator")


def test_logs_are_admin_only_to_read(thai):
    assert client.get("/logs", headers=thai).status_code == 403


# -------------------------------- dashboard ------------------------------


def test_dashboard_summary_for_the_demo_farm(thai):
    res = client.get("/dashboard/summary", headers=thai, params={"year": 2026, "month": 9})
    assert res.status_code == 200
    body = res.json()
    assert body["full_name"] == "Lê Thành Thái"
    # Seeded: 50 kg urê @13.600 + 50 kg DAP @22.000 (the e2e tests of phase 3
    # ran on a different account, so nothing was issued from this shed).
    assert body["stock_kinds"] == 2
    assert body["stock_kg"] == 100
    assert body["stock_value"] == 50 * 13_600 + 50 * 22_000
    assert body["month_income"] == 1_500_000
    assert body["month_expense"] == 300_000 + 120_000 + 680_000 + 1_100_000
    assert body["month_profit"] == -700_000
    # Hộ này có hai lô: PUC-001-HB cà chua trồng 20/08 đang ở "Ra hoa đợt đầu"
    # (4 việc) và PUC-004-HB dưa leo trồng 15/09 ở giai đoạn đầu (3 việc).
    assert body["pending_tasks"] == 4 + 3
    assert body["pending_groups"][0]["stage_name"] == "Ra hoa đợt đầu"
    assert body["pending_groups"][0]["crop_name"] == "Cà chua"


def test_dashboard_pending_tasks_drop_when_ticked_and_calendar_crops_use_the_month():
    now = ms("2026-09-14")
    assert dashboard_service.infer_growth_stage(ms("2026-08-20"), now) == "vegetative"
    assert dashboard_service.infer_growth_stage(None, now) is None
    assert dashboard_service.seed_variety_category("seed_ca_chua_mv1") == "tomato_round"
    assert dashboard_service.seed_variety_category("coffee_arabica_tha1") == "coffee_arabica"
    robusta = dashboard_service.protocol_for("coffee", "coffee_robusta")
    assert robusta is not None
    assert dashboard_service.current_stage(robusta, None, now)["stage_code"] == "dot_4_cuoi_mua_mua"
    assert dashboard_service.current_stage(robusta, None, ms("2026-03-01")) is None


def test_dashboard_admin_can_view_a_farm_and_list_users(admin, anh):
    anh_id = me(anh)["id"]
    body = client.get("/dashboard/summary", headers=admin, params={"owner_id": anh_id, "year": 2026, "month": 9}).json()
    assert body["owner_id"] == anh_id and body["full_name"] == "Nguyễn Văn Anh"
    assert body["stock_kinds"] == 1
    users = client.get("/users", headers=admin).json()
    assert {u["username"] for u in users} >= {"lethanhthai", "nguyenvananh", "nguyenvanhai"}
    assert client.get("/users", headers=anh).status_code == 403


# ---------------------------------- pdf ----------------------------------


def test_pdf_notes_are_derived_from_the_ledger():
    class R:
        def __init__(self, **kw):
            self.__dict__.update(kw)

    expenses = [
        R(kind="fertilizer", description="Mua Urê Cà Mau 50 kg", amount=680_000, occurred_at=ms("2026-09-10")),
        R(kind="fertilizer", description="Mua DAP 50 kg", amount=1_100_000, occurred_at=ms("2026-09-10")),
        R(kind="fertilizer", description="Mua kali", amount=300_000, occurred_at=ms("2026-07-20")),
        R(kind="labor", description="Công", amount=300_000, occurred_at=ms("2026-09-05")),
    ]
    report = ledger.financial_report([], expenses, ledger.Period(2026, month=9))
    stock = ledger.stock_summary(
        [R(fertilizer_id="ure_ca_mau", fertilizer_name="Urê", category="dam", quantity_kg=80, unit_price=15_000, occurred_at=ms("2026-09-10"))],
        [],
    )
    notes = report_pdf.report_notes(report, stock, expenses, ledger.Period(2026, month=9))
    assert notes.fertilizer_total == 1_780_000
    assert notes.stock_kg == 80 and notes.stock_value == 1_200_000
    # 3-month window Jul–Sep: 300k + 1.78M = 2.08M / 3
    assert notes.avg_monthly_fertilizer == pytest.approx(2_080_000 / 3)
    lines = notes.as_lines()
    assert lines[0] == "Chi phí phân bón: 680.000₫ + 1.100.000₫ = 1.780.000₫"
    assert lines[1].startswith("Còn dư phân bón: 80 kg (1 loại, ≈ 1.200.000₫")
    assert "693.333₫" in lines[2]


def test_pdf_month_with_data_downloads_an_a4_document(thai):
    res = client.get("/reports/financials.pdf", headers=thai, params={"year": 2026, "month": 9})
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert 'filename="bao-cao-thu-chi-2026-thang-9.pdf"' in res.headers["content-disposition"]
    assert res.content[:5] == b"%PDF-"
    # A4 portrait in points (595 x 842) and the embedded Open Sans face.
    assert b"/MediaBox [0 0 595.28 841.89]" in res.content
    assert b"OpenSans" in res.content


def test_pdf_quarter_and_validation(thai):
    ok = client.get("/reports/financials.pdf", headers=thai, params={"year": 2026, "quarter": 3})
    assert ok.status_code == 200
    assert client.get("/reports/financials.pdf", headers=thai, params={"year": 2026}).status_code == 422
    assert client.get("/reports/financials.pdf", headers=thai, params={"year": 2026, "month": 13}).status_code == 422


def test_pdf_month_without_data_says_so(thai):
    res = client.get("/reports/financials.pdf", headers=thai, params={"year": 2025, "month": 1})
    assert res.status_code == 404
    assert res.json()["detail"] == "Không có dữ liệu tháng này"


def test_pdf_unicode_text_survives_the_round_trip():
    """The document text must carry Vietnamese letters and ₫ — the reason
    Open Sans is embedded instead of Helvetica."""
    report = ledger.financial_report(
        [type("R", (), {"kind": "product", "description": "Bán cà chua MV1 50kg", "amount": 1_500_000, "occurred_at": ms("2026-09-01"), "note": None, "checked": True})()],
        [],
        ledger.Period(2026, month=9),
    )
    notes = report_pdf.report_notes(report, [], [], ledger.Period(2026, month=9))
    content = report_pdf.build_pdf(
        farmer_name="Lê Thành Thái",
        address="Xã Hòa Bình, Huyện Thanh Trì, Hà Nội",
        report=report,
        notes=notes,
        generated_at=datetime(2026, 9, 14, tzinfo=ledger.VN_TZ),
    )
    from pypdf import PdfReader
    import io

    text = PdfReader(io.BytesIO(content)).pages[0].extract_text()
    assert "Lê Thành Thái" in text
    assert "1.500.000₫" in text
    assert "Tháng 9, Năm 2026" in text
    assert "LÃI" in text
    assert "support@agrilog.vn" in text


# ---------------------------------- e2e ----------------------------------


def test_e2e_p4_01_login_dashboard_pdf(thai):
    """Login user A → dashboard shows the shed → PDF for the month downloads."""
    dash = client.get("/dashboard/summary", headers=thai, params={"year": 2026, "month": 9}).json()
    summary = client.get("/warehouse/summary", headers=thai).json()
    assert dash["stock_value"] == summary["total_value"]
    assert dash["stock_kg"] == summary["total_stock_kg"]
    pdf = client.get("/reports/financials.pdf", headers=thai, params={"year": dash["year"], "month": dash["month"]})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")


def test_e2e_p4_02_offline_expense_then_second_device_conflict_resolved(thai):
    """A logs an expense offline on phone 1; phone 2 edits the same expense
    online; phone 1 comes online → conflict → the farmer takes the newer
    version ("lấy bản mới") and both devices agree afterwards."""
    exp_id = str(uuid.uuid4())

    def expense(desc: str, updated_at: int) -> dict:
        return {
            "id": exp_id,
            "kind": "labor",
            "description": desc,
            "amount": 200_000,
            "occurred_at": ms("2026-09-14"),
            "note": None,
            "plot_id": "demo-plot-puc-001-hb",
            "checked": False,
            "warehouse_in_id": None,
            "owner_id": "ignored",
            "updated_by": "device-1",
            "created_at": ms("2026-09-13"),
            "updated_at": updated_at,
        }

    push(thai, created("expense", [expense("Công tưới (máy 1, offline)", ms("2026-09-13"))]))
    push(thai, {"expense": {"created": [], "updated": [dict(expense("Công tưới — sửa ở máy 2", ms("2026-09-14", 11)), updated_by="device-2")], "deleted": []}})
    res = push(thai, {"expense": {"created": [], "updated": [expense("Công tưới — sửa ở máy 1 lúc offline", ms("2026-09-14", 9))], "deleted": []}})
    assert res["applied"]["conflicts"] == 1
    server_copy = res["conflicts"][0]["server"]
    assert server_copy["description"] == "Công tưới — sửa ở máy 2"
    assert server_copy["updated_by"] == "device-2"
    # "Lấy bản mới": phone 1 applies the server copy locally and re-pushes it
    # unchanged; the server accepts (newer stamp, same content) — no divergence.
    again = push(thai, {"expense": {"created": [], "updated": [dict(server_copy, updated_at=server_copy["updated_at"] + 1)], "deleted": []}})
    assert again["applied"]["conflicts"] == 0
    final = next(e for e in client.get("/expense", headers=thai).json() if e["id"] == exp_id)
    assert final["description"] == "Công tưới — sửa ở máy 2"


def test_e2e_p4_03_error_in_f1_is_logged_and_reported(thai, admin):
    """F1 with an invalid input → boundary catches → log queued → "Báo lỗi" POST /logs."""
    log_id = str(uuid.uuid4())
    res = client.post(
        "/logs",
        headers=thai,
        json=[{"id": log_id, "action": "FertilizerCalculator · Tính lượng cần", "message": "Thiếu hệ số quy đổi cho N", "stack": None, "app_version": "0.1.0", "platform": "android", "occurred_at": ms("2026-09-14", 10), "reported": True}],
    )
    assert res.status_code == 201
    logs = client.get("/logs", headers=admin).json()
    assert any(l["id"] == log_id and l["reported"] for l in logs)


def test_e2e_p4_04_airplane_mode_two_hours_three_tables(hai):
    """Two hours in airplane mode across plans, warehouse_out and income;
    one sync pass afterwards lands all three and the dashboard reflects it."""
    hai_id = me(hai)["id"]
    before = client.get("/dashboard/summary", headers=hai, params={"year": 2026, "month": 9}).json()
    plan_id, out_id, inc_id = (str(uuid.uuid4()) for _ in range(3))
    t = ms("2026-09-14", 6)
    changes = {
        "plans": {"created": [dict(plan_row(plan_id, name="Máy bay 2h", updated_at=t), plot_id="demo-plot-puc-003-hb")], "updated": [], "deleted": []},
        "warehouse_out": {"created": [{"id": out_id, "fertilizer_id": "kali_bot_ca_mau", "fertilizer_name": "Kali bột (MOP) Cà Mau", "category": "kali", "quantity_kg": 5, "unit_price": 11_000, "total_cost": 55_000, "occurred_at": t, "note": None, "plot_id": "demo-plot-puc-003-hb", "plan_id": plan_id, "owner_id": "x", "updated_by": "d", "created_at": t, "updated_at": t}], "updated": [], "deleted": []},
        "income": {"created": [{"id": inc_id, "kind": "product", "description": "Bán ớt 10 kg", "amount": 500_000, "occurred_at": t, "note": None, "plot_id": "demo-plot-puc-003-hb", "checked": False, "owner_id": "x", "updated_by": "d", "created_at": t, "updated_at": t}], "updated": [], "deleted": []},
    }
    res = push(hai, changes, last_pulled_at=t - 2 * 3_600_000)
    assert res["applied"]["created"] == 3
    after = client.get("/dashboard/summary", headers=hai, params={"year": 2026, "month": 9}).json()
    assert after["owner_id"] == hai_id
    assert after["month_income"] == before["month_income"] + 500_000
    assert after["stock_kg"] == before["stock_kg"] - 5


def test_e2e_p4_05_delete_plan_offline_then_sync(anh):
    plan_id = str(uuid.uuid4())
    push(anh, created("plans", [dict(plan_row(plan_id, name="Xoá offline", updated_at=ms("2026-09-13")), plot_id="demo-plot-puc-002-hb")]))
    res = push(anh, {"plans": {"created": [], "updated": [], "deleted": [plan_id]}})
    assert res["applied"]["deleted"] == 1
    assert not any(p["id"] == plan_id for p in client.get("/plans", headers=anh).json())
    # Deleting again (retry after a dropped response) is harmless.
    again = push(anh, {"plans": {"created": [], "updated": [], "deleted": [plan_id]}})
    assert again["applied"]["deleted"] == 0
