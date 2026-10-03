"""V2.2 — thông báo xuống điện thoại.

Quản trị viên gửi cho mọi nông hộ hoặc một nông hộ; thông báo về máy qua
/sync như hướng dẫn chăm sóc, nên mở được cả khi mất sóng. Nông hộ chỉ đọc —
không qua REST, không qua /sync — và đánh dấu "đã xem" bằng bảng
notification_reads của chính mình, để trang quản trị biết thông báo đã tới
bao nhiêu nông hộ. Mỗi giá phân mới cũng thành một thông báo, gộp lại khi
quản trị viên nhập nhiều giá liền nhau.
"""

import time
import uuid

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from v21_support import PASSWORD, admin, client, login, make_farmer, pull, push, user_id


@pytest.fixture(scope="module")
def anh():
    return make_farmer("v22_notice_anh")


@pytest.fixture(scope="module")
def binh():
    return make_farmer("v22_notice_binh")


def make_admin(username: str) -> dict[str, str]:
    """A second administrator, so price digests here do not fold into ones
    other test modules opened with the seeded admin."""
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(id=str(uuid.uuid4()), username=username)
            db.add(user)
        user.password_hash = hash_password(PASSWORD)
        user.full_name = "Quản trị giá"
        user.role = UserRole.ADMIN
        user.is_active = True
        db.commit()
    return login(username)


def send(headers, **fields):
    return client.post("/notifications", headers=headers, json={"title": "Họp tổ hợp tác", "body": "8 giờ sáng thứ Bảy", **fields})


