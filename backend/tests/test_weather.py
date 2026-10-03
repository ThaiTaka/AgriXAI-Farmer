"""V2.2 — thời tiết làng hoa Vạn Thành và cảnh báo chính thức.

Nguồn: Open-Meteo (thay bằng dữ liệu giả trong test — không gọi mạng).
Ngưỡng: QĐ 18/2021/QĐ-TTg Điều 5 — khoản 17: mưa to trên 50 đến 100 mm/24 giờ,
mưa rất to trên 100 mm; khoản 18: rét hại khi nhiệt độ trung bình ngày dưới 13°C.
"""

from datetime import date, timedelta

import httpx
import pytest

from app.core.config import settings
from app.services import weather
from v21_support import admin, client, make_farmer, pull


def day(offset: int) -> str:
    return (weather._today() + timedelta(days=offset)).isoformat()


def raw_forecast(rain: list[float], mean: list[float]) -> dict:
    n = len(rain)
    return {
        "elevation": 1499.0,
        "current": {
            "time": f"{day(0)}T07:00",
            "temperature_2m": 17.0,
            "relative_humidity_2m": 92,
            "precipitation": 0.4,
            "weather_code": 61,
            "wind_speed_10m": 5.4,
            "is_day": 1,
        },
        "daily": {
            "time": [day(i) for i in range(n)],
            "weather_code": [63] * n,
            "temperature_2m_max": [m + 6 for m in mean],
            "temperature_2m_min": [m - 4 for m in mean],
            "temperature_2m_mean": mean,
            "precipitation_sum": rain,
            "precipitation_probability_max": [90] * n,
            "wind_speed_10m_max": [12.0] * n,
        },
    }


@pytest.fixture
def online(monkeypatch):
    """Weather switched on, Open-Meteo replaced by whatever the test sets."""
    monkeypatch.setattr(settings, "weather_enabled", True)
    weather.reset_cache()
    answer = {"raw": raw_forecast([2.0] * 7, [18.0] * 7)}

    def fake_fetch():
        if isinstance(answer["raw"], Exception):
            raise answer["raw"]
        return answer["raw"]

    monkeypatch.setattr(weather, "fetch_raw", fake_fetch)
    yield answer
    weather.reset_cache()


@pytest.fixture(scope="module")
def farmer():
    return make_farmer("v22_weather_farmer")


@pytest.mark.parametrize(
    ("rain", "expected"),
    [
        (50.0, None),  # "trên 50 mm": exactly 50 is not yet mưa to
        (50.1, "mua_to"),
        (100.0, "mua_to"),
        (100.1, "mua_rat_to"),
    ],
)
def test_rain_thresholds_follow_qd_18_2021(rain, expected):
    days = weather.parse(raw_forecast([rain], [18.0]), 0)["daily"]
    alerts = weather.alerts_for(days, today=weather._today())
    assert [a["kind"] for a in alerts] == ([expected] if expected else [])


def test_damaging_cold_is_a_daily_mean_below_13():
    days = weather.parse(raw_forecast([0, 0], [13.0, 12.9]), 0)["daily"]
    alerts = weather.alerts_for(days, today=weather._today())
    assert [(a["date"], a["kind"]) for a in alerts] == [(day(1), "ret_hai")]
    assert "khoản 18" in alerts[0]["body"]


def test_only_the_next_three_days_raise_a_warning():
    days = weather.parse(raw_forecast([80.0] * 7, [18.0] * 7), 0)["daily"]
    alerts = weather.alerts_for(days, today=weather._today())
    assert [a["date"] for a in alerts] == [day(0), day(1), day(2)]


