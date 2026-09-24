"""Cultivation history of a plot, crop suggestions and what the plot cost.

A "cultivation history" entry is a crop cycle (`crop_cycles`) — the same rows
the phone's "Vụ trồng" tab writes through /sync. There is no second table: a
season recorded here and a season recorded on the phone are the same record.

    GET    /plots/{plot_id}/cultivation-history
    POST   /plots/{plot_id}/cultivation-history
    PATCH  /cultivation-history/{cycle_id}
    DELETE /cultivation-history/{cycle_id}
    GET    /plots/{plot_id}/recommend-crops?season=spring
    GET    /plots/{plot_id}/cost-summary?start=&end=

A farmer reaches only their own plots; an admin reaches any (a farm's
records are the farm's, so an admin-created cycle is still owned by it).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.farm import CropCycle, GrowthStage, Plot, Season
from app.models.ledger import Expense, WarehouseOut
from app.models.user import User, UserRole
from app.schemas.cultivation import (
    CropSuggestionOut,
    CultivationCreate,
    CultivationOut,
    CultivationUpdate,
    MediaRef,
    PlotCostsOut,
)
from app.services import cultivation as cult
from app.services import media_service, static_data
from app.services.auth_service import current_user
from app.services.sync_service import now_ms

router = APIRouter(tags=["cultivation"])


def _plot(db: Session, user: User, plot_id: str) -> Plot:
    plot = db.get(Plot, plot_id)
    if plot is None or plot.is_deleted or not (user.role is UserRole.ADMIN or plot.owner_id == user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lô đất")
    return plot


def _cycle(db: Session, user: User, cycle_id: str) -> CropCycle:
    cycle = db.get(CropCycle, cycle_id)
    if cycle is None or cycle.is_deleted or not (user.role is UserRole.ADMIN or cycle.owner_id == user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy vụ trồng")
    return cycle


def _alive_cycles(db: Session, plot_id: str) -> list[CropCycle]:
    stmt = select(CropCycle).where(CropCycle.plot_id == plot_id, CropCycle.is_deleted.is_(False))
    return list(db.scalars(stmt.order_by(CropCycle.started_at.desc())))


def crop_names() -> dict[str, str]:
    return {c["id"]: c["name"] for c in static_data.load("crop_varieties").get("crop_types", [])}


def cycle_out(cycle: CropCycle) -> CultivationOut:
    season = cult.cycle_season(cycle)
    return CultivationOut(
        id=cycle.id,
        plot_id=cycle.plot_id,
        name=cycle.name,
        crop_type=cycle.crop_type,
        crop_name=cycle.crop_name or crop_names().get(cycle.crop_type),
        variety_id=cycle.variety_id,
        variety_name=cycle.variety_name,
        stage=cycle.stage,
        season=season,
        season_label=cult.season_label(season, cult.year_of(cycle.started_at)),
        started_at=cycle.started_at,
        ended_at=cycle.ended_at,
        area_m2=cycle.area_m2,
        yield_kg=cycle.yield_kg,
        productivity=cult.productivity(cycle.yield_kg, cycle.area_m2),
        notes=cycle.notes,
        media=[MediaRef(**ref) for ref in media_service.with_urls(media_service.parse_refs(cycle.media_json))],
        owner_id=cycle.owner_id,
        updated_by=cycle.updated_by,
        created_at=cycle.created_at,
        updated_at=cycle.updated_at,
    )


def _ensure_single_open(db: Session, plot_id: str, except_id: str | None = None) -> None:
    """One crop growing at a time — the same rule the phone enforces."""
    for other in _alive_cycles(db, plot_id):
        if other.ended_at is None and other.id != except_id:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f'Lô đang có vụ "{other.name}" chưa kết thúc. Kết thúc vụ đó trước.',
            )


@router.get("/plots/{plot_id}/cultivation-history", response_model=list[CultivationOut])
def list_cultivation(plot_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    plot = _plot(db, user, plot_id)
    return [cycle_out(c) for c in _alive_cycles(db, plot.id)]


@router.post(
    "/plots/{plot_id}/cultivation-history",
    response_model=CultivationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_cultivation(
    plot_id: str, body: CultivationCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    """Records a season. Leave `ended_at` out for the crop growing now; give it
    (with `yield_kg`) to write down a past season after the fact."""
    plot = _plot(db, user, plot_id)
    if body.ended_at is None:
        _ensure_single_open(db, plot.id)
    cycle = CropCycle(
        id=body.id or str(uuid.uuid4()),
        plot_id=plot.id,
        name=body.name.strip(),
        crop_type=body.crop_type,
        crop_name=body.crop_name or crop_names().get(body.crop_type),
        variety_id=body.variety_id,
        variety_name=body.variety_name,
        stage=GrowthStage.FINISHED.value if body.ended_at else GrowthStage.SEEDLING.value,
        season=(body.season.value if body.season else cult.season_of(body.started_at)),
        started_at=body.started_at,
        ended_at=body.ended_at,
        area_m2=body.area_m2 or cult.area_in_m2(plot.area, plot.area_unit) or None,
        yield_kg=body.yield_kg,
        notes=body.notes,
        owner_id=plot.owner_id,
        updated_by=user.id,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle_out(cycle)


@router.patch("/cultivation-history/{cycle_id}", response_model=CultivationOut)
def update_cultivation(
    cycle_id: str, body: CultivationUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    cycle = _cycle(db, user, cycle_id)
    data = body.model_dump(exclude_unset=True)
    for key in ("stage", "season"):
        if data.get(key) is not None:
            data[key] = data[key].value
    started = data.get("started_at", cycle.started_at)
    ended = data["ended_at"] if "ended_at" in data else cycle.ended_at
    if ended is not None and ended < started:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ngày kết thúc không được trước ngày xuống giống")
    if ended is None and cycle.ended_at is not None:
        _ensure_single_open(db, cycle.plot_id, except_id=cycle.id)
    for key, value in data.items():
        setattr(cycle, key, value)
    if "ended_at" in data and ended is not None and "stage" not in data:
        cycle.stage = GrowthStage.FINISHED.value
    cycle.updated_by = user.id
    db.commit()
    db.refresh(cycle)
    return cycle_out(cycle)


@router.delete("/cultivation-history/{cycle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cultivation(cycle_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    cycle = _cycle(db, user, cycle_id)
    cycle.is_deleted = True
    cycle.deleted_at = now_ms()
    cycle.updated_by = user.id
    db.commit()


@router.get("/plots/{plot_id}/recommend-crops", response_model=list[CropSuggestionOut])
def recommend_crops(
    plot_id: str,
    season: Season | None = Query(default=None, description="spring | summer | autumn | winter"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Crops this plot has grown, best average productivity first.

    Harvests of the requested season are preferred; with none recorded, all
    seasons are used and each item says so in `basis`/`reason`. An empty list
    means there is nothing to learn from yet — no finished season with both a
    yield and an area.
    """
    plot = _plot(db, user, plot_id)
    suggestions = cult.recommend(_alive_cycles(db, plot.id), season.value if season else None, crop_names())
    return [CropSuggestionOut(**vars(s)) for s in suggestions]


@router.get("/plots/{plot_id}/cost-summary", response_model=PlotCostsOut)
def plot_cost_summary(
    plot_id: str,
    start: int | None = Query(default=None, description="epoch ms, tính từ"),
    end: int | None = Query(default=None, description="epoch ms, tính đến"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Giống + Phân bón + Nhân công (+ khác) spent on this plot."""
    plot = _plot(db, user, plot_id)
    # `plot_id` on a ledger row is a plain string the phone fills in, so the
    # owner is checked too — another farm's row naming this plot is not its cost.
    expenses = db.scalars(
        select(Expense).where(
            Expense.plot_id == plot.id, Expense.owner_id == plot.owner_id, Expense.is_deleted.is_(False)
        )
    )
    issues = db.scalars(
        select(WarehouseOut).where(
            WarehouseOut.plot_id == plot.id,
            WarehouseOut.owner_id == plot.owner_id,
            WarehouseOut.is_deleted.is_(False),
        )
    )
    totals = cult.plot_costs(expenses, issues, plot.id, start, end)
    return PlotCostsOut(plot_id=plot.id, start=start, end=end, **totals)
