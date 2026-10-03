"""Weather for the village — see app/services/weather.py for source and thresholds.

    GET  /weather            current conditions, 7 days, official warnings
    POST /weather/refresh    admin — fetch now and raise any new warning
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services import weather
from app.services.auth_service import current_admin, current_user

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("")
def get_weather(_: User = Depends(current_user)) -> dict[str, Any]:
    try:
        return weather.forecast()
    except weather.WeatherUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.post("/refresh")
def refresh_weather(_: User = Depends(current_admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        data = weather.forecast(force=True)
    except weather.WeatherUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    raised = [] if data.get("stale") else weather.raise_alerts(db, data)
    return {**data, "raised": raised}
