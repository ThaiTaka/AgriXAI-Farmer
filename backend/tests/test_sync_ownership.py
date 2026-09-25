"""Một hộ không sửa, không xoá được bản ghi của hộ khác qua /sync.

Lỗi tìm thấy khi làm V2.1: `push_changes` áp mọi `updated`/`deleted` vào bất
cứ id nào điện thoại gửi lên, không hỏi bản ghi đó của ai. Mã lô đất demo đoán
được ("demo-plot-puc-002-hb"), nên chỉ một lệnh đẩy
`{"plots": {"deleted": ["demo-plot-puc-002-hb"]}}` từ tài khoản ông Thái là xoá
được lô của anh Anh. Chặn cả đường vòng: một bản "created" mang id đã có của
người khác trước đây được coi như bản sửa.
"""

import uuid

import pytest

from v21_support import admin, assign_plot, client, make_farmer, make_task, pull, push


@pytest.fixture(scope="module")
def chu():
    return make_farmer("v21_own_chu")


@pytest.fixture(scope="module")
def la():
    """A stranger — another farm in the same commune."""
    return make_farmer("v21_own_la")


def plot_of(headers, plot_id):
    return next((p for p in client.get("/plots", headers=headers).json() if p["id"] == plot_id), None)


def plot_row(plot_id: str, name: str, stamp: int) -> dict:
    return {
        "id": plot_id, "code": "PUC-V21-TEST", "name": name, "region": None, "area": 1.0,
        "area_unit": "m2", "crop_type": "tomato", "crop_name": "Cà chua", "variety_id": None,
        "variety_name": None, "planted_at": None, "status": "active", "notes": None,
        "owner_id": "x", "updated_by": "x", "created_at": stamp, "updated_at": stamp,
    }


def test_a_stranger_cannot_delete_someone_elses_plot(chu, la):
    plot = assign_plot(chu)
    body = push(la, {"plots": {"created": [], "updated": [], "deleted": [plot]}})
    assert body["applied"]["deleted"] == 0
    assert body["rejected"] == [
        {"table": "plots", "id": plot, "reason": "not_owner", "message": "Bản ghi này không thuộc tài khoản của bạn."}
    ]
    assert plot_of(chu, plot) is not None


def test_a_stranger_cannot_overwrite_someone_elses_plot(chu, la):
    plot = assign_plot(chu)
    future = 4_000_000_000_000  # would win any last-write-wins race
    body = push(la, {"plots": {"created": [], "updated": [plot_row(plot, "Lô bị chiếm", future)], "deleted": []}})
    assert body["applied"]["updated"] == 0 and body["applied"]["rejected"] == 1
    assert plot_of(chu, plot)["name"] == "Lô thử V2.1"


def test_a_create_naming_an_existing_id_is_not_a_back_door(chu, la):
    task = make_task(chu, assign_plot(chu))
    note_id = f"note-{uuid.uuid4().hex[:8]}"
    stamp = 1_790_000_000_000
    note = {
        "id": note_id, "task_id": task, "plot_id": None, "note_text": "của chủ", "media_json": None,
        "occurred_at": stamp, "owner_id": "x", "updated_by": "x", "created_at": stamp, "updated_at": stamp,
    }
    push(chu, {"task_notes": {"created": [note], "updated": [], "deleted": []}})
    stolen = {**note, "note_text": "của người lạ", "updated_at": stamp + 1}
    body = push(la, {"task_notes": {"created": [stolen], "updated": [], "deleted": []}})
    assert body["rejected"][0]["reason"] == "not_owner"
    [row] = [r for r in pull(chu, "task_notes") if r["id"] == note_id]
    assert row["note_text"] == "của chủ"
    assert note_id not in [r["id"] for r in pull(la, "task_notes")]


def test_the_owner_still_edits_and_deletes_their_own_rows(chu):
    task = make_task(chu, assign_plot(chu))
    stamp = 1_790_000_000_000
    row = next(r for r in pull(chu, "tasks_history") if r["id"] == task)
    body = push(chu, {"tasks_history": {"created": [], "updated": [{**row, "note": "đã sửa", "updated_at": stamp + 10}], "deleted": []}})
    assert body["applied"]["updated"] == 1
    body = push(chu, {"tasks_history": {"created": [], "updated": [], "deleted": [task]}})
    assert body["applied"]["deleted"] == 1


def test_seed_varieties_are_nobody_elses_to_change_but_a_proposal_is_its_authors(chu, la):
    seeded = next(r for r in pull(chu, "crop_varieties") if r.get("source") == "seed")
    body = push(chu, {"crop_varieties": {"created": [], "updated": [], "deleted": [seeded["id"]]}})
    assert body["rejected"][0]["reason"] == "not_owner"

    mine = str(uuid.uuid4())
    me = client.get("/auth/me", headers=chu).json()["id"]
    stamp = 1_790_000_000_000
    variety = {
        "id": mine, "seed_key": None, "name": "Giống nhà tôi", "crop_type": "tomato", "crop_name": "Cà chua",
        "category_id": None, "category_name": None, "description": None, "usage": None, "growing_note": None,
        "badge": None, "is_seed": False, "approved": False, "source": "user", "created_by": me,
        "created_at": stamp, "updated_at": stamp,
    }
    push(chu, {"crop_varieties": {"created": [variety], "updated": [], "deleted": []}})
    renamed = {**variety, "name": "Giống nhà tôi (sửa)", "updated_at": stamp + 5}
    assert push(la, {"crop_varieties": {"created": [], "updated": [renamed], "deleted": []}})["applied"]["rejected"] == 1
    assert push(chu, {"crop_varieties": {"created": [], "updated": [renamed], "deleted": []}})["applied"]["updated"] == 1


def test_an_admin_may_correct_any_farms_rows(chu):
    plot = assign_plot(chu)
    stamp = 4_000_000_000_000
    body = push(admin(), {"plots": {"created": [], "updated": [plot_row(plot, "Admin sửa hộ", stamp)], "deleted": []}})
    assert body["applied"]["updated"] == 1
    fixed = plot_of(chu, plot)
    assert fixed["name"] == "Admin sửa hộ"
    assert fixed["owner_id"] == client.get("/auth/me", headers=chu).json()["id"]
