"""Tổng quan toàn hệ thống cho trang quản trị (chỉ quản trị viên).

Các endpoint khác trả dữ liệu của MỘT nông hộ (nông hộ xem hộ mình, quản trị
viên chọn hộ qua `owner_id`). Trang "Tổng quan" của web-admin cần cái nhìn ngược
lại — cả hệ thống trong một lần — và để trình duyệt tự gộp thì phải gọi mỗi hộ
mỗi tháng một lần (13 hộ × 6 tháng = 78 yêu cầu). Gộp ở máy chủ là một yêu cầu.

Tiền theo `occurred_at` (ngày nghiệp vụ nông hộ nhập), tính theo giờ Việt Nam,
đúng như báo cáo thu - chi của từng hộ — nên tổng ở đây khớp tổng các hộ cộng lại.
"""

import time
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.farm import CropVariety, Plot
from app.models.ledger import Expense, Income, WarehouseIn, WarehouseOut
from app.models.ops import ErrorLog
from app.models.user import User, UserRole
from app.services import ledger_service as ledger
from app.services.auth_service import current_admin

admin_router = APIRouter(prefix="/admin", tags=["admin"])

THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000


class FarmerCounts(BaseModel):
    total: int
    active: int
    locked: int
    without_plot: int


class CropShare(BaseModel):
    crop_type: str
    crop_name: str
    plots: int
    area_m2: float


class PlotStats(BaseModel):
    total: int
    area_m2: float
    by_status: dict[str, int]
    by_crop: list[CropShare]


class MonthTotal(BaseModel):
    year: int
    month: int
    income: float
    expense: float


class FarmMonth(BaseModel):
    owner_id: str
    income: float
    expense: float


class OverviewOut(BaseModel):
    generated_at: int
    year: int
    month: int
    farmers: FarmerCounts
    plots: PlotStats
    # `months` tháng liền nhau, tháng cuối là (year, month).
    months: list[MonthTotal]
    # Thu - chi của từng nông hộ trong tháng (year, month); hộ không phát sinh thì vắng mặt.
    farms: list[FarmMonth]
    stock_value: float
    stock_kg: float
    pending_varieties: int
    errors_30d: int


def _month_back(year: int, month: int, back: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) - back
    return index // 12, index % 12 + 1


def _sum_by_owner(db: Session, model, start: int, end: int) -> dict[str, float]:
    rows = db.execute(
        select(model.owner_id, func.coalesce(func.sum(model.amount), 0.0))
        .where(model.is_deleted.is_(False), model.occurred_at >= start, model.occurred_at < end)
        .group_by(model.owner_id)
    )
    return {owner: float(total) for owner, total in rows}


@admin_router.get("/overview", response_model=OverviewOut)
def overview(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    months: int = Query(default=6, ge=1, le=12, description="Số tháng của dãy thu - chi (tháng cuối là tháng được chọn)"),
    _: User = Depends(current_admin),
    db: Session = Depends(get_db),
) -> OverviewOut:
    """Số liệu toàn hệ thống: nông hộ, lô đất, thu - chi theo tháng, tồn kho, việc chờ xử lý."""
    now = datetime.now(tz=ledger.VN_TZ)
    year = year or now.year
    month = month or now.month
    if not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="month phải từ 1 đến 12")

    # ---- nông hộ ----
    farmers = list(
        db.scalars(select(User).where(User.role == UserRole.FARMER, User.is_deleted.is_(False)))
    )
    plots = list(db.scalars(select(Plot).where(Plot.is_deleted.is_(False))))
    owners_with_plot = {p.owner_id for p in plots}
    counts = FarmerCounts(
        total=len(farmers),
        active=sum(1 for f in farmers if f.is_active),
        locked=sum(1 for f in farmers if not f.is_active),
        without_plot=sum(1 for f in farmers if f.id not in owners_with_plot),
    )

    # ---- lô đất ----
    by_status: dict[str, int] = defaultdict(int)
    crops: dict[str, dict] = {}
    for plot in plots:
        by_status[plot.status] += 1
        entry = crops.setdefault(
            plot.crop_type, {"crop_type": plot.crop_type, "crop_name": plot.crop_name or plot.crop_type, "plots": 0, "area_m2": 0.0}
        )
        entry["plots"] += 1
        # Hàng lô đất chỉ lưu "m2" hoặc "ha" (xem mobile/src/domain/areaUnits.ts).
        entry["area_m2"] += plot.area * (10_000 if plot.area_unit == "ha" else 1)
    plot_stats = PlotStats(
        total=len(plots),
        area_m2=sum(c["area_m2"] for c in crops.values()),
        by_status=dict(by_status),
        by_crop=sorted((CropShare(**c) for c in crops.values()), key=lambda c: -c.area_m2),
    )

    # ---- thu - chi ----
    series: list[MonthTotal] = []
    for back in range(months - 1, -1, -1):
        y, m = _month_back(year, month, back)
        start, end = ledger.Period(y, month=m).bounds_ms()
        series.append(
            MonthTotal(
                year=y,
                month=m,
                income=sum(_sum_by_owner(db, Income, start, end).values()),
                expense=sum(_sum_by_owner(db, Expense, start, end).values()),
            )
        )
    start, end = ledger.Period(year, month=month).bounds_ms()
    income_by_owner = _sum_by_owner(db, Income, start, end)
    expense_by_owner = _sum_by_owner(db, Expense, start, end)
    farms = [
        FarmMonth(owner_id=owner, income=income_by_owner.get(owner, 0.0), expense=expense_by_owner.get(owner, 0.0))
        for owner in sorted(set(income_by_owner) | set(expense_by_owner))
    ]

    # ---- tồn kho: tính theo từng hộ rồi cộng, vì FIFO chỉ có nghĩa trong một kho ----
    ins: dict[str, list[WarehouseIn]] = defaultdict(list)
    outs: dict[str, list[WarehouseOut]] = defaultdict(list)
    for row in db.scalars(select(WarehouseIn).where(WarehouseIn.is_deleted.is_(False))):
        ins[row.owner_id].append(row)
    for row in db.scalars(select(WarehouseOut).where(WarehouseOut.is_deleted.is_(False))):
        outs[row.owner_id].append(row)
    stock_value = stock_kg = 0.0
    for owner in set(ins) | set(outs):
        for line in ledger.stock_summary(ins[owner], outs[owner]):
            if line.stock_kg > 0:
                stock_value += line.stock_value
                stock_kg += line.stock_kg

    # ---- việc chờ xử lý ----
    pending_varieties = db.scalar(
        select(func.count())
        .select_from(CropVariety)
        .where(CropVariety.is_deleted.is_(False), CropVariety.is_seed.is_(False), CropVariety.approved.is_(False))
    )
    now_ms = int(time.time() * 1000)
    errors_30d = db.scalar(
        select(func.count()).select_from(ErrorLog).where(ErrorLog.occurred_at >= now_ms - THIRTY_DAYS_MS)
    )

    return OverviewOut(
        generated_at=now_ms,
        year=year,
        month=month,
        farmers=counts,
        plots=plot_stats,
        months=series,
        farms=farms,
        stock_value=stock_value,
        stock_kg=stock_kg,
        pending_varieties=pending_varieties or 0,
        errors_30d=errors_30d or 0,
    )
