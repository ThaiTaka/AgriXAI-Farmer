"""V2.1 — ghi chú công việc kèm ảnh/video, và tiền thuê nhân công.

Tiền công là một khoản chi loại "labor" như mọi khoản chi khác, nên tự vào
Thu – Chi và báo cáo tháng mà không cần sổ thứ hai. Tổng tiền luôn do máy chủ
tính (số người × số giờ/ngày × đơn giá), không lấy số điện thoại gửi lên.
"""

from datetime import datetime

import pytest

from app.services.labor import labor_amount
from v21_support import admin, assign_plot, client, jpeg_bytes, make_farmer, make_task, pull, upload


def ms(day: str) -> int:
    return int(datetime.fromisoformat(f"{day}T08:00:00+07:00").timestamp() * 1000)


@pytest.fixture(scope="module")
def lan():
    return make_farmer("v21_task_lan")


@pytest.fixture(scope="module")
def tuan():
    return make_farmer("v21_task_tuan")


@pytest.fixture(scope="module")
def task(lan):
    return make_task(lan, assign_plot(lan))


# --------------------------------- labour sum --------------------------------


def test_labor_amount_by_hour_day_and_lump():
    # The prompt's example: 1 người × 2 giờ × 30.000₫ = 60.000₫.
    assert labor_amount("hour", 1, 2, 30_000) == 60_000
    assert labor_amount("day", 3, 1, 100_000) == 300_000
    assert labor_amount("day", 2, 1.5, 180_000) == 540_000
    assert labor_amount("lump", None, None, 450_000) == 450_000
    assert labor_amount("hour", 1, 2.5, 33_333) == 83_332  # whole đồng
    with pytest.raises(ValueError):
        labor_amount("hour", None, 2, 30_000)


# ----------------------------------- notes -----------------------------------


def test_a_text_note(lan, task):
    res = client.post(f"/tasks-history/{task}/notes", headers=lan, json={"note_text": "Bón quanh gốc, cách 10 cm"})
    assert res.status_code == 201, res.text
    note = res.json()
    assert note["task_id"] == task and note["plot_id"] is not None
    assert note["media"] == []
    listed = client.get(f"/tasks-history/{task}/notes", headers=lan).json()
    assert note["id"] in [n["id"] for n in listed]


def test_a_note_with_photos_uploaded_first(lan, task):
    photo = upload(lan, jpeg_bytes()).json()
    res = client.post(
        f"/tasks-history/{task}/notes",
        headers=lan,
        json={"note_text": "Ảnh trước khi bón", "media_ids": [photo["id"]]},
    )
    assert res.status_code == 201, res.text
    media = res.json()["media"]
    assert media == [{"id": photo["id"], "kind": "image", "mime": "image/jpeg", "uploaded": True, "url": photo["url"]}]


