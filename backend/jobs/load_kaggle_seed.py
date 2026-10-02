import argparse
import csv
import logging
from pathlib import Path

from app.core.logging import setup_logger
from app.core.timeutil import parse_date_ist
from app.data.mandi.canonical import Canonicalizer, load_tracked_scope
from app.data.mandi.reconcile import dedupe_by_key
from app.data.mandi.repository import MandiRepository
from app.data.mandi.validate import flag_quality
from app.data.types import MandiRecord

logger = setup_logger("load_kaggle_seed")


def load_kaggle_seed(csv_path: str | Path, dry_run: bool = False) -> int:
    path = Path(csv_path)
    if not path.exists():
        logger.error(f"Kaggle seed CSV file does not exist: {path}")
        return 1

    scope = load_tracked_scope()
    canonicalizer = Canonicalizer(scope)
    repo = MandiRepository()

    records: list[MandiRecord] = []
    with open(path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        # Check header
        headers_lower = {h.lower(): h for h in reader.fieldnames or []}
        if "arrival_date" not in headers_lower or "commodity" not in headers_lower:
            logger.error(f"Expected Kaggle headers not found. Present headers: {reader.fieldnames}")
            return 1

        for row in reader:
            try:
                date_str = row.get(headers_lower["arrival_date"], "")
                if not date_str:
                    continue
                arrival_d = parse_date_ist(date_str)

                min_p = float(row[headers_lower["min_price"]]) if row.get(headers_lower.get("min_price", "")) else None
                max_p = float(row[headers_lower["max_price"]]) if row.get(headers_lower.get("max_price", "")) else None
                modal_p = float(row[headers_lower["modal_price"]]) if row.get(headers_lower.get("modal_price", "")) else None

                rec = MandiRecord(
                    state=row.get(headers_lower.get("state", ""), "").strip(),
                    district=row.get(headers_lower.get("district", ""), "").strip(),
                    market=row.get(headers_lower.get("market", ""), "").strip(),
                    commodity=row.get(headers_lower.get("commodity", ""), "").strip(),
                    variety=row.get(headers_lower.get("variety", ""), "").strip(),
                    grade=row.get(headers_lower.get("grade", ""), "").strip(),
                    arrival_date=arrival_d,
                    min_price=min_p,
                    max_price=max_p,
                    modal_price=modal_p,
                    unit="Rs/Quintal",
                    source="kaggle_seed",
                    source_priority=10,
                    quality_flag="ok",
                )
                canon = canonicalizer.canonicalize(rec, strict_crop=True)
                if canon:
                    records.append(canon)
            except Exception as exc:
                logger.warning(f"Error parsing Kaggle seed row: {exc}")

    validated = [flag_quality(r) for r in records]
    deduped = dedupe_by_key(validated, keep="highest_priority_then_latest")
    logger.info(f"Loaded {len(records)} Kaggle rows -> {len(deduped)} deduped rows")

    if not dry_run and deduped:
        upserted = repo.upsert_records(deduped)
        logger.info(f"Successfully upserted {upserted} Kaggle records into Supabase")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Load Kaggle seed CSV into Supabase mandi_prices")
    parser.add_argument("--csv", required=True, help="Path to Kaggle CSV file")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without upserting")
    args = parser.parse_args()
    exit_code = load_kaggle_seed(args.csv, dry_run=args.dry_run)
    exit(exit_code)


if __name__ == "__main__":
    main()
