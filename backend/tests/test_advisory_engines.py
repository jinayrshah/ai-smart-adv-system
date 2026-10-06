"""
Unit tests for Personalized Crop Advisory computation engines.
Pure functions, no network, no LLM. Architecture_Advisory.md §18.
"""

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.domain.advisory.climate_suitability_engine import check_climate_suitability
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.domain.advisory.water_requirement_engine import calculate_irrigation_need
from app.main import app

client = TestClient(app)


# ==================== ENGINE 1: GROWTH STAGE (GDD) ====================

def test_growth_stage_engine_gdd_calculation():
    """Test GDD accumulation and stage transition using known temperature history."""
    sowing = date(2026, 11, 1)
    as_of = date(2026, 11, 20)  # 19 days

    # Simulate 20 days with avg temp 20°C (Tmax 25, Tmin 15).
    # Wheat T_base is 5.0°C -> GDD/day = 20 - 5 = 15.0 GDD.
    # Total GDD = 20 * 15.0 = 300.0 GDD.
    # Stage thresholds for Wheat:
    # 1: Germination (150 GDD)
    # 2: CRI (350 GDD) -> 300 GDD falls in CRI.
    history = []
    curr = sowing
    while curr <= as_of:
        history.append({
            "date": curr.isoformat(),
            "tmax_c": 25.0,
            "tmin_c": 15.0,
        })
        curr += timedelta(days=1)

    result = current_growth_stage(
        crop="Wheat",
        sowing_date=sowing,
        weather_history=history,
        as_of=as_of,
    )

    assert result.method == "gdd"
    assert result.stage_order == 2
    assert result.stage_name == "Crown Root Initiation (CRI)"
    assert result.cumulative_gdd == 300.0
    assert result.days_since_sowing == 19
    assert result.next_stage_name == "Tillering"
    assert result.gdd_remaining_in_stage == 50.0  # 350 - 300
    assert "PAU" in result.source or "ICAR" in result.source


def test_growth_stage_calendar_fallback():
    """Test fallback to typical calendar days when weather history is unavailable."""
    sowing = date(2026, 10, 1)
    as_of = date(2026, 10, 26)  # 25 days since sowing

    result = current_growth_stage(
        crop="Wheat",
        sowing_date=sowing,
        weather_history=None,
        as_of=as_of,
    )

    assert result.method == "calendar_fallback"
    assert result.stage_name == "Crown Root Initiation (CRI)"  # typical_days_fallback = 25
    assert result.days_since_sowing == 25
    assert result.source != ""


def test_growth_stage_unmapped_crop_fails_loudly():
    """Architecture requirement: an unsupported crop must fail loudly, not default silently."""
    with pytest.raises(ValueError, match="not found in agronomic stage norms"):
        current_growth_stage(
            crop="PineappleSpecialCrop",
            sowing_date=date(2026, 1, 1),
            weather_history=None,
        )


# ==================== ENGINE 2: WATER REQUIREMENT & DEFICIT ====================

def test_water_requirement_etc_and_deficit():
    """Test ETc calculation (Kc * ET0) and 7-day water balance deficit."""
    # Wheat at Tillering stage has Kc = 0.75
    weather_summary = {
        "days": [
            {"phase": "past", "et0_mm": 4.0, "rain_mm": 2.0},
            {"phase": "past", "et0_mm": 4.0, "rain_mm": 0.0},
            {"phase": "past", "et0_mm": 4.0, "rain_mm": 0.0},
            {"phase": "past", "et0_mm": 4.0, "rain_mm": 1.0},
            {"phase": "past", "et0_mm": 4.0, "rain_mm": 0.0},
            {"phase": "past", "et0_mm": 4.0, "rain_mm": 0.0},
            {"phase": "today", "et0_mm": 4.0, "rain_mm": 0.0},
            {"phase": "future", "et0_mm": 4.0, "rain_mm": 0.0},  # should be excluded from 7d past balance
        ],
        "metrics": {"confidence": "high"},
    }

    advice = calculate_irrigation_need(
        crop="Wheat",
        stage_name="Tillering",
        weather_summary=weather_summary,
    )

    # Kc = 0.75
    # etc_today = 0.75 * 4.0 = 3.0 mm
    # etc_7d = 7 * (0.75 * 4.0) = 21.0 mm
    # rain_7d = 2.0 + 1.0 = 3.0 mm
    # deficit = 21.0 - 3.0 = 18.0 mm
    assert advice.kc == 0.75
    assert advice.etc_today_mm == 3.0
    assert advice.etc_7d_mm == 21.0
    assert advice.rain_7d_mm == 3.0
    assert advice.deficit_mm == 18.0
    assert advice.confidence == "high"
    assert "deficit is approximately 18.0 mm" in advice.recommendation
    assert "FAO-56" in advice.source


