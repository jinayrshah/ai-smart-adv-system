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

logger = setup_logger("load_ceda_csv")


def load_ceda_csv(csv_path: str | Path, dry_run: bool = False) -> int:
    path = Path(csv_path)
    if not path.exists():
        logger.error(f"CEDA CSV file does not exist: {path}")
        return 1

    scope = load_tracked_scope()
    canonicalizer = Canonicalizer(scope)
    repo = MandiRepository()

    records: list[MandiRecord] = []
    with open(path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                date_str = row.get("date") or row.get("arrival_date") or ""
                if not date_str:
                    continue
                arrival_d = parse_date_ist(date_str)

                min_p = float(row["min_price"]) if row.get("min_price") else None
                max_p = float(row["max_price"]) if row.get("max_price") else None
                modal_p = float(row["modal_price"]) if row.get("modal_price") else None

                rec = MandiRecord(
                    state=row.get("state_name", "").strip(),
                    district=row.get("district_name", "").strip(),
                    market=row.get("market_name", "").strip(),
                    commodity=row.get("commodity_name", "").strip(),
                    variety=row.get("variety", "").strip(),
                    grade=row.get("grade", "").strip(),
                    arrival_date=arrival_d,
                    min_price=min_p,
                    max_price=max_p,
                    modal_price=modal_p,
                    unit="Rs/Quintal",
                    source="ceda",
                    source_priority=50,
                    quality_flag="ok",
                )
                canon = canonicalizer.canonicalize(rec, strict_crop=True)
                if canon:
                    records.append(canon)
            except Exception as exc:
                logger.warning(f"Error parsing row {row}: {exc}")

    validated = [flag_quality(r) for r in records]
    deduped = dedupe_by_key(validated, keep="highest_priority_then_latest")
    logger.info(f"Loaded {len(records)} CEDA rows -> {len(deduped)} deduped rows")

    if not dry_run and deduped:
        upserted = repo.upsert_records(deduped)
        logger.info(f"Successfully upserted {upserted} CEDA records into Supabase")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Load CEDA CSV export into Supabase mandi_prices")
    parser.add_argument("--csv", required=True, help="Path to CEDA CSV file")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without upserting")
    args = parser.parse_args()
    exit_code = load_ceda_csv(args.csv, dry_run=args.dry_run)
    exit(exit_code)


if __name__ == "__main__":
    main()
