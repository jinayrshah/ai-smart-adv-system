import logging
from datetime import date, timedelta
from typing import Any

from app.core.timeutil import today_ist
from app.data.types import AgroMetrics, FusedDay

logger = logging.getLogger(__name__)

CONFIDENCE_RANK = {"low": 1, "medium": 2, "high": 3}
RANK_TO_CONFIDENCE = {1: "low", 2: "medium", 3: "high"}


def compute_normal_rain_30d(
    end_date: date,
    normals_by_month: dict[int, dict[str, Any]],
) -> float | None:
    """
    Compute expected normal rainfall over the 30-day window ending on end_date,
    prorated by number of days falling in each month.
    """
    if not normals_by_month:
        return None

    total_expected = 0.0
    start_date = end_date - timedelta(days=29)

    curr = start_date
    while curr <= end_date:
        m = curr.month
        norm = normals_by_month.get(m)
        if norm and norm.get("precip_mm_month") is not None:
            # Days in this month
            days_in_month = 31 if m in (1, 3, 5, 7, 8, 10, 12) else (30 if m in (4, 6, 9, 11) else 28)
            daily_norm = float(norm["precip_mm_month"]) / days_in_month
            total_expected += daily_norm
        curr += timedelta(days=1)

    return total_expected if total_expected > 0 else None


def compute_agro_metrics(
    fused_days: list[FusedDay],
    normals: list[dict[str, Any]] | None = None,
    ref_today: date | None = None,
) -> AgroMetrics:
    """
    Compute agricultural weather metrics from fused days and monthly normals.
    Inherits lowest confidence from the 7-day past window (Architecture §9.3 & §15).
    """
    if ref_today is None:
        ref_today = today_ist()

    # Index fused days by date
    days_by_date = {fd.date: fd for fd in fused_days}

    # Index normals by month
    normals_by_month: dict[int, dict[str, Any]] = {}
    if normals:
        for n in normals:
            m = n.get("month")
            if m:
                normals_by_month[int(m)] = n

    # 7-day past window (ref_today - 6 to ref_today)
    past_7d = [ref_today - timedelta(days=i) for i in range(7)]
    past_7d_fused = [days_by_date[d] for d in past_7d if d in days_by_date]

    # 30-day past window (ref_today - 29 to ref_today)
    past_30d = [ref_today - timedelta(days=i) for i in range(30)]
    past_30d_fused = [days_by_date[d] for d in past_30d if d in days_by_date]

    # 1. rain_7d_mm
    rain_7d = sum(fd.precip_mm or 0.0 for fd in past_7d_fused)

    # 2. rain_30d_mm
    rain_30d = sum(fd.precip_mm or 0.0 for fd in past_30d_fused)

    # 3. rain_30d_vs_normal_pct
    expected_normal_30d = compute_normal_rain_30d(ref_today, normals_by_month)
    rain_30d_vs_normal_pct: float | None = None
    if expected_normal_30d and expected_normal_30d > 0:
        rain_30d_vs_normal_pct = round(((rain_30d - expected_normal_30d) / expected_normal_30d) * 100.0, 1)

    # 4. dry_spell_days: consecutive days with precip < 1.0 mm ending today
    dry_spell = 0
    curr = ref_today
    while True:
        fd = days_by_date.get(curr)
        if fd is None:
            break
        precip = fd.precip_mm or 0.0
        if precip < 1.0:
            dry_spell += 1
            curr -= timedelta(days=1)
        else:
            break

    # 5. tmax_7d_anomaly_c: 7d avg tmax minus current month normal tmax
    tmax_vals_7d = [fd.tmax_c for fd in past_7d_fused if fd.tmax_c is not None]
    tmax_7d_anomaly: float | None = None
    if tmax_vals_7d:
        avg_tmax_7d = sum(tmax_vals_7d) / len(tmax_vals_7d)
        curr_month_norm = normals_by_month.get(ref_today.month)
        if curr_month_norm and curr_month_norm.get("tmax_c") is not None:
            tmax_7d_anomaly = round(avg_tmax_7d - float(curr_month_norm["tmax_c"]), 1)

    # 6. et0_7d_mm: sum of et0 over 7 days
    et0_vals_7d = [fd.et0_mm for fd in past_7d_fused if fd.et0_mm is not None]
    et0_7d = round(sum(et0_vals_7d), 1) if et0_vals_7d else None

    # Confidence inheritance: lowest confidence of the days used (Case (f) in §15)
    lowest_rank = 3  # default high
    if not past_7d_fused:
        metrics_confidence = "medium"
    else:
        for fd in past_7d_fused:
            rank = CONFIDENCE_RANK.get(fd.confidence, 2)
            if rank < lowest_rank:
                lowest_rank = rank
        metrics_confidence = RANK_TO_CONFIDENCE.get(lowest_rank, "medium")

    return AgroMetrics(
        rain_7d_mm=round(rain_7d, 1),
        rain_30d_mm=round(rain_30d, 1),
        rain_30d_vs_normal_pct=rain_30d_vs_normal_pct,
        dry_spell_days=dry_spell,
        tmax_7d_anomaly_c=tmax_7d_anomaly,
        et0_7d_mm=et0_7d,
        confidence=metrics_confidence,
    )