def test_water_requirement_zero_deficit_when_rain_exceeds_etc():
    """Deficit must not become negative if heavy rain occurred."""
    weather_summary = {
        "days": [
            {"phase": "today", "et0_mm": 3.0, "rain_mm": 50.0},
        ],
        "metrics": {"confidence": "medium"},
    }

    advice = calculate_irrigation_need(
        crop="Tomato",
        stage_name="Vegetative Growth",
        weather_summary=weather_summary,
    )

    assert advice.deficit_mm == 0.0
    assert "Withhold irrigation" in advice.recommendation


# ==================== ENGINE 3: SOIL SUITABILITY ====================

def test_soil_suitability_compliant_returns_empty_list():
    """Compliant soil should produce zero flags (never manufacture a non-issue)."""
    flags = check_soil_suitability(
        crop="Wheat",
        soil_type="Loamy (दोमट)",
        soil_npk={"n": 200.0, "p": 20.0, "k": 180.0, "ph": 6.8},
    )
    assert flags == []


def test_soil_suitability_flags_mismatch_and_ph():
    """Test detection of acidic pH, soil type mismatch, and nutrient deficiencies."""
    flags = check_soil_suitability(
        crop="Wheat",
        soil_type="Saline Peat Bog",
        soil_npk={"n": 90.0, "p": 5.0, "k": 70.0, "ph": 4.5},
    )

    flag_types = [f.flag_type for f in flags]
    assert "soil_type_mismatch" in flag_types
    assert "ph_out_of_range" in flag_types
    assert "low_nitrogen" in flag_types
    assert "low_phosphorus" in flag_types
    assert "low_potassium" in flag_types

    # Provenance check
    for f in flags:
        assert f.source != ""


# ==================== ENGINE 4: CLIMATE SUITABILITY ====================

def test_climate_suitability_verdicts():
    """Test suitable, marginal, and unsuitable temperature thresholds."""
    # Wheat ideal: 15.0 - 25.0°C
    v_suitable = check_climate_suitability(crop="Wheat", observed_temp_c=20.0, reading_source="weather_forecast")
    assert v_suitable.verdict == "suitable"
    assert v_suitable.reading_source == "weather_forecast"

    # 27°C is +2°C above 25°C -> marginal (band is 3°C)
    v_marginal = check_climate_suitability(crop="Wheat", observed_temp_c=27.0, reading_source="iot_live")
    assert v_marginal.verdict == "marginal"
    assert v_marginal.reading_source == "iot_live"

    # 35°C is +10°C above 25°C -> unsuitable
    v_unsuitable = check_climate_suitability(crop="Wheat", observed_temp_c=35.0)
    assert v_unsuitable.verdict == "unsuitable"
    assert "thermal comfort limits" in (v_unsuitable.notes or "")


# ==================== FASTAPI ADVISORY ROUTES ====================

def test_api_advisory_endpoints():
    """Test HTTP API endpoints for advisory computations."""
    # 1. Crops list
    res_crops = client.get("/api/advisory/crops")
    assert res_crops.status_code == 200
    crops = res_crops.json()
    assert "Wheat" in crops
    assert "Cotton" in crops

    # 2. Crop stages
    res_stages = client.get("/api/advisory/crops/Wheat/stages")
    assert res_stages.status_code == 200
    stages = res_stages.json()
    assert len(stages) == 8
    assert stages[0]["stage_name"] == "Germination & Emergence"
    assert stages[0]["source"] != ""

    # 3. Stage calculation endpoint
    res_stage_calc = client.get("/api/advisory/stage?crop=Wheat&sowing_date=2026-10-01")
    assert res_stage_calc.status_code == 200
    data = res_stage_calc.json()
    assert data["crop"] == "Wheat"
    assert "stage_name" in data

    # 4. Soil check endpoint
    res_soil = client.post("/api/advisory/soil", json={
        "crop": "Cotton",
        "soil_type": "Sandy Marsh",
        "shc_n": 80.0,
        "shc_ph": 9.5
    })
    assert res_soil.status_code == 200
    soil_flags = res_soil.json()
    assert len(soil_flags) >= 2

    # 5. Climate check endpoint
    res_clim = client.get("/api/advisory/climate?crop=Rice&temp_c=28.0&humidity_pct=75.0")
    assert res_clim.status_code == 200
    clim_data = res_clim.json()
    assert clim_data["crop"] == "Rice"
    assert clim_data["verdict"] == "suitable"
