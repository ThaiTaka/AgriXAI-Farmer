"""Sync protocol tests, including the two-device conflict case required by Mục 9.

Plots are handed out by land management, so a farmer cannot create one — not
through POST /plots and not through a sync push either (the phone could
otherwise sync around the rule). The plots these tests edit are therefore
created by an admin and assigned to the farmer, exactly as production does it.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import iter_seed_varieties, run as run_seed

run_seed()
client = TestClient(app)


@pytest.fixture(scope="module")
def token() -> str:
    res = client.post(
        "/auth/login",
        json={
            "username": settings.seed_farmer_username,
            "password": settings.seed_farmer_password,
        },
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token() -> str:
    res = client.post(
        "/auth/login",
        json={
            "username": settings.seed_admin_username,
            "password": settings.seed_admin_password,
        },
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def farmer_id(token: str) -> str:
    return client.get("/auth/me", headers=auth(token)).json()["id"]


def assign_plot(admin_token: str, token: str, record_id: str, name: str) -> dict:
    """Land management creates a plot and hands it to the farmer."""
    res = client.post(
        "/plots",
        headers=auth(admin_token),
        json={
            "id": record_id,
            "owner_id": farmer_id(token),
            "code": "PUC-2609-TEST",
            "name": name,
            "region": "Cam Ly",
            "area": 1200.0,
            "area_unit": "m2",
            "crop_type": "tomato",
            "crop_name": "Cà chua",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def cycle_row(record_id: str, name: str, updated_at: int, **overrides) -> dict:
    row = {
        "id": record_id,
        "plot_id": f"plot-{record_id}",
        "name": name,
        "crop_type": "tomato",
        "variety_id": None,
        "variety_name": None,
        "stage": "seedling",
        "started_at": updated_at,
        "ended_at": None,
        "yield_kg": None,
        "notes": None,
        "owner_id": "ignored-by-server",
        "updated_by": "device",
        "created_at": updated_at,
        "updated_at": updated_at,
    }
    row.update(overrides)
    return row


def plot_row(record_id: str, name: str, updated_at: int, **overrides) -> dict:
    row = {
        "id": record_id,
        "code": "PUC-2609-TEST",
        "name": name,
        "region": "Cam Ly",
        "area": 1200.0,
        "area_unit": "m2",
        "crop_type": "tomato",
        "crop_name": "Cà chua",
        "variety_id": None,
        "variety_name": None,
        "planted_at": None,
        "status": "active",
        "notes": None,
        "owner_id": "ignored-by-server",
        "updated_by": "device",
        "created_at": updated_at,
        "updated_at": updated_at,
    }
    row.update(overrides)
    return row


def empty_changes() -> dict:
    return {
        table: {"created": [], "updated": [], "deleted": []}
        for table in ("plots", "crop_varieties", "crop_cycles", "change_logs")
    }


def test_pull_first_sync_returns_seed_varieties(token: str):
    res = client.get("/sync", headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert "timestamp" in body
    varieties = body["changes"]["crop_varieties"]["created"]
    expected = sum(1 for _ in iter_seed_varieties())
    assert len(varieties) == expected, "toàn bộ giống trong danh mục seed phải đồng bộ xuống máy"
    assert all(v["is_seed"] for v in varieties)
    # Every seeded row carries the two upper catalogue levels.
    assert all(v["category_id"] and v["category_name"] and v["crop_name"] for v in varieties)
    assert {v["crop_type"] for v in varieties} >= {"tomato", "coffee", "cucumber", "chili"}


def test_push_then_pull_roundtrip(token: str):
    """A record created offline reaches the server and comes back on the next
    pull — tested on crop_cycles, a table the farmer does own end to end."""
    record_id = str(uuid.uuid4())
    changes = empty_changes()
    changes["crop_cycles"]["created"] = [cycle_row(record_id, "Vụ đông 2026", 1_000)]

    res = client.post("/sync", headers=auth(token), json=changes)
    assert res.status_code == 200
    assert res.json()["applied"]["created"] == 1

    pulled = client.get("/sync", params={"last_pulled_at": 500}, headers=auth(token))
    rows = pulled.json()["changes"]["crop_cycles"]["created"]
    saved = next(r for r in rows if r["id"] == record_id)
    assert saved["name"] == "Vụ đông 2026"
    # The server must ignore the client-supplied owner and file the row under the
    # authenticated user instead.
    assert saved["owner_id"] != "ignored-by-server"


def test_farmer_cannot_create_a_plot_through_sync(token: str):
    """The phone has no "thêm lô" button, and the server does not take one
    through the back door either: a pushed plot is rejected, with a reason the
    app can show, and never reaches the database."""
    record_id = str(uuid.uuid4())
    changes = empty_changes()
    changes["plots"]["created"] = [plot_row(record_id, "Lô tự thêm", 9_000)]

    res = client.post("/sync", headers=auth(token), json=changes)
    assert res.status_code == 200
    body = res.json()
    assert body["applied"]["created"] == 0
    assert body["applied"]["rejected"] == 1
    assert body["rejected"][0]["table"] == "plots"
    assert body["rejected"][0]["reason"] == "admin_only_create"

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    plots = pulled.json()["changes"]["plots"]
    assert record_id not in {r["id"] for r in plots["created"] + plots["updated"]}


def test_farmer_may_still_edit_the_plot_they_were_given(admin_token: str, token: str):
    """Creating land is management's job; recording what grows on it is the
    farmer's, and that must keep working."""
    record_id = str(uuid.uuid4())
    assigned = assign_plot(admin_token, token, record_id, "Lô được giao")

    changes = empty_changes()
    changes["plots"]["updated"] = [
        plot_row(record_id, "Lô được giao (đã trồng)", assigned["updated_at"] + 1_000)
    ]
    res = client.post("/sync", headers=auth(token), json=changes)
    assert res.status_code == 200
    assert res.json()["applied"]["updated"] == 1
    assert res.json()["applied"]["rejected"] == 0

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    plots = pulled.json()["changes"]["plots"]
    saved = next(r for r in plots["created"] + plots["updated"] if r["id"] == record_id)
    assert saved["name"] == "Lô được giao (đã trồng)"
    assert saved["owner_id"] == farmer_id(token), "lô vẫn thuộc về nông hộ được giao"


