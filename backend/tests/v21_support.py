"""Shared set-up for the V2.1 tests (cultivation history, task notes with
media, labour costs, care guides).

Every farm these tests write to is created here, fresh, per test module — the
demo households have fixed ledger totals that other files assert on, so V2.1
tests never add rows to them.
"""

import io
import uuid

import httpx
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole
from app.seed import run as run_seed

run_seed()
client = TestClient(app)

PASSWORD = "test-only-password"


def login(username: str, password: str = PASSWORD) -> dict[str, str]:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def admin() -> dict[str, str]:
    return login(settings.seed_admin_username, settings.seed_admin_password)


def make_farmer(username: str) -> dict[str, str]:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(id=str(uuid.uuid4()), username=username)
            db.add(user)
        user.password_hash = hash_password(PASSWORD)
        user.full_name = f"Nông hộ {username}"
        user.role = UserRole.FARMER
        user.is_active = True
        user.is_deleted = False
        db.commit()
    return login(username)


def user_id(headers: dict[str, str]) -> str:
    return client.get("/auth/me", headers=headers).json()["id"]


def assign_plot(farmer: dict[str, str], area: float = 1000.0, crop_type: str = "tomato", unit: str = "m2") -> str:
    """Land management creates a plot and hands it to the farmer."""
    plot_id = f"plot-{uuid.uuid4().hex[:12]}"
    res = client.post(
        "/plots",
        headers=admin(),
        json={
            "id": plot_id,
            "owner_id": user_id(farmer),
            "code": "PUC-V21-TEST",
            "name": "Lô thử V2.1",
            "area": area,
            "area_unit": unit,
            "crop_type": crop_type,
            "crop_name": "Cà chua",
        },
    )
    assert res.status_code == 201, res.text
    return plot_id


def push(headers: dict[str, str], changes: dict) -> dict:
    res = client.post("/sync", params={"last_pulled_at": 1}, headers=headers, json=changes)
    assert res.status_code == 200, res.text
    return res.json()


def pull(headers: dict[str, str], table: str) -> list[dict]:
    body = client.get("/sync", params={"last_pulled_at": 1}, headers=headers).json()
    rows = body["changes"][table]
    return rows["created"] + rows["updated"]


def make_task(farmer: dict[str, str], plot_id: str | None, title: str = "Bón thúc lần 1") -> str:
    """A tasks_history row, written the way the phone writes it: a sync push."""
    task_id = f"task-{uuid.uuid4().hex[:12]}"
    stamp = 1_780_000_000_000
    push(
        farmer,
        {
            "tasks_history": {
                "created": [
                    {
                        "id": task_id,
                        "protocol_id": "tomato_vien_rau_qua",
                        "stage_code": "vegetative",
                        "task_key": "bon_thuc_1",
                        "task_title": title,
                        "crop_type": "tomato",
                        "plot_id": plot_id,
                        "done": True,
                        "done_at": stamp,
                        "remind_at": None,
                        "note": None,
                        "owner_id": "ignored",
                        "updated_by": "device",
                        "created_at": stamp,
                        "updated_at": stamp,
                    }
                ],
                "updated": [],
                "deleted": [],
            }
        },
    )
    return task_id


def jpeg_bytes(color: str = "green") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color).save(buf, "JPEG")
    return buf.getvalue()


def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "white").save(buf, "PNG")
    return buf.getvalue()


# The first bytes are all the server judges a file by; the rest is filler.
MP4_BYTES = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + bytes(4096)
HEIC_BYTES = b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" + bytes(256)


def upload(headers: dict[str, str], data: bytes, name: str = "anh.jpg", **form) -> httpx.Response:
    return client.post("/media", headers=headers, files={"file": (name, data, "application/octet-stream")}, data=form)
