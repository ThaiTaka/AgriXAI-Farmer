"""Weather for the village — an Open-Meteo forecast, cached, with official warnings.

Source: Open-Meteo (https://open-meteo.com). No key. The free API is for
non-commercial use ("private or non-profit websites or apps that do not have
subscriptions or advertising", fewer than 10 000 calls a day) and its data is
CC BY 4.0, so every screen that shows it names Open-Meteo. The server asks
once per WEATHER_REFRESH_MINUTES whatever the number of phones; phones ask the
server and keep the last answer for when they are offline.

Place: one point for the whole village (settings.weather_*). Every farm is in
Làng hoa Vạn Thành; a per-plot forecast would need plot coordinates, which the
app does not collect.

Warnings use the national definitions of Quyết định 18/2021/QĐ-TTg (22/04/2021),
Điều 5:

  khoản 17 — mưa lớn: tổng lượng mưa trên 50 mm trong 24 giờ; trên 50 đến
             100 mm là mưa to, trên 100 mm là mưa rất to;
  khoản 18 — rét hại: nhiệt độ không khí trung bình ngày xuống dưới 13°C.

The forecast's total for the calendar day stands in for "24 giờ". Only today
and the next two days raise a warning — further out, a model forecast of a
rain total is too uncertain to act on — and each notice says it is a forecast
and points to the official bulletin.
"""

import asyncio
import logging
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import NotificationKind, NotificationLevel
from app.services import notification_service as notices

logger = logging.getLogger("agrilog.weather")

VN_TZ = timezone(timedelta(hours=7))
SOURCE = {"name": "Open-Meteo", "url": "https://open-meteo.com/", "licence": "CC BY 4.0"}
BASIS = "Quyết định 18/2021/QĐ-TTg, Điều 5"
OFFICIAL_BULLETIN = "https://www.nchmf.gov.vn/kttv/"

HEAVY_RAIN_MM = 50  # khoản 17: mưa to — trên 50 đến 100 mm / 24 giờ
VERY_HEAVY_RAIN_MM = 100  # khoản 17: mưa rất to — trên 100 mm / 24 giờ
DAMAGING_COLD_C = 13  # khoản 18: rét hại — trung bình ngày dưới 13°C
ALERT_DAYS = 3

DAILY = (
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "precipitation_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
)
CURRENT = ("temperature_2m", "relative_humidity_2m", "precipitation", "weather_code", "wind_speed_10m", "is_day")

# WMO weather interpretation codes, as Open-Meteo documents them. Code 65 is
# "heavy intensity" rain at that moment — not the official "mưa to", which is
# a 24-hour total — so it is worded differently on purpose.
WMO: dict[int, tuple[str, str]] = {
    0: ("Trời quang", "clear"),
    1: ("Ít mây", "partly"),
    2: ("Mây rải rác", "partly"),
    3: ("Nhiều mây", "cloud"),
    45: ("Sương mù", "fog"),
    48: ("Sương mù đóng băng", "fog"),
    51: ("Mưa phùn nhẹ", "drizzle"),
    53: ("Mưa phùn", "drizzle"),
    55: ("Mưa phùn dày", "drizzle"),
    56: ("Mưa phùn băng giá", "drizzle"),
    57: ("Mưa phùn băng giá", "drizzle"),
    61: ("Mưa nhỏ", "rain"),
    63: ("Mưa vừa", "rain"),
    65: ("Mưa nặng hạt", "rain"),
    66: ("Mưa băng giá", "rain"),
    67: ("Mưa băng giá", "rain"),
    71: ("Tuyết nhẹ", "snow"),
    73: ("Tuyết", "snow"),
    75: ("Tuyết dày", "snow"),
    77: ("Hạt tuyết", "snow"),
    80: ("Mưa rào nhẹ", "rain"),
    81: ("Mưa rào", "rain"),
    82: ("Mưa rào rất mạnh", "rain"),
    85: ("Mưa tuyết", "snow"),
    86: ("Mưa tuyết dày", "snow"),
    95: ("Dông", "storm"),
    96: ("Dông kèm mưa đá", "storm"),
    99: ("Dông kèm mưa đá", "storm"),
}


