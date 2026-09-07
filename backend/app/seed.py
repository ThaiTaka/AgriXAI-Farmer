"""Create the development / demo accounts.

Run with:  python -m app.seed
Idempotent — re-running updates the existing rows instead of duplicating them.
"""

import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.user import User, UserRole

SEED_USERS = [
    {
        "username": settings.seed_admin_username,
        "password": settings.seed_admin_password,
        "full_name": "Quản trị viên hệ thống",
        "role": UserRole.ADMIN,
        "region": None,
        "phone": None,
    },
    {
        "username": settings.seed_farmer_username,
        "password": settings.seed_farmer_password,
        "full_name": "Triệu Quang Học",
        "role": UserRole.FARMER,
        "region": "Cam Ly, Đà Lạt",
        "phone": "0900000001",
    },
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for spec in SEED_USERS:
            user = db.scalar(select(User).where(User.username == spec["username"]))
            if user is None:
                user = User(id=str(uuid.uuid4()), username=spec["username"])
                db.add(user)
                action = "created"
            else:
                action = "updated"
            user.password_hash = hash_password(spec["password"])
            user.full_name = spec["full_name"]
            user.role = spec["role"]
            user.region = spec["region"]
            user.phone = spec["phone"]
            user.is_active = True
            print(f"  {action}: {spec['username']} ({spec['role'].value})")
        db.commit()
    print("Seed done.")


if __name__ == "__main__":
    run()
