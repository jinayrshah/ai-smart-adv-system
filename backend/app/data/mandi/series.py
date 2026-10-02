from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any

from app.core.timeutil import now_ist, now_utc_iso, today_ist
from app.data.mandi.repository import MandiRepository
from app.schemas.market import CoverageStats, DateRange, MarketTrendResponse, TrendPoint


def generate_date_spine(start_date: date, end_date: date) -> list[date]:
    """Emit an unbroken sequence of calendar dates from start_date to end_date."""
    dates = []
    curr = start_date
    while curr <= end_date:
        dates.append(curr)
        curr += timedelta(days=1)
    return dates


def is_stale_data(newest_date: date | None) -> bool:
    """
    Check if the latest available data point is stale.
    stale=true if the newest data point is older than 36h on a weekday.
    """
    if not newest_date:
        return True

    now = now_ist()
    # If today is Monday-Friday (weekday < 5)
    if now.weekday() < 5:
        cutoff = (now - timedelta(hours=36)).date()
        return newest_date < cutoff

    # On weekends, allow until Friday's date
    cutoff = (now - timedelta(days=now.weekday() - 4, hours=36)).date()
    return newest_date < cutoff


def build_market_trend(
    repo: MandiRepository,
    commodity: str,
    market: str,
    state: str,
    days: int = 30,
) -> MarketTrendResponse:
    """
    Build a complete date-spine market trend for the requested commodity, market, and state.
    Missing dates within the window are explicitly populated with nulls and recorded as gaps.
    """
    if days not in (7, 30, 90, 180):
        days = 30

    today = today_ist()
    start_date = today - timedelta(days=days - 1)

    # 1. Fetch aggregated daily rows from v_mandi_daily
    db_rows = repo.get_daily_trend(commodity, market, state, start_date, today)

    # Map db rows by date string YYYY-MM-DD
    rows_by_date: dict[str, dict[str, Any]] = {}
    for r in db_rows:
        d_str = str(r["arrival_date"])
        rows_by_date[d_str] = r

    # 2. Fetch raw sources mix for this scope to populate source breakdown
    raw_query = (
        repo.client.table("mandi_prices")
        .select("source")
        .eq("commodity", commodity)
        .eq("market", market)
        .eq("state", state)
        .gte("arrival_date", start_date.isoformat())
        .lte("arrival_date", today.isoformat())
        .execute()
    )
    source_counts = Counter(r["source"] for r in (raw_query.data or []))

    # 3. Generate unbroken date spine
    spine = generate_date_spine(start_date, today)
    points: list[TrendPoint] = []
    gaps: list[str] = []
    newest_available_date: date | None = None

    for d in spine:
        d_str = d.isoformat()
        if d_str in rows_by_date:
            row = rows_by_date[d_str]
            newest_available_date = d
            points.append(
                TrendPoint(
                    date=d_str,
                    modal=float(row["modal_price"]) if row.get("modal_price") is not None else None,
                    min=float(row["min_price"]) if row.get("min_price") is not None else None,
                    max=float(row["max_price"]) if row.get("max_price") is not None else None,
                    n_varieties=int(row.get("n_varieties", 1)),
                )
            )
        else:
            gaps.append(d_str)
            points.append(
                TrendPoint(
                    date=d_str,
                    modal=None,
                    min=None,
                    max=None,
                    n_varieties=0,
                )
            )

    coverage = CoverageStats(
        expected_days=len(spine),
        days_with_data=len(db_rows),
        gaps=gaps,
    )

    return MarketTrendResponse(
        commodity=commodity,
        market=market,
        state=state,
        unit="Rs/Quintal",
        range=DateRange(from_date=start_date.isoformat(), to_date=today.isoformat()),
        coverage=coverage,
        sources=dict(source_counts),
        as_of=now_utc_iso(),
        stale=is_stale_data(newest_available_date),
        points=points,
    )
