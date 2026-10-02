import argparse
import asyncio
from datetime import timedelta
from pathlib import Path

from app.core.logging import setup_logger
from app.core.timeutil import today_ist
from app.data.mandi.canonical import Canonicalizer, load_tracked_scope
from app.data.mandi.reconcile import dedupe_by_key
from app.data.mandi.repository import MandiRepository
from app.data.mandi.sources.agmarknet_pkg import AgmarknetPkgSource
from app.data.mandi.validate import flag_quality
from app.data.types import MandiRecord

logger = setup_logger("backfill_mandi")


async def run_backfill(days: int = 90, source_name: str = "agmarknet_pkg") -> int:
    today = today_ist()
    start_date = today - timedelta(days=days)
    logger.info(f"Starting mandi backfill for last {days} days ({start_date} to {today}) using {source_name}")

    scope = load_tracked_scope()
    canonicalizer = Canonicalizer(scope)
    repo = MandiRepository()

    run_id = repo.start_ingestion_run(job="backfill_mandi", source=source_name)

    raw_records: list[MandiRecord] = []
    if source_name == "agmarknet_pkg":
        pkg_source = AgmarknetPkgSource()
        raw_records = await pkg_source.fetch(start=start_date, end=today, scope=scope)
    else:
        logger.error(f"Unsupported source for automated backfill: {source_name}. Use load_{source_name}.py")
        repo.finish_ingestion_run(run_id, status="failed", rows_in=0, rows_upserted=0, rows_flagged=0)
        return 1

    logger.info(f"Fetched {len(raw_records)} raw backfill records")

    canonical_records = []
    for r in raw_records:
        canon = canonicalizer.canonicalize(r, strict_crop=True)
        if canon:
            canonical_records.append(canon)

    validated = [flag_quality(r) for r in canonical_records]
    flagged_count = sum(1 for r in validated if r.quality_flag != "ok")
    deduped = dedupe_by_key(validated, keep="highest_priority_then_latest")

    logger.info(f"Deduped to {len(deduped)} records (flagged: {flagged_count})")
    upserted = 0
    if deduped:
        upserted = repo.upsert_records(deduped)

    notes = {
        "days": days,
        "source": source_name,
        "rows_raw": len(raw_records),
        "rows_deduped": len(deduped),
        "rows_upserted": upserted,
        "unmapped_report": canonicalizer.get_unmapped_report(),
    }
    repo.finish_ingestion_run(
        run_id=run_id,
        status="ok",
        rows_in=len(raw_records),
        rows_upserted=upserted,
        rows_flagged=flagged_count,
        notes=notes,
    )

    # Generate coverage report
    generate_coverage_report(repo, scope, days=days)
    return 0


def generate_coverage_report(repo: MandiRepository, scope, days: int = 90):
    report_path = Path(__file__).resolve().parents[2] / "docs" / "data-layer" / "backfill_coverage.md"
    today = today_ist()
    start_90 = today - timedelta(days=90)
    start_30 = today - timedelta(days=30)

    lines = [
        "# Mandi Price History Coverage Report",
        "",
        f"**Generated:** {today}  ",
        f"**Scope:** 6 crops across {len(scope.states)} states  ",
        "",
        "| Crop | State | Priority Market | Days Available (30d) | Coverage (30d) | Days Available (90d) | Coverage (90d) | Status |",
        "|---|---|---|---|---|---|---|---|",
    ]

    low_coverage_markets = []

    for crop in scope.crops:
        for state, markets in scope.priority_markets.items():
            for market in markets:
                rows_30 = repo.get_daily_trend(crop.display, market, state, start_30, today)
                rows_90 = repo.get_daily_trend(crop.display, market, state, start_90, today)

                d30 = len(rows_30)
                d90 = len(rows_90)
                pct30 = round((d30 / 30.0) * 100, 1)
                pct90 = round((d90 / 90.0) * 100, 1)

                status = "✅ Good" if pct30 >= 50 else "⚠️ Low (<50%)"
                if pct30 < 50:
                    low_coverage_markets.append(f"{crop.display} - {market} ({state}): {pct30}% (30d)")

                lines.append(f"| {crop.display} | {state} | {market} | {d30}/30 | {pct30}% | {d90}/90 | {pct90}% | {status} |")

    lines.extend([
        "",
        "## Markets with < 50% Coverage",
        "",
    ])
    if low_coverage_markets:
        for item in low_coverage_markets[:20]:
            lines.append(f"- {item}")
    else:
        lines.append("None — all priority markets meet or exceed 50% coverage.")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"Saved coverage report to {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Backfill mandi price history")
    parser.add_argument("--days", type=int, default=90, help="Number of days to backfill (e.g. 30, 60, 90)")
    parser.add_argument("--source", default="agmarknet_pkg", choices=["agmarknet_pkg", "ceda_csv", "kaggle"], help="Source to backfill from")
    args = parser.parse_args()
    asyncio.run(run_backfill(days=args.days, source_name=args.source))


if __name__ == "__main__":
    main()
