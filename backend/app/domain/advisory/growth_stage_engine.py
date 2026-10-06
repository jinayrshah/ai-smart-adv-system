"""
Growth-stage engine based on cumulative Growing Degree Days (GDD).
Architecture_Advisory.md §7.
"""

from datetime import date
import logging
from typing import Any

from app.data.advisory.reference_repo import get_agronomy_repo
from app.schemas.advisory import CropStageNorm, StageResult

logger = logging.getLogger(__name__)


def current_growth_stage(
    crop: str,
    sowing_date: date,
    weather_history: list[dict[str, Any]] | None = None,
    as_of: date | None = None,
) -> StageResult:
    """
    Computes current crop physiological growth stage using thermal time (GDD).
    Falls back gracefully to calendar days if weather history is incomplete or unavailable.
    Fails loudly with ValueError if crop is not found in crop_stage_norms.
    """
    repo = get_agronomy_repo()
    stages = repo.get_stages(crop)  # sorted by stage_order, raises ValueError if missing
    if not stages:
        raise ValueError(f"No growth stage norms defined for crop '{crop}'.")

    if as_of is None:
        as_of = date.today()

    days_since_sowing = max(0, (as_of - sowing_date).days)
    base_temp = stages[0].gdd_base_c

    # Check if we have complete daily weather history from sowing_date to as_of
    covered_dates: set[date] = set()
    total_gdd = 0.0

    if weather_history:
        for entry in weather_history:
            d_val = entry.get("date")
            if isinstance(d_val, str):
                d_obj = date.fromisoformat(d_val)
            elif isinstance(d_val, date):
                d_obj = d_val
            else:
                continue

            if sowing_date <= d_obj <= as_of:
                tmax = entry.get("tmax_c")
                tmin = entry.get("tmin_c")
                if tmax is not None and tmin is not None:
                    gdd_day = max(0.0, ((float(tmax) + float(tmin)) / 2.0) - base_temp)
                    total_gdd += gdd_day
                    covered_dates.add(d_obj)

    # Required days count
    expected_days_count = (as_of - sowing_date).days + 1
    # Full coverage if at least 80% of days are present and at least 1 day covered
    has_full_weather = (
        len(covered_dates) >= max(1, int(expected_days_count * 0.8))
        if expected_days_count > 0
        else False
    )

    if has_full_weather:
        # Match based on cumulative GDD
        matched_stage: CropStageNorm = stages[-1]
        matched_idx = len(stages) - 1
        for idx, s in enumerate(stages):
            if total_gdd <= s.gdd_cumulative_at_stage_end:
                matched_stage = s
                matched_idx = idx
                break

        next_stage_name = stages[matched_idx + 1].stage_name if matched_idx + 1 < len(stages) else None
        gdd_remaining = (
            max(0.0, matched_stage.gdd_cumulative_at_stage_end - total_gdd)
            if matched_stage != stages[-1]
            else 0.0
        )

        return StageResult(
            crop=matched_stage.crop,
            stage_name=matched_stage.stage_name,
            stage_order=matched_stage.stage_order,
            cumulative_gdd=round(total_gdd, 1),
            days_since_sowing=days_since_sowing,
            method="gdd",
            source=matched_stage.source,
            next_stage_name=next_stage_name,
            gdd_remaining_in_stage=round(gdd_remaining, 1),
        )

    # Calendar day fallback
    matched_stage = stages[-1]
    matched_idx = len(stages) - 1
    for idx, s in enumerate(stages):
        threshold_days = s.typical_days_fallback or 999
        if days_since_sowing <= threshold_days:
            matched_stage = s
            matched_idx = idx
            break

    next_stage_name = stages[matched_idx + 1].stage_name if matched_idx + 1 < len(stages) else None

    # Estimate rough synthetic GDD for display continuity based on stage midpoint
    est_gdd = matched_stage.gdd_cumulative_at_stage_end * 0.75

    return StageResult(
        crop=matched_stage.crop,
        stage_name=matched_stage.stage_name,
        stage_order=matched_stage.stage_order,
        cumulative_gdd=round(est_gdd, 1),
        days_since_sowing=days_since_sowing,
        method="calendar_fallback",
        source=matched_stage.source,
        next_stage_name=next_stage_name,
        gdd_remaining_in_stage=None,
    )
