"""Farm records that take part in the two-way sync with the mobile app.

Every table mirrors the WatermelonDB schema in mobile/src/db/schema.ts. The two
must stay in step — `tests/test_schema_parity.py` fails the build if they drift.
"""

import enum

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SyncMixin


class PlotStatus(str, enum.Enum):
    ACTIVE = "active"
    FALLOW = "fallow"
    HARVESTED = "harvested"


class GrowthStage(str, enum.Enum):
    SEEDLING = "seedling"
    VEGETATIVE = "vegetative"
    FLOWERING = "flowering"
    FRUITING = "fruiting"
    HARVESTING = "harvesting"
    FINISHED = "finished"


class Plot(Base, SyncMixin):
    __tablename__ = "plots"

    code: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    region: Mapped[str | None] = mapped_column(String(160), default=None)
    area: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(8), default="m2", nullable=False)
    crop_type: Mapped[str] = mapped_column(String(48), default="ca_chua", nullable=False)
    variety_id: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_name: Mapped[str | None] = mapped_column(String(128), default=None)
    planted_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    status: Mapped[str] = mapped_column(String(16), default=PlotStatus.ACTIVE.value, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class CropVariety(Base, SyncMixin):
    """Open catalogue: seeded from shared/data, extended by farmers in the app."""

    __tablename__ = "crop_varieties"

    seed_key: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    crop_type: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    crop_name: Mapped[str] = mapped_column(String(64), nullable=False)
    fruit: Mapped[str | None] = mapped_column(Text, default=None)
    usage: Mapped[str | None] = mapped_column(Text, default=None)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Farmer-added varieties arrive unapproved; an admin flips this in web-admin.
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(64), default=None)


class CropCycle(Base, SyncMixin):
    __tablename__ = "crop_cycles"

    plot_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    crop_type: Mapped[str] = mapped_column(String(48), default="ca_chua", nullable=False)
    variety_id: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_name: Mapped[str | None] = mapped_column(String(128), default=None)
    stage: Mapped[str] = mapped_column(String(16), default=GrowthStage.SEEDLING.value, nullable=False)
    started_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ended_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    yield_kg: Mapped[float | None] = mapped_column(Float, default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class ChangeLog(Base, SyncMixin):
    """Audit trail. Append-only: rows are never updated, only inserted."""

    __tablename__ = "change_logs"

    table_name: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    record_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    field: Mapped[str | None] = mapped_column(String(64), default=None)
    old_value: Mapped[str | None] = mapped_column(Text, default=None)
    new_value: Mapped[str | None] = mapped_column(Text, default=None)
    changed_by: Mapped[str] = mapped_column(String(64), nullable=False)
    changed_by_name: Mapped[str | None] = mapped_column(String(128), default=None)
    changed_at: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
