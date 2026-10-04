import json
from datetime import date
from pathlib import Path

from app.data.weather.providers.nasa_power import NasaPowerClient
from app.data.weather.providers.open_meteo import OpenMeteoClient
from app.data.weather.providers.openweather import OpenWeatherClient

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def test_open_meteo_parse_forecast_and_recent():
    client = OpenMeteoClient()
    fixture_path = FIXTURES_DIR / "open_meteo" / "forecast.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Reference today is 2026-10-04
    ref_today = date(2026, 10, 4)
    current, days = client.parse_forecast_and_recent(data, grid_key="20.0,73.8", ref_today=ref_today)

    # Check current
    assert current.grid_key == "20.0,73.8"
    assert current.temp_c == 29.4
    assert current.rh_pct == 68
    assert current.wind_kmh == 12.5
    assert current.source == "open_meteo"

    # Check days length and split
    assert len(days) == 15
    recent_days = [d for d in days if d.kind == "recent"]
    forecast_days = [d for d in days if d.kind == "forecast"]

    assert len(recent_days) == 6  # 2026-09-28 to 2026-10-03
    assert len(forecast_days) == 9  # 2026-10-04 to 2026-10-12
    assert all(d.date < ref_today for d in recent_days)
    assert all(d.date >= ref_today for d in forecast_days)


def test_open_meteo_parse_spread():
    client = OpenMeteoClient()
    fixture_path = FIXTURES_DIR / "open_meteo" / "spread.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    spread_map = client.parse_forecast_spread(data)
    assert len(spread_map) == 7
    d = date(2026, 10, 4)
    assert d in spread_map
    stats = spread_map[d]
    assert "spread_tmax_c" in stats
    assert "spread_precip_mm" in stats
    assert "models_rain_frac" in stats
    assert stats["models_rain_frac"] == 0.0


def test_nasa_power_fill_values_never_reach_db_as_numbers():
    """
    CRITICAL ACCEPTANCE TEST:
    NASA POWER fill values (-999, -999.0) must strictly be parsed as None.
    """
    client = NasaPowerClient()
    fixture_path = FIXTURES_DIR / "nasa_power" / "daily.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    ref_today = date(2026, 9, 25)
    days = client.parse_daily(data, grid_key="20.0,73.8", ref_today=ref_today)

    assert len(days) == 4
    day_22 = next(d for d in days if d.date == date(2026, 9, 22))

    # All -999.0 values must be None!
    assert day_22.tmax_c is None
    assert day_22.tmin_c is None
    assert day_22.tmean_c is None
    assert day_22.precip_mm is None
    assert day_22.rh_mean_pct is None
    assert day_22.radiation_mj_m2 is None

    # Normal values must parse correctly
    day_20 = next(d for d in days if d.date == date(2026, 9, 20))
    assert day_20.tmax_c == 31.2
    assert day_20.tmin_c == 21.0
    assert day_20.precip_mm == 0.0


def test_openweather_3hour_to_daily_aggregation():
    client = OpenWeatherClient()
    fixture_path = FIXTURES_DIR / "openweather" / "forecast.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    days = client.parse_forecast(data, grid_key="20.0,73.8", require_full_day=False)
    assert len(days) >= 1
    d0 = days[0]
    assert d0.grid_key == "20.0,73.8"
    assert d0.source == "openweather"
    assert d0.tmax_c is not None
    assert d0.tmin_c is not None
    assert d0.tmax_c >= d0.tmin_c
    assert d0.precip_mm is not None
    assert d0.rh_mean_pct is not None
