"""Numbers for the farmer's dashboard — the same three figures the phone
computes locally in mobile/src/domain/dashboard.ts:

    stock value     = Σ over fertilisers of (stock_kg × average price)
    month profit    = Σ income − Σ expense in the calendar month (VN time)
    pending tasks   = tasks of each active plot's CURRENT protocol stage that
                      have no "done" row in tasks_history

The current stage follows the phone's rule: annual crops by days since
planting (ADR 0002 §7), perennials by calendar month. The two sides share
the protocol file, so a plot shows the same task count on the phone and on
web-admin.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.farm import Plot
from app.models.ledger import Expense, Income, TaskHistory, WarehouseIn, WarehouseOut
from app.models.user import User
from app.services import ledger_service as ledger
from app.services import static_data

# Day thresholds of mobile/src/utils/growthStage.ts (tomato MV1 ~90–100 days).
GROWTH_STAGE_DAYS = [
    ("seedling", 20),
    ("vegetative", 40),
    ("flowering", 60),
    ("fruiting", 85),
    ("harvesting", float("inf")),
]


def infer_growth_stage(planted_at: int | None, now_ms: int) -> str | None:
    if not planted_at:
        return None
    day = max(0, (now_ms - planted_at) // 86_400_000)
    for stage, until in GROWTH_STAGE_DAYS:
        if day <= until:
            return stage
    return "harvesting"


def seed_variety_category(variety_id: str | None) -> str | None:
    """'seed_<key>' or bare key -> category id from the bundled catalogue."""
    if not variety_id:
        return None
    key = variety_id[5:] if variety_id.startswith("seed_") else variety_id
    for crop in static_data.load("crop_varieties")["crop_types"]:
        for category in crop["categories"]:
            if any(v["id"] == key for v in category["varieties"]):
                return category["category_id"]
    return None


def protocol_for(crop_type: str, category_id: str | None) -> dict | None:
    for protocol in static_data.load("care_protocols")["protocols"]:
        if protocol["crop_type"] != crop_type:
            continue
        if protocol["category_ids"] is None or category_id is None or category_id in protocol["category_ids"]:
            return protocol
    return None


def current_stage(protocol: dict, planted_at: int | None, now_ms: int) -> dict | None:
    if protocol["stage_model"] == "calendar":
        month = datetime.fromtimestamp(now_ms / 1000, tz=ledger.VN_TZ).month
        return next((s for s in protocol["stages"] if month in (s.get("months") or [])), None)
    growth = infer_growth_stage(planted_at, now_ms)
    if growth is None:
        return None
    return next((s for s in protocol["stages"] if growth in s.get("growth_stages", [])), None)


@dataclass
class PendingGroup:
    plot_id: str
    plot_name: str
    crop_name: str
    stage_name: str
    pending: int


@dataclass
class DashboardSummary:
    stock_value: float = 0.0
    stock_kg: float = 0.0
    stock_kinds: int = 0
    month_income: float = 0.0
    month_expense: float = 0.0
    pending_tasks: int = 0
    pending_groups: list[PendingGroup] = field(default_factory=list)

    @property
    def month_profit(self) -> float:
        return self.month_income - self.month_expense


def _alive(model, user: User):
    return select(model).where(model.owner_id == user.id, model.is_deleted.is_(False))


def pending_tasks(db: Session, user: User, now_ms: int) -> list[PendingGroup]:
    plots = list(db.scalars(_alive(Plot, user).where(Plot.status == "active")))
    done = {
        (row.plot_id, row.protocol_id, row.stage_code, row.task_key)
        for row in db.scalars(_alive(TaskHistory, user).where(TaskHistory.done.is_(True)))
    }
    groups: list[PendingGroup] = []
    for plot in plots:
        protocol = protocol_for(plot.crop_type, seed_variety_category(plot.variety_id))
        if protocol is None:
            continue
        stage = current_stage(protocol, plot.planted_at, now_ms)
        if stage is None:
            continue
        pending = sum(
            1 for task in stage["tasks"] if (plot.id, protocol["id"], stage["stage_code"], task["key"]) not in done
        )
        if pending:
            groups.append(
                PendingGroup(
                    plot_id=plot.id,
                    plot_name=plot.name,
                    crop_name=plot.crop_name or protocol["crop_name"],
                    stage_name=stage["stage_name_vi"],
                    pending=pending,
                )
            )
    return groups


def summary(db: Session, user: User, year: int, month: int, now_ms: int | None = None) -> DashboardSummary:
    now_ms = now_ms or int(time.time() * 1000)
    out = DashboardSummary()

    lines = ledger.stock_summary(db.scalars(_alive(WarehouseIn, user)), db.scalars(_alive(WarehouseOut, user)))
    in_stock = [l for l in lines if l.stock_kg > 0]
    out.stock_value = sum(l.stock_value for l in in_stock)
    out.stock_kg = sum(l.stock_kg for l in in_stock)
    out.stock_kinds = len(in_stock)

    report = ledger.financial_report(
        db.scalars(_alive(Income, user)), db.scalars(_alive(Expense, user)), ledger.Period(year, month=month)
    )
    out.month_income = report.total_income
    out.month_expense = report.total_expense

    out.pending_groups = pending_tasks(db, user, now_ms)
    out.pending_tasks = sum(g.pending for g in out.pending_groups)
    return out
