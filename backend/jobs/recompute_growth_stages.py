"""
Growth Stage & Agronomic Status Daily Recomputation Job.
Architecture_Advisory.md §19, Implementationplan_Advisory.md Phase 7.

Daily batch job (runs after weather ingestion):
Iterates over all active farm crops across registered farms, pulls historical
thermal time (temperatures) and rainfall, computes accumulated GDD, physiological
growth stages, 7-day crop water requirements (ETc = Kc * ET0), and soil suitability flags.
"""

import argparse
from datetime import date, datetime, timezone
import logging
from typing import Any

from app.core.timeutil import today_ist
from app.data.farmer.repository import FarmerRepository
from app.data.locations.grid import snap_to_grid
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.domain.advisory.water_requirement_engine import calculate_irrigation_need
from app.data.weather.service import WeatherService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("recompute_growth_stages")


def recompute_all_active_stages(
    farm_id: int | None = None,
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    farmer_repo = FarmerRepository()
    weather_service = WeatherService()

    # 1. Fetch active farm crops
    try:
        q = farmer_repo.client.table("farm_crops").select("*, farms(*)").eq("status", "active")
        if farm_id is not None:
            q = q.eq("farm_id", farm_id)
        res = q.execute()
        rows = res.data or []
    except Exception as exc:
        logger.warning(f"Supabase farm_crops query fallback: {exc}")
        # In-memory fallback
        rows = []
        for c in farmer_repo._crops.values():
            if c.get("status") == "active" and (farm_id is None or c.get("farm_id") == farm_id):
                farm_data = farmer_repo._farms.get(c.get("farm_id"), {})
                row = dict(c)
                row["farms"] = farm_data
                rows.append(row)

    if not rows:
        logger.info("No active farm crops found to recompute.")
        return []

    logger.info(f"Recomputing physiological growth stages for {len(rows)} active crops...")
    results: list[dict[str, Any]] = []
    today = today_ist()

    for row in rows:
        crop_id = row.get("id")
        crop_name = row.get("crop")
        sowing_date = _parse_date(row.get("sowing_date"))
        farm = row.get("farms") or {}
        f_id = row.get("farm_id")
        lat, lon = farm.get("lat"), farm.get("lon")
        if not crop_name or sowing_date is None or lat is None or lon is None:
            logger.warning(f"Crop #{crop_id}: missing crop, sowing date or farm location — skipped")
            continue
        if sowing_date > today:
            logger.info(f"Crop #{crop_id}: sowing date {sowing_date} is in the future — skipped")
            continue
        lat, lon = float(lat), float(lon)
        grid_key = farm.get("grid_key") or snap_to_grid(lat, lon).grid_key
        soil_type = farm.get("soil_type")
        soil_npk = farm.get("soil_npk") or {
            "n": farm.get("shc_n"), "p": farm.get("shc_p"), "k": farm.get("shc_k"), "ph": farm.get("shc_ph"),
        }

        try:
            weather_service.ensure_grid_weather(grid_key, lat, lon)
            w_history = weather_service.get_history_rows(grid_key, lat, lon, sowing_date, today)
            w_summary = weather_service.get_summary(lat=lat, lon=lon).model_dump()
        except Exception as exc:
            logger.warning(f"Weather lookup failed for grid {grid_key}: {exc}")
            w_history, w_summary = [], {"days": [], "metrics": {}}

        try:
            events = [e.model_dump() for e in farmer_repo.get_irrigation_events(f_id, since=sowing_date)]
        except Exception:
            events = []

        try:
            stage_res = current_growth_stage(
                crop=crop_name, sowing_date=sowing_date, weather_history=w_history, as_of=today
            )
            water_res = calculate_irrigation_need(
                crop=crop_name,
                stage_name=stage_res.stage_name,
                weather_summary=w_summary,
                history_rows=w_history,
                sowing_date=sowing_date,
                as_of=today,
                soil_type=soil_type,
                irrigation_type=farm.get("irrigation_type"),
                irrigation_events=events,
            )
        except ValueError as exc:  # crop not in the reference catalog
            logger.warning(f"Crop #{crop_id} ({crop_name}) skipped: {exc}")
            continue
        soil_flags = check_soil_suitability(crop=crop_name, soil_type=soil_type, soil_npk=soil_npk)

        entry = {
            "crop_id": crop_id,
            "farm_id": f_id,
            "crop": crop_name,
            "sowing_date": sowing_date.isoformat(),
            "accumulated_gdd": stage_res.cumulative_gdd,
            "stage_name": stage_res.stage_name,
            "stage_order": stage_res.stage_order,
            "stage_progress_pct": stage_res.stage_progress_pct,
            "days_since_sowing": stage_res.days_since_sowing,
            "estimation_method": stage_res.method,
            "weather_coverage_pct": stage_res.weather_coverage_pct,
            "next_stage_name": stage_res.next_stage_name,
            "gdd_remaining_in_stage": stage_res.gdd_remaining_in_stage,
            "water_method": water_res.method,
            "water_action": water_res.action,
            "water_deficit_7d_mm": water_res.deficit_mm,
            "root_zone_depletion_mm": water_res.root_zone_depletion_mm,
            "raw_mm": water_res.raw_mm,
            "days_to_stress": water_res.days_to_stress,
            "kc": water_res.kc,
            "water_confidence": water_res.confidence,
            "soil_flags_count": len(soil_flags),
            "recomputed_at": datetime.now(timezone.utc).isoformat(),
        }
        results.append(entry)

        gdd_txt = f"{stage_res.cumulative_gdd:.1f}" if stage_res.cumulative_gdd is not None else "n/a"
        logger.info(
            f"Crop #{crop_id} ({crop_name}, farm {f_id}): '{stage_res.stage_name}' "
            f"(GDD {gdd_txt}, {stage_res.method}) | water: {water_res.action} via {water_res.method} "
            f"({water_res.confidence})"
        )

    if results and not dry_run:
        try:
            farmer_repo.client.table("farm_crop_status").upsert(results, on_conflict="crop_id").execute()
            logger.info(f"Persisted status for {len(results)} crops.")
        except Exception as exc:
            logger.error(f"Could not persist farm_crop_status: {exc}")

    logger.info(f"Recomputed {len(results)} active crops.")
    return results


def _parse_date(v: Any) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return date.fromisoformat(v[:10])
        except ValueError:
            return None
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily Agronomic Stage Recomputation Job")
    parser.add_argument("--farm-id", type=int, default=None, help="Optional farm ID to filter")
    parser.add_argument("--dry-run", action="store_true", help="Calculate without mutating database")
    args = parser.parse_args()

    recompute_all_active_stages(farm_id=args.farm_id, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
