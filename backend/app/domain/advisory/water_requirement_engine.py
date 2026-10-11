"""
Water-requirement and irrigation engine.
Architecture_Advisory.md §8.

Two methods, chosen by what data exists:

1. ``fao56_water_balance`` (preferred) — the FAO-56 Chapter 8 daily root-zone
   depletion balance, run from the sowing date:

       Dr,i = Dr,i-1 − Pe,i − I,i + Ks,i·Kc,i·ET0,i          (FAO-56 eq. 85, RO/CR/DP ≈ 0,
                                                               excess drains: 0 ≤ Dr ≤ TAW)
       TAW  = 1000 · (θFC − θWP) · Zr                         (eq. 82, θ from Table 19)
       RAW  = p · TAW,  p = p_table + 0.04·(5 − ETc)          (eq. 83 + Table 22 note)
       Ks   = (TAW − Dr) / ((1 − p)·TAW)  when Dr > RAW       (eq. 84)
       Zr   grows linearly from Zr,ini to Zr,max at the start of mid-season (eq. 8-style)
       Pe   = 0 when daily rain < 0.2·ET0 ("normally entirely evaporated", FAO-56 Ch. 7)

   Irrigation is due when Dr ≥ RAW; the net depth to refill the root zone is Dr and
   the gross depth divides by the field application efficiency of the farm's method.
   Irrigation the farmer has logged is added back into the balance.

2. ``7day_deficit`` — the original ETc(7d) − rain(7d) heuristic, used when the
   season's weather history is too incomplete for a balance, and for paddy (rice is
   grown ponded, so a root-zone depletion balance does not apply).

Nothing is invented: if no ET0 is on file the engine returns ``insufficient_data``
instead of assuming a "typical" ET0.
"""

from __future__ import annotations

from datetime import date, timedelta
import logging
from typing import Any, Iterable

from app.data.advisory.reference_repo import get_agronomy_repo
from app.domain.advisory.growth_stage_engine import daily_gdd
from app.schemas.advisory import IrrigationAdvice

logger = logging.getLogger(__name__)

FAO56_SRC = "FAO Irrigation and Drainage Paper 56 (Allen et al., 1998), Ch. 8 eq. 82-85, Tables 19 & 22"

# FAO-56 Table 19: θFC − θWP (m³/m³) — midpoint of the published range.
# The Indian soil names used by the onboarding form are mapped to the closest USDA
# texture class; the mapping is reported back to the farmer as an assumption.
_AWC_BY_TEXTURE: dict[str, tuple[float, str]] = {
    "sand": (0.08, "Sand"),
    "loamy sand": (0.09, "Loamy sand"),
    "sandy loam": (0.13, "Sandy loam"),
    "loam": (0.155, "Loam"),
    "silt loam": (0.16, "Silt loam"),
    "silty clay loam": (0.155, "Silt clay loam"),
    "clay": (0.16, "Clay"),
}
# keyword in farmer's soil label -> texture class (first match wins; order matters)
_SOIL_KEYWORDS: list[tuple[str, str]] = [
    ("black", "clay"),            # Black cotton soil = Vertisol, clay texture
    ("vertisol", "clay"),
    ("clay loam", "silty clay loam"),
    ("sandy loam", "sandy loam"),
    ("loamy sand", "loamy sand"),
    ("red", "sandy loam"),        # Red soils (Alfisols) are mostly sandy-loam textured
    ("alluvial", "silt loam"),
    ("clay", "clay"),
    ("sand", "sand"),
    ("silt", "silt loam"),
    ("loam", "loam"),
]

ZR_INITIAL_M = 0.15  # FAO-56 Ch. 8: effective rooting depth during the initial period ≈ 0.15-0.20 m

# Field application efficiency by irrigation method (FAO Irrigation Water Management
# Training Manual No. 4, "Irrigation Scheduling": surface 60 %, sprinkler 75 %, drip 90 %).
_APPLICATION_EFFICIENCY: dict[str, float] = {
    "drip": 0.90,
    "sprinkler": 0.75,
    "borewell": 0.60,  # borewell / canal water is applied by surface (flood/furrow) methods
    "canal": 0.60,
    "other": 0.60,
}
EFFICIENCY_SRC = "FAO Irrigation Water Management Training Manual No. 4 (field application efficiency)"

