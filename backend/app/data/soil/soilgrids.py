"""
Soil estimate for a point from ISRIC SoilGrids v2.0 (250 m global soil model, free, no key).

Used when the farmer has no Soil Health Card: pH, texture fractions and organic carbon for
the top 15 cm. These are modelled estimates, labelled as such wherever they are shown.
https://rest.isric.org/soilgrids/v2.0/docs
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.data.locations.grid import snap_to_grid

logger = logging.getLogger(__name__)

URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOURCE = "ISRIC SoilGrids v2.0 (250 m modelled estimate, 0-15 cm)"
_cache: dict[str, dict[str, Any]] = {}  # shortcut: per-process cache, fine because soil maps are static


def usda_texture(sand: float, silt: float, clay: float) -> str:
    """USDA soil texture triangle (percentages of the fine earth)."""
    if silt + 1.5 * clay < 15:
        return "Sand"
    if silt + 2 * clay < 30:
        return "Loamy sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "Sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "Loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "Silt loam"
    if silt >= 80 and clay < 12:
        return "Silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "Sandy clay loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "Clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "Silty clay loam"
    if clay >= 35 and sand > 45:
        return "Sandy clay"
    if clay >= 40 and silt >= 40:
        return "Silty clay"
    return "Clay"


# Texture class -> the closest option in the farm setup soil list (None = let the farmer choose).
SOIL_OPTION = {"Loam": "Loamy (दोमट)", "Sandy loam": "Sandy loam (बलुई दोमट)", "Clay loam": "Clay loam (चिकनी दोमट)",
               "Silty clay loam": "Clay loam (चिकनी दोमट)", "Sandy clay loam": "Clay loam (चिकनी दोमट)"}


def parse(data: dict[str, Any]) -> dict[str, Any] | None:
    vals: dict[str, list[float]] = {}
    for layer in (data.get("properties") or {}).get("layers", []):
        factor = (layer.get("unit_measure") or {}).get("d_factor") or 1
        for d in layer.get("depths", []):
            mean = (d.get("values") or {}).get("mean")
            if mean is not None:
                vals.setdefault(layer["name"], []).append(mean / factor)
    if not all(k in vals for k in ("phh2o", "clay", "sand", "silt")):
        return None  # e.g. water, urban or no-data pixel
    avg = {k: round(sum(v) / len(v), 1) for k, v in vals.items()}
    total = avg["clay"] + avg["sand"] + avg["silt"] or 1
    clay, sand, silt = (round(avg[k] * 100 / total, 1) for k in ("clay", "sand", "silt"))
    texture = usda_texture(sand, silt, clay)
    return {
        "ph": avg["phh2o"], "clay_pct": clay, "sand_pct": sand, "silt_pct": silt,
        "organic_carbon_g_per_kg": avg.get("soc"), "texture_class": texture,
        "suggested_soil_type": SOIL_OPTION.get(texture), "depth": "0-15 cm", "source": SOURCE,
    }


def soil_estimate(lat: float, lon: float) -> dict[str, Any] | None:
    key = snap_to_grid(lat, lon, resolution=0.01).grid_key
    if key in _cache:
        return _cache[key]
    params = [("lon", lon), ("lat", lat), ("value", "mean"), ("depth", "0-5cm"), ("depth", "5-15cm"),
              *[("property", p) for p in ("phh2o", "clay", "sand", "silt", "soc")]]
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(URL, params=params)
        r.raise_for_status()
        result = parse(r.json())
    except Exception as exc:
        logger.warning(f"SoilGrids unavailable for {lat},{lon}: {exc}")
        return None
    if result:
        _cache[key] = result
    return result