def test_two_devices_edit_offline_last_write_wins(admin_token: str, token: str):
    """Device A and device B both edit the same plot while offline, then sync
    one after the other. The later `updated_at` must win, and the earlier one
    must be reported as a conflict rather than silently overwriting."""
    record_id = str(uuid.uuid4())
    assigned = assign_plot(admin_token, token, record_id, "Tên gốc")
    handover = assigned["updated_at"]

    # Device B edited later in wall-clock terms but syncs FIRST.
    push_b = empty_changes()
    push_b["plots"]["updated"] = [plot_row(record_id, "Sửa bởi máy B", handover + 3_000)]
    res_b = client.post("/sync", headers=auth(token), json=push_b)
    assert res_b.json()["applied"]["updated"] == 1

    # Device A edited earlier and syncs second — its write must lose.
    push_a = empty_changes()
    push_a["plots"]["updated"] = [plot_row(record_id, "Sửa bởi máy A", handover + 2_000)]
    res_a = client.post("/sync", headers=auth(token), json=push_a)
    assert res_a.json()["applied"]["conflicts"] == 1
    assert res_a.json()["applied"]["updated"] == 0

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    plots = pulled.json()["changes"]["plots"]
    rows = plots["created"] + plots["updated"]
    saved = next(r for r in rows if r["id"] == record_id)
    assert saved["name"] == "Sửa bởi máy B", "bản ghi mới hơn phải thắng"


def test_push_create_is_idempotent_after_a_dropped_response(token: str):
    """A phone that loses the connection mid-push retries the same batch. The
    retry must not fail or duplicate — this is the 'mất mạng giữa chừng' case."""
    record_id = str(uuid.uuid4())
    changes = empty_changes()
    changes["crop_cycles"]["created"] = [cycle_row(record_id, "Vụ thử lại", 5_000)]

    first = client.post("/sync", headers=auth(token), json=changes)
    second = client.post("/sync", headers=auth(token), json=changes)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["applied"]["created"] == 1
    # The retry is absorbed as an update (or a conflict), never a duplicate row.
    assert second.json()["applied"]["created"] == 0

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    cycles = pulled.json()["changes"]["crop_cycles"]
    rows = cycles["created"] + cycles["updated"]
    assert len([r for r in rows if r["id"] == record_id]) == 1


def test_delete_is_reported_to_other_devices(admin_token: str, token: str):
    record_id = str(uuid.uuid4())
    assign_plot(admin_token, token, record_id, "Lô sẽ xoá")

    remove = empty_changes()
    remove["plots"]["deleted"] = [record_id]
    res = client.post("/sync", headers=auth(token), json=remove)
    assert res.json()["applied"]["deleted"] == 1

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    assert record_id in pulled.json()["changes"]["plots"]["deleted"]


def test_sync_requires_authentication():
    assert client.get("/sync").status_code == 401
    assert client.post("/sync", json=empty_changes()).status_code == 401
