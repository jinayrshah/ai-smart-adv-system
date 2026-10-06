"""
Growth Stage & Agronomic Status Daily Recomputation Job.
Architecture_Advisory.md §19, Implementationplan_Advisory.md Phase 7.

Daily batch job (runs after weather ingestion):
Iterates over all active farm crops across registered farms, pulls historical
thermal time (temperatures) and rainfall, computes accumulated GDD, physiological
growth stages, 7-day crop water requirements (ETc = Kc * ET0), and soil suitability flags.
"""

import argparse
from datetime import date, datetime
import logging
from typing import Any

from app.data.farmer.repository import FarmerRepository
from app.data.locations.grid import snap_to_grid
from app.data.weather.repository import WeatherRepository
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
    weather_repo = WeatherRepository()
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

    today = date.today()

    for row in rows:
        crop_id = row.get("id")
        crop_name = row.get("crop", "Wheat")
        sowing_val = row.get("sowing_date")
        if isinstance(sowing_val, str):
            try:
                sowing_date = datetime.fromisoformat(sowing_val).date()
            except ValueError:
                sowing_date = today
        elif isinstance(sowing_val, date):
            sowing_date = sowing_val
        else:
            sowing_date = today

        farm = row.get("farms") or {}
        f_id = row.get("farm_id")
        lat = farm.get("lat") or 20.0
        lon = farm.get("lon") or 73.8
        soil_type = farm.get("soil_type") or "Loamy (दोमट)"

        grid_res = farm.get("agromet_grid_id") or snap_to_grid(lat, lon)
        grid_key = grid_res.grid_key if hasattr(grid_res, "grid_key") else str(grid_res)

        # Pull weather history & summary
        try:
            weather_service.ensure_grid_weather(grid_key, lat, lon)
            w_history = weather_repo.get_fused_range(grid_key, sowing_date, today)
            w_sum = weather_service.get_summary(lat=lat, lon=lon)
        except Exception as exc:
            logger.debug(f"Weather lookup fallback for grid {grid_key}: {exc}")
            w_history = []
            w_sum = None

        # 1. Growth stage via GDD thermal accumulation
        stage_res = current_growth_stage(
            crop=crop_name,
            sowing_date=sowing_date,
            weather_history=w_history,
            as_of=today,
        )

        # 2. Water requirement & irrigation deficit
        w_summary_dict = w_sum.model_dump() if w_sum else {
            "temp_c": 26.0,
            "humidity_pct": 55.0,
            "condition": "Clear",
            "forecast_7d": [],
        }
        water_res = calculate_irrigation_need(
            crop=crop_name,
            stage_name=stage_res.stage_name,
            weather_summary=w_summary_dict,
        )

        # 3. Soil suitability
        soil_flags = check_soil_suitability(
            crop=crop_name,
            soil_type=soil_type,
            soil_npk={
                "n": farm.get("shc_n"),
                "p": farm.get("shc_p"),
                "k": farm.get("shc_k"),
                "ph": farm.get("shc_ph"),
            },
        )

        entry = {
            "crop_id": crop_id,
            "farm_id": f_id,
            "crop": crop_name,
            "sowing_date": sowing_date.isoformat(),
            "accumulated_gdd": stage_res.cumulative_gdd,
            "stage_name": stage_res.stage_name,
            "stage_order": stage_res.stage_order,
            "days_since_sowing": stage_res.days_since_sowing,
            "estimation_method": stage_res.method,
            "next_stage_name": stage_res.next_stage_name,
            "gdd_remaining_in_stage": stage_res.gdd_remaining_in_stage,
            "water_deficit_7d_mm": water_res.deficit_mm,
            "kc": water_res.kc,
            "water_confidence": water_res.confidence,
            "soil_flags_count": len(soil_flags),
            "recomputed_at": datetime.now().isoformat(),
        }
        results.append(entry)

        logger.info(
            f"Crop #{crop_id} ({crop_name}, Farm {f_id}): Stage '{stage_res.stage_name}' "
            f"(GDD: {stage_res.cumulative_gdd:.1f}, {stage_res.method}) | "
            f"Water Deficit: {water_res.deficit_mm:.1f}mm (Conf: {water_res.confidence})"
        )

    logger.info(f"Successfully recomputed {len(results)} active crops.")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily Agronomic Stage Recomputation Job")
    parser.add_argument("--farm-id", type=int, default=None, help="Optional farm ID to filter")
    parser.add_argument("--dry-run", action="store_true", help="Calculate without mutating database")
    args = parser.parse_args()

    recompute_all_active_stages(farm_id=args.farm_id, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
