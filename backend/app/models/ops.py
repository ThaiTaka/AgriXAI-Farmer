"""Operational records that are NOT part of the phone sync.

`error_logs` is written by the phone's error boundary through POST /logs
once it is online (it queues them locally until then) and read by admins.
It has no WatermelonDB twin: the phone keeps its own local-only copy and
only ever uploads, never pulls.

`media_files` indexes the photos and videos on disk. Rows that sync (task
notes, crop cycles, care guides) only carry media ids; the bytes travel over
POST /media, never through /sync.
"""

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class ErrorLog(Base, TimestampMixin):
    __tablename__ = "error_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    # What the farmer was doing: route name + a short description ("F1 tính lượng cà chua").
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack: Mapped[str | None] = mapped_column(Text, default=None)
    app_version: Mapped[str | None] = mapped_column(String(32), default=None)
    platform: Mapped[str | None] = mapped_column(String(32), default=None)
    # When it happened on the device (epoch ms) — can be long before upload.
    occurred_at: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    # True when the farmer pressed "Báo lỗi" rather than the automatic upload.
    reported: Mapped[bool] = mapped_column(default=False, nullable=False)


class MediaFile(Base, TimestampMixin):
    __tablename__ = "media_files"

    # Chosen by the phone when the photo is taken, so a retried upload after a
    # dropped response lands on the same row instead of a duplicate.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(8), nullable=False)  # "image" | "video"
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    original_name: Mapped[str | None] = mapped_column(String(200), default=None)
    # Relative to settings.media_dir.
    path: Mapped[str] = mapped_column(String(300), nullable=False)
    # Public = anyone may fetch it (care-guide pictures). Private files are
    # served to their owner and to admins only.
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
