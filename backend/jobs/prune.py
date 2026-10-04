"""
Prune job — retention enforcement and storage budget monitoring.
Architecture §13 / Implementation Plan Phase 5.

Retention rules:
  1. OpenWeather rows in weather_daily > 14 days
  2. weather_daily forecast rows for dates older than 30 days
  3. ingestion_runs > 90 days
  4. Tier A mandi rows > 3 years
  5. Tier B explore mandi rows > 90 days
  6. mandi_watch rows with tracked=false and last_requested_at > 180 days
  7. Alert if total estimated DB storage exceeds 400 MB
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

from app.core.logging import setup_logger
from app.core.timeutil import now_utc_iso, today_ist
from app.data.mandi.canonical import load_tracked_scope
from app.data.mandi.repository import MandiRepository, get_supabase_client
from app.data.ops.service import ESTIMATED_BYTES_PER_ROW

logger = setup_logger("prune")


def prune_openweather_rows(client, retention_days: int = 14) -> int:
    """Delete transient OpenWeather cross-check rows older than retention_days."""
    cutoff = (today_ist() - timedelta(days=retention_days)).isoformat()
    try:
        res = (
            client.table("weather_daily")
            .delete()
            .eq("source", "openweather")
            .lt("date", cutoff)
            .execute()
        )
        count = len(res.data or [])
        logger.info(f"Pruned {count} OpenWeather rows older than {retention_days} days (cutoff: {cutoff})")
        return count
    except Exception as exc:
        logger.warning(f"Could not prune OpenWeather rows: {exc}")
        return 0


def prune_forecast_rows(client, retention_days: int = 30) -> int:
    """Delete past forecast rows older than retention_days (already reconciled/archived)."""
    cutoff = (today_ist() - timedelta(days=retention_days)).isoformat()
    try:
        res = (
            client.table("weather_daily")
            .delete()
            .eq("kind", "forecast")
            .lt("date", cutoff)
            .execute()
        )
        count = len(res.data or [])
        logger.info(f"Pruned {count} expired forecast rows older than {retention_days} days (cutoff: {cutoff})")
        return count
    except Exception as exc:
        logger.warning(f"Could not prune forecast rows: {exc}")
        return 0


def prune_ingestion_runs(client, retention_days: int = 90) -> int:
    """Delete operational ingestion_runs records older than retention_days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
    try:
        res = (
            client.table("ingestion_runs")
            .delete()
            .lt("started_at", cutoff)
            .execute()
        )
        count = len(res.data or [])
        logger.info(f"Pruned {count} ingestion_runs entries older than {retention_days} days")
        return count
    except Exception as exc:
        logger.warning(f"Could not prune ingestion_runs: {exc}")
        return 0


def prune_tier_a_prices(client, retention_years: int = 3) -> int:
    """Delete historic mandi_prices older than retention_years."""
    cutoff = (today_ist() - timedelta(days=retention_years * 365)).isoformat()
    try:
        res = (
            client.table("mandi_prices")
            .delete()
            .lt("arrival_date", cutoff)
            .execute()
        )
        count = len(res.data or [])
        logger.info(f"Pruned {count} Tier A mandi price rows older than {retention_years} years (cutoff: {cutoff})")
        return count
    except Exception as exc:
        logger.warning(f"Could not prune Tier A prices: {exc}")
        return 0


def prune_explore_prices(repo: MandiRepository, retention_days: int = 90) -> int:
    """
    Delete mandi_prices rows older than retention_days for commodities
    NOT in the tracked advisory scope (Tier B explore data).
    """
    scope = load_tracked_scope()
    tracked_commodities = set()
    for crop in scope.crops:
        tracked_commodities.add(crop.display)
        for alias in crop.aliases:
            tracked_commodities.add(alias)

    cutoff = (today_ist() - timedelta(days=retention_days)).isoformat()

    try:
        query = (
            repo.client.table("mandi_prices")
            .select("id")
            .lt("arrival_date", cutoff)
        )

        for commodity in tracked_commodities:
            query = query.neq("commodity", commodity)

        result = query.limit(5000).execute()
        ids = [r["id"] for r in (result.data or [])]

        if not ids:
            logger.info(f"No explore-tier rows older than {retention_days} days to prune")
            return 0

        deleted = 0
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            repo.client.table("mandi_prices").delete().in_("id", chunk).execute()
            deleted += len(chunk)

        logger.info(f"Pruned {deleted} explore-tier mandi_prices rows older than {retention_days} days")
        return deleted

    except Exception as exc:
        logger.error(f"Failed to prune explore prices: {exc}")
        return 0


def prune_stale_watch(repo: MandiRepository, stale_days: int = 180) -> int:
    """
    Delete mandi_watch rows where tracked=false AND last_requested_at > stale_days ago.
    """
    cutoff = (today_ist() - timedelta(days=stale_days)).isoformat()

    try:
        result = (
            repo.client.table("mandi_watch")
            .delete()
            .eq("tracked", False)
            .lt("last_requested_at", cutoff)
            .execute()
        )
        count = len(result.data or [])
        if count > 0:
            logger.info(f"Pruned {count} stale mandi_watch entries (untracked > {stale_days} days)")
        else:
            logger.info("No stale mandi_watch entries to prune")
        return count

    except Exception as exc:
        logger.error(f"Failed to prune stale watch entries: {exc}")
        return 0


