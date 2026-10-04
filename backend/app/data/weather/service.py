import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.timeutil import now_utc_iso, today_ist
from app.data.locations.grid import snap_to_grid
from app.data.locations.repository import LocationsRepository
from app.data.types import AgroMetrics, FusedDay, WeatherCurrent, WeatherDay
from app.data.weather.agro import compute_agro_metrics
from app.data.weather.fusion import fuse_range, load_fusion_config
from app.data.weather.providers.open_meteo import OpenMeteoClient
from app.data.weather.repository import WeatherRepository
from app.schemas.weather import (
    AgroMetricsDetail,
    CurrentWeatherDetail,
    FusedDayDetail,
    WeatherCurrentResponse,
    WeatherForecastResponse,
    WeatherHistoryResponse,
    WeatherLocationInfo,
    WeatherSummaryResponse,
)

logger = logging.getLogger(__name__)


class WeatherService:
    def __init__(
        self,
        weather_repo: WeatherRepository | None = None,
        locations_repo: LocationsRepository | None = None,
        open_meteo: OpenMeteoClient | None = None,
    ):
        self.weather_repo = weather_repo or WeatherRepository()
        self.locations_repo = locations_repo or LocationsRepository()
        self.open_meteo = open_meteo or OpenMeteoClient(timeout=8.0)
        self.settings = get_settings()

    def resolve_location(
        self,
        location_id: int | None = None,
        lat: float | None = None,
        lon: float | None = None,
        mandi: str | None = None,
        state: str | None = None,
    ) -> tuple[dict[str, Any], bool]:
        """
        Resolve location record and return (location_dict, is_degraded).
        Handles on-demand Tier B grid enrollment and cap checking (Architecture §9.4).
        Supports market-level weather lookup by mandi name (Architecture §9b.3).
        """
        is_degraded = False

        # 0. By mandi name (Architecture §9b.3)
        if mandi:
            loc = self.locations_repo.get_by_name_and_state(mandi, state or "")
            if loc:
                return loc, False

        # 1. By location_id
        if location_id is not None:
            loc = self.locations_repo.get_by_id(location_id)
            if loc:
                return loc, False

        # 2. By lat, lon
        if lat is not None and lon is not None:
            gp = snap_to_grid(lat, lon)
            loc = self.locations_repo.get_by_grid_key(gp.grid_key)
            if loc:
                return loc, False

            # Check daily new-grid cap (Architecture §9.4)
            cap = self.settings.WEATHER_ONDEMAND_MAX_NEW_GRIDS
            new_grids_today = self.locations_repo.count_new_grids_today()

            if new_grids_today >= cap:
                logger.warning(f"On-demand new grid cap ({cap}) reached. Serving nearest tracked grid.")
                nearest = self.locations_repo.find_nearest_tracked_grid(lat, lon)
                if nearest:
                    return nearest, True

            # Register as new tracked location
            new_loc = self.locations_repo.upsert_location(
                kind="custom",
                name=f"Grid {gp.grid_key}",
                state="",
                district="",
                lat=lat,
                lon=lon,
                grid_key=gp.grid_key,
                geocode_source="on_demand",
                verified=False,
                tracked=True,
            )
            if new_loc:
                return new_loc, False

            return {
                "id": None,
                "name": f"Grid {gp.grid_key}",
                "state": "",
                "district": "",
                "grid_key": gp.grid_key,
                "lat": lat,
                "lon": lon,
            }, False

        # 3. Default fallback: first tracked location or Nashik
        tracked = self.locations_repo.get_tracked_locations()
        if tracked:
            return tracked[0], False

        # Absolute fallback if DB is empty
        gp = snap_to_grid(20.0, 73.8)
        return {
            "id": 1,
            "name": "Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "grid_key": gp.grid_key,
            "lat": 20.0,
            "lon": 73.8,
        }, False

    def ensure_grid_weather(
        self,
        grid_key: str,
        lat: float,
        lon: float,
        force_live: bool = False,
    ) -> bool:
        """
        Tier B on-demand fetch: If data is missing or stale, do a single-source
        Open-Meteo call and write through with confidence='medium' (Architecture §9.4).
        """
        today = today_ist()
        start_date = today - timedelta(days=7)
        end_date = today + timedelta(days=7)

        existing = self.weather_repo.get_fused_range(grid_key, start_date, end_date)
        if existing and not force_live:
            # We already have data for today
            today_str = today.isoformat()
            if any(r.get("date") == today_str for r in existing):
                return True

        # Synchronous Open-Meteo-only fetch (8s timeout)
        try:
            current, daily_days = self.open_meteo.fetch_forecast_and_recent(
                lat=lat,
                lon=lon,
                grid_key=grid_key,
                past_days=7,
                forecast_days=8,
            )

            # Cap confidence to 'medium' for on-demand Tier B explore path
            current.confidence = "medium"

            self.weather_repo.upsert_current(current)
            self.weather_repo.upsert_daily_records(daily_days)

            # Fuse with medium confidence
            cfg = load_fusion_config()
            fused = fuse_range(grid_key, daily_days, start_date, end_date, today=today, cfg=cfg)

            # Cap fused confidence at medium for Tier B initial enrollment
            fused_dicts = []
            for fd in fused:
                fd.confidence = "medium"
                fd_dict = fd.to_dict()
                fd_dict["updated_at"] = now_utc_iso()
                fused_dicts.append(fd_dict)

            self.weather_repo.upsert_fused_days(fused_dicts)
            return True
        except Exception as exc:
            logger.warning(f"On-demand Open-Meteo fetch failed for grid {grid_key}: {exc}")
            return False

    def get_summary(
        self,
        location_id: int | None = None,
        lat: float | None = None,
        lon: float | None = None,
        mandi: str | None = None,
        state: str | None = None,
    ) -> WeatherSummaryResponse:
        """
        Return current + 7 past + today + 7 future days + agro metrics.
        Architecture §10.2 primary endpoint. Supports market-level weather (§9b.3).
        """
        loc, is_degraded = self.resolve_location(
            location_id=location_id,
            lat=lat,
            lon=lon,
            mandi=mandi,
            state=state,
        )
        grid_key = loc["grid_key"]
        loc_lat = float(loc.get("lat") or 20.0)
        loc_lon = float(loc.get("lon") or 73.8)

        # Ensure weather data exists for this grid
        self.ensure_grid_weather(grid_key, loc_lat, loc_lon)

        today = today_ist()
        start_date = today - timedelta(days=7)
        end_date = today + timedelta(days=7)

        # 1. Fetch current weather
        curr_row = self.weather_repo.get_current(grid_key)
        curr_detail = None
        stale = False

        if curr_row:
            observed_at = curr_row.get("observed_at") or now_utc_iso()
            try:
                obs_dt = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - obs_dt > timedelta(hours=12):
                    stale = True
            except Exception:
                stale = False

            curr_detail = CurrentWeatherDetail(
                observed_at=observed_at,
                temp_c=curr_row.get("temp_c"),
                rh_pct=curr_row.get("rh_pct"),
                wind_kmh=curr_row.get("wind_kmh"),
                precip_mm_1h=curr_row.get("precip_mm_1h"),
                weather_code=curr_row.get("weather_code"),
                source=curr_row.get("source", "open_meteo"),
                confidence=curr_row.get("confidence", "medium"),
                cross_check=curr_row.get("cross_check") or {},
            )

        # 2. Fetch fused days
        fused_rows = self.weather_repo.get_fused_range(grid_key, start_date, end_date)
        fused_days_list: list[FusedDay] = []
        days_detail: list[FusedDayDetail] = []

        for r in fused_rows:
            d_val = r["date"]
            if isinstance(d_val, str):
                d_obj = date.fromisoformat(d_val)
            else:
                d_obj = d_val

            fd = FusedDay(
                grid_key=grid_key,
                date=d_obj,
                phase=r.get("phase", "today"),
                tmax_c=r.get("tmax_c"),
                tmin_c=r.get("tmin_c"),
                precip_mm=r.get("precip_mm"),
                precip_prob_pct=r.get("precip_prob_pct"),
                rh_mean_pct=r.get("rh_mean_pct"),
                radiation_mj_m2=r.get("radiation_mj_m2"),
                et0_mm=r.get("et0_mm"),
                primary_source=r.get("primary_source", "open_meteo"),
                validators=r.get("validators") or [],
                confidence=r.get("confidence", "medium"),
                degraded=r.get("degraded", False),
                disagreement=r.get("disagreement"),
            )
            fused_days_list.append(fd)

            days_detail.append(
                FusedDayDetail(
                    date=d_obj.isoformat(),
                    phase=fd.phase,
                    tmax_c=fd.tmax_c,
                    tmin_c=fd.tmin_c,
                    precip_mm=fd.precip_mm,
                    precip_prob_pct=fd.precip_prob_pct,
                    rh_mean_pct=fd.rh_mean_pct,
                    radiation_mj_m2=fd.radiation_mj_m2,
                    et0_mm=fd.et0_mm,
                    primary_source=fd.primary_source,
                    validators=fd.validators,
                    confidence=fd.confidence,
                    degraded=fd.degraded,
                    disagreement=fd.disagreement,
                )
            )

        # 3. Compute agro metrics
        normals = self.weather_repo.get_normals(grid_key)
        agro = compute_agro_metrics(fused_days_list, normals=normals, ref_today=today)

        # Degraded status
        if any(d.degraded for d in days_detail):
            is_degraded = True

        return WeatherSummaryResponse(
            location=WeatherLocationInfo(
                id=loc.get("id"),
                name=loc.get("name", ""),
                state=loc.get("state", ""),
                district=loc.get("district", ""),
                grid_key=grid_key,
                lat=loc_lat,
                lon=loc_lon,
            ),
            as_of=now_utc_iso(),
            stale=stale,
            degraded=is_degraded,
            current=curr_detail,
            days=days_detail,
            metrics=AgroMetricsDetail(**agro.to_dict()),
        )

    def get_current(
        self,
        location_id: int | None = None,
        lat: float | None = None,
        lon: float | None = None,
    ) -> WeatherCurrentResponse:
        summary = self.get_summary(location_id, lat, lon)
        curr = summary.current or CurrentWeatherDetail(
            observed_at=summary.as_of,
            temp_c=None,
            rh_pct=None,
            wind_kmh=None,
            precip_mm_1h=None,
            source="open_meteo",
            confidence="medium",
            cross_check={},
        )
        return WeatherCurrentResponse(
            location=summary.location,
            as_of=summary.as_of,
            stale=summary.stale,
            degraded=summary.degraded,
            current=curr,
        )

    def get_forecast(
        self,
        location_id: int | None = None,
        lat: float | None = None,
        lon: float | None = None,
        days: int = 7,
    ) -> WeatherForecastResponse:
        summary = self.get_summary(location_id, lat, lon)
        today_str = today_ist().isoformat()
        future_days = [d for d in summary.days if d.date >= today_str][:days]
        return WeatherForecastResponse(
            location=summary.location,
            as_of=summary.as_of,
            stale=summary.stale,
            degraded=summary.degraded,
            days=future_days,
        )

    def get_history(
        self,
        location_id: int | None = None,
        lat: float | None = None,
        lon: float | None = None,
        days: int = 30,
    ) -> WeatherHistoryResponse:
        summary = self.get_summary(location_id, lat, lon)
        today_str = today_ist().isoformat()
        past_days = [d for d in summary.days if d.date < today_str]
        return WeatherHistoryResponse(
            location=summary.location,
            as_of=summary.as_of,
            stale=summary.stale,
            degraded=summary.degraded,
            days=past_days,
        )
