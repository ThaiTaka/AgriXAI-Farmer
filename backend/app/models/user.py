"""User accounts — farmers and administrators."""

import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SyncMixin


class UserRole(str, enum.Enum):
    FARMER = "farmer"
    ADMIN = "admin"


class User(Base, SyncMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    region: Mapped[str | None] = mapped_column(String(128), default=None)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=16), default=UserRole.FARMER, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.username} ({self.role.value})>"
