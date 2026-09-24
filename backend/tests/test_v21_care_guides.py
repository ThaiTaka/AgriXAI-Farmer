"""V2.1 — hướng dẫn chăm sóc: video YouTube nhúng + ảnh từng bước.

Quản trị viên soạn trên web-admin; mọi nông hộ đọc, kể cả khi không có sóng
(hướng dẫn về máy qua /sync như danh mục giống). Nông hộ không sửa được —
không qua REST, không qua /sync.
"""

import uuid

import pytest

from app.schemas.care_guide import youtube_id_of
from v21_support import admin, client, jpeg_bytes, make_farmer, pull, push, upload

VIDEO = "dQw4w9WgXcQ"


@pytest.fixture(scope="module")
def farmer():
    return make_farmer("v21_guide_farmer")


def create(headers, **fields):
    body = {"crop_type": "tomato", "title": "Bón thúc cà chua", "published": True, **fields}
    return client.post("/care-guides", headers=headers, json=body)


@pytest.mark.parametrize(
    "value",
    [
        VIDEO,
        f"https://www.youtube.com/watch?v={VIDEO}",
        f"https://youtube.com/watch?feature=share&v={VIDEO}",
        f"https://youtu.be/{VIDEO}?si=abc",
        f"https://m.youtube.com/watch?v={VIDEO}",
        f"https://www.youtube.com/shorts/{VIDEO}",
        f"https://www.youtube.com/embed/{VIDEO}",
        f"youtu.be/{VIDEO}",
    ],
)
def test_any_usual_youtube_link_gives_the_id(value):
    assert youtube_id_of(value) == VIDEO


@pytest.mark.parametrize("value", ["https://vimeo.com/123", "https://youtube.com/watch?v=short", "not a link"])
def test_other_links_are_refused(value):
    with pytest.raises(ValueError):
        youtube_id_of(value)


def test_admin_writes_a_guide_with_video_and_illustrated_steps():
    boss = admin()
    picture = upload(boss, jpeg_bytes(), public="true").json()["id"]
    res = create(
        boss,
        stage_code="vegetative",
        summary="Lần bón thúc thứ nhất, sau trồng 15–20 ngày.",
        youtube=f"https://youtu.be/{VIDEO}",
        steps=[
            {"title": "Xới nhẹ quanh gốc", "body": "Cách gốc 10–15 cm.", "image_id": picture},
            {"title": "Rải phân, lấp đất, tưới", "body": "Tưới ẩm ngay sau khi bón."},
        ],
        image_ids=[picture],
        source_name="Viện Nghiên cứu Rau quả",
        source_url="https://vegetables.org.vn",
    )
    assert res.status_code == 201, res.text
    guide = res.json()
    assert guide["youtube_id"] == VIDEO
    assert [s["title"] for s in guide["steps"]] == ["Xới nhẹ quanh gốc", "Rải phân, lấp đất, tưới"]
    assert guide["steps"][0]["image_id"] == picture
    assert guide["image_ids"] == [picture]


def test_farmers_read_but_never_write(farmer):
    guide = create(admin()).json()
    assert create(farmer).status_code == 403
    assert client.patch(f"/care-guides/{guide['id']}", headers=farmer, json={"title": "x"}).status_code == 403
    assert client.delete(f"/care-guides/{guide['id']}", headers=farmer).status_code == 403
    assert client.get(f"/care-guides/{guide['id']}", headers=farmer).status_code == 200
    assert guide["id"] in [g["id"] for g in client.get("/crops/tomato/care-guides", headers=farmer).json()]


def test_drafts_are_for_admins_only(farmer):
    draft = create(admin(), title="Nháp", published=False).json()
    assert client.get(f"/care-guides/{draft['id']}", headers=farmer).status_code == 404
    assert draft["id"] not in [g["id"] for g in client.get("/care-guides", headers=farmer).json()]
    assert draft["id"] in [g["id"] for g in client.get("/care-guides", headers=admin()).json()]
    published = client.patch(f"/care-guides/{draft['id']}", headers=admin(), json={"published": True}).json()
    assert published["published"] is True
    assert client.get(f"/care-guides/{draft['id']}", headers=farmer).status_code == 200


def test_pictures_must_be_public_uploads(farmer):
    private = upload(admin(), jpeg_bytes()).json()["id"]
    assert create(admin(), image_ids=[private]).status_code == 422
    assert create(admin(), steps=[{"title": "Bước", "image_id": "khong-co"}]).status_code == 422
    assert create(admin(), youtube="https://vimeo.com/1").status_code == 422
    assert create(admin(), crop_type="Cà Chua!").status_code == 422
    assert create(admin(), source_url="javascript:alert(1)").status_code == 422


def test_upload_image_adds_a_public_picture(farmer):
    guide = create(admin()).json()
    res = client.post(
        f"/care-guides/{guide['id']}/upload-image",
        headers=admin(),
        files={"file": ("buoc-1.jpg", jpeg_bytes("yellow"), "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    [image_id] = res.json()["image_ids"]
    # Anyone — the phone without a token included — can load it.
    assert client.get(f"/media/{image_id}").status_code == 200


def test_edit_and_delete(farmer):
    guide = create(admin()).json()
    edited = client.patch(
        f"/care-guides/{guide['id']}",
        headers=admin(),
        json={"title": "Bón thúc lần 1", "youtube": None, "steps": [{"title": "Một bước"}]},
    ).json()
    assert edited["title"] == "Bón thúc lần 1" and edited["youtube_id"] is None
    assert [s["title"] for s in edited["steps"]] == ["Một bước"]
    assert client.delete(f"/care-guides/{guide['id']}", headers=admin()).status_code == 204
    assert client.get(f"/care-guides/{guide['id']}", headers=admin()).status_code == 404


def guide_row(record_id: str, title: str) -> dict:
    stamp = 1_790_000_000_000
    return {
        "id": record_id, "crop_type": "tomato", "stage_code": None, "title": title, "summary": None,
        "youtube_id": None, "steps_json": None, "images_json": None, "source_name": None,
        "source_url": None, "published": True, "sort_order": 0, "created_by": None, "updated_by": None,
        "created_at": stamp, "updated_at": stamp,
    }


def test_guides_reach_every_phone_through_sync(farmer):
    guide = create(admin(), title="Hướng dẫn qua sync").json()
    assert guide["id"] in [r["id"] for r in pull(farmer, "care_guides")]


def test_a_farmer_cannot_write_guides_through_sync_either(farmer):
    guide = create(admin(), title="Bản gốc").json()
    forged_id = str(uuid.uuid4())
    body = push(
        farmer,
        {
            "care_guides": {
                "created": [guide_row(forged_id, "Hướng dẫn giả")],
                "updated": [guide_row(guide["id"], "Bị sửa")],
                "deleted": [guide["id"]],
            }
        },
    )
    assert body["applied"]["rejected"] == 3
    assert {r["reason"] for r in body["rejected"]} == {"admin_only_write"}
    current = client.get(f"/care-guides/{guide['id']}", headers=admin()).json()
    assert current["title"] == "Bản gốc"
    assert client.get(f"/care-guides/{forged_id}", headers=admin()).status_code == 404
