"""
Climate and ambient temperature/humidity suitability engine.
Architecture_Advisory.md §9b.
"""

import logging
from typing import Literal

from app.data.advisory.reference_repo import get_agronomy_repo
from app.schemas.advisory import ClimateVerdict

logger = logging.getLogger(__name__)

MARGINAL_BAND_C = 3.0  # Within 3°C of boundary is considered marginal rather than unsuitable


def check_climate_suitability(
    crop: str,
    stage_name: str | None = None,
    observed_temp_c: float = 24.0,
    observed_humidity_pct: float | None = None,
    reading_source: Literal["weather_forecast", "iot_live", "manual_input"] = "weather_forecast",
) -> ClimateVerdict:
    """
    Evaluates whether ambient thermal and moisture conditions are suitable for crop development.
    Answers: 'Is the temperature/humidity right for this crop right now?'
    Input can come from weather forecast or IoT live sensor without altering engine logic.
    """
    repo = get_agronomy_repo()
    ref = repo.get_climate_suitability(crop, stage_name)

    temp_ok = ref.ideal_temp_min_c <= observed_temp_c <= ref.ideal_temp_max_c
    margin_c = min(
        observed_temp_c - ref.ideal_temp_min_c,
        ref.ideal_temp_max_c - observed_temp_c,
    )

    if temp_ok:
        verdict: Literal["suitable", "marginal", "unsuitable"] = "suitable"
    elif abs(margin_c) <= MARGINAL_BAND_C:
        verdict = "marginal"
    else:
        verdict = "unsuitable"

    # Contextual guidance
    if verdict == "suitable":
        notes = (
            f"Observed temperature of {observed_temp_c}°C is within the optimum agronomic range "
            f"({ref.ideal_temp_min_c}°C to {ref.ideal_temp_max_c}°C) for {crop}."
        )
    elif verdict == "marginal":
        direction = "below" if observed_temp_c < ref.ideal_temp_min_c else "above"
        notes = (
            f"Observed temperature of {observed_temp_c}°C is marginally {direction} the ideal "
            f"range ({ref.ideal_temp_min_c}°C to {ref.ideal_temp_max_c}°C). Growth rate may be slightly subdued."
        )
    else:
        direction = "below" if observed_temp_c < ref.ideal_temp_min_c else "above"
        notes = (
            f"Observed temperature of {observed_temp_c}°C is significantly {direction} thermal comfort limits "
            f"({ref.ideal_temp_min_c}°C to {ref.ideal_temp_max_c}°C). {ref.notes or 'Take thermal stress mitigation measures.'}"
        )

    ideal_hum_range = (
        (ref.ideal_humidity_min_pct, ref.ideal_humidity_max_pct)
        if ref.ideal_humidity_min_pct is not None and ref.ideal_humidity_max_pct is not None
        else None
    )

    return ClimateVerdict(
        crop=crop,
        stage_name=stage_name,
        verdict=verdict,
        observed_temp_c=round(observed_temp_c, 1),
        observed_humidity_pct=round(observed_humidity_pct, 1) if observed_humidity_pct is not None else None,
        ideal_temp_range=(ref.ideal_temp_min_c, ref.ideal_temp_max_c),
        ideal_humidity_range=ideal_hum_range,
        margin_c=round(margin_c, 1),
        reading_source=reading_source,
        notes=notes,
        source=ref.source,
    )
