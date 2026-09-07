"""Liveness / readiness endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.common import HealthResponse
from app.services import static_data

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception as exc:  # pragma: no cover - only on a broken DB
        database = f"error: {exc.__class__.__name__}"

    return HealthResponse(
        status="ok" if database == "ok" else "degraded",
        app=settings.app_name,
        version=settings.app_version,
        database=database,
        static_data=static_data.availability(),
    )
