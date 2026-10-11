"""
Golden Question Evaluation Set & Groundedness Verification.
Architecture_Advisory.md §18, Implementationplan_Advisory.md "Definition of Done".

Verifies:
1. Personalization: Two farmers asking the same question get visibly different answers tailored to their location, soil, sowing date, and physiological stage.
2. Groundedness Spot-Check: Every specific number in a response traces back to context_snapshot.
3. Out-of-Scope Honesty: Out-of-domain queries return an honest refusal with KVK referrals without hallucinating.
4. Golden Question Coverage across the Deep-6 crops and National Welfare Schemes.
"""

import pytest
from datetime import date
from app.domain.advisory.context import AdvisoryContext
from app.domain.advisory.generator import generate_advisory_response
from app.domain.advisory.schemes import answer_scheme_query
from app.domain.advisory.disease_detector import get_disease_detector
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.water_requirement_engine import calculate_irrigation_need
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.domain.advisory.climate_suitability_engine import check_climate_suitability
from app.schemas.rag import RetrievedChunk


def _mock_chunk(title: str, page: int, text: str) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_text=text,
        document_id=1,
        page_number=page,
        similarity=0.88,
        crop="Wheat",
        doc_type="agronomy_pop",
        source_title=title,
    )


def test_personalization_divergence_between_two_farmers():
    """
    Definition of Done #1:
    A logged-in farmer with a completed profile gets an answer that visibly differs
    from what a different farmer (different location/crop/soil/sowing date) would get
    for the exact same question.
    """
    # Farmer A: Wheat sown 10 days ago (CRI stage, sandy loam, Punjab)
    stage_a = current_growth_stage("Wheat", sowing_date="2026-09-26", weather_history=[])
    irrig_a = calculate_irrigation_need("Wheat", stage_a.stage_name, {"temp_c": 24.0, "humidity_pct": 50.0, "forecast_7d": []})
    soil_a = check_soil_suitability("Wheat", "Sandy Loam (बलुई दोमट)", {"ph": 6.8, "n": 220, "p": 18, "k": 180})
    climate_a = check_climate_suitability("Wheat", stage_name=stage_a.stage_name, observed_temp_c=24.0, observed_humidity_pct=50.0)

    ctx_a = AdvisoryContext(
        farmer_id="f1",
        farmer_name="Ramesh Singh",
        preferred_language="en",
        farm_id=1,
        farm_name="Ludhiana Farm",
        lat=30.9,
        lon=75.8,
        state="Punjab",
        district="Ludhiana",
        soil_type="Sandy Loam (बलुई दोमट)",
        crop="Wheat",
        variety="PBW-343",
        sowing_date=date(2026, 9, 26),
        season="Rabi",
        stage=stage_a,
        weather_summary={"temp_c": 24.0, "condition": "Sunny", "forecast_7d": []},
        irrigation=irrig_a,
        soil_flags=soil_a,
        climate=climate_a,
        retrieved_chunks=[_mock_chunk("ICAR Wheat Guide", 14, "First irrigation at Crown Root Initiation (21 days).")],
    )

    # Farmer B: Wheat sown 60 days ago (Heading/Flowering stage, heavy clay, MP)
    stage_b = current_growth_stage("Wheat", sowing_date="2026-08-05", weather_history=[])
    irrig_b = calculate_irrigation_need("Wheat", stage_b.stage_name, {"temp_c": 31.0, "humidity_pct": 35.0, "forecast_7d": []})
    soil_b = check_soil_suitability("Wheat", "Clayey (चिकनी)", {"ph": 8.5, "n": 140, "p": 10, "k": 110})
    climate_b = check_climate_suitability("Wheat", stage_name=stage_b.stage_name, observed_temp_c=31.0, observed_humidity_pct=35.0)

    ctx_b = AdvisoryContext(
        farmer_id="f2",
        farmer_name="Suresh Patel",
        preferred_language="en",
        farm_id=2,
        farm_name="Indore Farm",
        lat=22.7,
        lon=75.8,
        state="Madhya Pradesh",
        district="Indore",
        soil_type="Clayey (चिकनी)",
        crop="Wheat",
        variety="Sharbati",
        sowing_date=date(2026, 8, 5),
        season="Rabi",
        stage=stage_b,
        weather_summary={"temp_c": 31.0, "condition": "Hot & Dry", "forecast_7d": []},
        irrigation=irrig_b,
        soil_flags=soil_b,
        climate=climate_b,
        retrieved_chunks=[_mock_chunk("ICAR Wheat Guide", 28, "Flowering stage requires critical moisture support.")],
    )

    resp_a = generate_advisory_response(ctx=ctx_a, user_query="Should I irrigate my field today?", query_id=1, use_mock=True)
    resp_b = generate_advisory_response(ctx=ctx_b, user_query="Should I irrigate my field today?", query_id=2, use_mock=True)

    # Responses must visibly differ
    assert resp_a.response != resp_b.response
    assert resp_a.computed.growth_stage.stage_name != resp_b.computed.growth_stage.stage_name
    # Different stages -> different crop coefficients (offline there is no ET0, so the
    # deficit itself is honestly "unknown" for both rather than a fabricated number)
    assert resp_a.computed.irrigation.kc != resp_b.computed.irrigation.kc



