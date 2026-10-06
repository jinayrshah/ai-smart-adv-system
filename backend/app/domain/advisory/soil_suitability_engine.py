"""
Soil suitability and Soil Health Card evaluation engine.
Architecture_Advisory.md §9.
"""

import logging
from typing import Any

from app.data.advisory.reference_repo import get_agronomy_repo
from app.schemas.advisory import SoilFlag

logger = logging.getLogger(__name__)


def check_soil_suitability(
    crop: str,
    soil_type: str | None = None,
    soil_npk: dict[str, Any] | None = None,
) -> list[SoilFlag]:
    """
    Evaluates soil texture and Soil Health Card parameters against crop norms.
    Returns list of SoilFlag. Empty list = compliant / no issues (don't manufacture a non-issue).
    """
    repo = get_agronomy_repo()
    ref = repo.get_soil_suitability(crop)
    flags: list[SoilFlag] = []

    # 1. Soil Texture / Type Check
    if soil_type:
        st_clean = soil_type.lower().strip()
        matched = False
        for ideal in ref.ideal_soil_types:
            # Match English or Hindi keywords (e.g. 'loamy', 'black cotton', 'clay')
            ideal_clean = ideal.lower().strip()
            if any(term in st_clean for term in ideal_clean.replace("(", " ").replace(")", " ").split() if len(term) > 3):
                matched = True
                break
            if ideal_clean in st_clean or st_clean in ideal_clean:
                matched = True
                break

        if not matched:
            flags.append(
                SoilFlag(
                    flag_type="soil_type_mismatch",
                    actual_value=soil_type,
                    expected=ref.ideal_soil_types,
                    notes=ref.notes or f"Crop '{crop}' thrives best in {', '.join(ref.ideal_soil_types)}.",
                    source=ref.source,
                )
            )

    # 2. pH Check
    if soil_npk and soil_npk.get("ph") is not None:
        try:
            ph = float(soil_npk["ph"])
            if not (ref.ideal_ph_min <= ph <= ref.ideal_ph_max):
                condition = "acidic" if ph < ref.ideal_ph_min else "alkaline / saline"
                amendment = "Apply agricultural lime or dolomite." if ph < ref.ideal_ph_min else "Incorporate gypsum and organic farmyard manure (FYM)."
                flags.append(
                    SoilFlag(
                        flag_type="ph_out_of_range",
                        actual_value=ph,
                        expected=[ref.ideal_ph_min, ref.ideal_ph_max],
                        notes=f"Soil pH is {ph} ({condition}). Optimal range is {ref.ideal_ph_min}–{ref.ideal_ph_max}. {amendment}",
                        source=ref.source,
                    )
                )
        except (ValueError, TypeError):
            pass

    # 3. Macro-nutrients (N, P, K) Indian ICAR Soil Health Card Benchmarks
    if soil_npk:
        # Nitrogen (Available N: <140 kg/ha is Low, 140-280 Medium, >280 High)
        n = soil_npk.get("n")
        if n is not None:
            try:
                n_val = float(n)
                if n_val < 140.0:
                    flags.append(
                        SoilFlag(
                            flag_type="low_nitrogen",
                            actual_value=n_val,
                            expected=">= 140 kg/ha",
                            notes="Soil test indicates Low Nitrogen status (<140 kg/ha). Supplement with basal Urea or FYM split doses.",
                            source="DAC&FW Soil Health Card Rating Standards & ICAR",
                        )
                    )
            except (ValueError, TypeError):
                pass

        # Phosphorus (Available P: <10 kg/ha Low, 10-25 Medium, >25 High)
        p = soil_npk.get("p")
        if p is not None:
            try:
                p_val = float(p)
                if p_val < 10.0:
                    flags.append(
                        SoilFlag(
                            flag_type="low_phosphorus",
                            actual_value=p_val,
                            expected=">= 10 kg/ha",
                            notes="Soil test indicates Low Phosphorus (<10 kg/ha). Apply Single Super Phosphate (SSP) or DAP prior to sowing.",
                            source="DAC&FW Soil Health Card Rating Standards & ICAR",
                        )
                    )
            except (ValueError, TypeError):
                pass

        # Potassium (Available K: <110 kg/ha Low, 110-280 Medium, >280 High)
        k = soil_npk.get("k")
        if k is not None:
            try:
                k_val = float(k)
                if k_val < 110.0:
                    flags.append(
                        SoilFlag(
                            flag_type="low_potassium",
                            actual_value=k_val,
                            expected=">= 110 kg/ha",
                            notes="Soil test indicates Low Potassium (<110 kg/ha). Supplement with Muriate of Potash (MOP).",
                            source="DAC&FW Soil Health Card Rating Standards & ICAR",
                        )
                    )
            except (ValueError, TypeError):
                pass

    return flags
