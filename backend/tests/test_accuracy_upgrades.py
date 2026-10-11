"""
Tests for the accuracy upgrades on this branch:
- GDD with upper cut-off + missing-day imputation, no fabricated GDD on calendar fallback
- FAO-56 root-zone water balance (TAW/RAW, effective rain, irrigation log, forecast rain)
- irrigation log endpoints
- Bhashini two-step translation flow
- generator robustness (no current weather) and unsupported-crop handling
- soil organic-carbon flag, weather code descriptions
"""

from datetime import date, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.data.weather.codes import describe_weather_code
from app.domain.advisory.growth_stage_engine import current_growth_stage, daily_gdd
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.domain.advisory.water_requirement_engine import (
    calculate_irrigation_need,
    effective_rain,
    soil_water_capacity,
)
from app.main import app

client = TestClient(app)
AS_OF = date(2026, 10, 1)


def _history(sowing: date, as_of: date, et0=5.0, rain=0.0, tmax=30.0, tmin=18.0, skip=()):
    rows = []
    d = sowing
    while d <= as_of:
        if d not in skip:
            rows.append({"date": d.isoformat(), "tmax_c": tmax, "tmin_c": tmin, "et0_mm": et0, "precip_mm": rain})
        d += timedelta(days=1)
    return rows


def _summary(future_rain=0.0, prob=None):
    days = [{"phase": "past", "date": (AS_OF - timedelta(days=i)).isoformat(), "et0_mm": 5.0, "precip_mm": 0.0}
            for i in range(7, 0, -1)]
    days.append({"phase": "today", "date": AS_OF.isoformat(), "et0_mm": 5.0, "precip_mm": 0.0})
    for i in range(1, 4):
        days.append({"phase": "future", "date": (AS_OF + timedelta(days=i)).isoformat(), "et0_mm": 5.0,
                     "precip_mm": future_rain / 3, "precip_prob_pct": prob})
    return {"days": days, "metrics": {"confidence": "high"}}


# ------------------------------------------------------------------ GDD
def test_daily_gdd_upper_cutoff():
    assert daily_gdd(38.0, 24.0, 10.0, 30.0) == 17.0  # Tmax capped at 30
    assert daily_gdd(38.0, 24.0, 10.0, None) == 21.0
    assert daily_gdd(36.0, 31.0, 10.0, 30.0) == 0.0   # whole day above the cut-off
    assert daily_gdd(8.0, 2.0, 10.0) == 0.0


def test_gdd_imputes_missing_days_and_reports_coverage():
    sowing = AS_OF - timedelta(days=29)  # 30 days expected
    missing = {sowing + timedelta(days=i) for i in (3, 9, 15, 21, 27)}  # 25/30 = 83 %
    res = current_growth_stage("Wheat", sowing, _history(sowing, AS_OF, skip=missing), as_of=AS_OF)
    assert res.method == "gdd"
    assert res.imputed_days == 5
    assert res.weather_coverage_pct == round(25 / 30 * 100, 1)
    # Imputation keeps thermal time unbiased: 30 days × ((30+18)/2 − Tbase)
    from app.data.advisory.reference_repo import get_agronomy_repo

    t_base = get_agronomy_repo().get_stages("Wheat")[0].gdd_base_c
    assert res.cumulative_gdd == round(30 * ((30 + 18) / 2 - t_base), 1)


def test_calendar_fallback_does_not_invent_gdd():
    res = current_growth_stage("Wheat", AS_OF - timedelta(days=30), [], as_of=AS_OF)
    assert res.method == "calendar_fallback"
    assert res.cumulative_gdd is None
    assert res.stage_progress_pct is not None


# ------------------------------------------------------------------ water balance
def test_soil_mapping_uses_fao56_table19():
    assert soil_water_capacity("Black Cotton (काली मिट्टी)")[1] == "Clay"
    assert soil_water_capacity("Sandy Loam (बलुई दोमट)")[1] == "Sandy loam"
    awc, label, assumed = soil_water_capacity(None)
    assert label == "Loam" and assumed is True


def test_effective_rain_ignores_small_events():
    assert effective_rain(0.8, 5.0) == 0.0   # < 0.2·ET0 evaporates
    assert effective_rain(12.0, 5.0) == 12.0


