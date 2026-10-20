"""
Bulk ingestion script to load all prepared MandiLens Agmarknet snapshot partitions
into Supabase mandi_prices table.

Sources: data/mandilens/*.json (88,852 records across 6 states, 79 districts, 121 markets, 14 commodities).
Uses: MandiRepository.upsert_records() with chunk_size=1000 and source='agmarknet_pkg'.
"""

import argparse
import glob
import json
import logging
import sys
import time
from datetime import date
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.logging import setup_logger
from app.data.mandi.repository import MandiRepository
from app.data.types import MandiRecord

logger = setup_logger("load_mandilens_snapshot")

STATE_MAP = {
    "kerala": "Keralam",
    "keralam": "Keralam",
    "chhattisgarh": "Chattisgarh",
    "odisha": "Odisha",
}


def load_mandilens_snapshot(
    data_dir: str | Path = "data/mandilens",
    chunk_size: int = 1000,
    dry_run: bool = False,
) -> int:
    path = Path(data_dir)
    if not path.exists():
        logger.error(f"Directory {path} does not exist!")
        return 1

    files = sorted(glob.glob(str(path / "*.json")))
    if not files:
        logger.error(f"No JSON files found in {path}")
        return 1

    logger.info(f"Found {len(files)} JSON files in {path}")
    start_time = time.time()

    all_records: list[MandiRecord] = []
    seen_keys: set[tuple] = set()

    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            commodity = data.get("commodity")
            if not commodity:
                continue

            markets_list = data.get("markets", [])
            market_map = {m["market_id"]: m for m in markets_list}

            observations = data.get("observations", [])
            for obs in observations:
                m_info = market_map.get(obs.get("market_id"))
                if not m_info:
                    continue

                raw_state = m_info.get("state", data.get("state", ""))
                state = STATE_MAP.get(raw_state.strip().lower(), raw_state.strip())
                district = m_info.get("district", "").strip()
                market = m_info.get("market", "").strip()

                date_str = obs.get("date")
                if not date_str:
                    continue
                arrival_d = date.fromisoformat(date_str)

                min_p = float(obs["min_price"]) if obs.get("min_price") is not None else None
                max_p = float(obs["max_price"]) if obs.get("max_price") is not None else None
                modal_p = (
                    float(obs["representative_price"])
                    if obs.get("representative_price") is not None
                    else None
                )
                arrivals = (
                    float(obs["arrivals_tonnes"])
                    if obs.get("arrivals_tonnes") is not None
                    else None
                )
                variety = obs.get("example_variety") or "Other"
                grade = "FAQ"

                # Check constraint mandi_prices_source_check requires one of:
                # 'datagov_live', 'agmarknet_pkg', 'ceda', 'kaggle_seed'
                source = "agmarknet_pkg"
                quality_flag = "outlier" if obs.get("is_anomaly") else "ok"

                rec = MandiRecord(
                    state=state,
                    district=district,
                    market=market,
                    commodity=commodity,
                    variety=variety,
                    grade=grade,
                    arrival_date=arrival_d,
                    min_price=min_p,
                    max_price=max_p,
                    modal_price=modal_p,
                    arrivals_tonnes=arrivals,
                    unit="Rs/Quintal",
                    source=source,
                    source_priority=100,
                    quality_flag=quality_flag,
                )

                ukey = rec.unique_key()
                if ukey not in seen_keys:
                    seen_keys.add(ukey)
                    all_records.append(rec)

        except Exception as exc:
            logger.error(f"Error reading file {file_path}: {exc}")

    logger.info(
        f"Parsed {len(all_records)} unique records from {len(files)} partition files in {time.time() - start_time:.2f}s"
    )

    if dry_run:
        logger.info(f"[DRY-RUN] Would upsert {len(all_records)} records in chunks of {chunk_size}.")
        return 0

    repo = MandiRepository()
    run_id = repo.start_ingestion_run("mandilens_bulk_snapshot", source="agmarknet_pkg")
    total_upserted = 0

    logger.info(f"Starting bulk upsert of {len(all_records)} records to Supabase...")
    upsert_start = time.time()

    for i in range(0, len(all_records), chunk_size):
        chunk = all_records[i : i + chunk_size]
        chunk_num = (i // chunk_size) + 1
        total_chunks = (len(all_records) + chunk_size - 1) // chunk_size

        try:
            count = repo.upsert_records(chunk, chunk_size=len(chunk))
            total_upserted += count
            if chunk_num % 10 == 0 or chunk_num == total_chunks:
                logger.info(
                    f"Progress: chunk {chunk_num}/{total_chunks} ({total_upserted}/{len(all_records)} rows upserted) in {time.time() - upsert_start:.1f}s"
                )
        except Exception as exc:
            logger.error(f"Failed upserting chunk {chunk_num}: {exc}")
            if run_id:
                repo.finish_ingestion_run(
                    run_id,
                    status="failed",
                    rows_in=len(all_records),
                    rows_upserted=total_upserted,
                    rows_flagged=0,
                    notes={"error": str(exc)},
                )
            return 1

    total_time = time.time() - upsert_start
    logger.info(
        f"Successfully upserted {total_upserted} records into Supabase mandi_prices in {total_time:.2f}s ({total_upserted / max(total_time, 0.001):.0f} rows/s)"
    )

    if run_id:
        repo.finish_ingestion_run(
            run_id,
            status="success",
            rows_in=len(all_records),
            rows_upserted=total_upserted,
            rows_flagged=0,
            notes={"total_files": len(files), "total_duration_sec": round(total_time, 2)},
        )

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest MandiLens snapshot data into Supabase")
    parser.add_argument("--data-dir", default="data/mandilens", help="Directory with MandiLens JSON files")
    parser.add_argument("--chunk-size", type=int, default=1000, help="Batch chunk size for RPC")
    parser.add_argument("--dry-run", action="store_true", help="Parse files without upserting to DB")

    args = parser.parse_args()
    sys.exit(
        load_mandilens_snapshot(
            data_dir=args.data_dir,
            chunk_size=args.chunk_size,
            dry_run=args.dry_run,
        )
    )
