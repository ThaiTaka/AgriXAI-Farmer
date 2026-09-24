"""Giai đoạn 3 records: fertiliser plans, the stock ledger, income/expense and
care-task history.

All six tables take part in the two-way sync, so each mirrors a table in
mobile/src/db/schema.ts column for column (`tests/test_schema_parity.py`).

Money is stored as whole đồng in a Float column; quantities as kilograms.
`occurred_at` is the business date the farmer entered (epoch ms), distinct
from `created_at`, which is when the row was written — a purchase typed in on
Friday for Tuesday's delivery must land in Tuesday's report.
"""

import enum

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SyncMixin


class IncomeKind(str, enum.Enum):
    PRODUCT = "product"
    SERVICE = "service"
    OTHER = "other"


class ExpenseKind(str, enum.Enum):
    SEED = "seed"
    FERTILIZER = "fertilizer"
    LABOR = "labor"
    UTILITIES = "utilities"
    OTHER = "other"


class LaborUnit(str, enum.Enum):
    """How hired work is priced: by the hour, by the day (ngày công), or as
    one agreed sum for the whole job (khoán)."""

    HOUR = "hour"
    DAY = "day"
    LUMP = "lump"


class StockUnit(str, enum.Enum):
    KG = "kg"
    TAN = "tan"


class Plan(Base, SyncMixin):
    """A saved F1 result: which protocol + scenario, for what area, and the
    scaled fertiliser list (kept as JSON so the plan survives later edits to
    the protocol files exactly as the farmer saw it)."""

    __tablename__ = "plans"

    plot_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    crop_type: Mapped[str] = mapped_column(String(48), nullable=False)
    crop_name: Mapped[str | None] = mapped_column(String(64), default=None)
    category_id: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_id: Mapped[str | None] = mapped_column(String(64), default=None)
    variety_name: Mapped[str | None] = mapped_column(String(128), default=None)
    protocol_id: Mapped[str] = mapped_column(String(64), nullable=False)
    scenario_id: Mapped[str] = mapped_column(String(64), nullable=False)
    scenario_name: Mapped[str] = mapped_column(String(160), nullable=False)
    area_input: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(16), nullable=False)
    area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    items_json: Mapped[str] = mapped_column(Text, nullable=False)
    cost_min: Mapped[float | None] = mapped_column(Float, default=None)
    cost_max: Mapped[float | None] = mapped_column(Float, default=None)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class WarehouseIn(Base, SyncMixin):
    __tablename__ = "warehouse_in"

    fertilizer_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    fertilizer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str | None] = mapped_column(String(32), default=None)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(8), default=StockUnit.KG.value, nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    occurred_at: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    plot_id: Mapped[str | None] = mapped_column(String(64), default=None)
    # The expense row written alongside a purchase, so the two stay linked.
    expense_id: Mapped[str | None] = mapped_column(String(64), default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class WarehouseOut(Base, SyncMixin):
    __tablename__ = "warehouse_out"

    fertilizer_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    fertilizer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str | None] = mapped_column(String(32), default=None)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    # FIFO cost of the kilograms taken out, fixed at the moment of the issue.
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, nullable=False)
    occurred_at: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    plot_id: Mapped[str | None] = mapped_column(String(64), default=None)
    plan_id: Mapped[str | None] = mapped_column(String(64), default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class Income(Base, SyncMixin):
    __tablename__ = "income"

    kind: Mapped[str] = mapped_column(String(16), default=IncomeKind.PRODUCT.value, nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    occurred_at: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    plot_id: Mapped[str | None] = mapped_column(String(64), default=None)
    checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class Expense(Base, SyncMixin):
    """Every đồng that left the farm.

    Hired labour is an expense like any other (kind "labor"), so it lands in the
    monthly report, the PDF and the profit card without a second ledger to add
    up. What makes it a labour cost is the breakdown — `workers` × `quantity`
    (hours or days each) × `unit_price` — and, when it was hired for a care
    task, the `task_id` of that tasks_history row. `amount` stays the total
    every report sums; app/services/labor.py is the one place that computes it.
    """

    __tablename__ = "expense"

    kind: Mapped[str] = mapped_column(String(16), default=ExpenseKind.OTHER.value, nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    occurred_at: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    plot_id: Mapped[str | None] = mapped_column(String(64), default=None)
    checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    warehouse_in_id: Mapped[str | None] = mapped_column(String(64), default=None)
    task_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    workers: Mapped[float | None] = mapped_column(Float, default=None)
    quantity: Mapped[float | None] = mapped_column(Float, default=None)
    unit: Mapped[str | None] = mapped_column(String(8), default=None)
    unit_price: Mapped[float | None] = mapped_column(Float, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class TaskHistory(Base, SyncMixin):
    """One row per care task the farmer ticked (or set a reminder on)."""

    __tablename__ = "tasks_history"

    protocol_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    stage_code: Mapped[str] = mapped_column(String(48), nullable=False)
    task_key: Mapped[str] = mapped_column(String(64), nullable=False)
    task_title: Mapped[str] = mapped_column(String(200), nullable=False)
    crop_type: Mapped[str] = mapped_column(String(48), nullable=False)
    plot_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    done_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    remind_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class TaskNote(Base, SyncMixin):
    """What the farmer wrote, photographed or filmed while doing a care task —
    how it was actually done on *this* plot, kept for next season.

    `task_id` is the tasks_history row; `plot_id` is copied from it so a plot's
    own working method can be listed without a join.
    """

    __tablename__ = "task_notes"

    task_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    plot_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    note_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # JSON list of media refs — see app/services/media_service.py.
    media_json: Mapped[str | None] = mapped_column(Text, default=None)
    occurred_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)
