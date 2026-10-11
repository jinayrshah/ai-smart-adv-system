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


THIN_DATA_MIN_REPORTS = 3  # Revisions §2.7: fewer than 3 reports -> table, no line/%


def _median(vals: list[float]) -> float:
    v = sorted(vals)
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2.0


def merge_alias_days(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """
    v_mandi_daily groups by the raw market string, so a market stored under two spellings
    ("APMC Malegaon" and "Malegaon") yields two rows for one day. Merge them: median of the
    modal prices, min of mins, max of maxes, summed variety counts.
    """
    by_date: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        by_date.setdefault(str(r["arrival_date"])[:10], []).append(r)
    merged: dict[str, dict[str, Any]] = {}
    for d, group in by_date.items():
        if len(group) == 1:
            merged[d] = group[0]
            continue
        modals = [float(g["modal_price"]) for g in group if g.get("modal_price") is not None]
        mins = [float(g["min_price"]) for g in group if g.get("min_price") is not None]
        maxs = [float(g["max_price"]) for g in group if g.get("max_price") is not None]
        merged[d] = {
            "arrival_date": d,
            "modal_price": _median(modals) if modals else None,
            "min_price": min(mins) if mins else None,
            "max_price": max(maxs) if maxs else None,
            "n_varieties": sum(int(g.get("n_varieties") or 1) for g in group),
        }
    return merged


def _change_vs(reports: list[tuple[date, float]], latest_d: date, latest_p: float,
               lag_days: int, tolerance_days: int) -> tuple[float | None, str | None]:
    """% change vs the most recent report dated lag..lag+tolerance days before the latest."""
    lo = latest_d - timedelta(days=lag_days + tolerance_days)
    hi = latest_d - timedelta(days=lag_days)
    base = [(d, p) for d, p in reports if lo <= d <= hi and p > 0]
    if not base:
        return None, None
    bd, bp = base[-1]
    return round((latest_p - bp) / bp * 100.0, 1), bd.isoformat()


def build_market_trend(
    repo: MandiRepository,
    commodity: str,
    market: str,
    state: str,
    days: int = 30,
) -> MarketTrendResponse:
    """
    Complete date-spine trend for a commodity/market/state. Missing dates are explicit
    nulls and listed as gaps; alias spellings of the market are merged.
    """
    if days not in (7, 30, 90, 180):
        days = 30

    today = today_ist()
    start_date = today - timedelta(days=days - 1)
    # Look back far enough to find a base report for the 30-day change.
    fetch_start = min(start_date, today - timedelta(days=45))

    db_rows = repo.get_daily_trend(commodity, market, state, fetch_start, today)
    all_days = merge_alias_days(db_rows)
    names_merged = sorted({str(r.get("market")) for r in db_rows if r.get("market")})

    raw_rows = repo.get_raw_rows(commodity, market, state, start_date, today)
    source_counts = Counter(r["source"] for r in raw_rows if r.get("source"))
    varieties_included = sorted({r["variety"] for r in raw_rows if r.get("variety")})

    spine = generate_date_spine(start_date, today)
    points: list[TrendPoint] = []
    gaps: list[str] = []
    for d in spine:
        row = all_days.get(d.isoformat())
        if row and row.get("modal_price") is not None:
            points.append(TrendPoint(
                date=d.isoformat(),
                modal=float(row["modal_price"]),
                min=float(row["min_price"]) if row.get("min_price") is not None else None,
                max=float(row["max_price"]) if row.get("max_price") is not None else None,
                n_varieties=int(row.get("n_varieties") or 1),
            ))
        else:
            gaps.append(d.isoformat())
            points.append(TrendPoint(date=d.isoformat(), modal=None, min=None, max=None, n_varieties=0))

    window_reports = [p for p in points if p.modal is not None]
    coverage = CoverageStats(expected_days=len(spine), days_with_data=len(window_reports), gaps=gaps)

    # Largest gap *between* two reports (leading/trailing days without data are not a
    # gap in the series; they are shown by first_reported_date / staleness instead).
    max_gap_days = 0
    prev: date | None = None
    for p in window_reports:
        d = date.fromisoformat(p.date)
        if prev is not None:
            max_gap_days = max(max_gap_days, (d - prev).days - 1)
        prev = d

    all_reports = sorted(
        (date.fromisoformat(k), float(v["modal_price"]))
        for k, v in all_days.items()
        if v.get("modal_price") is not None
    )
    latest_d = latest_p = None
    ch7 = ch7_base = ch30 = ch30_base = None
    if window_reports:
        latest_d, latest_p = date.fromisoformat(window_reports[-1].date), float(window_reports[-1].modal)
    thin = len(window_reports) < THIN_DATA_MIN_REPORTS
    if latest_d is not None and not thin:
        ch7, ch7_base = _change_vs(all_reports, latest_d, latest_p, 7, 7)
        ch30, ch30_base = _change_vs(all_reports, latest_d, latest_p, 30, 15)

    try:
        first_reported_date = repo.get_first_reported_date(commodity, market, state)
    except Exception:
        first_reported_date = all_reports[0][0].isoformat() if all_reports else None

    return MarketTrendResponse(
        commodity=commodity,
        market=market,
        state=state,
        unit="Rs/Quintal",
        range=DateRange(from_date=start_date.isoformat(), to_date=today.isoformat()),
        coverage=coverage,
        sources=dict(source_counts),
        as_of=now_utc_iso(),
        stale=is_stale_data(latest_d),
        points=points,
        first_reported_date=first_reported_date,
        max_gap_days=max_gap_days,
        varieties_included=varieties_included,
        reports_in_window=len(window_reports),
        thin_data=thin,
        latest_date=latest_d.isoformat() if latest_d else None,
        latest_modal=latest_p,
        change_7d_pct=ch7,
        change_7d_base_date=ch7_base,
        change_30d_pct=ch30,
        change_30d_base_date=ch30_base,
        market_names_merged=names_merged,
    )