# Product decision rules (not agronomic constants) — disclosed to the farmer in `assumptions`.
RAIN_PROB_TRUST_PCT = 60.0  # forecast rain is only relied on when its probability is ≥ this
MIN_SEASON_COVERAGE = 0.80  # same bar as the GDD engine


# --------------------------------------------------------------------------- helpers
def _to_date(v: Any) -> date | None:
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return date.fromisoformat(v[:10])
        except ValueError:
            return None
    return None


def _f(v: Any) -> float | None:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def soil_water_capacity(soil_type: str | None) -> tuple[float, str, bool]:
    """Return (θFC−θWP m³/m³, texture label, assumed?) for a farmer's soil label."""
    if soil_type:
        s = soil_type.lower()
        for kw, texture in _SOIL_KEYWORDS:
            if kw in s:
                awc, label = _AWC_BY_TEXTURE[texture]
                return awc, label, False
    awc, label = _AWC_BY_TEXTURE["loam"]
    return awc, label, True


def application_efficiency(irrigation_type: str | None) -> float | None:
    if not irrigation_type or irrigation_type == "rainfed":
        return None
    return _APPLICATION_EFFICIENCY.get(irrigation_type, 0.60)


def effective_rain(rain_mm: float, et0_mm: float | None) -> float:
    """FAO-56: daily rain below ~0.2·ET0 is evaporated from the surface and ignored."""
    if rain_mm <= 0:
        return 0.0
    if et0_mm is not None and rain_mm < 0.2 * et0_mm:
        return 0.0
    return rain_mm


def _confidence_of(weather_summary: dict[str, Any]) -> str:
    metrics = weather_summary.get("metrics") or {}
    current = weather_summary.get("current") or {}
    conf = metrics.get("confidence") or current.get("confidence") or "medium"
    return conf if conf in ("high", "medium", "low") else "medium"


_RANK = {"low": 0, "medium": 1, "high": 2}


def _cap(conf: str, ceiling: str) -> str:
    return conf if _RANK[conf] <= _RANK[ceiling] else ceiling


# --------------------------------------------------------------------------- 7-day method
def _seven_day_window(kc: float, weather_summary: dict[str, Any]) -> dict[str, Any]:
    """ETc / rain over the past-7-days + today window of the weather summary."""
    days = weather_summary.get("days") or []
    etc_today = None
    etc_7d = 0.0
    rain_7d = 0.0
    eff_rain_7d = 0.0
    et0_days = 0
    window_days = 0
    for d in days:
        phase = d.get("phase", "")
        if phase not in ("past", "today"):
            continue
        window_days += 1
        et0 = _f(d.get("et0_mm"))
        rain = _f(d.get("precip_mm", d.get("rain_mm"))) or 0.0
        rain_7d += rain
        eff_rain_7d += effective_rain(rain, et0)
        if et0 is not None:
            et0_days += 1
            etc_7d += kc * et0
            if phase == "today":
                etc_today = kc * et0
    return {
        "etc_today": etc_today,
        "etc_7d": etc_7d,
        "rain_7d": rain_7d,
        "eff_rain_7d": eff_rain_7d,
        "et0_days": et0_days,
        "window_days": window_days,
    }


def _forecast(weather_summary: dict[str, Any], horizon: int = 3) -> tuple[float, float | None, list[dict[str, Any]]]:
    future = [d for d in (weather_summary.get("days") or []) if d.get("phase") == "future"]
    future.sort(key=lambda d: str(d.get("date")))
    nxt = future[:horizon]
    rain = sum((_f(d.get("precip_mm")) or 0.0) for d in nxt)
    probs = [_f(d.get("precip_prob_pct")) for d in nxt if _f(d.get("precip_prob_pct")) is not None]
    return rain, (max(probs) if probs else None), future