class WeatherUnavailable(RuntimeError):
    """No forecast yet and Open-Meteo could not be reached."""


@dataclass
class _Snapshot:
    forecast: dict[str, Any]
    fetched_at: float  # time.time()


_cache: _Snapshot | None = None
_lock = threading.Lock()


def describe(code: int | None) -> tuple[str, str]:
    """(Vietnamese summary, icon key) for a WMO code."""
    if code is None:
        return ("Chưa rõ", "cloud")
    return WMO.get(int(code), ("Chưa rõ", "cloud"))


def fetch_raw() -> dict[str, Any]:
    """One call to Open-Meteo. Tests replace this function."""
    params = {
        "latitude": settings.weather_latitude,
        "longitude": settings.weather_longitude,
        "current": ",".join(CURRENT),
        "daily": ",".join(DAILY),
        "timezone": "Asia/Ho_Chi_Minh",
        "forecast_days": 7,
    }
    with httpx.Client(timeout=10.0) as client:
        response = client.get(settings.weather_api_url, params=params)
        response.raise_for_status()
        return response.json()


def parse(raw: dict[str, Any], fetched_at_ms: int) -> dict[str, Any]:
    """Open-Meteo's column-wise JSON -> the shape the app and web-admin read."""
    current = raw.get("current") or {}
    summary, icon = describe(current.get("weather_code"))
    daily_raw = raw.get("daily") or {}
    days: list[dict[str, Any]] = []
    for i, day in enumerate(daily_raw.get("time") or []):
        def col(name: str) -> Any:
            values = daily_raw.get(name) or []
            return values[i] if i < len(values) else None

        day_summary, day_icon = describe(col("weather_code"))
        days.append(
            {
                "date": day,
                "weather_code": col("weather_code"),
                "summary": day_summary,
                "icon": day_icon,
                "temp_max": col("temperature_2m_max"),
                "temp_min": col("temperature_2m_min"),
                "temp_mean": col("temperature_2m_mean"),
                "precipitation_sum": col("precipitation_sum"),
                "precipitation_probability": col("precipitation_probability_max"),
                "wind_speed_max": col("wind_speed_10m_max"),
            }
        )

    forecast = {
        "place": settings.weather_place,
        "latitude": settings.weather_latitude,
        "longitude": settings.weather_longitude,
        "elevation": raw.get("elevation"),
        "fetched_at": fetched_at_ms,
        "current": {
            "time": current.get("time"),
            "temperature": current.get("temperature_2m"),
            "humidity": current.get("relative_humidity_2m"),
            "precipitation": current.get("precipitation"),
            "weather_code": current.get("weather_code"),
            "wind_speed": current.get("wind_speed_10m"),
            "is_day": bool(current.get("is_day", 1)),
            "summary": summary,
            "icon": icon,
        },
        "daily": days,
        "source": SOURCE,
        "basis": BASIS,
    }
    forecast["alerts"] = alerts_for(days, today=_today())
    return forecast


def _today() -> date:
    return datetime.now(VN_TZ).date()


