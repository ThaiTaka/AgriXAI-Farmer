"""Kiem tra bao mat sync_service: client khong the tu phe duyet giong cay qua /sync.

Co che bao mat quan trong nhat cua Task 1: truong approved/is_seed/source
tren bang crop_varieties khong duoc phep ghi qua POST /sync du client co
gui len. Neu lo hong nay ton tai, mot nong ho co the:
  1. Them giong cay (trang thai cho duyet, approved=False)
  2. Gui ban cap nhat qua sync voi approved=True
  3. Giong cua ho xuat hien ngay lap tuc trong he thong ma khong can admin duyet

Cac test sau dam bao lo hong nay da duoc va.
"""

import uuid
from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


def login(username: str, password: str) -> dict[str, str]:
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_sync_push_cannot_self_approve_variety():
    """Nong ho gui sync push voi approved=True -> server van giu approved=False."""
    farmer_headers = login(settings.seed_farmer_username, settings.seed_farmer_password)

    variety_id = str(uuid.uuid4())
    now_ms = 1_700_000_000_000

    # Buoc 1: farmer tao giong moi qua sync push voi approved=True
    push_payload = {
        "crop_varieties": {
            "created": [
                {
                    "id": variety_id,
                    "name": "Giot sua test",
                    "crop_type": "lua",
                    "crop_name": "Lua",
                    "category_id": None,
                    "category_name": None,
                    "description": "Giong tu add",
                    "is_seed": True,     # client co gang nhan la hat giong goc
                    "approved": True,    # client co gang tu phe duyet
                    "source": "seed",    # client co gang nhan nguon la hat giong chinh thuc
                    "created_by": None,
                    "created_at": now_ms,
                    "updated_at": now_ms,
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    push_res = client.post(
        "/sync?last_pulled_at=0",
        json=push_payload,
        headers=farmer_headers,
    )
    assert push_res.status_code == 200, push_res.text

    # Buoc 2: pull lai va kiem tra truong approved/is_seed/source tren server
    pull_res = client.get("/sync", headers=farmer_headers)
    assert pull_res.status_code == 200, pull_res.text

    changes = pull_res.json()["changes"]
    all_varieties = (
        changes.get("crop_varieties", {}).get("created", [])
        + changes.get("crop_varieties", {}).get("updated", [])
    )
    saved = next((v for v in all_varieties if v["id"] == variety_id), None)
    assert saved is not None, "Giong vua tao khong thay trong pull response"

    # Server PHAI giu approved=False du client gui True
    assert saved["approved"] is False, (
        f"Lo hong bao mat: approved = {saved['approved']} (mong doi False). "
        "Client da tu phe duyet giong cay qua sync!"
    )
    # Server PHAI giu is_seed=False (giong do nong ho tu them, khong phai hat giong goc)
    assert saved["is_seed"] is False, (
        f"Lo hong bao mat: is_seed = {saved['is_seed']} (mong doi False)."
    )
    # Server PHAI giu source="farmer" (khong de client nhan la "seed")
    assert saved["source"] != "seed", (
        f"Lo hong bao mat: source = {saved['source']} (mong doi khac seed)."
    )


def test_sync_push_cannot_overwrite_approved_via_update():
    """Sau khi admin duyet, farmer khong the bo duyet lai qua sync update."""
    admin_headers = login(settings.seed_admin_username, settings.seed_admin_password)
    farmer_headers = login(settings.seed_farmer_username, settings.seed_farmer_password)

    # Buoc 1: tao giong moi
    variety_id = str(uuid.uuid4())
    now_ms = 1_700_000_001_000
    push_payload = {
        "crop_varieties": {
            "created": [
                {
                    "id": variety_id,
                    "name": "Giong bo duyet test",
                    "crop_type": "lua",
                    "crop_name": "Lua",
                    "category_id": None,
                    "category_name": None,
                    "description": "Test",
                    "is_seed": False,
                    "approved": False,
                    "source": "farmer",
                    "created_by": None,
                    "created_at": now_ms,
                    "updated_at": now_ms,
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    client.post("/sync?last_pulled_at=0", json=push_payload, headers=farmer_headers)

    # Buoc 2: admin duyet
    approve_res = client.patch(
        f"/crop-varieties/{variety_id}",
        json={"approved": True},
        headers=admin_headers,
    )
    assert approve_res.status_code == 200, approve_res.text

    # Buoc 3: farmer gui sync update voi approved=False (co gang bo duyet)
    later_ms = now_ms + 10_000
    update_payload = {
        "crop_varieties": {
            "created": [],
            "updated": [
                {
                    "id": variety_id,
                    "name": "Giong bo duyet test",
                    "crop_type": "lua",
                    "crop_name": "Lua",
                    "category_id": None,
                    "category_name": None,
                    "description": "Sua ten",
                    "is_seed": False,
                    "approved": False,   # farmer co gang bo duyet
                    "source": "farmer",
                    "created_by": None,
                    "created_at": now_ms,
                    "updated_at": later_ms,
                }
            ],
            "deleted": [],
        }
    }
    client.post(f"/sync?last_pulled_at={now_ms}", json=update_payload, headers=farmer_headers)

    # Buoc 4: pull lai, approved van phai la True
    pull_res = client.get("/sync", headers=farmer_headers)
    changes = pull_res.json()["changes"]
    all_varieties = (
        changes.get("crop_varieties", {}).get("created", [])
        + changes.get("crop_varieties", {}).get("updated", [])
    )
    saved = next((v for v in all_varieties if v["id"] == variety_id), None)

    if saved is not None:
        assert saved["approved"] is True, (
            f"Lo hong: farmer da bo duyet thanh cong qua sync (approved={saved['approved']})"
        )