# --------------------------------------------------------------------------- main entry
def calculate_irrigation_need(
    crop: str,
    stage_name: str,
    weather_summary: dict[str, Any],
    *,
    history_rows: Iterable[dict[str, Any]] | None = None,
    sowing_date: date | str | None = None,
    as_of: date | None = None,
    soil_type: str | None = None,
    irrigation_type: str | None = None,
    irrigation_events: Iterable[dict[str, Any]] | None = None,
) -> IrrigationAdvice:
    repo = get_agronomy_repo()
    kc_ref = repo.get_kc(crop, stage_name)
    kc = float(kc_ref.kc)
    confidence = _confidence_of(weather_summary or {})
    win = _seven_day_window(kc, weather_summary or {})
    fc_rain_3d, fc_prob, future_days = _forecast(weather_summary or {})

    base = dict(
        crop=crop,
        stage_name=stage_name,
        kc=round(kc, 2),
        etc_today_mm=round(win["etc_today"], 1) if win["etc_today"] is not None else 0.0,
        etc_7d_mm=round(win["etc_7d"], 1),
        rain_7d_mm=round(win["rain_7d"], 1),
        effective_rain_7d_mm=round(win["eff_rain_7d"], 1),
        forecast_rain_3d_mm=round(fc_rain_3d, 1) if future_days else None,
        forecast_rain_prob_max_pct=fc_prob,
    )

    params = repo.get_water_params(crop)
    sow = _to_date(sowing_date)
    today = as_of or date.today()
    history = list(history_rows or [])

    if params and sow and history:
        result = _water_balance(
            crop=crop,
            kc_today=kc,
            params=params,
            history=history,
            sowing=sow,
            today=today,
            soil_type=soil_type,
            irrigation_type=irrigation_type,
            irrigation_events=list(irrigation_events or []),
            future_days=future_days,
            fc_rain_3d=fc_rain_3d,
            fc_prob=fc_prob,
            confidence=confidence,
            base=base,
            kc_source=kc_ref.source,
        )
        if result is not None:
            return result

    return _seven_day_advice(crop, base, win, confidence, kc_ref.source, is_paddy=params is None)


def _seven_day_advice(
    crop: str, base: dict[str, Any], win: dict[str, Any], confidence: str, source: str, is_paddy: bool
) -> IrrigationAdvice:
    if win["et0_days"] == 0:
        return IrrigationAdvice(
            **base,
            deficit_mm=0.0,
            recommendation=(
                "Not enough recent weather data (reference evapotranspiration) is on file for this "
                "location to estimate crop water use. Check soil moisture by hand before irrigating."
            ),
            confidence="low",
            source=source,
            method="insufficient_data",
            data_available=False,
            action="unknown",
            assumptions=["No ET0 values were available for the last 7 days."],
        )

    etc_7d, eff_rain = win["etc_7d"], win["eff_rain_7d"]
    deficit = max(0.0, etc_7d - eff_rain)
    assumptions = []
    if win["et0_days"] < win["window_days"]:
        assumptions.append(f"ET0 was on file for {win['et0_days']} of {win['window_days']} recent days; "
                           "missing days are not counted, so demand may be under-estimated.")
        confidence = _cap(confidence, "medium")
    if is_paddy:
        assumptions.append("Rice is grown ponded, so the root-zone balance is not used; "
                           "keep the standing-water depth recommended for the current stage.")

    if deficit >= 15.0:
        action = "irrigate_now"
        rec = (f"Crop water use over the last 7 days ({round(etc_7d, 1)} mm) exceeded effective rainfall "
               f"({round(eff_rain, 1)} mm) by about {round(deficit, 1)} mm. Irrigation is advised.")
    elif deficit > 0.0:
        action = "monitor"
        rec = (f"A small water deficit of {round(deficit, 1)} mm built up over the last 7 days. "
               "Check topsoil moisture before irrigating.")
    else:
        action = "no_irrigation_needed"
        rec = (f"Effective rainfall ({round(eff_rain, 1)} mm) covered crop water use ({round(etc_7d, 1)} mm) "
               "over the last 7 days. Irrigation is not needed now.")

    return IrrigationAdvice(
        **base,
        deficit_mm=round(deficit, 1),
        recommendation=rec,
        confidence=confidence,
        source=source,
        method="7day_deficit",
        data_available=True,
        action=action,
        assumptions=assumptions,
    )


