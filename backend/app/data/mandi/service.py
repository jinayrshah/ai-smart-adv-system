"""
Mandi Explore service — live-lookup-on-miss via datagov_live,
watch-list upsert, and LRU eviction at MANDI_WATCH_MAX_TRACKED.

Architecture §9.5 / Implementation Plan Phase 2B.
"""

import logging
from datetime import date, datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.timeutil import today_ist
from app.data.mandi.canonical import Canonicalizer, load_tracked_scope
from app.data.mandi.reconcile import dedupe_by_key
from app.data.mandi.repository import MandiRepository
from app.data.mandi.sources.datagov_live import DatagovLiveSource
from app.data.mandi.validate import flag_quality
from app.data.types import MandiRecord

logger = logging.getLogger(__name__)


def _is_tracked_scope(commodity: str, state: str, market: str) -> bool:
    """Check if a commodity/state/market combo is in the tracked scope (Tier A)."""
    scope = load_tracked_scope()
    commodity_lower = commodity.strip().lower()
    state_clean = state.strip()

    # Check commodity is in tracked crops
    is_tracked_crop = False
    for crop in scope.crops:
        if crop.display.lower() == commodity_lower:
            is_tracked_crop = True
            break
        if any(a.lower() == commodity_lower for a in crop.aliases):
            is_tracked_crop = True
            break

    if not is_tracked_crop:
        return False

    # Check state is in tracked states
    if state_clean not in scope.states:
        return False

    return True


def get_market_search(
    repo: MandiRepository,
    commodity: str,
    state: str,
    market: str = "",
    district: str = "",
) -> dict[str, Any]:
    """
    Search for any crop/market in India. Returns today's price and short trend.

    Strategy:
    1. Check mandi_prices for existing data (fast path).
    2. If no data today, do a live lookup via datagov_live and upsert.
    3. Record the search in mandi_watch for future daily ingestion.
    4. Enforce LRU eviction if watch list exceeds cap.
    """
    settings = get_settings()
    today = today_ist()
    is_tracked = _is_tracked_scope(commodity, state, market)

    # 1. Check existing data (last 7 days for short trend)
    existing = repo.get_latest_prices(
        commodity=commodity,
        state=state,
        market=market if market else None,
        limit=30,
    )

    has_today = any(
        str(r.get("arrival_date", "")) == today.isoformat()
        for r in existing
    )

    # 2. If no data today and it's an untracked combo, do a live lookup
    if not has_today and not is_tracked:
        try:
            live_records = _live_lookup(commodity, state, market)
            if live_records:
                upserted = repo.upsert_records(live_records)
                logger.info(
                    f"Live lookup for {commodity}/{state}/{market}: "
                    f"fetched {len(live_records)}, upserted {upserted}"
                )
                # Re-fetch after upsert
                existing = repo.get_latest_prices(
                    commodity=commodity,
                    state=state,
                    market=market if market else None,
                    limit=30,
                )
        except Exception as exc:
            logger.warning(f"Live lookup failed for {commodity}/{state}/{market}: {exc}")

    # 3. Update mandi_watch
    if not is_tracked:
        _upsert_watch(repo, commodity, state, district, market)
        _enforce_lru_cap(repo, settings.MANDI_WATCH_MAX_TRACKED)

    # 4. Build response
    tier = "advisory" if is_tracked else "explore"
    history_available = len(existing) > 7

    # Group by market for structured response
    markets_seen: dict[str, dict[str, Any]] = {}
    for r in existing:
        mkt = r.get("market", "")
        if mkt not in markets_seen:
            markets_seen[mkt] = {
                "market": mkt,
                "district": r.get("district", ""),
                "state": r.get("state", state),
                "latest_date": r.get("arrival_date"),
                "latest_modal": r.get("modal_price"),
                "latest_min": r.get("min_price"),
                "latest_max": r.get("max_price"),
                "variety": r.get("variety", ""),
                "source": r.get("source", ""),
                "records_available": 0,
            }
        markets_seen[mkt]["records_available"] += 1

    return {
        "commodity": commodity,
        "state": state,
        "market_filter": market,
        "tier": tier,
        "history_available": history_available,
        "markets": list(markets_seen.values()),
        "total_records": len(existing),
    }


