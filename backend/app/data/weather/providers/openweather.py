import logging
from collections import defaultdict
from datetime import date, datetime, timezone, timedelta
from typing import Any
import httpx

from app.core.config import get_settings
from app.core.timeutil import IST, today_ist
from app.data.types import WeatherCurrent, WeatherDay

logger = logging.getLogger(__name__)

OPENWEATHER_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
OPENWEATHER_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


class OpenWeatherClient:
    def __init__(self, api_key: str | None = None, timeout: float = 8.0):
        settings = get_settings()
        self.api_key = api_key or settings.OPENWEATHER_API_KEY
        self.timeout = timeout

    def fetch_current(self, lat: float, lon: float, grid_key: str) -> WeatherCurrent | None:
        if not self.api_key:
            logger.warning("OpenWeather API key not configured; skipping current fetch")
            return None

        params = {
            "lat": lat,
            "lon": lon,
            "appid": self.api_key,
            "units": "metric",
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(OPENWEATHER_CURRENT_URL, params=params)
                if resp.status_code != 200:
                    logger.warning(f"OpenWeather current returned status {resp.status_code}")
                    return None
                data = resp.json()
                return self.parse_current(data, grid_key)
        except Exception as exc:
            logger.warning(f"OpenWeather current fetch failed: {exc}")
            return None

    def parse_current(self, data: dict[str, Any], grid_key: str) -> WeatherCurrent:
        main = data.get("main", {})
        wind = data.get("wind", {})
        rain = data.get("rain", {})
        weather_list = data.get("weather", [{}])
        weather_code = weather_list[0].get("id") if weather_list else None

        dt_epoch = data.get("dt")
        obs_dt = datetime.fromtimestamp(dt_epoch, tz=timezone.utc) if dt_epoch else datetime.now(timezone.utc)

        precip_1h = rain.get("1h", 0.0) if isinstance(rain, dict) else 0.0

        return WeatherCurrent(
            grid_key=grid_key,
            observed_at=obs_dt,
            source="openweather",
            temp_c=main.get("temp"),
            rh_pct=main.get("humidity"),
            wind_kmh=round(wind.get("speed", 0.0) * 3.6, 2) if wind.get("speed") is not None else None,
            precip_mm_1h=precip_1h,
            weather_code=weather_code,
            confidence="high",
            cross_check={},
        )

    def fetch_forecast(self, lat: float, lon: float, grid_key: str) -> list[WeatherDay]:
        if not self.api_key:
            logger.warning("OpenWeather API key not configured; skipping forecast fetch")
            return []

        params = {
            "lat": lat,
            "lon": lon,
            "appid": self.api_key,
            "units": "metric",
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(OPENWEATHER_FORECAST_URL, params=params)
                if resp.status_code != 200:
                    logger.warning(f"OpenWeather forecast returned status {resp.status_code}")
                    return []
                data = resp.json()
                return self.parse_forecast(data, grid_key)
        except Exception as exc:
            logger.warning(f"OpenWeather forecast fetch failed: {exc}")
            return []

    def parse_forecast(
        self,
        data: dict[str, Any],
        grid_key: str,
        require_full_day: bool = True,
    ) -> list[WeatherDay]:
        """
        Aggregate 3-hourly slots (up to 40) into daily WeatherDay records in IST.
        Groups slots by local IST date.
        """
        city = data.get("city", {})
        tz_offset_sec = city.get("timezone", 19800)  # default to IST (5.5h = 19800s)
        tz_info = timezone(timedelta(seconds=tz_offset_sec))

        slots = data.get("list", [])
        slots_by_date: dict[date, list[dict[str, Any]]] = defaultdict(list)

        for slot in slots:
            dt_epoch = slot.get("dt")
            if not dt_epoch:
                continue
            local_dt = datetime.fromtimestamp(dt_epoch, tz=tz_info)
            slot_date = local_dt.date()
            slots_by_date[slot_date].append(slot)

        today = today_ist()
        days: list[WeatherDay] = []

        for d, day_slots in sorted(slots_by_date.items()):
            # Architecture §8.7: Skip incomplete days (< 8 slots) to avoid skewed aggregations
            if require_full_day and len(day_slots) < 8 and d > today:
                continue

            tmax_vals = [s.get("main", {}).get("temp_max") for s in day_slots if s.get("main", {}).get("temp_max") is not None]
            tmin_vals = [s.get("main", {}).get("temp_min") for s in day_slots if s.get("main", {}).get("temp_min") is not None]
            rh_vals = [s.get("main", {}).get("humidity") for s in day_slots if s.get("main", {}).get("humidity") is not None]
            pops = [s.get("pop", 0.0) for s in day_slots if s.get("pop") is not None]
            rain_sums = [s.get("rain", {}).get("3h", 0.0) for s in day_slots if isinstance(s.get("rain"), dict)]

            tmax = round(max(tmax_vals), 2) if tmax_vals else None
            tmin = round(min(tmin_vals), 2) if tmin_vals else None
            rh_mean = round(sum(rh_vals) / len(rh_vals), 1) if rh_vals else None
            precip_prob = round(max(pops) * 100, 1) if pops else None
            precip_total = round(sum(rain_sums), 2) if rain_sums else 0.0

            kind = "forecast" if d >= today else "recent"

            wd = WeatherDay(
                grid_key=grid_key,
                date=d,
                source="openweather",
                kind=kind,
                tmax_c=tmax,
                tmin_c=tmin,
                precip_mm=precip_total,
                precip_prob_pct=precip_prob,
                rh_mean_pct=rh_mean,
            )
            days.append(wd)

        return days
