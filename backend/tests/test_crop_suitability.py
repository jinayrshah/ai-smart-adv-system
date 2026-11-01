"""Crop suitability: verdicts follow the normals and never claim 'suitable' without data."""
from app.domain.advisory.crop_suitability import assess


def _normals(temp_by_month, rain_by_month):
    return [{"month": m, "tmax_c": temp_by_month[m] + 5, "tmin_c": temp_by_month[m] - 5,
             "precip_mm_month": rain_by_month[m]} for m in range(1, 13)]


# A Rajkot-like profile: hot monsoon with ~600 mm, mild dry winter.
TEMP = {1: 20, 2: 22, 3: 27, 4: 31, 5: 33, 6: 31, 7: 28, 8: 27, 9: 28, 10: 27, 11: 24, 12: 21}
RAIN = {1: 0, 2: 0, 3: 1, 4: 1, 5: 5, 6: 110, 7: 230, 8: 160, 9: 90, 10: 15, 11: 5, 12: 1}


def _row(rows, crop, season):
    return next(r for r in rows if r["crop"] == crop and r["season"] == season)


def test_irrigation_and_rain_drive_water_verdict():
    rainfed = assess(_normals(TEMP, RAIN), irrigation="rainfed")
    assert _row(rainfed, "Wheat", "rabi")["verdict"] == "unsuitable"   # ~6 mm winter rain, no irrigation
    irrigated = assess(_normals(TEMP, RAIN), irrigation="borewell")
    assert _row(irrigated, "Wheat", "rabi")["verdict"] == "suitable"
    assert _row(irrigated, "Cotton", "kharif")["verdict"] in ("suitable", "marginal")


def test_soil_mismatch_is_flagged():
    rows = assess(_normals(TEMP, RAIN), soil_type="Sandy loam (बलुई दोमट)", irrigation="drip")
    soil = next(c for c in _row(rows, "Cotton", "kharif")["checks"] if c["factor"] == "soil")
    assert soil["verdict"] == "marginal"


def test_no_normals_never_claims_suitable():
    rows = assess([], soil_type="Black (काली)", irrigation="canal")
    assert rows and all(r["verdict"] != "suitable" for r in rows)
    assert all(r["season_climate"] is None for r in rows)