def read_mark(notification_id: str, at: int) -> dict:
    return {
        "notification_reads": {
            "created": [
                {
                    "id": f"read-{uuid.uuid4().hex[:12]}",
                    "notification_id": notification_id,
                    "read_at": at,
                    "owner_id": "ignored",
                    "created_at": at,
                    "updated_at": at,
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }


def test_a_broadcast_reaches_every_farm_through_sync(anh, binh):
    res = send(admin(), level="warning")
    assert res.status_code == 201, res.text
    notice = res.json()
    assert notice["owner_id"] is None
    assert notice["audience_label"] == "Mọi nông hộ"
    assert notice["kind"] == "announcement"

    for farm in (anh, binh):
        ids = {row["id"] for row in pull(farm, "notifications")}
        assert notice["id"] in ids


def test_a_message_for_one_farm_reaches_only_that_farm(anh, binh):
    notice = send(admin(), title="Lô PUC-001 đến lịch kiểm tra", owner_id=user_id(anh)).json()
    assert notice["audience_label"] == "Nông hộ v22_notice_anh"
    assert notice["id"] in {row["id"] for row in pull(anh, "notifications")}
    assert notice["id"] not in {row["id"] for row in pull(binh, "notifications")}
    # REST shows the same scope.
    assert notice["id"] not in {row["id"] for row in client.get("/notifications", headers=binh).json()}


def test_a_message_to_an_unknown_account_is_refused():
    assert send(admin(), owner_id="no-such-user").status_code == 422


def test_farmers_cannot_write_notifications_any_way(anh):
    notice = send(admin()).json()
    assert send(anh).status_code == 403
    assert client.patch(f"/notifications/{notice['id']}", headers=anh, json={"title": "x"}).status_code == 403
    assert client.delete(f"/notifications/{notice['id']}", headers=anh).status_code == 403

    stamp = int(time.time() * 1000) + 60_000
    body = push(
        anh,
        {
            "notifications": {
                "created": [{"id": f"fake-{uuid.uuid4().hex[:8]}", "title": "Giả mạo", "body": "", "kind": "announcement", "level": "info", "created_at": stamp, "updated_at": stamp}],
                "updated": [{**notice, "title": "Sửa trộm", "updated_at": stamp}],
                "deleted": [notice["id"]],
            }
        },
    )
    assert {r["reason"] for r in body["rejected"]} == {"admin_only_write"}
    assert len(body["rejected"]) == 3
    still = next(r for r in client.get("/notifications", headers=anh).json() if r["id"] == notice["id"])
    assert still["title"] == "Họp tổ hợp tác"


def test_read_marks_sync_back_and_count_for_the_admin(anh, binh):
    boss = admin()
    notice = send(boss, title="Lịch tiêm phòng").json()
    assert notice["read_count"] == 0
    assert notice["audience_size"] >= 2

    push(anh, read_mark(notice["id"], int(time.time() * 1000) + 1000))
    row = next(r for r in client.get("/notifications", headers=boss).json() if r["id"] == notice["id"])
    assert row["read_count"] == 1
    assert next(r for r in client.get("/notifications", headers=anh).json() if r["id"] == notice["id"])["read"] is True
    assert next(r for r in client.get("/notifications", headers=binh).json() if r["id"] == notice["id"])["read"] is False
    # The mark is the farm's own record: it comes back to that farm only.
    assert any(r["notification_id"] == notice["id"] for r in pull(anh, "notification_reads"))
    assert not any(r["notification_id"] == notice["id"] for r in pull(binh, "notification_reads"))


def test_an_edited_message_counts_as_unread_again(anh):
    boss = admin()
    notice = send(boss, title="Giờ họp").json()
    push(anh, read_mark(notice["id"], notice["updated_at"]))
    assert next(r for r in client.get("/notifications", headers=anh).json() if r["id"] == notice["id"])["read"] is True

    time.sleep(0.02)
    client.patch(f"/notifications/{notice['id']}", headers=boss, json={"body": "Dời sang 9 giờ"})
    edited = next(r for r in client.get("/notifications", headers=anh).json() if r["id"] == notice["id"])
    assert edited["body"] == "Dời sang 9 giờ"
    assert edited["updated_at"] > notice["updated_at"]
    assert edited["read"] is False


def test_a_retracted_message_leaves_the_phones(anh):
    boss = admin()
    notice = send(boss, title="Gửi nhầm").json()
    before = client.get("/sync", headers=anh).json()["timestamp"]
    assert client.delete(f"/notifications/{notice['id']}", headers=boss).status_code == 204
    changes = client.get("/sync", params={"last_pulled_at": before - 1}, headers=anh).json()["changes"]
    assert notice["id"] in changes["notifications"]["deleted"]
    assert notice["id"] not in {r["id"] for r in client.get("/notifications", headers=boss).json()}


def test_each_new_price_is_announced_and_quick_changes_fold_into_one(anh):
    boss = make_admin("v22_price_admin")
    now = int(time.time() * 1000)

    def price(fertilizer_id: str, value: float):
        res = client.post("/fertilizer-prices", headers=boss, json={"fertilizer_id": fertilizer_id, "price_per_kg": value, "effective_from": now})
        assert res.status_code == 201, res.text

    def digest():
        rows = [r for r in client.get("/notifications", params={"kind": "price"}, headers=boss).json() if r["created_by"] == user_id(boss)]
        assert len(rows) == 1, rows
        return rows[0]

    price("kali_bot_phu_my", 12000)
    first = digest()
    assert first["title"] == "Giá Kali bột (MOP) Phú Mỹ mới cập nhật"
    assert first["link"] == "prices:kali_bot_phu_my"
    assert first["owner_id"] is None

    price("kali_bot_phu_my", 12500)  # same product again: its line is replaced
    price("ure_phu_my", 13200)
    folded = digest()
    assert folded["id"] == first["id"]
    assert folded["title"] == "Giá 2 loại phân bón mới cập nhật"
    assert folded["link"] == "prices"
    lines = folded["body"].split("\n")
    assert len(lines) == 2
    assert lines[0] == "Kali bột (MOP) Phú Mỹ: 12.500 đ/kg (tăng từ 12.000 đ)"
    assert lines[1].startswith("Urê Phú Mỹ: 13.200 đ/kg")
    # And it reaches the phones like any broadcast.
    assert folded["id"] in {r["id"] for r in pull(anh, "notifications")}


def test_a_price_entered_ahead_of_time_says_when_it_applies():
    boss = make_admin("v22_future_price_admin")
    later = int(time.time() * 1000) + 3 * 86_400_000
    client.post("/fertilizer-prices", headers=boss, json={"fertilizer_id": "ure_ha_bac", "price_per_kg": 12800, "effective_from": later})
    rows = [r for r in client.get("/notifications", params={"kind": "price"}, headers=boss).json() if r["created_by"] == user_id(boss)]
    assert "áp dụng từ" in rows[0]["body"]
