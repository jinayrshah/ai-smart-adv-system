import json
import logging
from pathlib import Path

from app.core.logging import setup_logger
from app.core.timeutil import parse_date_ist
from app.data.mandi.canonical import Canonicalizer, load_tracked_scope
from app.data.mandi.reconcile import dedupe_by_key
from app.data.mandi.repository import MandiRepository
from app.data.mandi.validate import flag_quality
from app.data.types import MandiRecord

logger = setup_logger("migrate_legacy_history")


def migrate_history(json_path: str | Path | None = None) -> int:
    if not json_path:
        json_path = Path(__file__).resolve().parents[2] / "data" / "market_price_history.json"
    else:
        json_path = Path(json_path)

    if not json_path.exists():
        logger.error(f"Legacy file {json_path} does not exist.")
        return 1

    logger.info(f"Loading legacy history from {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        raw_items = json.load(f)

    logger.info(f"Found {len(raw_items)} records in legacy JSON.")

    scope = load_tracked_scope()
    canonicalizer = Canonicalizer(scope)
    repo = MandiRepository()

    parsed_records: list[MandiRecord] = []
    for item in raw_items:
        try:
            arrival_date = parse_date_ist(item.get("arrival_date", ""))
            min_price = float(item["min_price"]) if item.get("min_price") is not None else None
            max_price = float(item["max_price"]) if item.get("max_price") is not None else None
            modal_price = float(item["modal_price"]) if item.get("modal_price") is not None else None

            rec = MandiRecord(
                state=item.get("state", "").strip(),
                district=item.get("district", "").strip(),
                market=item.get("market", "").strip(),
                commodity=item.get("commodity", "").strip(),
                variety=item.get("variety", "").strip(),
                grade=item.get("grade", "").strip(),
                arrival_date=arrival_date,
                min_price=min_price,
                max_price=max_price,
                modal_price=modal_price,
                arrivals_tonnes=None,
                unit="Rs/Quintal",
                source="datagov_live",
                source_priority=100,
                quality_flag="ok",
            )

            # Canonicalize (allow all commodities in legacy file or scoped)
            canon = canonicalizer.canonicalize(rec, strict_crop=False)
            if canon:
                parsed_records.append(canon)
        except Exception as exc:
            logger.warning(f"Skipping record due to parse error: {exc}")

    validated_records = [flag_quality(r) for r in parsed_records]
    deduped_records = dedupe_by_key(validated_records, keep="highest_priority_then_latest")
    logger.info(f"Parsed {len(parsed_records)} -> {len(deduped_records)} unique records after deduplication.")

    upserted = repo.upsert_records(deduped_records)
    logger.info(f"Successfully migrated {upserted} records into Supabase mandi_prices table.")
    return 0


if __name__ == "__main__":
    migrate_history()
