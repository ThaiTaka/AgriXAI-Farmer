"""Create the development / demo data.

Run with:  python -m app.seed
Idempotent — re-running updates the existing rows instead of duplicating them.
"""

import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.farm import CropVariety
from app.models.user import User, UserRole
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
        "email": "quanghoc@agrilog.local",
        "password": settings.seed_farmer_password,
        "full_name": "Triệu Quang Học",
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


def seed_varieties(db) -> None:
    """Loads shared/data/crop_varieties.json.

    Matched on `seed_key`, so re-running after the file gains a variety adds only
    what is missing and never touches a variety a farmer created.

    The id is derived from the seed key rather than random, so the row the mobile
    app seeds offline and the row seeded here are the SAME record. Otherwise the
    first sync would leave the farmer with two of every variety.
    """
    catalogue = static_data.load("crop_varieties")["varieties"]
    added = 0
    for entry in catalogue:
        existing = db.scalar(select(CropVariety).where(CropVariety.seed_key == entry["id"]))
        if existing is None:
            existing = CropVariety(id=f"seed_{entry['id']}", seed_key=entry["id"])
            db.add(existing)
            added += 1
        existing.name = entry["name"]
        existing.crop_type = entry["crop_type"]
        existing.crop_name = entry["crop_name"]
        existing.fruit = entry.get("fruit")
        existing.usage = entry.get("usage")
        existing.note = entry.get("note")
        existing.is_seed = True
        existing.approved = True
        existing.source = "seed"
    print(f"  crop varieties: {added} added, {len(catalogue) - added} already present")


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_users(db)
        seed_varieties(db)
        db.commit()
    print("Seed done.")


if __name__ == "__main__":
    run()
