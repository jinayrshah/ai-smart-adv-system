import logging
import sys
import time
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from app.core.logging import setup_logger
from app.core.timeutil import now_utc_iso, today_ist
from app.data.locations.repository import LocationsRepository
from app.data.types import WeatherDay
from app.data.weather.fusion import fuse_range, load_fusion_config
from app.data.weather.providers.open_meteo import OpenMeteoClient
from app.data.weather.providers.openweather import OpenWeatherClient
from app.data.weather.repository import WeatherRepository, weather_day_from_row

logger = setup_logger("ingest_weather")


def run_ingest_weather() -> int:
    start_time = time.time()
    logger.info("Starting ingest_weather job", extra={"job": "ingest_weather", "status": "started"})

    weather_repo = WeatherRepository()
    locations_repo = LocationsRepository()
    open_meteo = OpenMeteoClient(timeout=12.0)
    openweather = OpenWeatherClient(timeout=8.0)
    fusion_cfg = load_fusion_config()

    run_id = weather_repo.start_ingestion_run(job="ingest_weather", source="open_meteo+openweather")
    today = today_ist()
    start_range = today - timedelta(days=7)
    end_range = today + timedelta(days=7)

    tracked_locations = locations_repo.get_tracked_locations()
    if not tracked_locations:
        logger.warning("No tracked locations found in database")
        weather_repo.finish_ingestion_run(
            run_id=run_id,
            status="ok",
            rows_in=0,
            rows_upserted=0,
            notes={"warning": "no tracked locations"},
        )
        return 0

    # Group by grid_key to fetch once per unique grid
    grids: dict[str, dict[str, Any]] = {}
    for loc in tracked_locations:
        gk = loc.get("grid_key")
        if gk and gk not in grids:
            grids[gk] = loc

    logger.info(f"Processing {len(grids)} unique tracked grids for weather ingestion")

    total_rows_in = 0
    total_rows_upserted = 0
    disagreement_counts: dict[str, int] = defaultdict(int)
    comparison_counts: dict[str, int] = defaultdict(int)
    failed_grids: list[str] = []

    for grid_key, loc in grids.items():
        lat = float(loc["lat"])
        lon = float(loc["lon"])

        try:
            # 1. Fetch Open-Meteo primary
            current, om_days = open_meteo.fetch_forecast_and_recent(
                lat=lat,
                lon=lon,
                grid_key=grid_key,
                past_days=7,
                forecast_days=8,
            )

            # 2. Fetch Open-Meteo spread
            try:
                spread_map = open_meteo.fetch_forecast_spread(lat=lat, lon=lon, forecast_days=7)
                for d in om_days:
                    if d.date in spread_map:
                        sp = spread_map[d.date]
                        d.spread_tmax_c = sp.get("spread_tmax_c")
                        d.spread_precip_mm = sp.get("spread_precip_mm")
                        d.models_rain_frac = sp.get("models_rain_frac")
            except Exception as spread_exc:
                logger.warning(f"Spread fetch failed for {grid_key}: {spread_exc}")

            # 3. Fetch OpenWeather cross-check validator
            ow_days: list[WeatherDay] = []
            try:
                ow_current = openweather.fetch_current(lat=lat, lon=lon, grid_key=grid_key)
                if ow_current and ow_current.temp_c is not None:
                    current.cross_check = {"openweather": {"temp_c": ow_current.temp_c}}
                ow_days = openweather.fetch_forecast(lat=lat, lon=lon, grid_key=grid_key)
            except Exception as ow_exc:
                logger.warning(f"OpenWeather fetch failed for {grid_key}: {ow_exc}")

            # Upsert current
            weather_repo.upsert_current(current)

            # Save raw daily records
            all_raw = om_days + ow_days
            total_rows_in += len(all_raw)
            upserted = weather_repo.upsert_daily_records(all_raw)
            total_rows_upserted += upserted

            # Also query any existing archive rows for the past 7 days to fuse with high accuracy
            existing_archive_raw = weather_repo.get_raw_daily_range(grid_key, start_range, today - timedelta(days=1))
            archive_days = [
                weather_day_from_row(r, grid_key)
                for r in existing_archive_raw
                if r.get("source") in ("open_meteo", "nasa_power") and r.get("kind") == "archive"
            ]

            combined_for_fusion = all_raw + archive_days

            # 4. Fuse range
            fused_days = fuse_range(
                grid_key=grid_key,
                raw_rows=combined_for_fusion,
                start_date=start_range,
                end_date=end_range,
                today=today,
                cfg=fusion_cfg,
            )

            fused_dicts = []
            for fd in fused_days:
                fd_dict = fd.to_dict()
                fd_dict["updated_at"] = now_utc_iso()
                fused_dicts.append(fd_dict)

                # Track disagreements for observability (§15)
                if fd.disagreement:
                    for field in fd.disagreement:
                        disagreement_counts[field] += 1
                if fd.validators:
                    for v_src in fd.validators:
                        comparison_counts[v_src] += 1

            upserted_fused = weather_repo.upsert_fused_days(fused_dicts)
            total_rows_upserted += upserted_fused

        except Exception as exc:
            logger.error(f"Failed to ingest weather for grid {grid_key}: {exc}")
            failed_grids.append(grid_key)

    elapsed = time.time() - start_time
    status = "ok" if not failed_grids else ("partial" if total_rows_upserted > 0 else "failed")

    notes = {
        "duration_seconds": round(elapsed, 2),
        "total_grids": len(grids),
        "failed_grids": failed_grids,
        "disagreement_counts": dict(disagreement_counts),
        "comparison_counts": dict(comparison_counts),
    }

    weather_repo.finish_ingestion_run(
        run_id=run_id,
        status=status,
        rows_in=total_rows_in,
        rows_upserted=total_rows_upserted,
        notes=notes,
    )

    logger.info(
        f"Completed ingest_weather in {elapsed:.2f}s with status={status}. "
        f"Rows in: {total_rows_in}, Upserted: {total_rows_upserted}",
        extra={"job": "ingest_weather", "status": status, "duration": elapsed},
    )
    if status == "failed":
        return -1
    return total_rows_upserted


if __name__ == "__main__":
    count = run_ingest_weather()
    sys.exit(0 if count >= 0 else 1)
