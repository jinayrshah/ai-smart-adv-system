import logging
from datetime import date, datetime, timezone
from typing import Any
import httpx

from app.core.timeutil import today_ist
from app.data.types import WeatherCurrent, WeatherDay

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


class OpenMeteoClient:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    def fetch_forecast_and_recent(
        self,
        lat: float,
        lon: float,
        grid_key: str,
        past_days: int = 7,
        forecast_days: int = 8,
    ) -> tuple[WeatherCurrent, list[WeatherDay]]:
        """
        Fetch current observations, past recent days, and forecast days.
        Splits daily items:
          date < today_ist -> kind='recent'
          date >= today_ist -> kind='forecast'
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": (
                "temperature_2m_max,temperature_2m_min,temperature_2m_mean,"
                "precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean,"
                "wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration"
            ),
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "past_days": past_days,
            "forecast_days": forecast_days,
            "timezone": "Asia/Kolkata",
        }

        with httpx.Client(timeout=self.timeout) as client:
            resp = client.get(OPEN_METEO_FORECAST_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return self.parse_forecast_and_recent(data, grid_key)

    def parse_forecast_and_recent(
        self,
        data: dict[str, Any],
        grid_key: str,
        ref_today: date | None = None,
    ) -> tuple[WeatherCurrent, list[WeatherDay]]:
        """Parse raw forecast JSON response into WeatherCurrent and list of WeatherDay."""
        if ref_today is None:
            ref_today = today_ist()

        # Parse current
        current_data = data.get("current", {})
        obs_time_str = current_data.get("time")
        if obs_time_str:
            try:
                obs_dt = datetime.fromisoformat(obs_time_str).replace(tzinfo=timezone.utc)
            except Exception:
                obs_dt = datetime.now(timezone.utc)
        else:
            obs_dt = datetime.now(timezone.utc)

        current = WeatherCurrent(
            grid_key=grid_key,
            observed_at=obs_dt,
            source="open_meteo",
            temp_c=current_data.get("temperature_2m"),
            rh_pct=current_data.get("relative_humidity_2m"),
            wind_kmh=current_data.get("wind_speed_10m"),
            precip_mm_1h=current_data.get("precipitation"),
            weather_code=current_data.get("weather_code"),
            confidence="high",
            cross_check={},
        )

        daily_data = data.get("daily", {})
        times = daily_data.get("time", [])
        tmaxs = daily_data.get("temperature_2m_max", [])
        tmins = daily_data.get("temperature_2m_min", [])
        tmeans = daily_data.get("temperature_2m_mean", [])
        precips = daily_data.get("precipitation_sum", [])
        precip_probs = daily_data.get("precipitation_probability_max", [])
        rhs = daily_data.get("relative_humidity_2m_mean", [])
        winds = daily_data.get("wind_speed_10m_max", [])
        rads = daily_data.get("shortwave_radiation_sum", [])
        et0s = daily_data.get("et0_fao_evapotranspiration", [])

        days: list[WeatherDay] = []
        for i, t_str in enumerate(times):
            d = date.fromisoformat(t_str)
            kind = "recent" if d < ref_today else "forecast"

            wd = WeatherDay(
                grid_key=grid_key,
                date=d,
                source="open_meteo",
                kind=kind,
                tmax_c=tmaxs[i] if i < len(tmaxs) else None,
                tmin_c=tmins[i] if i < len(tmins) else None,
                tmean_c=tmeans[i] if i < len(tmeans) else None,
                precip_mm=precips[i] if i < len(precips) else None,
                precip_prob_pct=precip_probs[i] if i < len(precip_probs) else None,
                rh_mean_pct=rhs[i] if i < len(rhs) else None,
                wind_max_kmh=winds[i] if i < len(winds) else None,
                radiation_mj_m2=rads[i] if i < len(rads) else None,
                et0_mm=et0s[i] if i < len(et0s) else None,
            )
            days.append(wd)

        return current, days

    def fetch_forecast_spread(
        self,
        lat: float,
        lon: float,
        forecast_days: int = 7,
    ) -> dict[date, dict[str, float]]:
        """
        Fetch multi-model spread from Open-Meteo across ecmwf_ifs025, gfs_seamless, icon_seamless.
        Returns dict keyed by date mapping to {spread_tmax_c, spread_precip_mm, models_rain_frac}.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "models": "ecmwf_ifs025,gfs_seamless,icon_seamless",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
            "forecast_days": forecast_days,
            "timezone": "Asia/Kolkata",
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.get(OPEN_METEO_FORECAST_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return self.parse_forecast_spread(data)

    def parse_forecast_spread(self, data: dict[str, Any]) -> dict[date, dict[str, float]]:
        """Parse multi-model daily data and compute spread statistics per date."""
        daily = data.get("daily", {})
        times = daily.get("time", [])
        if not times:
            return {}

        # Look for model-suffixed keys
        # e.g., temperature_2m_max_ecmwf_ifs025, temperature_2m_max_gfs_seamless, etc.
        models = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"]

        result: dict[date, dict[str, float]] = {}

        for i, t_str in enumerate(times):
            d = date.fromisoformat(t_str)
            tmax_vals: list[float] = []
            precip_vals: list[float] = []

            for m in models:
                tmax_k = f"temperature_2m_max_{m}"
                precip_k = f"precipitation_sum_{m}"

                if tmax_k in daily and i < len(daily[tmax_k]) and daily[tmax_k][i] is not None:
                    tmax_vals.append(float(daily[tmax_k][i]))
                if precip_k in daily and i < len(daily[precip_k]) and daily[precip_k][i] is not None:
                    precip_vals.append(float(daily[precip_k][i]))

            spread_tmax = max(tmax_vals) - min(tmax_vals) if len(tmax_vals) >= 2 else 0.0
            spread_precip = max(precip_vals) - min(precip_vals) if len(precip_vals) >= 2 else 0.0
            rain_count = sum(1 for p in precip_vals if p >= 0.1)
            rain_frac = (rain_count / len(precip_vals)) if precip_vals else 0.0

            result[d] = {
                "spread_tmax_c": round(spread_tmax, 2),
                "spread_precip_mm": round(spread_precip, 2),
                "models_rain_frac": round(rain_frac, 2),
            }

        return result

    def fetch_archive(
        self,
        lat: float,
        lon: float,
        grid_key: str,
        start_date: date,
        end_date: date,
    ) -> list[WeatherDay]:
        """
        Fetch ERA5-Land historical reanalysis for historical past dates (up to today - 5/6 days).
        Returns list of WeatherDay with source='open_meteo' and kind='archive'.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "models": "era5_land",
            "daily": (
                "temperature_2m_max,temperature_2m_min,temperature_2m_mean,"
                "precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max,"
                "shortwave_radiation_sum,et0_fao_evapotranspiration"
            ),
            "timezone": "Asia/Kolkata",
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.get(OPEN_METEO_ARCHIVE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return self.parse_archive(data, grid_key)

    def parse_archive(self, data: dict[str, Any], grid_key: str) -> list[WeatherDay]:
        daily = data.get("daily", {})
        times = daily.get("time", [])
        tmaxs = daily.get("temperature_2m_max", [])
        tmins = daily.get("temperature_2m_min", [])
        tmeans = daily.get("temperature_2m_mean", [])
        precips = daily.get("precipitation_sum", [])
        rhs = daily.get("relative_humidity_2m_mean", [])
        winds = daily.get("wind_speed_10m_max", [])
        rads = daily.get("shortwave_radiation_sum", [])
        et0s = daily.get("et0_fao_evapotranspiration", [])

        days: list[WeatherDay] = []
        for i, t_str in enumerate(times):
            d = date.fromisoformat(t_str)
            wd = WeatherDay(
                grid_key=grid_key,
                date=d,
                source="open_meteo",
                kind="archive",
                tmax_c=tmaxs[i] if i < len(tmaxs) else None,
                tmin_c=tmins[i] if i < len(tmins) else None,
                tmean_c=tmeans[i] if i < len(tmeans) else None,
                precip_mm=precips[i] if i < len(precips) else None,
                rh_mean_pct=rhs[i] if i < len(rhs) else None,
                wind_max_kmh=winds[i] if i < len(winds) else None,
                radiation_mj_m2=rads[i] if i < len(rads) else None,
                et0_mm=et0s[i] if i < len(et0s) else None,
            )
            days.append(wd)
        return days

    def fetch_normals(
        self,
        lat: float,
        lon: float,
        grid_key: str,
        start_year: int = 2010,
        end_year: int = 2024,
    ) -> list[dict[str, Any]]:
        """
        Fetch ERA5-Land monthly normals (2010-2024) and aggregate into 12 monthly normals rows.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": f"{start_year}-01-01",
            "end_date": f"{end_year}-12-31",
            "models": "era5_land",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
            "timezone": "Asia/Kolkata",
        }
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(OPEN_METEO_ARCHIVE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return self.parse_normals(data, grid_key, start_year, end_year)

    def parse_normals(
        self,
        data: dict[str, Any],
        grid_key: str,
        start_year: int = 2010,
        end_year: int = 2024,
    ) -> list[dict[str, Any]]:
        daily = data.get("daily", {})
        times = daily.get("time", [])
        tmaxs = daily.get("temperature_2m_max", [])
        tmins = daily.get("temperature_2m_min", [])
        precips = daily.get("precipitation_sum", [])

        # Accumulators per month (1 to 12)
        month_tmax: dict[int, list[float]] = {m: [] for m in range(1, 13)}
        month_tmin: dict[int, list[float]] = {m: [] for m in range(1, 13)}
        month_precip: dict[int, float] = {m: 0.0 for m in range(1, 13)}

        num_years = max(1, end_year - start_year + 1)

        for i, t_str in enumerate(times):
            d = date.fromisoformat(t_str)
            m = d.month
            if i < len(tmaxs) and tmaxs[i] is not None:
                month_tmax[m].append(float(tmaxs[i]))
            if i < len(tmins) and tmins[i] is not None:
                month_tmin[m].append(float(tmins[i]))
            if i < len(precips) and precips[i] is not None:
                month_precip[m] += float(precips[i])

        normals: list[dict[str, Any]] = []
        for m in range(1, 13):
            avg_tmax = round(sum(month_tmax[m]) / len(month_tmax[m]), 2) if month_tmax[m] else None
            avg_tmin = round(sum(month_tmin[m]) / len(month_tmin[m]), 2) if month_tmin[m] else None
            avg_monthly_precip = round(month_precip[m] / num_years, 2)

            normals.append({
                "grid_key": grid_key,
                "month": m,
                "tmax_c": avg_tmax,
                "tmin_c": avg_tmin,
                "precip_mm_month": avg_monthly_precip,
                "source": "open_meteo_era5land",
                "period": f"{start_year}-{end_year}",
            })

        return normals
