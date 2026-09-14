"""Giai đoạn 4 endpoints: error logs, dashboard summary, PDF report, users.

Farmers get their own numbers; an admin may pass `owner_id` to look at one
farm from web-admin. Nothing here lets a farmer read another farm.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.ledger import Expense, Income, WarehouseIn, WarehouseOut
from app.models.ops import ErrorLog
from app.models.user import User, UserRole
from app.services import dashboard_service, ledger_service as ledger, report_pdf
from app.services.auth_service import current_admin, current_user

logs_router = APIRouter(prefix="/logs", tags=["ops"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])
reports_pdf_router = APIRouter(prefix="/reports", tags=["finance"])
users_router = APIRouter(prefix="/users", tags=["ops"])


def resolve_target(db: Session, user: User, owner_id: str | None) -> User:
    """The farm being looked at: the caller, or — for an admin only — another user."""
    if not owner_id or owner_id == user.id:
        return user
    if user.role is not UserRole.ADMIN:
        # Same 404 as an unknown id: a farmer must not learn which ids exist.
        raise HTTPException(status_code=404, detail="Không tìm thấy nông hộ")
    target = db.get(User, owner_id)
    if target is None or target.is_deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy nông hộ")
    return target


# --------------------------------- logs ----------------------------------


class ErrorLogIn(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    action: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1)
    stack: str | None = None
    app_version: str | None = Field(default=None, max_length=32)
    platform: str | None = Field(default=None, max_length=32)
    occurred_at: int
    reported: bool = False


class ErrorLogOut(ErrorLogIn):
    id: str
    user_id: str
    created_at: int


@logs_router.post("", status_code=status.HTTP_201_CREATED)
def post_logs(body: list[ErrorLogIn], user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Accepts a batch (the phone queues while offline). Re-sending an id is
    a no-op, so a retry after a dropped response cannot duplicate a log."""
    accepted: list[str] = []
    for entry in body:
        row_id = entry.id or str(uuid.uuid4())
        if db.get(ErrorLog, row_id) is not None:
            accepted.append(row_id)
            continue
        db.add(
            ErrorLog(
                id=row_id,
                user_id=user.id,
                action=entry.action,
                message=entry.message[:4000],
                stack=(entry.stack or "")[:8000] or None,
                app_version=entry.app_version,
                platform=entry.platform,
                occurred_at=entry.occurred_at,
                reported=entry.reported,
            )
        )
        accepted.append(row_id)
    db.commit()
    return {"accepted": accepted}


@logs_router.get("", response_model=list[ErrorLogOut])
def list_logs(
    owner_id: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    _: User = Depends(current_admin),
    db: Session = Depends(get_db),
) -> list[ErrorLog]:
    stmt = select(ErrorLog).order_by(ErrorLog.occurred_at.desc()).limit(limit)
    if owner_id:
        stmt = stmt.where(ErrorLog.user_id == owner_id)
    return list(db.scalars(stmt))


# ------------------------------- dashboard -------------------------------


class PendingGroupOut(BaseModel):
    plot_id: str
    plot_name: str
    crop_name: str
    stage_name: str
    pending: int


class DashboardOut(BaseModel):
    owner_id: str
    full_name: str
    region: str | None
    year: int
    month: int
    stock_value: float
    stock_kg: float
    stock_kinds: int
    month_income: float
    month_expense: float
    month_profit: float
    pending_tasks: int
    pending_groups: list[PendingGroupOut]


@dashboard_router.get("/summary", response_model=DashboardOut)
def dashboard_summary(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> DashboardOut:
    target = resolve_target(db, user, owner_id)
    now = datetime.now(tz=ledger.VN_TZ)
    year = year or now.year
    month = month or now.month
    if not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="month phải từ 1 đến 12")
    s = dashboard_service.summary(db, target, year, month)
    return DashboardOut(
        owner_id=target.id,
        full_name=target.full_name,
        region=target.region,
        year=year,
        month=month,
        stock_value=s.stock_value,
        stock_kg=s.stock_kg,
        stock_kinds=s.stock_kinds,
        month_income=s.month_income,
        month_expense=s.month_expense,
        month_profit=s.month_profit,
        pending_tasks=s.pending_tasks,
        pending_groups=[PendingGroupOut(**g.__dict__) for g in s.pending_groups],
    )


# ---------------------------------- pdf ----------------------------------


@reports_pdf_router.get("/financials.pdf")
def financials_pdf(
    year: int = Query(...),
    month: int | None = Query(default=None),
    quarter: int | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    if month is not None and not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="month phải từ 1 đến 12")
    if quarter is not None and not 1 <= quarter <= 4:
        raise HTTPException(status_code=422, detail="quarter phải từ 1 đến 4")
    if month is None and quarter is None:
        raise HTTPException(status_code=422, detail="Cần month hoặc quarter")

    target = resolve_target(db, user, owner_id)
    period = ledger.Period(year=year, month=month, quarter=quarter)

    def alive(model):
        return select(model).where(model.owner_id == target.id, model.is_deleted.is_(False))

    all_expenses = list(db.scalars(alive(Expense)))
    report = ledger.financial_report(db.scalars(alive(Income)), all_expenses, period)
    if not report.incomes and not report.expenses:
        # The brief's wording, verbatim — the phone shows the same string.
        raise HTTPException(status_code=404, detail="Không có dữ liệu tháng này")

    stock = ledger.stock_summary(db.scalars(alive(WarehouseIn)), db.scalars(alive(WarehouseOut)))
    notes = report_pdf.report_notes(report, stock, all_expenses, period)
    content = report_pdf.build_pdf(
        farmer_name=target.full_name or target.username,
        address=target.region,
        report=report,
        notes=notes,
        generated_at=datetime.now(tz=ledger.VN_TZ),
    )
    name = f"bao-cao-thu-chi-{year}" + (f"-thang-{month}" if month else f"-quy-{quarter}") + ".pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# --------------------------------- users ---------------------------------


class UserSummary(BaseModel):
    id: str
    username: str
    full_name: str
    region: str | None
    role: str


@users_router.get("", response_model=list[UserSummary])
def list_users(_: User = Depends(current_admin), db: Session = Depends(get_db)) -> list[UserSummary]:
    rows = db.scalars(select(User).where(User.is_deleted.is_(False)).order_by(User.full_name))
    return [UserSummary(id=u.id, username=u.username, full_name=u.full_name, region=u.region, role=u.role.value) for u in rows]


@users_router.get("/version")
def app_version(_: User = Depends(current_user)) -> dict[str, str]:
    return {"app": settings.app_name, "version": settings.app_version}