def test_a_warning_names_the_forecast_the_rule_and_the_official_bulletin():
    days = weather.parse(raw_forecast([2.0, 120.4], [18.0, 18.0]), 0)["daily"]
    alert = weather.alerts_for(days, today=weather._today())[0]
    target = date.fromisoformat(day(1))
    assert alert["id"] == f"weather-{day(1)}-mua-rat-to"
    assert alert["level"] == "danger"
    assert alert["title"] == f"Dự báo mưa rất to ngày {target.day:02d}/{target.month:02d}"
    assert "120,4 mm" in alert["body"]
    assert "khoản 17" in alert["body"]
    assert "dự báo, không phải số đo" in alert["body"]
    # Expires at the end of that day, Vietnam time.
    assert alert["expires_at"] - 86_400_000 == int(
        weather.datetime(target.year, target.month, target.day, tzinfo=weather.VN_TZ).timestamp() * 1000
    )


def test_codes_read_as_vietnamese_without_borrowing_official_terms():
    assert weather.describe(0) == ("Trời quang", "clear")
    assert weather.describe(95) == ("Dông", "storm")
    # Heavy *intensity* is not the official 24-hour "mưa to".
    assert "to" not in weather.describe(65)[0]
    assert weather.describe(None)[0] == "Chưa rõ"


def test_the_phone_gets_conditions_seven_days_and_the_source(online, farmer):
    online["raw"] = raw_forecast([2.0, 64.0, 3.0, 1.0, 0.0, 0.0, 5.0], [18.0] * 7)
    res = client.get("/weather", headers=farmer)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["place"] == settings.weather_place
    assert body["current"]["summary"] == "Mưa nhỏ"
    assert len(body["daily"]) == 7
    assert body["daily"][1]["precipitation_sum"] == 64.0
    assert [a["kind"] for a in body["alerts"]] == ["mua_to"]
    assert body["source"] == {"name": "Open-Meteo", "url": "https://open-meteo.com/", "licence": "CC BY 4.0"}
    assert body["stale"] is False


def test_the_last_forecast_is_served_stale_when_open_meteo_is_down(online, farmer):
    assert client.get("/weather", headers=farmer).json()["stale"] is False
    online["raw"] = httpx.ConnectError("down")
    body = weather.forecast(force=True)
    assert body["stale"] is True
    assert len(body["daily"]) == 7


def test_no_forecast_at_all_is_a_503(farmer, monkeypatch):
    weather.reset_cache()
    monkeypatch.setattr(settings, "weather_enabled", False)
    assert client.get("/weather", headers=farmer).status_code == 503


def test_a_refresh_raises_each_warning_once_for_every_farm(online, farmer):
    online["raw"] = raw_forecast([2.0, 75.0, 130.0, 0.0, 0.0, 0.0, 0.0], [18.0, 18.0, 12.5, 18.0, 18.0, 18.0, 18.0])
    boss = admin()
    first = client.post("/weather/refresh", headers=boss)
    assert first.status_code == 200, first.text
    raised = set(first.json()["raised"])
    assert raised == {f"weather-{day(1)}-mua-to", f"weather-{day(2)}-mua-rat-to", f"weather-{day(2)}-ret-hai"}

    # Half an hour later the same forecast raises nothing new.
    assert client.post("/weather/refresh", headers=boss).json()["raised"] == []

    notices = {r["id"]: r for r in pull(farmer, "notifications")}
    assert raised <= set(notices)
    rain = notices[f"weather-{day(2)}-mua-rat-to"]
    assert rain["kind"] == "weather"
    assert rain["level"] == "danger"
    assert rain["link"] == "weather"
    assert rain["owner_id"] is None
    assert rain["expires_at"] > 0


def test_a_retracted_warning_is_not_raised_again(online):
    online["raw"] = raw_forecast([90.0, 0, 0, 0, 0, 0, 0], [18.0] * 7)
    boss = admin()
    warning_id = f"weather-{day(0)}-mua-to"
    client.post("/weather/refresh", headers=boss)
    assert client.delete(f"/notifications/{warning_id}", headers=boss).status_code == 204
    assert client.post("/weather/refresh", headers=boss).json()["raised"] == []


def test_farmers_cannot_force_a_refresh(farmer):
    assert client.post("/weather/refresh", headers=farmer).status_code == 403
