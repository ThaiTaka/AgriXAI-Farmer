"""REST endpoints for Giai đoạn 3: plans, warehouse, income / expense, reports.

The phone writes through the sync protocol; these endpoints exist for
web-admin, for integrations and because the business rules (FIFO cost,
stock check, monthly report) are far easier to test over plain HTTP.
Every list is scoped to the caller — a farmer never sees another farm's
ledger, whatever query string they send.
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ledger import Expense, ExpenseKind, Income, Plan, TaskHistory, WarehouseIn, WarehouseOut
from app.models.user import User, UserRole
from app.schemas.ledger import (
    CheckedUpdate,
    ExpenseCreate,
    ExpenseOut,
    FinancialReportOut,
    IncomeCreate,
    IncomeOut,
    PlanCreate,
    PlanOut,
    StockCheckOut,
    StockLineOut,
    StockSummaryOut,
    WarehouseInCreate,
    WarehouseInOut,
    WarehouseOutCreate,
    WarehouseOutOut,
)
from app.services import ledger_service as ledger
from app.services import static_data
from app.services.auth_service import current_user
from app.services.sync_service import now_ms

plans_router = APIRouter(prefix="/plans", tags=["plans"])
warehouse_router = APIRouter(prefix="/warehouse", tags=["warehouse"])
income_router = APIRouter(prefix="/income", tags=["finance"])
expense_router = APIRouter(prefix="/expense", tags=["finance"])
reports_router = APIRouter(prefix="/reports", tags=["finance"])
protocols_router = APIRouter(prefix="/care-protocols", tags=["care-protocols"])
tasks_router = APIRouter(prefix="/tasks-history", tags=["care-protocols"])


def _alive(model, user: User):
    return select(model).where(model.owner_id == user.id, model.is_deleted.is_(False))


def _viewer(db: Session, user: User, owner_id: str | None) -> User:
    """Whose ledger a list endpoint shows: the caller, or — admin only — a
    given farm. A farmer asking for someone else gets a 404, not a 403, so
    the existence of other ids is not confirmed."""
    if not owner_id or owner_id == user.id:
        return user
    if user.role is not UserRole.ADMIN:
        raise HTTPException(status_code=404, detail="Không tìm thấy nông hộ")
    target = db.get(User, owner_id)
    if target is None or target.is_deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy nông hộ")
    return target


# --------------------------------- plans ---------------------------------


@plans_router.get("", response_model=list[PlanOut])
def list_plans(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Plan]:
    target = _viewer(db, user, owner_id)
    return list(db.scalars(_alive(Plan, target).order_by(Plan.created_at.desc())))


@plans_router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(body: PlanCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Plan:
    plan = Plan(
        id=body.id or str(uuid.uuid4()),
        owner_id=user.id,
        updated_by=user.id,
        items_json=json.dumps([item.model_dump() for item in body.items], ensure_ascii=False),
        **body.model_dump(exclude={"id", "items"}),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


# ------------------------------- warehouse -------------------------------


@warehouse_router.get("/in", response_model=list[WarehouseInOut])
def list_warehouse_in(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[WarehouseIn]:
    target = _viewer(db, user, owner_id)
    return list(db.scalars(_alive(WarehouseIn, target).order_by(WarehouseIn.occurred_at.desc())))


@warehouse_router.post("/in", response_model=WarehouseInOut, status_code=status.HTTP_201_CREATED)
def create_warehouse_in(
    body: WarehouseInCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> WarehouseIn:
    quantity_kg = ledger.to_kg(body.quantity, body.unit.value)
    row = WarehouseIn(
        id=body.id or str(uuid.uuid4()),
        owner_id=user.id,
        updated_by=user.id,
        fertilizer_id=body.fertilizer_id,
        fertilizer_name=body.fertilizer_name,
        category=body.category,
        quantity=body.quantity,
        unit=body.unit.value,
        quantity_kg=quantity_kg,
        price=body.price,
        unit_price=body.price / quantity_kg if quantity_kg else 0.0,
        occurred_at=body.occurred_at,
        note=body.note,
        plot_id=body.plot_id,
    )
    db.add(row)

    if body.record_expense and body.price > 0:
        # A purchase is money out of the farm: book it under "Phân bón" and
        # link the two rows so neither can be double counted later.
        expense = Expense(
            id=str(uuid.uuid4()),
            owner_id=user.id,
            updated_by=user.id,
            kind=ExpenseKind.FERTILIZER.value,
            description=f"Mua {body.fertilizer_name} {body.quantity:g} {body.unit.value}",
            amount=body.price,
            occurred_at=body.occurred_at,
            note=body.note,
            plot_id=body.plot_id,
            checked=False,
            warehouse_in_id=row.id,
        )
        db.add(expense)
        row.expense_id = expense.id

    db.commit()
    db.refresh(row)
    return row


@warehouse_router.get("/out", response_model=list[WarehouseOutOut])
def list_warehouse_out(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[WarehouseOut]:
    target = _viewer(db, user, owner_id)
    return list(db.scalars(_alive(WarehouseOut, target).order_by(WarehouseOut.occurred_at.desc())))


@warehouse_router.post("/out", response_model=WarehouseOutOut, status_code=status.HTTP_201_CREATED)
def create_warehouse_out(
    body: WarehouseOutCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> WarehouseOut:
    ins = list(db.scalars(_alive(WarehouseIn, user)))
    outs = list(db.scalars(_alive(WarehouseOut, user)))

    stock = sum(r.quantity_kg for r in ins if r.fertilizer_id == body.fertilizer_id) - sum(
        r.quantity_kg for r in outs if r.fertilizer_id == body.fertilizer_id
    )
    if body.quantity_kg > stock + 1e-9:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kho chỉ còn {stock:g} kg {body.fertilizer_name}, không xuất được {body.quantity_kg:g} kg",
        )

    fifo = ledger.fifo_cost(
        [ledger.InRow(r.fertilizer_id, r.quantity_kg, r.unit_price, r.occurred_at, r.created_at) for r in ins],
        [ledger.OutRow(r.fertilizer_id, r.quantity_kg, r.occurred_at, r.created_at) for r in outs],
        body.fertilizer_id,
        body.quantity_kg,
        body.occurred_at,
    )
    row = WarehouseOut(
        id=body.id or str(uuid.uuid4()),
        owner_id=user.id,
        updated_by=user.id,
        fertilizer_id=body.fertilizer_id,
        fertilizer_name=body.fertilizer_name,
        category=body.category,
        quantity_kg=body.quantity_kg,
        unit_price=fifo.unit_price,
        total_cost=fifo.total_cost,
        occurred_at=body.occurred_at,
        note=body.note,
        plot_id=body.plot_id,
        plan_id=body.plan_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@warehouse_router.get("/summary", response_model=StockSummaryOut)
def warehouse_summary(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> StockSummaryOut:
    target = _viewer(db, user, owner_id)
    lines = ledger.stock_summary(db.scalars(_alive(WarehouseIn, target)), db.scalars(_alive(WarehouseOut, target)))
    out = [
        StockLineOut(
            fertilizer_id=l.fertilizer_id,
            fertilizer_name=l.fertilizer_name,
            category=l.category,
            in_kg=l.in_kg,
            out_kg=l.out_kg,
            stock_kg=l.stock_kg,
            avg_price=l.avg_price,
            stock_value=l.stock_value,
            latest_unit_price=l.latest_unit_price,
        )
        for l in lines
    ]
    return StockSummaryOut(
        lines=out,
        total_stock_kg=sum(l.stock_kg for l in lines),
        total_value=sum(l.stock_value for l in lines),
    )


@warehouse_router.get("/summary.csv")
def warehouse_summary_csv(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    lines = ledger.stock_summary(db.scalars(_alive(WarehouseIn, user)), db.scalars(_alive(WarehouseOut, user)))
    return Response(
        content="﻿" + ledger.stock_csv(lines),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ton-kho.csv"'},
    )


@warehouse_router.get("/check", response_model=StockCheckOut)
def warehouse_check(
    fertilizer_id: str = Query(...),
    needed_kg: float = Query(gt=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> StockCheckOut:
    """F4: is there enough of one fertiliser in the shed for a planned application?"""
    ins = list(db.scalars(_alive(WarehouseIn, user).where(WarehouseIn.fertilizer_id == fertilizer_id)))
    outs = list(db.scalars(_alive(WarehouseOut, user).where(WarehouseOut.fertilizer_id == fertilizer_id)))
    lines = ledger.stock_summary(ins, outs)
    stock = lines[0].stock_kg if lines else 0.0
    latest = lines[0].latest_unit_price if lines else None
    fifo = ledger.fifo_cost(
        [ledger.InRow(r.fertilizer_id, r.quantity_kg, r.unit_price, r.occurred_at, r.created_at) for r in ins],
        [ledger.OutRow(r.fertilizer_id, r.quantity_kg, r.occurred_at, r.created_at) for r in outs],
        fertilizer_id,
        needed_kg,
        now_ms(),
    )
    remaining = stock - needed_kg
    return StockCheckOut(
        fertilizer_id=fertilizer_id,
        stock_kg=stock,
        needed_kg=needed_kg,
        remaining_kg=max(0.0, remaining),
        shortfall_kg=max(0.0, -remaining),
        enough=remaining >= 0,
        latest_unit_price=latest,
        fifo_unit_price=fifo.unit_price,
    )


# -------------------------------- finance --------------------------------


@income_router.get("", response_model=list[IncomeOut])
def list_income(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Income]:
    target = _viewer(db, user, owner_id)
    return list(db.scalars(_alive(Income, target).order_by(Income.occurred_at.desc())))


@income_router.post("", response_model=IncomeOut, status_code=status.HTTP_201_CREATED)
def create_income(body: IncomeCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Income:
    row = Income(
        id=body.id or str(uuid.uuid4()),
        owner_id=user.id,
        updated_by=user.id,
        kind=body.kind.value,
        **body.model_dump(exclude={"id", "kind"}),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@income_router.patch("/{row_id}/checked", response_model=IncomeOut)
def set_income_checked(
    row_id: str, body: CheckedUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Income:
    row = db.get(Income, row_id)
    if row is None or row.is_deleted or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản thu")
    row.checked = body.checked
    row.updated_by = user.id
    db.commit()
    db.refresh(row)
    return row


@expense_router.get("", response_model=list[ExpenseOut])
def list_expense(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Expense]:
    target = _viewer(db, user, owner_id)
    return list(db.scalars(_alive(Expense, target).order_by(Expense.occurred_at.desc())))


@expense_router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(body: ExpenseCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Expense:
    row = Expense(
        id=body.id or str(uuid.uuid4()),
        owner_id=user.id,
        updated_by=user.id,
        kind=body.kind.value,
        **body.model_dump(exclude={"id", "kind"}),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@expense_router.patch("/{row_id}/checked", response_model=ExpenseOut)
def set_expense_checked(
    row_id: str, body: CheckedUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Expense:
    row = db.get(Expense, row_id)
    if row is None or row.is_deleted or row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")
    row.checked = body.checked
    row.updated_by = user.id
    db.commit()
    db.refresh(row)
    return row


def _period(year: int, month: int | None, quarter: int | None) -> ledger.Period:
    if month is not None and not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="month phải từ 1 đến 12")
    if quarter is not None and not 1 <= quarter <= 4:
        raise HTTPException(status_code=422, detail="quarter phải từ 1 đến 4")
    return ledger.Period(year=year, month=month, quarter=quarter)


@reports_router.get("/financials", response_model=FinancialReportOut)
def financials(
    year: int = Query(...),
    month: int | None = Query(default=None),
    quarter: int | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> FinancialReportOut:
    target = _viewer(db, user, owner_id)
    report = ledger.financial_report(
        db.scalars(_alive(Income, target)), db.scalars(_alive(Expense, target)), _period(year, month, quarter)
    )
    return FinancialReportOut(
        period=report.period,
        total_income=report.total_income,
        total_expense=report.total_expense,
        profit=report.profit,
        income_by_kind=report.income_by_kind,
        expense_by_kind=report.expense_by_kind,
        daily=report.daily,
        incomes=report.incomes,
        expenses=report.expenses,
    )


@reports_router.get("/financials.csv")
def financials_csv(
    year: int = Query(...),
    month: int | None = Query(default=None),
    quarter: int | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    report = ledger.financial_report(
        db.scalars(_alive(Income, user)), db.scalars(_alive(Expense, user)), _period(year, month, quarter)
    )
    name = f"thu-chi-{year}" + (f"-thang-{month}" if month else f"-quy-{quarter}" if quarter else "")
    return Response(
        # BOM so Excel on Windows opens the Vietnamese text as UTF-8.
        content="﻿" + ledger.financial_csv(report),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
    )


# ---------------------------- care protocols -----------------------------


@protocols_router.get("")
def list_care_protocols(_: User = Depends(current_user)) -> dict:
    """The merged shared/data/care_protocols.json, so web-admin shows exactly
    what the phone bundles."""
    return static_data.load("care_protocols")


@tasks_router.get("")
def list_tasks_history(
    plot_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    stmt = _alive(TaskHistory, user)
    if plot_id:
        stmt = stmt.where(TaskHistory.plot_id == plot_id)
    rows = db.scalars(stmt.order_by(TaskHistory.updated_at.desc()))
    return [
        {
            "id": r.id,
            "protocol_id": r.protocol_id,
            "stage_code": r.stage_code,
            "task_key": r.task_key,
            "task_title": r.task_title,
            "crop_type": r.crop_type,
            "plot_id": r.plot_id,
            "done": r.done,
            "done_at": r.done_at,
            "remind_at": r.remind_at,
            "note": r.note,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]
