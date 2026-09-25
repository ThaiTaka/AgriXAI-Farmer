"""Điện thoại cập nhật app (schema v6 → v7) phải nhận lại đủ cột mới.

Tìm thấy khi chạy thử V2.1 trên máy ảo: bản app cũ (v6) đã kéo các vụ trồng
mới về, nhưng schema v6 chưa có `area_m2`/`season`/`crop_name` nên WatermelonDB
bỏ chúng đi. Lên v7, các cột đó rỗng mãi — mốc `last_pulled_at` đã qua các dòng
ấy, một lần kéo thường sẽ không bao giờ gửi lại. Hậu quả thấy được: năng suất
"—" và "chưa đủ dữ liệu để gợi ý" dù lô có bốn vụ ghi sản lượng.

WatermelonDB giải bằng "migration sync": lần kéo đầu sau khi nâng schema, điện
thoại gửi kèm danh sách bảng/cột mới, máy chủ gửi lại nguyên các bảng đó.
"""

import json
from datetime import datetime

import pytest

from v21_support import assign_plot, client, make_farmer

FUTURE = 4_000_000_000_000  # a last_pulled_at later than every row

MIGRATION_6_TO_7 = {
    "from": 6,
    "tables": ["task_notes", "care_guides"],
    "columns": [
        {"table": "crop_cycles", "columns": ["crop_name", "season", "area_m2", "media_json"]},
        {"table": "expense", "columns": ["task_id", "workers", "quantity", "unit", "unit_price"]},
    ],
}


def ms(day: str) -> int:
    return int(datetime.fromisoformat(f"{day}T08:00:00+07:00").timestamp() * 1000)


@pytest.fixture(scope="module")
def farmer():
    return make_farmer("v21_migration_farmer")


def pull(headers, migration=None):
    params = {"last_pulled_at": FUTURE, "schema_version": 7}
    if migration is not None:
        params["migration"] = json.dumps(migration)
    res = client.get("/sync", params=params, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["changes"]


def test_a_plain_pull_never_resends_old_rows(farmer):
    plot = assign_plot(farmer, area=300)
    client.post(
        f"/plots/{plot}/cultivation-history",
        headers=farmer,
        json={"name": "Vụ Xuân 2025", "crop_type": "tomato", "started_at": ms("2025-02-05"),
              "ended_at": ms("2025-05-25"), "yield_kg": 1380},
    )
    changes = pull(farmer)
    assert changes["crop_cycles"] == {"created": [], "updated": [], "deleted": []}


def test_the_first_pull_after_an_upgrade_resends_the_widened_and_new_tables(farmer):
    plot = assign_plot(farmer, area=300)
    cycle = client.post(
        f"/plots/{plot}/cultivation-history",
        headers=farmer,
        json={"name": "Vụ Xuân 2026", "crop_type": "tomato", "started_at": ms("2026-02-03"),
              "ended_at": ms("2026-06-05"), "yield_kg": 1230},
    ).json()

    changes = pull(farmer, MIGRATION_6_TO_7)
    # Widened table: every row again, as "updated", with the new columns filled.
    resent = {r["id"]: r for r in changes["crop_cycles"]["updated"]}
    assert resent[cycle["id"]]["area_m2"] == 300
    assert resent[cycle["id"]]["season"] == "spring"
    # New tables: whole, as "created" (care guides are shared, so the seeded ones come too).
    assert {g["id"] for g in changes["care_guides"]["created"]} >= {"demo-guide-ca-chua-ra-hoa"}
    # Untouched tables stay incremental.
    assert changes["plots"] == {"created": [], "updated": [], "deleted": []}


def test_only_the_farmers_own_rows_are_resent(farmer):
    other = make_farmer("v21_migration_other")
    assign_plot(other)
    client.post(
        f"/plots/{assign_plot(other)}/cultivation-history",
        headers=other,
        json={"name": "Của hộ khác", "crop_type": "corn", "started_at": ms("2025-05-01"),
              "ended_at": ms("2025-08-01"), "yield_kg": 500},
    )
    names = {r["name"] for r in pull(farmer, MIGRATION_6_TO_7)["crop_cycles"]["updated"]}
    assert "Của hộ khác" not in names


def test_local_only_and_unknown_tables_are_ignored(farmer):
    changes = pull(farmer, {"from": 5, "tables": ["error_logs", "khong_co"], "columns": [{"table": "khong_co", "columns": ["x"]}]})
    assert "error_logs" not in changes


def test_a_malformed_migration_is_refused(farmer):
    bad = client.get("/sync", params={"last_pulled_at": FUTURE, "migration": "{not json"}, headers=farmer)
    assert bad.status_code == 422
    wrong_shape = client.get("/sync", params={"last_pulled_at": FUTURE, "migration": "[1, 2]"}, headers=farmer)
    assert wrong_shape.status_code == 422
