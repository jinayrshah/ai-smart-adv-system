import logging
import sys
import time

from app.core.logging import setup_logger
from app.data.locations.repository import LocationsRepository
from app.data.weather.providers.open_meteo import OpenMeteoClient
from app.data.weather.repository import WeatherRepository

logger = setup_logger("refresh_normals")


def run_refresh_normals(force: bool = False) -> int:
    start_time = time.time()
    logger.info("Starting refresh_normals job", extra={"job": "refresh_normals", "status": "started"})

    weather_repo = WeatherRepository()
    locations_repo = LocationsRepository()
    open_meteo = OpenMeteoClient(timeout=35.0)

    run_id = weather_repo.start_ingestion_run(job="refresh_normals", source="open_meteo_era5land")

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

    total_normals_upserted = 0
    failed_grids = []

    for grid_key, loc in grids.items():
        # Check if already present
        if not force:
            existing = weather_repo.get_normals(grid_key)
            if len(existing) >= 12:
                logger.info(f"Normals already present for grid {grid_key}; skipping")
                continue

        lat = float(loc["lat"])
        lon = float(loc["lon"])

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Computing 2010-2024 ERA5-Land normals for {loc.get('name')} ({grid_key})")
                normals = open_meteo.fetch_normals(
                    lat=lat,
                    lon=lon,
                    grid_key=grid_key,
                    start_year=2010,
                    end_year=2024,
                )

                if normals:
                    upserted = weather_repo.upsert_normals(normals)
                    total_normals_upserted += upserted

                # Polite pause between long historical archive queries
                time.sleep(1.5)
                break

            except Exception as exc:
                if "429" in str(exc) and attempt < max_retries:
                    backoff = (attempt + 1) * 3.0
                    logger.warning(f"Rate limited (429) for {grid_key}. Backing off for {backoff}s before retry...")
                    time.sleep(backoff)
                else:
                    logger.error(f"Failed to refresh normals for grid {grid_key}: {exc}")
                    failed_grids.append(grid_key)
                    break

    elapsed = time.time() - start_time
    status = "ok" if not failed_grids else "partial"

    weather_repo.finish_ingestion_run(
        run_id=run_id,
        status=status,
        rows_in=total_normals_upserted,
        rows_upserted=total_normals_upserted,
        notes={
            "duration_seconds": round(elapsed, 2),
            "total_grids": len(grids),
            "failed_grids": failed_grids,
        },
    )

    logger.info(f"refresh_normals completed in {elapsed:.2f}s: {total_normals_upserted} normals rows upserted.")
    return total_normals_upserted


if __name__ == "__main__":
    force_refresh = "--force" in sys.argv
    count = run_refresh_normals(force=force_refresh)
    sys.exit(0 if count >= 0 else 1)
