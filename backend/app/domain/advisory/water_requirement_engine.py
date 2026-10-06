"""
Water-requirement and irrigation deficit engine.
Architecture_Advisory.md §8.
"""

import logging
from typing import Any

from app.data.advisory.reference_repo import get_agronomy_repo
from app.schemas.advisory import IrrigationAdvice

logger = logging.getLogger(__name__)


def calculate_irrigation_need(
    crop: str,
    stage_name: str,
    weather_summary: dict[str, Any],
) -> IrrigationAdvice:
    """
    Computes crop evapotranspiration (ETc) and 7-day water deficit.
    ETc = Kc * ET0 (Penman-Monteith).
    Inherits weather summary confidence.
    """
    repo = get_agronomy_repo()
    kc_ref = repo.get_kc(crop, stage_name)
    kc = kc_ref.kc

    # Parse weather summary details
    days = weather_summary.get("days", [])
    metrics = weather_summary.get("metrics", {})
    confidence = metrics.get("confidence") or weather_summary.get("current", {}).get("confidence") or "medium"
    if confidence not in ("high", "medium", "low"):
        confidence = "medium"

    etc_today = 0.0
    etc_7d = 0.0
    rain_7d = 0.0

    today_found = False
    for d in days:
        phase = d.get("phase", "")
        et0 = float(d.get("et0_mm") or 0.0)
        rain = float(d.get("rain_mm") or 0.0)

        if phase == "today":
            etc_today = kc * et0
            today_found = True

        if phase in ("past", "today"):
            etc_7d += kc * et0
            rain_7d += rain

    # Fallback if days list structure is different
    if not today_found and days:
        # Use first or middle day
        mid_et0 = float(days[0].get("et0_mm") or 3.5)
        etc_today = kc * mid_et0
        etc_7d = sum(kc * float(d.get("et0_mm") or 3.5) for d in days[:7])
        rain_7d = float(metrics.get("rain_7d_mm") or 0.0)
    elif not days:
        # Safe default if weather days unavailable
        etc_today = kc * 3.5
        etc_7d = kc * 24.5
        rain_7d = float(metrics.get("rain_7d_mm") or 0.0)

    deficit_mm = max(0.0, etc_7d - rain_7d)

    # Contextual recommendation sentence based on calculated numbers
    if deficit_mm >= 15.0:
        rec = (
            f"Crop water demand ({round(etc_7d, 1)} mm) exceeded rainfall ({round(rain_7d, 1)} mm). "
            f"Water deficit is approximately {round(deficit_mm, 1)} mm — apply irrigation of roughly "
            f"{int(round(deficit_mm / 5.0) * 5)} mm."
        )
    elif deficit_mm > 0.0:
        rec = (
            f"Moderate water deficit of {round(deficit_mm, 1)} mm detected. "
            f"Monitor topsoil moisture before initiating light irrigation."
        )
    else:
        rec = (
            f"Recent rainfall ({round(rain_7d, 1)} mm) fully satisfied crop evapotranspiration demand "
            f"({round(etc_7d, 1)} mm). Withhold irrigation to avoid root zone waterlogging."
        )

    return IrrigationAdvice(
        crop=crop,
        stage_name=stage_name,
        kc=round(kc, 2),
        etc_today_mm=round(etc_today, 1),
        etc_7d_mm=round(etc_7d, 1),
        rain_7d_mm=round(rain_7d, 1),
        deficit_mm=round(deficit_mm, 1),
        recommendation=rec,
        confidence=confidence,
        source=kc_ref.source,
    )
