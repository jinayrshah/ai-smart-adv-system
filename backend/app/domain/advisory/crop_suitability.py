"""
Which crops suit a field: climate normals x crop references x soil x irrigation, per season.

Inputs are the farm's coordinates (plus soil, pH and irrigation when known). For every
supported crop and every season it is normally sown in, the 15-year monthly normals for
that grid are compared with the crop's reference ranges. Each check reports what it used;
a check without data is reported as "unknown", never guessed.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from app.data.advisory.reference_repo import get_agronomy_repo
from app.data.locations.grid import snap_to_grid

logger = logging.getLogger(__name__)

Verdict = Literal["suitable", "marginal", "unsuitable", "unknown"]
_RANK = {"suitable": 0, "unknown": 1, "marginal": 2, "unsuitable": 3}

# Growing-window months per season (sowing to harvest, broad national calendar).
SEASON_MONTHS = {"kharif": [6, 7, 8, 9, 10], "rabi": [11, 12, 1, 2, 3], "zaid": [3, 4, 5, 6]}
SEASON_LABEL = {"kharif": "Kharif (monsoon)", "rabi": "Rabi (winter)", "zaid": "Zaid (summer)"}
TEMP_MARGIN_C = 3.0  # within this of the ideal band = marginal, beyond = unsuitable


def _season_climate(normals: list[dict[str, Any]], season: str) -> dict[str, float] | None:
    rows = {int(r["month"]): r for r in normals}
    months = [rows[m] for m in SEASON_MONTHS[season] if m in rows]
    temps = [(r["tmax_c"] + r["tmin_c"]) / 2 for r in months if r.get("tmax_c") is not None and r.get("tmin_c") is not None]
    rain = [r["precip_mm_month"] for r in months if r.get("precip_mm_month") is not None]
    if len(temps) < len(SEASON_MONTHS[season]) or len(rain) < len(SEASON_MONTHS[season]):
        return None
    return {"mean_temp_c": round(sum(temps) / len(temps), 1), "rain_mm": round(sum(rain))}


def _soil_matches(farm_soil: str, ideal: list[str]) -> bool:
    # "Black (काली)" vs "Black Cotton (काली मिट्टी)": compare the English head word.
    head = farm_soil.split("(")[0].strip().lower().split()[0] if farm_soil.strip() else ""
    return bool(head) and any(head in s.lower() for s in ideal)


def assess(
    normals: list[dict[str, Any]],
    soil_type: str | None = None,
    soil_ph: float | None = None,
    irrigation: str | None = None,
    season: str | None = None,
) -> list[dict[str, Any]]:
    """Pure function: one row per (crop, season), best first. Easy to test without I/O."""
    repo = get_agronomy_repo()
    irrigated = irrigation not in (None, "", "rainfed")
    rows: list[dict[str, Any]] = []
    for crop in repo.get_supported_crops():
        ref = repo._fixture_data.get(crop, {})
        seasons = (ref.get("seasons") or {}).get("values") or []
        water = ref.get("seasonal_water_mm") or {}
        clim = repo.get_climate_suitability(crop)
        soil = repo.get_soil_suitability(crop)
        for s in seasons:
            if season and s != season:
                continue
            checks: list[dict[str, Any]] = []
            sc = _season_climate(normals, s)

            if sc is None:
                checks.append({"factor": "temperature", "verdict": "unknown", "detail": "No climate normals for this location yet."})
            else:
                t, lo, hi = sc["mean_temp_c"], clim.ideal_temp_min_c, clim.ideal_temp_max_c
                off = max(lo - t, t - hi, 0)
                v: Verdict = "suitable" if off == 0 else "marginal" if off <= TEMP_MARGIN_C else "unsuitable"
                word = "within" if off == 0 else ("below" if t < lo else "above")
                checks.append({"factor": "temperature", "verdict": v,
                               "detail": f"Season average {t} °C is {word} the ideal {lo:g}–{hi:g} °C.", "source": clim.source})

            if sc is not None and water:
                rain, need = sc["rain_mm"], water["min"]
                if rain >= need:
                    v, d = "suitable", f"Normal season rain {rain} mm covers the crop’s need of {need}–{water['max']} mm."
                elif irrigated:
                    v, d = "suitable", f"Rain {rain} mm is below the {need}–{water['max']} mm need; your irrigation has to cover about {need - rain} mm or more."
                elif rain >= 0.6 * need:
                    v, d = "marginal", f"Rain {rain} mm is short of the {need}–{water['max']} mm need and the field is rainfed; expect water stress in dry years."
                else:
                    v, d = "unsuitable", f"Rain {rain} mm is far below the {need}–{water['max']} mm need; not viable without irrigation."
                if irrigation in (None, ""):
                    d += " (Irrigation not given.)"
                    if v == "unsuitable":
                        v = "marginal"
                checks.append({"factor": "water", "verdict": v, "detail": d, "source": water["source"]})

            if soil_type:
                ok = _soil_matches(soil_type, soil.ideal_soil_types)
                checks.append({"factor": "soil", "verdict": "suitable" if ok else "marginal",
                               "detail": f"{soil_type} is {'a' if ok else 'not a'} preferred soil (preferred: {', '.join(x.split('(')[0].strip() for x in soil.ideal_soil_types)}).",
                               "source": soil.source})
            if soil_ph is not None:
                off = max(soil.ideal_ph_min - soil_ph, soil_ph - soil.ideal_ph_max, 0)
                checks.append({"factor": "soil pH", "verdict": "suitable" if off == 0 else "marginal" if off <= 1 else "unsuitable",
                               "detail": f"pH {soil_ph:g} vs ideal {soil.ideal_ph_min:g}–{soil.ideal_ph_max:g}.", "source": soil.source})

            known = [c["verdict"] for c in checks if c["verdict"] != "unknown"]
            overall: Verdict = max(known, key=_RANK.get) if known else "unknown"
            if overall == "suitable" and len(known) < len(checks):
                overall = "unknown"  # never call it suitable on partial evidence
            rows.append({
                "crop": crop, "season": s, "season_label": SEASON_LABEL[s], "verdict": overall,
                "season_climate": sc, "checks": checks,
                "season_source": (ref.get("seasons") or {}).get("source"),
            })
    rows.sort(key=lambda r: (_RANK[r["verdict"]], r["crop"]))
    return rows


def load_normals(lat: float, lon: float) -> tuple[list[dict[str, Any]], str | None]:
    """Normals for the farm's grid; fetched once from ERA5-Land when the grid has none."""
    from app.data.weather.repository import WeatherRepository
    from app.data.weather.providers.open_meteo import OpenMeteoClient

    grid_key = snap_to_grid(lat, lon).grid_key
    repo = WeatherRepository()
    normals = repo.get_normals(grid_key)
    if len(normals) >= 12:
        return normals, normals[0].get("period")
    try:
        normals = OpenMeteoClient(timeout=35.0).fetch_normals(lat=lat, lon=lon, grid_key=grid_key, start_year=2015, end_year=2024)
        if normals:
            repo.upsert_normals(normals)
            return normals, normals[0].get("period")
    except Exception as exc:
        logger.warning(f"Climate normals unavailable for {grid_key}: {exc}")
    return [], None
