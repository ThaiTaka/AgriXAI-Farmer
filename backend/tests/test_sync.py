"""Sync protocol tests, including the two-device conflict case required by Mục 9."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

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


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def plot_row(record_id: str, name: str, updated_at: int, **overrides) -> dict:
    row = {
        "id": record_id,
        "code": "PUC-2609-TEST",
        "name": name,
        "region": "Cam Ly",
        "area": 1200.0,
        "area_unit": "m2",
        "crop_type": "ca_chua",
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
        for table in ("plots", "crop_varieties", "diagnoses", "crop_cycles", "change_logs")
    }


def test_pull_first_sync_returns_seed_varieties(token: str):
    res = client.get("/sync", headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert "timestamp" in body
    varieties = body["changes"]["crop_varieties"]["created"]
    assert len(varieties) == 8, "8 giống cà chua từ seed phải đồng bộ xuống máy"
    assert all(v["is_seed"] for v in varieties)


def test_push_then_pull_roundtrip(token: str):
    record_id = str(uuid.uuid4())
    changes = empty_changes()
    changes["plots"]["created"] = [plot_row(record_id, "Vườn nhà trên", 1_000)]

    res = client.post("/sync", headers=auth(token), json=changes)
    assert res.status_code == 200
    assert res.json()["applied"]["created"] == 1

    pulled = client.get("/sync", params={"last_pulled_at": 500}, headers=auth(token))
    rows = pulled.json()["changes"]["plots"]["created"]
    saved = next(r for r in rows if r["id"] == record_id)
    assert saved["name"] == "Vườn nhà trên"
    # The server must ignore the client-supplied owner and file the row under the
    # authenticated user instead.
    assert saved["owner_id"] != "ignored-by-server"


def test_two_devices_edit_offline_last_write_wins(token: str):
    """Device A and device B both edit the same plot while offline, then sync
    one after the other. The later `updated_at` must win, and the earlier one
    must be reported as a conflict rather than silently overwriting."""
    record_id = str(uuid.uuid4())

    create = empty_changes()
    create["plots"]["created"] = [plot_row(record_id, "Tên gốc", 1_000)]
    client.post("/sync", headers=auth(token), json=create)

    # Device B edited later in wall-clock terms but syncs FIRST.
    push_b = empty_changes()
    push_b["plots"]["updated"] = [plot_row(record_id, "Sửa bởi máy B", 3_000)]
    res_b = client.post("/sync", headers=auth(token), json=push_b)
    assert res_b.json()["applied"]["updated"] == 1

    # Device A edited earlier and syncs second — its write must lose.
    push_a = empty_changes()
    push_a["plots"]["updated"] = [plot_row(record_id, "Sửa bởi máy A", 2_000)]
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
    changes["plots"]["created"] = [plot_row(record_id, "Lô thử lại", 5_000)]

    first = client.post("/sync", headers=auth(token), json=changes)
    second = client.post("/sync", headers=auth(token), json=changes)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["applied"]["created"] == 1
    # The retry is absorbed as an update (or a conflict), never a duplicate row.
    assert second.json()["applied"]["created"] == 0

    pulled = client.get("/sync", params={"last_pulled_at": 1}, headers=auth(token))
    plots = pulled.json()["changes"]["plots"]
    rows = plots["created"] + plots["updated"]
    assert len([r for r in rows if r["id"] == record_id]) == 1


def test_delete_is_reported_to_other_devices(token: str):
    record_id = str(uuid.uuid4())
    create = empty_changes()
    create["plots"]["created"] = [plot_row(record_id, "Lô sẽ xoá", 7_000)]
    client.post("/sync", headers=auth(token), json=create)

    remove = empty_changes()
    remove["plots"]["deleted"] = [record_id]
    res = client.post("/sync", headers=auth(token), json=remove)
    assert res.json()["applied"]["deleted"] == 1

    pulled = client.get("/sync", params={"last_pulled_at": 6_000}, headers=auth(token))
    assert record_id in pulled.json()["changes"]["plots"]["deleted"]


def test_sync_requires_authentication():
    assert client.get("/sync").status_code == 401
    assert client.post("/sync", json=empty_changes()).status_code == 401