def alerts_for(days: list[dict[str, Any]], *, today: date) -> list[dict[str, Any]]:
    """Official warnings for today and the next ALERT_DAYS - 1 days."""
    alerts: list[dict[str, Any]] = []
    for day in days:
        try:
            when = date.fromisoformat(day["date"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (today <= when < today + timedelta(days=ALERT_DAYS)):
            continue
        label = f"{when.day:02d}/{when.month:02d}"
        ends = int(datetime(when.year, when.month, when.day, tzinfo=VN_TZ).timestamp() * 1000) + 86_400_000

        rain = day.get("precipitation_sum")
        if isinstance(rain, (int, float)) and rain > HEAVY_RAIN_MM:
            very = rain > VERY_HEAVY_RAIN_MM
            name = "mưa rất to" if very else "mưa to"
            band = "trên 100 mm/24 giờ" if very else "trên 50 đến 100 mm/24 giờ"
            alerts.append(
                {
                    "id": f"weather-{day['date']}-{'mua-rat-to' if very else 'mua-to'}",
                    "date": day["date"],
                    "kind": "mua_rat_to" if very else "mua_to",
                    "level": NotificationLevel.DANGER if very else NotificationLevel.WARNING,
                    "title": f"Dự báo {name} ngày {label}",
                    "body": (
                        f"Open-Meteo dự báo tổng lượng mưa khoảng {_number(rain)} mm trong ngày {label} "
                        f"tại {settings.weather_place} — thuộc mức {name} ({band}, {BASIS} khoản 17). "
                        "Đây là dự báo, không phải số đo; theo dõi bản tin chính thức của "
                        "Trung tâm Dự báo Khí tượng Thủy văn Quốc gia."
                    ),
                    "expires_at": ends,
                }
            )

        mean = day.get("temp_mean")
        if isinstance(mean, (int, float)) and mean < DAMAGING_COLD_C:
            alerts.append(
                {
                    "id": f"weather-{day['date']}-ret-hai",
                    "date": day["date"],
                    "kind": "ret_hai",
                    "level": NotificationLevel.WARNING,
                    "title": f"Dự báo rét hại ngày {label}",
                    "body": (
                        f"Open-Meteo dự báo nhiệt độ trung bình ngày {label} khoảng {_number(mean)}°C "
                        f"tại {settings.weather_place} — dưới 13°C là rét hại ({BASIS} khoản 18). "
                        "Đây là dự báo, không phải số đo; theo dõi bản tin chính thức của "
                        "Trung tâm Dự báo Khí tượng Thủy văn Quốc gia."
                    ),
                    "expires_at": ends,
                }
            )
    return alerts


def _number(value: float) -> str:
    return f"{value:.1f}".replace(".", ",").removesuffix(",0")


def forecast(*, force: bool = False) -> dict[str, Any]:
    """The cached forecast, refreshed when older than the refresh interval.

    When Open-Meteo cannot be reached the last good forecast is returned with
    `stale: true` — yesterday's forecast with its timestamp beats an error.
    Raises WeatherUnavailable only when there has never been one.
    """
    global _cache
    if not settings.weather_enabled and _cache is None:
        raise WeatherUnavailable("Chức năng thời tiết đang tắt")
    max_age = settings.weather_refresh_minutes * 60
    with _lock:
        snapshot = _cache
        fresh = snapshot is not None and time.time() - snapshot.fetched_at < max_age
        if fresh and not force:
            return {**snapshot.forecast, "stale": False}
        if settings.weather_enabled:
            try:
                fetched = time.time()
                parsed = parse(fetch_raw(), int(fetched * 1000))
                _cache = _Snapshot(parsed, fetched)
                return {**parsed, "stale": False}
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                logger.warning("weather fetch failed: %s", exc.__class__.__name__)
        if snapshot is None:
            raise WeatherUnavailable("Chưa lấy được dự báo thời tiết")
        return {**snapshot.forecast, "stale": True}


def raise_alerts(db: Session, data: dict[str, Any]) -> list[str]:
    """Turns each warning into a notification for every farm, once."""
    raised: list[str] = []
    for alert in data.get("alerts") or []:
        row = notices.ensure(
            db,
            alert["id"],
            title=alert["title"],
            body=alert["body"],
            kind=NotificationKind.WEATHER,
            level=alert["level"],
            link="weather",
            source_name=f"Open-Meteo · ngưỡng theo {BASIS}",
            source_url=OFFICIAL_BULLETIN,
            expires_at=alert["expires_at"],
        )
        if row is not None:
            raised.append(row.id)
    if raised:
        logger.info("weather warnings raised: %s", ", ".join(raised))
    return raised


def refresh_and_alert() -> list[str]:
    """One background pass: refresh the forecast, raise any new warning."""
    from app.core.database import SessionLocal

    data = forecast(force=True)
    if data.get("stale"):
        return []
    with SessionLocal() as db:
        return raise_alerts(db, data)


async def refresh_forever() -> None:
    """Background task started with the API (app/main.py lifespan)."""
    while True:
        try:
            await asyncio.to_thread(refresh_and_alert)
        except WeatherUnavailable:
            pass
        except Exception:  # never let the loop die on one bad pass
            logger.exception("weather refresh failed")
        await asyncio.sleep(max(60, settings.weather_refresh_minutes * 60))


def reset_cache() -> None:
    """For tests."""
    global _cache
    with _lock:
        _cache = None
