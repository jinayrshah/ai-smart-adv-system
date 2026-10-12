"""
Growth-stage engine based on cumulative Growing Degree Days (GDD).
Architecture_Advisory.md §7.

Daily GDD uses the simple-average method with a horizontal cut-off when the crop
has a documented upper development threshold (e.g. maize 10/30 °C):
    Tmax' = min(Tmax, T_upper);  GDD = max(0, (Tmax' + Tmin)/2 − T_base)
    and GDD = 0 when Tmin > T_upper (vertical cut-off for a day entirely above it).
(UC IPM / Oregon State degree-day calculation methods.)

Missing days: if at least 80 % of the days since sowing have temperatures, each
missing day is filled with the mean daily GDD of the observed days (reported as
`imputed_days`). Summing only observed days — what the first version did —
systematically under-counts thermal time and lags the reported stage.
"""

from datetime import date
import logging
from typing import Any

from app.core.timeutil import today_ist
from app.data.advisory.reference_repo import get_agronomy_repo
from app.schemas.advisory import CropStageNorm, StageResult

logger = logging.getLogger(__name__)

MIN_WEATHER_COVERAGE = 0.80


def daily_gdd(tmax: float, tmin: float, base: float, upper: float | None = None) -> float:
    """Simple-average degree-days with optional horizontal upper cut-off."""
    if upper is not None:
        if tmin > upper:
            return 0.0
        tmax = min(tmax, upper)
    return max(0.0, (tmax + tmin) / 2.0 - base)


def current_growth_stage(
    crop: str,
    sowing_date: date,
    weather_history: list[dict[str, Any]] | None = None,
    as_of: date | None = None,
) -> StageResult:
    """
    Computes current crop physiological growth stage using thermal time (GDD).
    Falls back to calendar days if weather history covers < 80 % of the season.
    Fails loudly with ValueError if crop is not found in crop_stage_norms.
    """
    repo = get_agronomy_repo()
    stages = repo.get_stages(crop)  # sorted by stage_order, raises ValueError if missing
    if not stages:
        raise ValueError(f"No growth stage norms defined for crop '{crop}'.")

    if isinstance(sowing_date, str):
        sowing_date = date.fromisoformat(sowing_date)
    if as_of is None:
        as_of = today_ist()
    elif isinstance(as_of, str):
        as_of = date.fromisoformat(as_of)

    days_since_sowing = max(0, (as_of - sowing_date).days)
    base_temp = stages[0].gdd_base_c
    upper_temp = stages[0].gdd_upper_c

    covered: dict[date, float] = {}
    for entry in weather_history or []:
        d_val = entry.get("date")
        if isinstance(d_val, str):
            d_obj = date.fromisoformat(d_val)
        elif isinstance(d_val, date):
            d_obj = d_val
        else:
            continue
        if not (sowing_date <= d_obj <= as_of):
            continue
        tmax, tmin = entry.get("tmax_c"), entry.get("tmin_c")
        if tmax is None or tmin is None:
            continue
        covered[d_obj] = daily_gdd(float(tmax), float(tmin), base_temp, upper_temp)

    expected_days = (as_of - sowing_date).days + 1
    coverage = (len(covered) / expected_days) if expected_days > 0 else 0.0

    if expected_days > 0 and covered and coverage >= MIN_WEATHER_COVERAGE:
        observed_total = sum(covered.values())
        imputed_days = expected_days - len(covered)
        mean_daily = observed_total / len(covered)
        total_gdd = observed_total + mean_daily * imputed_days

        matched_idx = len(stages) - 1
        for idx, s in enumerate(stages):
            if total_gdd <= s.gdd_cumulative_at_stage_end:
                matched_idx = idx
                break
        matched_stage: CropStageNorm = stages[matched_idx]

        stage_start = stages[matched_idx - 1].gdd_cumulative_at_stage_end if matched_idx > 0 else 0.0
        span = max(1.0, matched_stage.gdd_cumulative_at_stage_end - stage_start)
        progress = min(100.0, max(0.0, (total_gdd - stage_start) / span * 100.0))

        is_last = matched_idx == len(stages) - 1
        next_stage_name = None if is_last else stages[matched_idx + 1].stage_name
        gdd_remaining = 0.0 if is_last else max(0.0, matched_stage.gdd_cumulative_at_stage_end - total_gdd)

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
            weather_coverage_pct=round(coverage * 100.0, 1),
            imputed_days=imputed_days,
            stage_progress_pct=round(progress, 1),
            gdd_upper_c=upper_temp,
        )

    # Calendar-day fallback (weather history incomplete)
    matched_idx = len(stages) - 1
    for idx, s in enumerate(stages):
        threshold_days = s.typical_days_fallback or 999
        if days_since_sowing <= threshold_days:
            matched_idx = idx
            break
    matched_stage = stages[matched_idx]
    next_stage_name = stages[matched_idx + 1].stage_name if matched_idx + 1 < len(stages) else None

    prev_days = (stages[matched_idx - 1].typical_days_fallback or 0) if matched_idx > 0 else 0
    span_days = max(1, (matched_stage.typical_days_fallback or prev_days + 1) - prev_days)
    progress = min(100.0, max(0.0, (days_since_sowing - prev_days) / span_days * 100.0))

    return StageResult(
        crop=matched_stage.crop,
        stage_name=matched_stage.stage_name,
        stage_order=matched_stage.stage_order,
        cumulative_gdd=None,
        days_since_sowing=days_since_sowing,
        method="calendar_fallback",
        source=matched_stage.source,
        next_stage_name=next_stage_name,
        gdd_remaining_in_stage=None,
        weather_coverage_pct=round(coverage * 100.0, 1),
        imputed_days=0,
        stage_progress_pct=round(progress, 1),
        gdd_upper_c=upper_temp,
    )