def _live_lookup(commodity: str, state: str, market: str) -> list[MandiRecord]:
    """Synchronous live lookup via datagov_live for today's price."""
    import asyncio

    source = DatagovLiveSource()
    scope = load_tracked_scope()
    canonicalizer = Canonicalizer(scope)

    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # We're inside an active async event loop, run in a separate thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                raw = pool.submit(
                    asyncio.run,
                    source.fetch_today(state=state, commodity=commodity, market=market or None)
                ).result(timeout=15)
        else:
            raw = asyncio.run(
                source.fetch_today(state=state, commodity=commodity, market=market or None)
            )
    except Exception as exc:
        logger.warning(f"Live lookup async error: {exc}")
        return []

    # Canonicalize with strict_crop=False (Tier B allows any commodity)
    validated: list[MandiRecord] = []
    for r in raw:
        canon = canonicalizer.canonicalize(r, strict_crop=False)
        if canon:
            flagged = flag_quality(canon)
            if flagged.quality_flag == "ok":
                validated.append(flagged)

    return dedupe_by_key(validated, keep="highest_priority_then_latest")


def _upsert_watch(
    repo: MandiRepository,
    commodity: str,
    state: str,
    district: str,
    market: str,
) -> None:
    """Insert or update a mandi_watch entry for this search pair."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        existing = (
            repo.client.table("mandi_watch")
            .select("id, request_count")
            .eq("state", state)
            .eq("district", district or "")
            .eq("market", market or "")
            .eq("commodity", commodity)
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            row_id = existing.data[0]["id"]
            current_count = existing.data[0].get("request_count", 1) or 1
            repo.client.table("mandi_watch").update({
                "last_requested_at": now,
                "request_count": current_count + 1,
                "tracked": True,
            }).eq("id", row_id).execute()
        else:
            repo.client.table("mandi_watch").insert({
                "state": state,
                "district": district or "",
                "market": market or "",
                "commodity": commodity,
                "first_requested_at": now,
                "last_requested_at": now,
                "request_count": 1,
                "tracked": True,
            }).execute()
    except Exception as exc:
        logger.warning(f"Failed to upsert mandi_watch: {exc}")


def _enforce_lru_cap(repo: MandiRepository, max_tracked: int) -> None:
    """
    If mandi_watch has more than max_tracked active entries,
    flip the least-recently-requested ones to tracked=false.
    """
    try:
        # Count currently tracked
        count_res = (
            repo.client.table("mandi_watch")
            .select("id", count="exact")
            .eq("tracked", True)
            .execute()
        )
        total = count_res.count or 0

        if total <= max_tracked:
            return

        excess = total - max_tracked
        logger.info(f"mandi_watch LRU eviction: {total} tracked, cap={max_tracked}, evicting {excess}")

        # Get the oldest-requested tracked entries
        oldest = (
            repo.client.table("mandi_watch")
            .select("id")
            .eq("tracked", True)
            .order("last_requested_at", desc=False)
            .limit(excess)
            .execute()
        )

        if oldest.data:
            ids_to_evict = [row["id"] for row in oldest.data]
            repo.client.table("mandi_watch").update(
                {"tracked": False}
            ).in_("id", ids_to_evict).execute()
            logger.info(f"Evicted {len(ids_to_evict)} entries from mandi_watch")

    except Exception as exc:
        logger.warning(f"LRU eviction failed: {exc}")


def get_watched_pairs(repo: MandiRepository) -> list[dict[str, str]]:
    """
    Return all tracked mandi_watch pairs for inclusion in the daily ingestion scope.
    Used by ingest_mandi_daily to extend beyond the tracked_scope.yaml.
    """
    try:
        res = (
            repo.client.table("mandi_watch")
            .select("state,district,market,commodity")
            .eq("tracked", True)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.warning(f"Failed to read mandi_watch: {exc}")
        return []