def test_water_balance_calls_for_irrigation_in_dry_spell():
    sowing = AS_OF - timedelta(days=45)
    stage = current_growth_stage("Wheat", sowing, _history(sowing, AS_OF), as_of=AS_OF)
    adv = calculate_irrigation_need(
        "Wheat", stage.stage_name, _summary(),
        history_rows=_history(sowing, AS_OF), sowing_date=sowing, as_of=AS_OF,
        soil_type="Loamy (दोमट)", irrigation_type="drip", irrigation_events=[],
    )
    assert adv.method == "fao56_water_balance"
    assert adv.action == "irrigate_now"
    assert adv.root_zone_depletion_mm >= adv.raw_mm
    assert adv.net_irrigation_mm == adv.root_zone_depletion_mm
    assert adv.gross_irrigation_mm == round(adv.net_irrigation_mm / 0.9, 1)
    assert adv.confidence == "medium"  # capped: nothing logged
    assert any("No irrigation has been logged" in a for a in adv.assumptions)


def test_logged_irrigation_refills_root_zone():
    sowing = AS_OF - timedelta(days=45)
    hist = _history(sowing, AS_OF)
    stage = current_growth_stage("Wheat", sowing, hist, as_of=AS_OF)
    adv = calculate_irrigation_need(
        "Wheat", stage.stage_name, _summary(), history_rows=hist, sowing_date=sowing, as_of=AS_OF,
        soil_type="Loamy", irrigation_type="drip",
        irrigation_events=[{"date": (AS_OF - timedelta(days=1)).isoformat(), "amount_mm": 80.0}],
    )
    assert adv.action in ("no_irrigation_needed", "monitor")
    assert adv.root_zone_depletion_mm < adv.raw_mm


def test_forecast_rain_defers_irrigation():
    sowing = AS_OF - timedelta(days=45)
    hist = _history(sowing, AS_OF)
    stage = current_growth_stage("Wheat", sowing, hist, as_of=AS_OF)
    adv = calculate_irrigation_need(
        "Wheat", stage.stage_name, _summary(future_rain=300.0, prob=90.0),
        history_rows=hist, sowing_date=sowing, as_of=AS_OF, soil_type="Loamy", irrigation_type="drip",
    )
    assert adv.action == "wait_for_rain"
    low_prob = calculate_irrigation_need(
        "Wheat", stage.stage_name, _summary(future_rain=300.0, prob=30.0),
        history_rows=hist, sowing_date=sowing, as_of=AS_OF, soil_type="Loamy", irrigation_type="drip",
    )
    assert low_prob.action == "irrigate_now"


def test_rainfed_field_is_not_told_to_irrigate():
    sowing = AS_OF - timedelta(days=45)
    hist = _history(sowing, AS_OF)
    stage = current_growth_stage("Wheat", sowing, hist, as_of=AS_OF)
    adv = calculate_irrigation_need(
        "Wheat", stage.stage_name, _summary(), history_rows=hist, sowing_date=sowing, as_of=AS_OF,
        irrigation_type="rainfed",
    )
    assert adv.action == "monitor"
    assert adv.gross_irrigation_mm is None


def test_paddy_uses_seven_day_method():
    sowing = AS_OF - timedelta(days=45)
    hist = _history(sowing, AS_OF)
    stage = current_growth_stage("Rice", sowing, hist, as_of=AS_OF)
    adv = calculate_irrigation_need("Rice", stage.stage_name, _summary(), history_rows=hist,
                                    sowing_date=sowing, as_of=AS_OF)
    assert adv.method == "7day_deficit"
    assert any("ponded" in a for a in adv.assumptions)


def test_no_et0_means_no_invented_numbers():
    adv = calculate_irrigation_need("Wheat", "Tillering", {"days": [], "metrics": {}})
    assert adv.method == "insufficient_data"
    assert adv.data_available is False
    assert adv.etc_7d_mm == 0.0 and adv.action == "unknown"


