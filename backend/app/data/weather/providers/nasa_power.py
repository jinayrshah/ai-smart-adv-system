import logging
from datetime import date
from typing import Any
import httpx

from app.core.timeutil import today_ist
from app.data.types import WeatherDay

logger = logging.getLogger(__name__)

NASA_POWER_POINT_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"


class NasaPowerClient:
    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout

    def fetch_daily(
        self,
        lat: float,
        lon: float,
        grid_key: str,
        start_date: date,
        end_date: date,
    ) -> list[WeatherDay]:
        """
        Fetch daily agro-climatology data from NASA POWER API.
        Fill values (-999, -999.0) are strictly parsed as None.
        """
        params = {
            "start": start_date.strftime("%Y%m%d"),
            "end": end_date.strftime("%Y%m%d"),
            "latitude": lat,
            "longitude": lon,
            "community": "ag",
            "parameters": "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN",
            "format": "json",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(NASA_POWER_POINT_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning(f"NASA POWER fetch failed for grid {grid_key} ({lat}, {lon}): {exc}")
            return []

        return self.parse_daily(data, grid_key)

    def parse_daily(
        self,
        data: dict[str, Any],
        grid_key: str,
        ref_today: date | None = None,
    ) -> list[WeatherDay]:
        """
        Parse NASA POWER JSON response.
        Strictly converts fill values (-999) to None.
        """
        if ref_today is None:
            ref_today = today_ist()

        properties = data.get("properties", {})
        parameter = properties.get("parameter", {})

        t2m_max = parameter.get("T2M_MAX", {})
        t2m_min = parameter.get("T2M_MIN", {})
        t2m = parameter.get("T2M", {})
        prectot = parameter.get("PRECTOTCORR", {})
        rh2m = parameter.get("RH2M", {})
        solar = parameter.get("ALLSKY_SFC_SW_DWN", {})

        # Date keys in YYYYMMDD format
        date_keys = sorted(t2m_max.keys())
        days: list[WeatherDay] = []

        def clean_val(val: Any) -> float | None:
            if val is None:
                return None
            try:
                num = float(val)
                # Check for NASA fill value -999 (or negative 990-1000 range)
                if num <= -900:
                    return None
                return round(num, 2)
            except (ValueError, TypeError):
                return None

        for d_str in date_keys:
            try:
                d = date(int(d_str[:4]), int(d_str[4:6]), int(d_str[6:8]))
            except ValueError:
                continue

            kind = "recent" if d >= (ref_today.replace(day=max(1, ref_today.day - 6))) else "archive"

            wd = WeatherDay(
                grid_key=grid_key,
                date=d,
                source="nasa_power",
                kind=kind,
                tmax_c=clean_val(t2m_max.get(d_str)),
                tmin_c=clean_val(t2m_min.get(d_str)),
                tmean_c=clean_val(t2m.get(d_str)),
                precip_mm=clean_val(prectot.get(d_str)),
                rh_mean_pct=clean_val(rh2m.get(d_str)),
                radiation_mj_m2=clean_val(solar.get(d_str)),
            )
            days.append(wd)

        return days
