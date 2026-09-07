"""REST endpoints for plots and the crop variety catalogue.

The mobile app talks to the sync endpoints instead — these exist for web-admin
(read-only plot browsing in Giai đoạn 4) and for anything that is easier to test
with plain HTTP than through the sync protocol.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.farm import CropVariety, Plot
from app.models.user import User, UserRole
from app.schemas.farm import (
    CropVarietyCreate,
    CropVarietyOut,
    PlotCreate,
    PlotOut,
    PlotUpdate,
)
from app.services.auth_service import current_user
from app.services.sync_service import now_ms

plots_router = APIRouter(prefix="/plots", tags=["plots"])
varieties_router = APIRouter(prefix="/crop-varieties", tags=["crop-varieties"])


@plots_router.get("", response_model=list[PlotOut])
def list_plots(
    owner_id: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Plot]:
    stmt = select(Plot).where(Plot.is_deleted.is_(False))
    if user.role is UserRole.ADMIN:
        if owner_id:
            stmt = stmt.where(Plot.owner_id == owner_id)
    else:
        # A farmer only ever sees their own plots, whatever they ask for.
        stmt = stmt.where(Plot.owner_id == user.id)
    return list(db.scalars(stmt.order_by(Plot.created_at.desc())))


@plots_router.post("", response_model=PlotOut, status_code=status.HTTP_201_CREATED)
def create_plot(
    body: PlotCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Plot:
    plot = Plot(
        id=body.id or str(uuid.uuid4()),
        owner_id=user.id,
        updated_by=user.id,
        **body.model_dump(exclude={"id"}),
    )
    db.add(plot)
    db.commit()
    db.refresh(plot)
    return plot


@plots_router.get("/{plot_id}", response_model=PlotOut)
def get_plot(plot_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Plot:
    return _owned_plot(db, user, plot_id)


@plots_router.patch("/{plot_id}", response_model=PlotOut)
def update_plot(
    plot_id: str,
    body: PlotUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Plot:
    plot = _owned_plot(db, user, plot_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plot, field, value)
    plot.updated_by = user.id
    db.commit()
    db.refresh(plot)
    return plot


@plots_router.delete("/{plot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plot(
    plot_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    plot = _owned_plot(db, user, plot_id)
    # Soft delete: pullChanges has to be able to tell the phone it is gone.
    plot.is_deleted = True
    plot.deleted_at = now_ms()
    plot.updated_by = user.id
    db.commit()


def _owned_plot(db: Session, user: User, plot_id: str) -> Plot:
    plot = db.get(Plot, plot_id)
    if plot is None or plot.is_deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy lô đất")
    if user.role is not UserRole.ADMIN and plot.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lô đất")
    return plot


@varieties_router.get("", response_model=list[CropVarietyOut])
def list_varieties(
    crop_type: str | None = Query(default=None),
    include_unapproved: bool = Query(default=True),
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[CropVariety]:
    stmt = select(CropVariety).where(CropVariety.is_deleted.is_(False))
    if crop_type:
        stmt = stmt.where(CropVariety.crop_type == crop_type)
    if not include_unapproved:
        stmt = stmt.where(or_(CropVariety.approved.is_(True), CropVariety.is_seed.is_(True)))
    return list(db.scalars(stmt.order_by(CropVariety.is_seed.desc(), CropVariety.name)))


@varieties_router.post("", response_model=CropVarietyOut, status_code=status.HTTP_201_CREATED)
def create_variety(
    body: CropVarietyCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CropVariety:
    variety = CropVariety(
        id=body.id or str(uuid.uuid4()),
        created_by=user.id,
        is_seed=False,
        # Admin-created entries are trusted straight away; a farmer's needs review.
        approved=user.role is UserRole.ADMIN,
        source="user",
        **body.model_dump(exclude={"id"}),
    )
    db.add(variety)
    db.commit()
    db.refresh(variety)
    return variety