def check_storage_budget(client) -> float:
    """
    Compute estimated database footprint in MB and alert if > 400 MB.
    Architecture §13.
    """
    counts = {}
    for table in ESTIMATED_BYTES_PER_ROW.keys():
        try:
            res = client.table(table).select("*", count="exact").limit(0).execute()
            counts[table] = res.count if res.count is not None else 0
        except Exception:
            counts[table] = 0

    total_bytes = sum(counts.get(t, 0) * b for t, b in ESTIMATED_BYTES_PER_ROW.items())
    estimated_mb = round((total_bytes * 1.8) / (1024.0 * 1024.0), 2)
    estimated_mb = max(2.1, estimated_mb)

    logger.info(f"Database storage audit: estimated {estimated_mb} MB in use across application tables.")
    if estimated_mb >= 400.0:
        logger.error(
            f"STORAGE ALERT: Database footprint {estimated_mb} MB exceeds warning budget of 400 MB! "
            "Action required: inspect table sizes and prune historical data."
        )
    else:
        logger.info(f"Storage health OK: {estimated_mb} MB / 400 MB warning budget (500 MB hard cap).")

    return estimated_mb


def run_prune(
    retention_explore_days: int = 90,
    stale_watch_days: int = 180,
    weather_openweather_days: int = 14,
    weather_forecast_days: int = 30,
    ingestion_runs_days: int = 90,
    tier_a_years: int = 3,
) -> int:
    """Run the complete retention and storage maintenance cycle."""
    logger.info("Starting scheduled prune and retention maintenance...")
    repo = MandiRepository()
    sb = get_supabase_client()

    run_id = None
    try:
        run_res = sb.table("ingestion_runs").insert({
            "job": "prune",
            "source": "retention_policy",
            "status": "running",
            "started_at": now_utc_iso(),
        }).execute()
        if run_res.data:
            run_id = run_res.data[0].get("id")
    except Exception as exc:
        logger.warning(f"Could not write ingestion_runs start for prune: {exc}")

    ow_pruned = prune_openweather_rows(sb, weather_openweather_days)
    fc_pruned = prune_forecast_rows(sb, weather_forecast_days)
    runs_pruned = prune_ingestion_runs(sb, ingestion_runs_days)
    tier_a_pruned = prune_tier_a_prices(sb, tier_a_years)
    explore_pruned = prune_explore_prices(repo, retention_explore_days)
    watch_pruned = prune_stale_watch(repo, stale_watch_days)

    total_pruned = ow_pruned + fc_pruned + runs_pruned + tier_a_pruned + explore_pruned + watch_pruned
    db_size_mb = check_storage_budget(sb)

    logger.info(
        f"Prune cycle complete. Total records removed: {total_pruned} "
        f"(OpenWeather: {ow_pruned}, Expired Forecasts: {fc_pruned}, Runs: {runs_pruned}, "
        f"Tier A: {tier_a_pruned}, Tier B: {explore_pruned}, Stale Watch: {watch_pruned}). "
        f"Current DB footprint: {db_size_mb} MB."
    )

    if run_id:
        try:
            sb.table("ingestion_runs").update({
                "status": "ok",
                "finished_at": now_utc_iso(),
                "rows_upserted": total_pruned,
                "notes": {
                    "total_pruned": total_pruned,
                    "db_size_mb": db_size_mb,
                    "breakdown": {
                        "openweather": ow_pruned,
                        "forecast": fc_pruned,
                        "runs": runs_pruned,
                        "tier_a": tier_a_pruned,
                        "tier_b": explore_pruned,
                        "stale_watch": watch_pruned,
                    },
                },
            }).eq("id", run_id).execute()
        except Exception as exc:
            logger.warning(f"Could not finish ingestion_runs for prune: {exc}")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Prune old data and enforce retention policies")
    parser.add_argument("--explore-days", type=int, default=90, help="Retention for explore mandi rows (default: 90)")
    parser.add_argument("--watch-days", type=int, default=180, help="Retention for untracked watch entries (default: 180)")
    parser.add_argument("--ow-days", type=int, default=14, help="Retention for OpenWeather rows (default: 14)")
    parser.add_argument("--forecast-days", type=int, default=30, help="Retention for old forecast rows (default: 30)")
    parser.add_argument("--runs-days", type=int, default=90, help="Retention for ingestion_runs (default: 90)")
    parser.add_argument("--tier-a-years", type=int, default=3, help="Retention for Tier A prices (default: 3)")
    args = parser.parse_args()

    exit_code = run_prune(
        retention_explore_days=args.explore_days,
        stale_watch_days=args.watch_days,
        weather_openweather_days=args.ow_days,
        weather_forecast_days=args.forecast_days,
        ingestion_runs_days=args.runs_days,
        tier_a_years=args.tier_a_years,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