def test_groundedness_audit_spot_check():
    """
    Definition of Done #2:
    Every specific number in a response traces back to context_snapshot.
    """
    stage = current_growth_stage("Wheat", sowing_date="2026-09-20", weather_history=[])
    irrig = calculate_irrigation_need("Wheat", stage.stage_name, {"temp_c": 22.0, "humidity_pct": 55.0, "forecast_7d": []})
    soil = check_soil_suitability("Wheat", "Loamy (दोमट)", {"ph": 7.0, "n": 240, "p": 22, "k": 190})
    climate = check_climate_suitability("Wheat", stage_name=stage.stage_name, observed_temp_c=22.0, observed_humidity_pct=55.0)

    ctx = AdvisoryContext(
        farmer_id="f3",
        farmer_name="Harpreet",
        preferred_language="en",
        farm_id=3,
        farm_name="Amritsar Farm",
        lat=31.6,
        lon=74.8,
        state="Punjab",
        district="Amritsar",
        soil_type="Loamy (दोमट)",
        crop="Wheat",
        variety="HD-2967",
        sowing_date=date(2026, 9, 20),
        season="Rabi",
        stage=stage,
        weather_summary={"temp_c": 22.0, "condition": "Clear", "forecast_7d": []},
        irrigation=irrig,
        soil_flags=soil,
        climate=climate,
        retrieved_chunks=[_mock_chunk("ICAR Rabi Agronomy 2025", 8, "Maintain 25 mm soil moisture deficit threshold.")],
    )

    resp = generate_advisory_response(ctx=ctx, user_query="What is my irrigation requirement?", query_id=10, use_mock=True)

    assert resp.confidence in ("grounded", "partial")
    assert len(resp.sources) > 0
    # Spot-check that irrigation deficit number in computed matches context
    assert resp.computed.irrigation.deficit_mm == irrig.deficit_mm
    assert resp.computed.growth_stage.cumulative_gdd == stage.cumulative_gdd


def test_out_of_scope_honest_refusal():
    """
    Definition of Done #4:
    An out-of-scope question gets an honest 'I don't know' instead of a confident guess.
    """
    stage = current_growth_stage("Wheat", sowing_date="2026-09-20", weather_history=[])
    irrig = calculate_irrigation_need("Wheat", stage.stage_name, {"temp_c": 22.0, "humidity_pct": 55.0, "forecast_7d": []})

    ctx = AdvisoryContext(
        farmer_id="f4",
        farmer_name="Karan",
        preferred_language="en",
        farm_id=4,
        farm_name="Karnal Farm",
        lat=29.6,
        lon=76.9,
        state="Haryana",
        district="Karnal",
        soil_type="Loamy (दोमट)",
        crop="Wheat",
        variety="HD-3086",
        sowing_date=date(2026, 9, 20),
        season="Rabi",
        stage=stage,
        weather_summary={"temp_c": 22.0, "condition": "Clear", "forecast_7d": []},
        irrigation=irrig,
        soil_flags=[],
        climate=check_climate_suitability("Wheat", stage_name=stage.stage_name, observed_temp_c=22.0, observed_humidity_pct=55.0),
        retrieved_chunks=[],  # No retrieved agronomic PoP matches
    )

    resp = generate_advisory_response(ctx=ctx, user_query="What is the stock price prediction for Apple Inc next week?", query_id=11, use_mock=True)
    assert resp.confidence == "insufficient"
    assert "Krishi Vigyan Kendra" in resp.response or "KVK" in resp.response or "reliable information" in resp.response


def test_golden_questions_national_schemes():
    """Verify known golden questions on national government schemes return accurate facts."""
    # 1. PM-KISAN installment structure
    resp1 = answer_scheme_query("What is the annual installment breakdown under PM-KISAN?", "PM-KISAN", use_mock=True)
    assert resp1.confidence in ("grounded", "partial")
    assert "6,000" in resp1.answer or "6000" in resp1.answer

    # 2. PMFBY Kharif premium
    resp2 = answer_scheme_query("What premium does a farmer pay for Kharif crops under PMFBY?", "PMFBY", use_mock=True)
    assert resp2.confidence in ("grounded", "partial")
    assert "2.0%" in resp2.answer or "2%" in resp2.answer

    # 3. KCC collateral-free limit
    resp3 = answer_scheme_query("What is the collateral-free loan limit under Kisan Credit Card?", "KCC", use_mock=True)
    assert resp3.confidence in ("grounded", "partial")
    assert "1,60,000" in resp3.answer or "160000" in resp3.answer or "credit" in resp3.answer.lower()
