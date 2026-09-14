"""Create the development / demo data.

Run with:  python -m app.seed
Idempotent — re-running updates the existing rows instead of duplicating them.
"""

import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.schema_upgrade import upgrade
from app.core.security import hash_password
from app.models.farm import CropVariety
from app.models.user import User, UserRole
from app.seed_demo import seed_demo_farm
from app.services import static_data

SEED_USERS = [
    {
        "username": settings.seed_admin_username,
        "email": "admin@agrilog.local",
        "password": settings.seed_admin_password,
        "full_name": "Quản trị viên hệ thống",
        "role": UserRole.ADMIN,
        "region": None,
        "phone": None,
    },
    {
        "username": settings.seed_farmer_username,
        "email": "thaitaka@agrilog.local",
        "password": settings.seed_farmer_password,
        "full_name": "Thái Taka",
        "role": UserRole.FARMER,
        "region": "Cam Ly, Đà Lạt",
        "phone": "0900000001",
    },
]


def seed_users(db) -> None:
    for spec in SEED_USERS:
        user = db.scalar(select(User).where(User.username == spec["username"]))
        if user is None:
            user = User(id=str(uuid.uuid4()), username=spec["username"])
            db.add(user)
            action = "created"
        else:
            action = "updated"
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


def run() -> None:
    added = upgrade(engine)
    if added:
        print(f"  schema: added columns {', '.join(added)}")
    with SessionLocal() as db:
        seed_users(db)
        seed_varieties(db)
        seed_demo_farm(db)
        db.commit()
    print("Seed done.")


if __name__ == "__main__":
    run()
