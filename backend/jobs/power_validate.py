import logging
import sys
import time
from datetime import date, timedelta

from app.core.logging import setup_logger
from app.core.timeutil import now_utc_iso, today_ist
from app.data.locations.repository import LocationsRepository
from app.data.types import WeatherDay
from app.data.weather.fusion import fuse_range, load_fusion_config
from app.data.weather.providers.nasa_power import NasaPowerClient
from app.data.weather.repository import WeatherRepository, weather_day_from_row

logger = setup_logger("power_validate")


def run_power_validate() -> int:
    start_time = time.time()
    logger.info("Starting power_validate job", extra={"job": "power_validate", "status": "started"})

    weather_repo = WeatherRepository()
    locations_repo = LocationsRepository()
    power_client = NasaPowerClient(timeout=20.0)
    fusion_cfg = load_fusion_config()

    run_id = weather_repo.start_ingestion_run(job="power_validate", source="nasa_power")
    today = today_ist()

    # NASA POWER window: today - 14 to today - 2 (latency is 2-7 days)
    start_date = today - timedelta(days=14)
    end_date = today - timedelta(days=2)

    tracked_locations = locations_repo.get_tracked_locations()
    if not tracked_locations:
        logger.warning("No tracked locations found")
        weather_repo.finish_ingestion_run(run_id, "ok", 0, 0, notes={"warning": "no locations"})
        return 0

    grids: dict[str, dict] = {}
    for loc in tracked_locations:
        gk = loc.get("grid_key")
        if gk and gk not in grids:
            grids[gk] = loc

    total_power_rows = 0
    total_fused_updated = 0
    failed_grids = []

    for grid_key, loc in grids.items():
        lat = float(loc["lat"])
        lon = float(loc["lon"])

        try:
            # Respect rate limit / latency: short sleep between points
            time.sleep(0.5)

            power_days = power_client.fetch_daily(
                lat=lat,
                lon=lon,
                grid_key=grid_key,
                start_date=start_date,
                end_date=end_date,
            )

            if not power_days:
                continue

            total_power_rows += len(power_days)
            weather_repo.upsert_daily_records(power_days)

            # Re-fuse the range with the new NASA POWER validation data
            raw_db_rows = weather_repo.get_raw_daily_range(grid_key, start_date, end_date)
            parsed_raw: list[WeatherDay] = [weather_day_from_row(r, grid_key) for r in raw_db_rows]

            fused_days = fuse_range(
                grid_key=grid_key,
                raw_rows=parsed_raw,
                start_date=start_date,
                end_date=end_date,
                today=today,
                cfg=fusion_cfg,
            )

            fused_dicts = []
            for fd in fused_days:
                fd_dict = fd.to_dict()
                fd_dict["updated_at"] = now_utc_iso()
                fused_dicts.append(fd_dict)

            upserted = weather_repo.upsert_fused_days(fused_dicts)
            total_fused_updated += upserted

        except Exception as exc:
            logger.error(f"NASA POWER validation failed for grid {grid_key}: {exc}")
            failed_grids.append(grid_key)

    elapsed = time.time() - start_time
    status = "ok" if not failed_grids else ("partial" if len(failed_grids) < len(grids) else "failed")

    weather_repo.finish_ingestion_run(
        run_id=run_id,
        status=status,
        rows_in=total_power_rows,
        rows_upserted=total_power_rows + total_fused_updated,
        notes={
            "duration_seconds": round(elapsed, 2),
            "window": f"{start_date.isoformat()} to {end_date.isoformat()}",
            "failed_grids": failed_grids,
        },
    )

    logger.info(
        f"power_validate completed in {elapsed:.2f}s: {total_power_rows} POWER rows, "
        f"{total_fused_updated} fused rows updated."
    )
    if status == 'failed':
        return -1
    return total_power_rows + total_fused_updated


if __name__ == "__main__":
    count = run_power_validate()
    sys.exit(0 if count >= 0 else 1)
