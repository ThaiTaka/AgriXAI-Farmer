"""System-wide figures for the admin home page of web-admin.

Everything a manager of the village wants on one screen: how many farms and
how much land, money in and out across all farms for the last six months,
what is planted where, and what is waiting for them (varieties to approve,
errors from the phones). Per-farm figures reuse dashboard_service.summary, so
the overview and a farm's own dashboard can never disagree.
"""

import time
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.farm import CropVariety, Plot, PlotStatus
from app.models.ledger import Expense, Income, TaskHistory, WarehouseIn, WarehouseOut
from app.models.ops import ErrorLog
from app.models.user import User, UserRole
from app.services import dashboard_service, ledger_service as ledger, static_data
from app.services.cultivation import area_in_m2

WEEK_MS = 7 * 86_400_000


@dataclass
class MonthTotals:
    year: int
    month: int
    income: float = 0.0
    expense: float = 0.0


@dataclass
class CropArea:
    crop_type: str
    crop_name: str
    plots: int = 0
    area_m2: float = 0.0


@dataclass
class FarmRow:
    id: str
    username: str
    full_name: str
    region: str | None
    is_active: bool
    plots: int = 0
    area_m2: float = 0.0
    month_income: float = 0.0
    month_expense: float = 0.0
    stock_value: float = 0.0
    pending_tasks: int = 0
    last_activity: int | None = None


@dataclass
class Overview:
    year: int
    month: int
    farms_total: int = 0
    farms_active: int = 0
    plots: int = 0
    area_m2: float = 0.0
    month_income: float = 0.0
    month_expense: float = 0.0
    stock_value: float = 0.0
    pending_tasks: int = 0
    varieties_pending: int = 0
    errors_7d: int = 0
    months: list[MonthTotals] = field(default_factory=list)
    crops: list[CropArea] = field(default_factory=list)
    farms: list[FarmRow] = field(default_factory=list)


def _last_months(year: int, month: int, count: int) -> list[MonthTotals]:
    out: list[MonthTotals] = []
    y, m = year, month
    for _ in range(count):
        out.append(MonthTotals(y, m))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    return list(reversed(out))


def _catalogue_names() -> dict[str, str]:
    return {c["id"]: c["name"] for c in static_data.load("crop_varieties")["crop_types"]}


def overview(db: Session, now_ms: int | None = None, months: int = 6) -> Overview:
    now_ms = now_ms or int(time.time() * 1000)
    now = datetime.fromtimestamp(now_ms / 1000, ledger.VN_TZ)
    out = Overview(year=now.year, month=now.month)

    farmers = list(
        db.scalars(
            select(User)
            .where(User.role == UserRole.FARMER, User.is_deleted.is_(False))
            .order_by(User.full_name, User.username)
        )
    )
    out.farms_total = len(farmers)
    out.farms_active = sum(1 for f in farmers if f.is_active)

    # Land: every live plot, grouped by crop.
    names = _catalogue_names()
    crops: dict[str, CropArea] = {}
    rows = {f.id: FarmRow(f.id, f.username, f.full_name or f.username, f.region, f.is_active) for f in farmers}
    for plot in db.scalars(select(Plot).where(Plot.is_deleted.is_(False))):
        area = area_in_m2(plot.area, plot.area_unit)
        if plot.status == PlotStatus.ACTIVE.value:
            crop = crops.setdefault(plot.crop_type, CropArea(plot.crop_type, names.get(plot.crop_type) or plot.crop_name or plot.crop_type))
            crop.plots += 1
            crop.area_m2 += area
        out.plots += 1
        out.area_m2 += area
        if plot.owner_id in rows:
            rows[plot.owner_id].plots += 1
            rows[plot.owner_id].area_m2 += area
    out.crops = sorted(crops.values(), key=lambda c: c.area_m2, reverse=True)

    # Money: the last `months` months across all farms, bucketed in Python.
    series = _last_months(now.year, now.month, months)
    start, _ = ledger.Period(series[0].year, month=series[0].month).bounds_ms()
    _, end = ledger.Period(series[-1].year, month=series[-1].month).bounds_ms()
    buckets = {(m.year, m.month): m for m in series}
    for model, attr in ((Income, "income"), (Expense, "expense")):
        for occurred_at, amount in db.execute(
            select(model.occurred_at, model.amount).where(
                model.is_deleted.is_(False), model.occurred_at >= start, model.occurred_at < end
            )
        ):
            when = datetime.fromtimestamp(occurred_at / 1000, ledger.VN_TZ)
            bucket = buckets.get((when.year, when.month))
            if bucket is not None:
                setattr(bucket, attr, getattr(bucket, attr) + amount)
    out.months = series

    # Each farm's own numbers, exactly as its dashboard shows them.
    for farm in farmers:
        s = dashboard_service.summary(db, farm, now.year, now.month, now_ms)
        row = rows[farm.id]
        row.month_income = s.month_income
        row.month_expense = s.month_expense
        row.stock_value = s.stock_value
        row.pending_tasks = s.pending_tasks
        out.month_income += s.month_income
        out.month_expense += s.month_expense
        out.stock_value += s.stock_value
        out.pending_tasks += s.pending_tasks

    # Last time anything of that farm changed — its phone synced, or an admin edited.
    for model in (Plot, Income, Expense, WarehouseIn, WarehouseOut, TaskHistory):
        for owner_id, last in db.execute(select(model.owner_id, func.max(model.updated_at)).group_by(model.owner_id)):
            row = rows.get(owner_id)
            if row is not None and last is not None and (row.last_activity is None or last > row.last_activity):
                row.last_activity = last
    out.farms = list(rows.values())

    out.varieties_pending = db.scalar(
        select(func.count())
        .select_from(CropVariety)
        .where(CropVariety.is_deleted.is_(False), CropVariety.approved.is_(False), CropVariety.is_seed.is_(False))
    ) or 0
    out.errors_7d = db.scalar(select(func.count()).select_from(ErrorLog).where(ErrorLog.occurred_at >= now_ms - WEEK_MS)) or 0
    return out