def test_upload_media_straight_onto_a_note(lan, task):
    note = client.post(f"/tasks-history/{task}/notes", headers=lan, json={"note_text": "Quay cách pha phân"}).json()
    res = client.post(
        f"/tasks-history/{task}/notes/{note['id']}/upload-media",
        headers=lan,
        files={"file": ("pha-phan.jpg", jpeg_bytes("blue"), "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    assert len(res.json()["media"]) == 1
    # The note changed, so a phone pulling afterwards sees the new picture.
    synced = next(r for r in pull(lan, "task_notes") if r["id"] == note["id"])
    assert '"uploaded": true' in synced["media_json"]


def test_a_note_needs_words_or_a_picture_and_real_media(lan, tuan, task):
    assert client.post(f"/tasks-history/{task}/notes", headers=lan, json={"note_text": "  "}).status_code == 422
    unknown = client.post(f"/tasks-history/{task}/notes", headers=lan, json={"media_ids": ["khong-co-that"]})
    assert unknown.status_code == 422
    # Someone else's photo cannot be attached to this farm's note.
    theirs = upload(tuan, jpeg_bytes()).json()["id"]
    assert client.post(f"/tasks-history/{task}/notes", headers=lan, json={"media_ids": [theirs]}).status_code == 422


def test_notes_stay_with_their_farm(lan, tuan, task):
    note = client.post(f"/tasks-history/{task}/notes", headers=lan, json={"note_text": "riêng"}).json()
    assert client.get(f"/tasks-history/{task}/notes", headers=tuan).status_code == 404
    assert client.delete(f"/task-notes/{note['id']}", headers=tuan).status_code == 404
    assert client.delete(f"/task-notes/{note['id']}", headers=lan).status_code == 204
    assert note["id"] not in [n["id"] for n in client.get(f"/tasks-history/{task}/notes", headers=lan).json()]


# ------------------------------- labour costs --------------------------------


def test_hire_labour_for_a_task_and_see_it_in_the_ledger(lan, task):
    res = client.post(
        f"/tasks-history/{task}/labor-costs",
        headers=lan,
        json={"description": "Thuê bón phân lô 1", "unit": "hour", "workers": 1, "quantity": 2,
              "unit_price": 30_000, "occurred_at": ms("2026-09-12")},
    )
    assert res.status_code == 201, res.text
    cost = res.json()
    assert cost["amount"] == 60_000
    assert cost["task_id"] == task and cost["unit"] == "hour"

    # It is an ordinary "labor" expense: Thu – Chi and the report include it.
    expenses = client.get("/expense", headers=lan).json()
    row = next(e for e in expenses if e["id"] == cost["id"])
    assert row["kind"] == "labor" and row["workers"] == 1 and row["unit_price"] == 30_000
    report = client.get("/reports/financials", params={"year": 2026, "month": 9}, headers=lan).json()
    assert report["expense_by_kind"]["labor"] >= 60_000

    listed = client.get(f"/tasks-history/{task}/labor-costs", headers=lan).json()
    assert [c["id"] for c in listed] == [cost["id"]]


def test_the_server_computes_the_total(lan, task):
    body = client.post(
        f"/tasks-history/{task}/labor-costs",
        headers=lan,
        json={"description": "Làm cỏ", "unit": "day", "workers": 2, "quantity": 1.5,
              "unit_price": 180_000, "amount": 1},  # a client "amount" is ignored
    ).json()
    assert body["amount"] == 540_000

    lump = client.post(
        f"/tasks-history/{task}/labor-costs",
        headers=lan,
        json={"description": "Khoán làm giàn", "unit": "lump", "workers": 4, "quantity": 9, "unit_price": 450_000},
    ).json()
    assert lump["amount"] == 450_000
    assert lump["workers"] is None and lump["quantity"] is None


def test_edit_recomputes_and_delete_removes(lan, task):
    cost = client.post(
        f"/tasks-history/{task}/labor-costs",
        headers=lan,
        json={"description": "Phun thuốc", "unit": "hour", "workers": 1, "quantity": 3, "unit_price": 35_000},
    ).json()
    edited = client.patch(f"/labor-costs/{cost['id']}", headers=lan, json={"workers": 2}).json()
    assert edited["amount"] == 210_000
    to_lump = client.patch(f"/labor-costs/{cost['id']}", headers=lan, json={"unit": "lump", "unit_price": 200_000}).json()
    assert to_lump["amount"] == 200_000 and to_lump["workers"] is None
    assert client.delete(f"/labor-costs/{cost['id']}", headers=lan).status_code == 204
    assert cost["id"] not in [e["id"] for e in client.get("/expense", headers=lan).json()]


def test_labour_needs_a_breakdown_unless_it_is_a_lump_sum(lan, task):
    res = client.post(
        f"/tasks-history/{task}/labor-costs",
        headers=lan,
        json={"description": "Thiếu số người", "unit": "hour", "quantity": 2, "unit_price": 30_000},
    )
    assert res.status_code == 422


def test_labour_stays_with_its_farm_and_admins_can_correct_it(lan, tuan, task):
    cost = client.post(
        f"/tasks-history/{task}/labor-costs",
        headers=lan,
        json={"description": "Tưới", "unit": "hour", "workers": 1, "quantity": 1, "unit_price": 25_000},
    ).json()
    assert client.get(f"/tasks-history/{task}/labor-costs", headers=tuan).status_code == 404
    assert client.patch(f"/labor-costs/{cost['id']}", headers=tuan, json={"workers": 9}).status_code == 404
    fixed = client.patch(f"/labor-costs/{cost['id']}", headers=admin(), json={"quantity": 2})
    assert fixed.status_code == 200 and fixed.json()["amount"] == 50_000
    assert fixed.json()["owner_id"] == cost["owner_id"]