# ------------------------------------------------------------------ irrigation log API
def _onboard():
    payload = {
        "farmer_id": str(uuid4()), "full_name": "Log Test", "farm_name": "Plot", "lat": 20.14, "lon": 74.24,
        "state": "Maharashtra", "district": "Nashik", "soil_type": "Loamy (दोमट)", "irrigation_type": "drip",
        "crops": [{"crop": "Wheat", "sowing_date": (date.today() - timedelta(days=20)).isoformat(), "season": "rabi"}],
    }
    res = client.post("/api/farmer/onboard", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["farm"]["id"]


def test_irrigation_log_roundtrip():
    farm_id = _onboard()
    d = (date.today() - timedelta(days=2)).isoformat()
    res = client.post(f"/api/farmer/farms/{farm_id}/irrigation", json={"irrigated_on": d, "amount_mm": 40})
    assert res.status_code == 201, res.text
    listed = client.get(f"/api/farmer/farms/{farm_id}/irrigation").json()
    assert listed[0]["irrigated_on"] == d and listed[0]["amount_mm"] == 40.0

    future = (date.today() + timedelta(days=3)).isoformat()
    assert client.post(f"/api/farmer/farms/{farm_id}/irrigation",
                       json={"irrigated_on": future, "amount_mm": 10}).status_code == 422
    assert client.post("/api/farmer/farms/999999/irrigation",
                       json={"irrigated_on": d, "amount_mm": 10}).status_code == 404


def test_diagnostic_reports_logged_irrigation():
    farm_id = _onboard()
    client.post(f"/api/farmer/farms/{farm_id}/irrigation",
                json={"irrigated_on": (date.today() - timedelta(days=1)).isoformat(), "amount_mm": 25})
    res = client.get(f"/api/advisory/diagnostic?farm_id={farm_id}")
    assert res.status_code == 200, res.text
    assert res.json()["irrigation_events_logged"] == 1


# ------------------------------------------------------------------ advisory robustness
def test_unsupported_crop_is_rejected_not_swapped():
    res = client.post("/api/advisory/ask", json={"crop": "Onion", "query": "When to irrigate?", "lat": 20.0, "lon": 73.8})
    assert res.status_code == 422
    assert "Onion" in res.json()["detail"]


def test_ask_reports_assumptions_when_profile_is_missing():
    res = client.post("/api/advisory/ask", json={"crop": "Wheat", "query": "Should I irrigate my wheat?"})
    assert res.status_code == 200, res.text
    assumptions = res.json()["computed"]["assumptions"]
    assert any("Sowing date not given" in a for a in assumptions)
    assert any("No farm location" in a for a in assumptions)


def test_query_length_is_capped():
    res = client.post("/api/advisory/ask", json={"crop": "Wheat", "query": "x" * 5000})
    assert res.status_code == 422


# ------------------------------------------------------------------ Bhashini
def test_bhashini_two_step_flow(monkeypatch):
    from app.domain.advisory import translation

    monkeypatch.setenv("BHASHINI_API_KEY", "ulca-key")
    monkeypatch.setenv("BHASHINI_USER_ID", "user-1")
    translation._PIPELINE_CACHE.clear()

    config_resp = MagicMock(status_code=200)
    config_resp.json.return_value = {
        "pipelineInferenceAPIEndPoint": {
            "callbackUrl": "https://dhruva.example/infer",
            "inferenceApiKey": {"name": "Authorization", "value": "infer-key"},
        },
        "pipelineResponseConfig": [{
            "taskType": "translation",
            "config": [{"serviceId": "svc-en-hi", "language": {"sourceLanguage": "en", "targetLanguage": "hi"}}],
        }],
    }
    infer_resp = MagicMock(status_code=200)
    infer_resp.json.return_value = {"pipelineResponse": [{"output": [{"target": "नमस्ते"}]}]}

    calls = []

    def fake_post(self, url, json=None, headers=None):
        calls.append((url, json, headers))
        return config_resp if "getModelsPipeline" in url else infer_resp

    with patch("httpx.Client.post", new=fake_post):
        out = translation.translate_from_english("Hello", "hi")
    assert out == "नमस्ते"
    assert calls[0][2]["ulcaApiKey"] == "ulca-key"
    assert calls[1][0] == "https://dhruva.example/infer"
    assert calls[1][2]["Authorization"] == "infer-key"
    assert calls[1][1]["pipelineTasks"][0]["config"]["serviceId"] == "svc-en-hi"
    translation._PIPELINE_CACHE.clear()


def test_translation_without_credentials_returns_original(monkeypatch):
    from app.domain.advisory import translation

    monkeypatch.delenv("BHASHINI_API_KEY", raising=False)
    monkeypatch.delenv("BHASHINI_USER_ID", raising=False)
    assert translation.translate_from_english("Irrigate now.", "gu") == "Irrigate now."


# ------------------------------------------------------------------ misc
def test_low_organic_carbon_flag():
    flags = check_soil_suitability("Wheat", "Loamy", {"oc": 0.3})
    assert any(f.flag_type == "low_organic_carbon" for f in flags)
    assert not any(f.flag_type == "low_organic_carbon" for f in check_soil_suitability("Wheat", "Loamy", {"oc": 0.8}))


def test_weather_code_descriptions():
    assert describe_weather_code(0) == "Clear sky"
    assert describe_weather_code(63) == "Moderate rain"
    assert describe_weather_code(501) == "Rain"  # OpenWeatherMap id
    assert describe_weather_code(None) is None
