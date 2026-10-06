"""
Job to load agronomic reference datasets (GDD stages, Kc, soil & climate norms) into Supabase.
Architecture_Advisory.md §7, §8, §9, §9b.
"""

import json
import logging
from pathlib import Path
import sys

from app.data.mandi.repository import get_supabase_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

CATALOG_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "advisory" / "fixtures" / "crop_catalog.json"


def load_advisory_reference_data():
    if not CATALOG_PATH.exists():
        logger.error(f"Catalog fixture not found at {CATALOG_PATH}")
        sys.exit(1)

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    crops_dict = data.get("crops", {})
    client = get_supabase_client()

    stage_rows = []
    kc_rows = []
    soil_rows = []
    climate_rows = []

    for crop_name, crop_info in crops_dict.items():
        base_gdd = float(crop_info.get("gdd_base_c", 10.0))
        crop_source = crop_info.get("source")
        if not crop_source:
            raise ValueError(f"Crop {crop_name} is missing required source provenance!")

        # 1. Stages & Kc
        for st in crop_info.get("stages", []):
            st_source = st.get("source") or crop_source
            if not st_source:
                raise ValueError(f"Stage {st.get('stage_name')} for {crop_name} missing source!")

            stage_rows.append({
                "crop": crop_name,
                "stage_order": st["stage_order"],
                "stage_name": st["stage_name"],
                "gdd_base_c": base_gdd,
                "gdd_cumulative_at_stage_end": float(st["gdd_cumulative_at_stage_end"]),
                "typical_days_fallback": st.get("typical_days_fallback"),
                "source": st_source,
            })

            kc_rows.append({
                "crop": crop_name,
                "stage_name": st["stage_name"],
                "kc": float(st["kc"]),
                "source": st.get("kc_source") or "FAO-56 Table 12",
            })

        # 2. Soil
        soil = crop_info.get("soil", {})
        if not soil.get("source"):
            raise ValueError(f"Soil parameters for {crop_name} missing source!")
        soil_rows.append({
            "crop": crop_name,
            "ideal_soil_types": soil["ideal_soil_types"],
            "ideal_ph_min": float(soil["ideal_ph_min"]),
            "ideal_ph_max": float(soil["ideal_ph_max"]),
            "notes": soil.get("notes"),
            "source": soil["source"],
        })

        # 3. Climate
        climate = crop_info.get("climate", {})
        if not climate.get("source"):
            raise ValueError(f"Climate parameters for {crop_name} missing source!")
        climate_rows.append({
            "crop": crop_name,
            "stage_name": "",
            "ideal_temp_min_c": float(climate["ideal_temp_min_c"]),
            "ideal_temp_max_c": float(climate["ideal_temp_max_c"]),
            "ideal_humidity_min_pct": float(climate["ideal_humidity_min_pct"]) if climate.get("ideal_humidity_min_pct") is not None else None,
            "ideal_humidity_max_pct": float(climate["ideal_humidity_max_pct"]) if climate.get("ideal_humidity_max_pct") is not None else None,
            "notes": climate.get("notes"),
            "source": climate["source"],
        })

    logger.info(f"Prepared {len(stage_rows)} stages, {len(kc_rows)} Kc rows, {len(soil_rows)} soil rows, {len(climate_rows)} climate rows.")

    # Upsert to Supabase
    try:
        if stage_rows:
            client.table("crop_stage_norms").upsert(stage_rows, on_conflict="crop,stage_order").execute()
            logger.info("Successfully seeded crop_stage_norms.")
        if kc_rows:
            client.table("crop_kc_reference").upsert(kc_rows, on_conflict="crop,stage_name").execute()
            logger.info("Successfully seeded crop_kc_reference.")
        if soil_rows:
            client.table("crop_soil_suitability").upsert(soil_rows, on_conflict="crop").execute()
            logger.info("Successfully seeded crop_soil_suitability.")
        if climate_rows:
            client.table("crop_climate_suitability").upsert(climate_rows, on_conflict="crop,stage_name").execute()
            logger.info("Successfully seeded crop_climate_suitability.")
    except Exception as exc:
        logger.warning(f"Remote Supabase seeding note (tables may need SQL migration executed first): {exc}")


if __name__ == "__main__":
    load_advisory_reference_data()
