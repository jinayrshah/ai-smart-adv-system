"""
Prune job — retention enforcement for Tier B (Explore) data.

- 90-day retention for non-advisory-crop mandi_prices rows regardless of watch status.
- Stale untracked mandi_watch rows > 180 days are deleted.

Architecture §9.5 / Implementation Plan Phase 2B.
"""

import argparse
import logging
import sys
from datetime import timedelta

from app.core.logging import setup_logger
from app.core.timeutil import today_ist
from app.data.mandi.canonical import load_tracked_scope
from app.data.mandi.repository import MandiRepository

logger = setup_logger("prune")


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
        # Build query: delete rows where commodity NOT IN tracked AND arrival_date < cutoff
        # Supabase client doesn't support NOT IN directly, so we use neq chaining or RPC
        # Using a workaround: fetch IDs then delete in batches
        query = (
            repo.client.table("mandi_prices")
            .select("id")
            .lt("arrival_date", cutoff)
        )

        # Filter to only non-tracked commodities
        for commodity in tracked_commodities:
            query = query.neq("commodity", commodity)

        result = query.limit(5000).execute()
        ids = [r["id"] for r in (result.data or [])]

        if not ids:
            logger.info(f"No explore-tier rows older than {retention_days} days to prune")
            return 0

        deleted = 0
        # Delete in chunks of 500
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


def run_prune(retention_days: int = 90, stale_days: int = 180) -> int:
    """Run the full prune cycle."""
    logger.info(f"Starting prune job (retention={retention_days}d, stale_watch={stale_days}d)")
    repo = MandiRepository()

    prices_pruned = prune_explore_prices(repo, retention_days)
    watch_pruned = prune_stale_watch(repo, stale_days)

    logger.info(f"Prune complete: {prices_pruned} price rows removed, {watch_pruned} watch entries removed")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Prune old Tier B explore data")
    parser.add_argument("--retention-days", type=int, default=90,
                        help="Retention period for explore-tier price rows (default: 90)")
    parser.add_argument("--stale-days", type=int, default=180,
                        help="Age threshold for removing untracked watch entries (default: 180)")
    args = parser.parse_args()
    exit_code = run_prune(retention_days=args.retention_days, stale_days=args.stale_days)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
