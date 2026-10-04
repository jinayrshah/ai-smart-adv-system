"""
Load job for Phase 4B: crop_cost_reference and crop_storage_reference.
Architecture §9b, Implementation Plan Phase 4B Task 2 & 3.

Populates benchmark tables from curated DES Cost of Cultivation (2022-23)
and WDRA / ICAR post-harvest storage parameters.
"""

import logging
import sys
from pathlib import Path
import yaml

from app.data.mandi.repository import get_supabase_client
from app.data.reference.repository import ReferenceRepository

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def run_load_reference():
    logger.info("Starting reference data loading job...")
    repo = ReferenceRepository()

    # 1. Load and verify local YAML datasets
    costs = repo.cost_data
    storage = repo.storage_data

    logger.info(f"Loaded {len(costs)} cost reference records from crop_cost.yaml")
    logger.info(f"Loaded {len(storage)} storage reference records from crop_storage.yaml")

    # 2. Sync to Supabase
    sb = get_supabase_client()
    cost_synced = 0
    storage_synced = 0

    try:
        # Upsert storage reference
        storage_rows = []
        for r in storage:
            storage_rows.append({
                "crop": r["crop"],
                "storable": bool(r["storable"]),
                "max_storage_days": r.get("max_storage_days"),
                "typical_loss_pct_per_month": float(r["typical_loss_pct_per_month"]) if r.get("typical_loss_pct_per_month") is not None else None,
                "source": r.get("source", ""),
            })

        res_storage = sb.table("crop_storage_reference").upsert(storage_rows, on_conflict="crop").execute()
        storage_synced = len(res_storage.data) if res_storage.data else len(storage_rows)
        logger.info(f"Successfully upserted {storage_synced} rows into Supabase 'crop_storage_reference'")
    except Exception as exc:
        logger.warning(
            f"Could not sync to Supabase 'crop_storage_reference': {exc}. "
            "If the table does not exist yet, run 'supabase/migrations/20261004000000_phase4b_calculators.sql' in Supabase SQL editor. "
            "Local YAML fallback will be used automatically in the meantime."
        )

    try:
        # Upsert cost reference
        cost_rows = []
        for r in costs:
            cost_rows.append({
                "crop": r["crop"],
                "state": r["state"],
                "year": str(r["year"]),
                "cost_a2fl_per_quintal": float(r["cost_a2fl_per_quintal"]) if r.get("cost_a2fl_per_quintal") is not None else None,
                "cost_c2_per_quintal": float(r["cost_c2_per_quintal"]),
                "reference_yield_qtl_per_hectare": float(r["reference_yield_qtl_per_hectare"]),
                "source": r.get("source", "DES Cost of Cultivation Scheme"),
            })

        res_cost = sb.table("crop_cost_reference").upsert(cost_rows, on_conflict="crop,state,year").execute()
        cost_synced = len(res_cost.data) if res_cost.data else len(cost_rows)
        logger.info(f"Successfully upserted {cost_synced} rows into Supabase 'crop_cost_reference'")
    except Exception as exc:
        logger.warning(
            f"Could not sync to Supabase 'crop_cost_reference': {exc}. "
            "If the table does not exist yet, run 'supabase/migrations/20261004000000_phase4b_calculators.sql' in Supabase SQL editor. "
            "Local YAML fallback will be used automatically in the meantime."
        )

    logger.info(
        f"Reference load job complete. Costs on file: {len(costs)} (remote: {cost_synced}), "
        f"Storage on file: {len(storage)} (remote: {storage_synced})."
    )


if __name__ == "__main__":
    run_load_reference()
