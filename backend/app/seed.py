"""Create the development / demo data.

Run with:  python -m app.seed
Idempotent — re-running updates the existing rows instead of duplicating them.
The command line seeds the extended roster as well (see `run(extended=...)`).
"""

import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.schema_upgrade import upgrade
from app.core.security import hash_password
from app.models.farm import CropVariety
from app.models.user import User, UserRole
from app.seed_demo import seed_demo_farm, seed_extended
from app.services import static_data

SEED_USERS = [
    {
        "username": settings.seed_admin_username,
        "email": "admin@agrilog.local",
        "password": settings.seed_admin_password,
        "full_name": "Quản trị viên hệ thống",
        "role": UserRole.ADMIN,
        "region": "Ban quản trị AgriLog, Đà Lạt, Lâm Đồng",
        "phone": None,
    },
    {
        "username": settings.seed_farmer_username,
        "email": f"{settings.seed_farmer_username}@agrilog.local",
        "password": settings.seed_farmer_password,
        # Tài khoản mới tạo, chưa được giao lô: bộ test dùng nó làm "nông hộ
        # trống", và trang Lô đất của web-admin dùng nó để thử việc giao lô.
        "full_name": "Mai Xuân Bình",
        "role": UserRole.FARMER,
        "region": "Đạ Sar, xã Lạc Dương, Lâm Đồng",
        "phone": "0944905316",
    },
]

# Tên đăng nhập cũ của tài khoản nông hộ mẫu. Trên một máy đã seed, đổi tên tại
# chỗ thay vì lập tài khoản thứ hai (lô đất, kho và thu - chi gắn theo id).
LEGACY_FARMER_USERNAMES = ("thaitaka",)


def seed_users(db) -> None:
    for spec in SEED_USERS:
        user = db.scalar(select(User).where(User.username == spec["username"]))
        action = "updated"
        if user is None and spec["role"] is UserRole.FARMER:
            user = db.scalar(select(User).where(User.username.in_(LEGACY_FARMER_USERNAMES)))
            if user is not None:
                user.username = spec["username"]
                action = "renamed"
        if user is None:
            user = User(id=str(uuid.uuid4()), username=spec["username"])
            db.add(user)
            action = "created"
        user.email = spec["email"]
        user.password_hash = hash_password(spec["password"])
        user.full_name = spec["full_name"]
        user.role = spec["role"]
        user.region = spec["region"]
        user.phone = spec["phone"]
        user.is_active = True
        print(f"  user {action}: {spec['username']} ({spec['role'].value})")


def iter_seed_varieties():
    """Flattens the three-level catalogue into (crop, category, variety) rows."""
    for crop in static_data.load("crop_varieties")["crop_types"]:
        for category in crop["categories"]:
            for variety in category["varieties"]:
                yield crop, category, variety


def seed_varieties(db) -> None:
    """Loads shared/data/crop_varieties.json (crop type -> category -> variety).

    Matched on `seed_key`, so re-running after the file gains a variety adds only
    what is missing and never touches a variety a farmer created.

    The id is derived from the seed key rather than random, so the entry the
    mobile app reads from its bundled copy and the row seeded here are the SAME
    record. Otherwise the first sync would leave the farmer with two of every
    variety.
    """
    added = total = 0
    for crop, category, entry in iter_seed_varieties():
        total += 1
        existing = db.scalar(select(CropVariety).where(CropVariety.seed_key == entry["id"]))
        if existing is None:
            existing = CropVariety(id=f"seed_{entry['id']}", seed_key=entry["id"])
            db.add(existing)
            added += 1
        existing.name = entry["name"]
        existing.crop_type = crop["id"]
        existing.crop_name = crop["name"]
        existing.category_id = category["category_id"]
        existing.category_name = category["category_name"]
        existing.description = entry.get("description")
        existing.usage = entry.get("usage")
        existing.growing_note = entry.get("growing_note")
        existing.badge = entry.get("badge")
        existing.is_seed = True
        existing.approved = True
        existing.source = "seed"
    print(f"  crop varieties: {added} added, {total - added} already present")


def run(*, extended: bool = False) -> None:
    """Seeds users, the catalogue and the demo farms.

    `extended=True` (what `python -m app.seed` passes) adds the rest of the
    roster — a dozen households around Đà Lạt, a locked account, the fertiliser
    price history and a few error logs — so web-admin has something to page and
    filter. The test suite calls `run()` without it and keeps its small, exactly
    countable data set.
    """
    added = upgrade(engine)
    if added:
        print(f"  schema: added columns {', '.join(added)}")
    with SessionLocal() as db:
        seed_users(db)
        seed_varieties(db)
        seed_demo_farm(db)
        if extended:
            seed_extended(db)
        db.commit()
    print("Seed done.")


if __name__ == "__main__":
    run(extended=True)
