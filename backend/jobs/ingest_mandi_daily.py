import asyncio
import sys
import time

from app.core.logging import setup_logger
from app.core.timeutil import today_ist
from app.data.mandi.canonical import Canonicalizer, load_tracked_scope
from app.data.mandi.reconcile import dedupe_by_key
from app.data.mandi.repository import MandiRepository
from app.data.mandi.service import get_watched_pairs
from app.data.mandi.sources.datagov_live import DatagovLiveSource
from app.data.mandi.validate import flag_quality
from app.data.types import MandiRecord

logger = setup_logger("ingest_mandi_daily")


async def run_ingestion() -> int:
    start_time = time.time()
    logger.info("Starting scheduled mandi price ingestion", extra={"job": "ingest_mandi_daily", "status": "started"})

    scope = load_tracked_scope()
    canonicalizer = Canonicalizer(scope)
    source = DatagovLiveSource()
    repo = MandiRepository()

    run_id = repo.start_ingestion_run(job="ingest_mandi_daily", source=source.name)
    current_date = today_ist()

    rows_in = 0
    rows_upserted = 0
    rows_flagged = 0
    status = "ok"

    try:
        # Phase 1: Fetch tracked scope (Tier A advisory crops)
        raw_records = await source.fetch(start=current_date, end=current_date, scope=scope)
        rows_in = len(raw_records)
        logger.info(f"Fetched {rows_in} raw records from data.gov.in (Tier A)", extra={"job": "ingest_mandi_daily", "rows": rows_in})

        # Phase 2B: Also fetch watched pairs (Tier B graduated combos)
        watched_pairs = get_watched_pairs(repo)
        watch_records: list[MandiRecord] = []
        if watched_pairs:
            logger.info(f"Fetching {len(watched_pairs)} mandi_watch tracked pairs (Tier B)")
            seen_pairs: set[tuple[str, str]] = set()
            import httpx
            async with httpx.AsyncClient() as client:
                for pair in watched_pairs:
                    pair_key = (pair["state"], pair["commodity"])
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)
                    try:
                        pair_records = await source.fetch_scope_pair(
                            client=client,
                            state=pair["state"],
                            commodity=pair["commodity"],
                            max_pages=5,  # Limit for Tier B
                        )
                        watch_records.extend(pair_records)
                    except Exception as exc:
                        logger.warning(f"Watch pair fetch failed for {pair_key}: {exc}")

            if watch_records:
                raw_records.extend(watch_records)
                rows_in = len(raw_records)
                logger.info(f"Total records after Tier B: {rows_in}")

        canonical_records: list[MandiRecord] = []
        for r in raw_records:
            # Use strict_crop=False for Tier B records to accept any commodity
            canon = canonicalizer.canonicalize(r, strict_crop=False)
            if canon:
                canonical_records.append(canon)

        validated_records = [flag_quality(r) for r in canonical_records]
        rows_flagged = sum(1 for r in validated_records if r.quality_flag != "ok")

        deduped_records = dedupe_by_key(validated_records, keep="highest_priority_then_latest")
        logger.info(f"{len(deduped_records)} records after validation and deduplication (flagged: {rows_flagged})")

        if deduped_records:
            rows_upserted = repo.upsert_records(deduped_records)
            logger.info(f"Successfully upserted {rows_upserted} rows into mandi_prices")

        repo.run_outlier_flagging(days=7)

        unmapped_report = canonicalizer.get_unmapped_report()
        circuit_broken = getattr(source, "circuit_broken", False)
        status = "partial" if circuit_broken else "ok"
        notes = {
            "unmapped_report": unmapped_report,
            "duration_s": round(time.time() - start_time, 2),
            "rows_raw": rows_in,
            "rows_deduped": len(deduped_records),
            "rows_flagged": rows_flagged,
            "rows_upserted": rows_upserted,
            "circuit_broken": circuit_broken,
        }

        repo.finish_ingestion_run(
            run_id=run_id,
            status=status,
            rows_in=rows_in,
            rows_upserted=rows_upserted,
            rows_flagged=rows_flagged,
            notes=notes,
        )

        logger.info(
            f"Mandi ingestion completed in {notes['duration_s']}s. Upserted: {rows_upserted}",
            extra={"job": "ingest_mandi_daily", "status": "ok", "rows": rows_upserted, "duration_ms": int(notes["duration_s"] * 1000)},
        )
        return 0

    except Exception as exc:
        status = "failed"
        logger.error(f"Mandi daily ingestion failed: {exc}", exc_info=True, extra={"job": "ingest_mandi_daily", "status": "failed"})
        notes = {
            "error": str(exc),
            "duration_s": round(time.time() - start_time, 2),
        }
        repo.finish_ingestion_run(
            run_id=run_id,
            status="failed",
            rows_in=rows_in,
            rows_upserted=rows_upserted,
            rows_flagged=rows_flagged,
            notes=notes,
        )
        return 1


def main():
    exit_code = asyncio.run(run_ingestion())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
