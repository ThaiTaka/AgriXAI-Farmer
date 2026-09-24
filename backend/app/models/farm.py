"""Farm records that take part in the two-way sync with the mobile app.

Every table mirrors the WatermelonDB schema in mobile/src/db/schema.ts. The two
must stay in step — `tests/test_schema_parity.py` fails the build if they drift.
"""

import enum

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Integer, String, Text
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
    # Catalogue crop id ("tomato", "coffee"...) or a slug the farmer created.
    crop_type: Mapped[str] = mapped_column(String(48), default="tomato", nullable=False)
    crop_name: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_id: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_name: Mapped[str | None] = mapped_column(String(128), default=None)
    planted_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    status: Mapped[str] = mapped_column(String(16), default=PlotStatus.ACTIVE.value, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class CropVariety(Base, SyncMixin):
    """Open catalogue: seeded from shared/data, extended by farmers in the app.

    The catalogue has three levels (crop type -> category -> variety). Only the
    variety is a row; the two upper levels are static and denormalised here as
    ids + names so a row stays readable for a crop a farmer invented.
    """

    __tablename__ = "crop_varieties"

    seed_key: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    crop_type: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    crop_name: Mapped[str] = mapped_column(String(64), nullable=False)
    category_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    category_name: Mapped[str | None] = mapped_column(String(96), default=None)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    usage: Mapped[str | None] = mapped_column(Text, default=None)
    growing_note: Mapped[str | None] = mapped_column(Text, default=None)
    badge: Mapped[str | None] = mapped_column(String(16), default=None)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Farmer-added varieties arrive unapproved; an admin flips this in web-admin.
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(64), default=None)


class Season(str, enum.Enum):
    """Vụ, by the month the crop went in: Xuân 1–3, Hè 4–6, Thu 7–9, Đông 10–12.

    A convention for grouping harvests, not an agronomic claim — the farmer can
    override it when a crop sown late September is "vụ Đông" to them.
    """

    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


class CropCycle(Base, SyncMixin):
    """One crop on one plot, from sowing to harvest — the cultivation history.

    A finished cycle with a yield is what the crop recommendation learns from,
    so it keeps the plot's area *at the time* (`area_m2`): a plot later
    re-surveyed from 300 to 350 m² must not quietly rewrite last year's
    productivity.
    """

    __tablename__ = "crop_cycles"

    plot_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    crop_type: Mapped[str] = mapped_column(String(48), default="tomato", nullable=False)
    # Self-describing for a crop the farmer invented (no catalogue name to look up).
    crop_name: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_id: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_name: Mapped[str | None] = mapped_column(String(128), default=None)
    stage: Mapped[str] = mapped_column(String(16), default=GrowthStage.SEEDLING.value, nullable=False)
    season: Mapped[str | None] = mapped_column(String(16), default=None)
    started_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ended_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    area_m2: Mapped[float | None] = mapped_column(Float, default=None)
    yield_kg: Mapped[float | None] = mapped_column(Float, default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    # JSON list of media refs (photos of the harvest) — see app/services/media_service.py.
    media_json: Mapped[str | None] = mapped_column(Text, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class CareGuide(Base, SyncMixin):
    """A how-to for one crop: an embedded video plus illustrated steps.

    Written by an admin in web-admin, read by every farm — so it syncs like the
    variety catalogue (no owner column), but only an admin may write it, over
    REST or over /sync. Drafts sync too; the phone shows `published` ones only.
    """

    __tablename__ = "care_guides"

    crop_type: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    # Optional link to a protocol stage, so a task card can offer "xem cách làm".
    stage_code: Mapped[str | None] = mapped_column(String(48), default=None)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, default=None)
    youtube_id: Mapped[str | None] = mapped_column(String(16), default=None)
    # JSON [{title, body, image_id}] — image ids point at public media files.
    steps_json: Mapped[str | None] = mapped_column(Text, default=None)
    # JSON [media id] — the picture strip above the steps.
    images_json: Mapped[str | None] = mapped_column(Text, default=None)
    source_name: Mapped[str | None] = mapped_column(String(160), default=None)
    source_url: Mapped[str | None] = mapped_column(String(500), default=None)
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(64), default=None)
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