def _water_balance(
    *,
    crop: str,
    kc_today: float,
    params: dict[str, Any],
    history: list[dict[str, Any]],
    sowing: date,
    today: date,
    soil_type: str | None,
    irrigation_type: str | None,
    irrigation_events: list[dict[str, Any]],
    future_days: list[dict[str, Any]],
    fc_rain_3d: float,
    fc_prob: float | None,
    confidence: str,
    base: dict[str, Any],
    kc_source: str,
) -> IrrigationAdvice | None:
    repo = get_agronomy_repo()
    try:
        stages = repo.get_stages(crop)
        stage_kc = [float(repo.get_kc(crop, s.stage_name).kc) for s in stages]
    except Exception as exc:  # reference data incomplete -> caller falls back
        logger.debug(f"Water balance unavailable for {crop}: {exc}")
        return None

    by_date: dict[date, dict[str, Any]] = {}
    for r in history:
        d = _to_date(r.get("date"))
        if d and sowing <= d <= today:
            by_date[d] = r

    n_days = (today - sowing).days + 1
    if n_days <= 0:
        return None
    et0_known = [x for x in (_f(r.get("et0_mm")) for r in by_date.values()) if x is not None]
    coverage = len(et0_known) / n_days
    if coverage < MIN_SEASON_COVERAGE or not et0_known:
        return None
    mean_et0 = sum(et0_known) / len(et0_known)

    # Stage index per day: thermal time when temperatures exist, else calendar norms.
    base_t = stages[0].gdd_base_c
    upper_t = stages[0].gdd_upper_c
    temps = [(_f(r.get("tmax_c")), _f(r.get("tmin_c"))) for r in by_date.values()]
    observed_gdd = [daily_gdd(tx, tn, base_t, upper_t) for tx, tn in temps if tx is not None and tn is not None]
    mean_gdd = (sum(observed_gdd) / len(observed_gdd)) if observed_gdd else None

    # Day of season at which Kc first reaches its maximum = start of mid-season,
    # where FAO-56 lets roots reach their maximum depth.
    peak_idx = stage_kc.index(max(stage_kc))
    peak_start_days = (stages[peak_idx - 1].typical_days_fallback or 0) if peak_idx > 0 else 0
    peak_start_gdd = stages[peak_idx - 1].gdd_cumulative_at_stage_end if peak_idx > 0 else 0.0

    zr_max = float(params["root_depth_min_m"])  # FAO-56: lower end of the Table 22 range for scheduling
    p_table = float(params["depletion_fraction_p"])
    awc, texture, soil_assumed = soil_water_capacity(soil_type)
    eff = application_efficiency(irrigation_type)

    irr_by_date: dict[date, float] = {}
    for ev in irrigation_events:
        d = _to_date(ev.get("date") or ev.get("irrigated_on"))
        amt = _f(ev.get("amount_mm"))
        if d and amt and amt > 0 and sowing <= d <= today:
            irr_by_date[d] = irr_by_date.get(d, 0.0) + amt * (eff or 0.6)

    dr = 0.0  # assumption: root zone at field capacity at sowing
    cum_gdd = 0.0
    imputed_et0 = 0
    taw = raw = 0.0
    zr = ZR_INITIAL_M
    etc_last = kc_today * mean_et0
    for i in range(n_days):
        d = sowing + timedelta(days=i)
        r = by_date.get(d, {})
        tmax, tmin = _f(r.get("tmax_c")), _f(r.get("tmin_c"))
        g = daily_gdd(tmax, tmin, base_t, upper_t) if tmax is not None and tmin is not None else (mean_gdd or 0.0)
        cum_gdd += g

        if mean_gdd is not None:
            idx = next((k for k, s in enumerate(stages) if cum_gdd <= s.gdd_cumulative_at_stage_end), len(stages) - 1)
            frac = min(1.0, cum_gdd / peak_start_gdd) if peak_start_gdd > 0 else 1.0
        else:
            idx = next((k for k, s in enumerate(stages) if i <= (s.typical_days_fallback or 999)), len(stages) - 1)
            frac = min(1.0, i / peak_start_days) if peak_start_days > 0 else 1.0
        kc_d = stage_kc[idx]
        zr = ZR_INITIAL_M + (max(zr_max, ZR_INITIAL_M) - ZR_INITIAL_M) * frac
        taw = 1000.0 * awc * zr

        et0 = _f(r.get("et0_mm"))
        if et0 is None:
            et0 = mean_et0
            imputed_et0 += 1
        etc = kc_d * et0
        p = min(0.8, max(0.1, p_table + 0.04 * (5.0 - etc)))
        raw = p * taw
        ks = 1.0 if dr <= raw else max(0.0, (taw - dr) / ((1.0 - p) * taw))
        rain = _f(r.get("precip_mm", r.get("rain_mm"))) or 0.0
        dr = dr - effective_rain(rain, et0) - irr_by_date.get(d, 0.0) + ks * etc
        dr = min(taw, max(0.0, dr))
        etc_last = etc

    # Project forward: days until Dr reaches RAW with no rain (worst case).
    days_to_stress: int | None = 0 if dr >= raw else None
    if days_to_stress is None:
        proj = dr
        fut = sorted(future_days, key=lambda x: str(x.get("date")))
        for j in range(14):
            et0_f = _f(fut[j].get("et0_mm")) if j < len(fut) else None
            proj += kc_today * (et0_f if et0_f is not None else mean_et0)
            if proj >= raw:
                days_to_stress = j + 1
                break

    assumptions = [
        f"Soil water held between field capacity and wilting point taken as {round(awc * 1000)} mm per metre "
        f"({texture}, FAO-56 Table 19)" + (" — soil type not given, loam assumed." if soil_assumed else "."),
        f"Effective root depth grows from {ZR_INITIAL_M} m to {zr_max} m by mid-season (FAO-56 Table 22).",
        "Soil assumed at field capacity on the sowing date.",
    ]
    if imputed_et0:
        assumptions.append(f"ET0 missing for {imputed_et0} of {n_days} days since sowing; the season mean was used.")
    if not irr_by_date and eff is not None:
        assumptions.append("No irrigation has been logged since sowing — log each irrigation so the balance stays accurate.")
        confidence = _cap(confidence, "medium")
    if soil_assumed:
        confidence = _cap(confidence, "medium")
    if imputed_et0 > 0.2 * n_days:
        confidence = "low"

    net = round(dr, 1)
    gross = round(dr / eff, 1) if eff else None
    trust_rain = fc_prob is not None and fc_prob >= RAIN_PROB_TRUST_PCT
    if future_days:
        assumptions.append(f"Forecast rain is relied on only when its probability is at least {int(RAIN_PROB_TRUST_PCT)} %.")

    if eff is None:  # rainfed
        action = "monitor"
        state = "below" if dr >= raw else "within"
        rec = (f"Rainfed field: the root zone has lost about {net} mm of {round(taw)} mm available water; "
               f"soil moisture is {state} the comfortable range for {crop.lower()} (stress starts at {round(raw)} mm).")
    elif dr >= raw:
        if trust_rain and fc_rain_3d >= dr:
            action = "wait_for_rain"
            rec = (f"The root zone has lost about {net} mm of water, past the {round(raw)} mm stress point, but "
                   f"{round(fc_rain_3d, 1)} mm of rain is forecast over the next 3 days. Wait for the rain, then re-check.")
        else:
            action = "irrigate_now"
            rec = (f"Irrigate now: the root zone has lost about {net} mm of water, past the {round(raw)} mm point "
                   f"where {crop.lower()} starts to suffer stress. Apply about {net} mm net"
                   + (f" (about {gross} mm at the field with {irrigation_type} irrigation)." if gross else "."))
    elif days_to_stress is not None and days_to_stress <= 3:
        action = "monitor"
        rec = (f"Soil water is adequate today ({net} mm used of {round(raw)} mm readily available), but without rain "
               f"the crop reaches stress in about {days_to_stress} day(s). Plan irrigation.")
    else:
        action = "no_irrigation_needed"
        rec = (f"No irrigation needed: the root zone has used {net} mm of the {round(raw)} mm the crop can draw "
               "without stress.")

    return IrrigationAdvice(
        **base,
        deficit_mm=round(max(0.0, base["etc_7d_mm"] - base["effective_rain_7d_mm"]), 1),
        recommendation=rec,
        confidence=confidence,
        source=f"{kc_source}; {FAO56_SRC}" + (f"; {EFFICIENCY_SRC}" if eff else ""),
        method="fao56_water_balance",
        data_available=True,
        root_zone_depletion_mm=net,
        taw_mm=round(taw, 1),
        raw_mm=round(raw, 1),
        root_depth_m=round(zr, 2),
        days_to_stress=days_to_stress,
        net_irrigation_mm=net if action == "irrigate_now" else None,
        gross_irrigation_mm=gross if action == "irrigate_now" else None,
        action=action,
        assumptions=assumptions,
    )
