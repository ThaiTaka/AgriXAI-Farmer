"""V2.1 — ảnh/video: tải lên, xem, quyền, giới hạn.

Ảnh ruộng của một hộ chỉ hộ đó (và quản trị viên) xem được. Thẻ <img>,
<video> và WebView không gửi được header Authorization, nên có một token
ngắn hạn đi trên URL — và token đó tuyệt đối không được dùng thay đăng nhập.
"""

import uuid
from pathlib import Path

import pytest

from app.core.config import settings
from app.services.media_service import sniff
from v21_support import HEIC_BYTES, MP4_BYTES, admin, client, jpeg_bytes, make_farmer, png_bytes, upload


@pytest.fixture(scope="module")
def ba():
    return make_farmer("v21_media_ba")


@pytest.fixture(scope="module")
def nam():
    return make_farmer("v21_media_nam")


def test_upload_and_read_back_a_photo(ba):
    data = jpeg_bytes()
    res = upload(ba, data)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["kind"] == "image" and body["content_type"] == "image/jpeg"
    assert body["size_bytes"] == len(data)
    assert body["url"] == f"/media/{body['id']}"

    got = client.get(body["url"], headers=ba)
    assert got.status_code == 200
    assert got.content == data
    assert got.headers["content-type"] == "image/jpeg"
    assert got.headers["cache-control"].startswith("private")


def test_retrying_the_same_id_does_not_duplicate(ba):
    media_id = uuid.uuid4().hex
    first = upload(ba, jpeg_bytes(), id=media_id)
    again = upload(ba, jpeg_bytes("red"), id=media_id)
    assert first.status_code == 201
    assert again.status_code == 200
    assert again.json()["id"] == media_id
    # The first upload is what stays: a retry is the same photo, not a new one.
    assert client.get(f"/media/{media_id}", headers=ba).content == jpeg_bytes()


def test_an_id_taken_by_another_farm_is_refused(ba, nam):
    media_id = uuid.uuid4().hex
    assert upload(ba, jpeg_bytes(), id=media_id).status_code == 201
    assert upload(nam, jpeg_bytes(), id=media_id).status_code == 409


def test_a_private_photo_is_invisible_to_other_farms_and_to_anonymous(ba, nam):
    media_id = upload(ba, jpeg_bytes()).json()["id"]
    assert client.get(f"/media/{media_id}", headers=nam).status_code == 404
    assert client.get(f"/media/{media_id}").status_code == 404
    assert client.get(f"/media/{media_id}", headers=admin()).status_code == 200


def test_media_token_opens_media_but_never_the_api(ba, nam):
    media_id = upload(ba, jpeg_bytes()).json()["id"]
    token = client.post("/media/token", headers=ba).json()["token"]

    assert client.get(f"/media/{media_id}", params={"t": token}).status_code == 200
    # Leaked in a URL, it must not stand in for a login.
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.get("/sync", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    # Another farm's media token opens nothing of Bà's.
    other = client.post("/media/token", headers=nam).json()["token"]
    assert client.get(f"/media/{media_id}", params={"t": other}).status_code == 404
    # A login token is not accepted in the query string either.
    login_token = ba["Authorization"].removeprefix("Bearer ")
    assert client.get(f"/media/{media_id}", params={"t": login_token}).status_code == 401
    assert client.get(f"/media/{media_id}", params={"t": "rac"}).status_code == 401


def test_the_file_type_comes_from_the_bytes_not_the_name(ba):
    assert upload(ba, b"MZ\x90\x00 this is not a picture", name="anh.jpg").status_code == 415
    # HEIC: only Safari can show it, so it is refused rather than stored broken.
    assert upload(ba, HEIC_BYTES, name="IMG_0001.heic").status_code == 415
    png = upload(ba, png_bytes(), name="lying.jpg").json()
    assert png["content_type"] == "image/png"


def test_sniff_recognises_the_accepted_formats():
    assert sniff(b"\xff\xd8\xff\xe0").content_type == "image/jpeg"
    assert sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ").content_type == "image/webp"
    assert sniff(b"\x1a\x45\xdf\xa3").content_type == "video/webm"
    assert sniff(b"\x00\x00\x00\x14ftypqt  ").content_type == "video/quicktime"
    assert sniff(b"\x00\x00\x00\x14ftyp3gp4").content_type == "video/3gpp"
    assert sniff(MP4_BYTES).content_type == "video/mp4"
    assert sniff(b"GIF89a") is None


def test_size_limits_are_enforced_and_leave_nothing_behind(ba, monkeypatch):
    monkeypatch.setattr(settings, "media_max_image_mb", 0)
    media_id = uuid.uuid4().hex
    res = upload(ba, jpeg_bytes(), id=media_id)
    assert res.status_code == 413
    assert client.get(f"/media/{media_id}", headers=ba).status_code == 404
    # Neither the file nor its half-written ".part" is left on disk.
    assert not list(Path(settings.media_dir).rglob(f"{media_id}*"))


def test_a_video_is_served_in_ranges_so_it_can_seek(ba):
    body = upload(ba, MP4_BYTES, name="bon-phan.mp4").json()
    assert body["kind"] == "video"
    part = client.get(body["url"], headers={**ba, "Range": "bytes=0-99"})
    assert part.status_code == 206
    assert len(part.content) == 100


def test_only_admins_publish_public_images(ba):
    assert upload(ba, jpeg_bytes(), public="true").status_code == 403
    body = upload(admin(), jpeg_bytes(), public="true").json()
    assert body["is_public"] is True
    anonymous = client.get(body["url"])
    assert anonymous.status_code == 200
    assert anonymous.headers["cache-control"].startswith("public")


def test_delete_removes_the_file(ba, nam):
    media_id = upload(ba, jpeg_bytes()).json()["id"]
    assert client.delete(f"/media/{media_id}", headers=nam).status_code == 404
    assert client.delete(f"/media/{media_id}", headers=ba).status_code == 204
    assert client.get(f"/media/{media_id}", headers=ba).status_code == 404
