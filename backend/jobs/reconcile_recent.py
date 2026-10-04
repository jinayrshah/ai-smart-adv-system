import logging
import sys
import time
from datetime import date, timedelta

from app.core.logging import setup_logger
from app.core.timeutil import now_utc_iso, today_ist
from app.data.locations.repository import LocationsRepository
from app.data.types import WeatherDay
from app.data.weather.fusion import fuse_range, load_fusion_config
from app.data.weather.providers.open_meteo import OpenMeteoClient
from app.data.weather.repository import WeatherRepository

logger = setup_logger("reconcile_recent")


def run_reconcile_recent() -> int:
    start_time = time.time()
    logger.info("Starting reconcile_recent job", extra={"job": "reconcile_recent", "status": "started"})

    weather_repo = WeatherRepository()
    locations_repo = LocationsRepository()
    open_meteo = OpenMeteoClient(timeout=15.0)
    fusion_cfg = load_fusion_config()

    run_id = weather_repo.start_ingestion_run(job="reconcile_recent", source="open_meteo_archive")
    today = today_ist()

    # Reconcile window: 14 days ago to 6 days ago (ERA5-Land ~5-day lag)
    start_date = today - timedelta(days=14)
    end_date = today - timedelta(days=6)

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

    total_archive_rows = 0
    total_fused_updated = 0
    failed_grids = []

    for grid_key, loc in grids.items():
        lat = float(loc["lat"])
        lon = float(loc["lon"])

        try:
            # 1. Fetch official ERA5-Land archive records
            archive_days = open_meteo.fetch_archive(
                lat=lat,
                lon=lon,
                grid_key=grid_key,
                start_date=start_date,
                end_date=end_date,
            )

            if not archive_days:
                continue

            total_archive_rows += len(archive_days)
            # Upsert into weather_daily with kind='archive'
            weather_repo.upsert_daily_records(archive_days)

            # 2. Fetch all raw rows for this grid and date range to re-fuse
            raw_db_rows = weather_repo.get_raw_daily_range(grid_key, start_date, end_date)
            parsed_raw: list[WeatherDay] = []
            for r in raw_db_rows:
                d_val = r["date"]
                d_obj = date.fromisoformat(d_val) if isinstance(d_val, str) else d_val
                parsed_raw.append(
                    WeatherDay(
                        grid_key=grid_key,
                        date=d_obj,
                        source=r["source"],
                        kind=r["kind"],
                        tmax_c=r.get("tmax_c"),
                        tmin_c=r.get("tmin_c"),
                        precip_mm=r.get("precip_mm"),
                        rh_mean_pct=r.get("rh_mean_pct"),
                        radiation_mj_m2=r.get("radiation_mj_m2"),
                        et0_mm=r.get("et0_mm"),
                    )
                )

            # 3. Re-fuse with newly replaced archive rows
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
            logger.error(f"Reconciliation failed for grid {grid_key}: {exc}")
            failed_grids.append(grid_key)

    elapsed = time.time() - start_time
    status = "ok" if not failed_grids else "partial"

    weather_repo.finish_ingestion_run(
        run_id=run_id,
        status=status,
        rows_in=total_archive_rows,
        rows_upserted=total_archive_rows + total_fused_updated,
        notes={
            "duration_seconds": round(elapsed, 2),
            "window": f"{start_date.isoformat()} to {end_date.isoformat()}",
            "failed_grids": failed_grids,
        },
    )

    logger.info(
        f"reconcile_recent completed in {elapsed:.2f}s: {total_archive_rows} archive rows, "
        f"{total_fused_updated} fused rows updated."
    )
    return total_archive_rows + total_fused_updated


if __name__ == "__main__":
    count = run_reconcile_recent()
    sys.exit(0 if count >= 0 else 1)
