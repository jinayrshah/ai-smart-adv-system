"""
Unit & Integration Tests for Advisory Phase 7 Hardening & Jobs.
Architecture_Advisory.md §13, §18, §19, Implementationplan_Advisory.md Phase 7.
"""

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.data.advisory.query_repo import get_query_repo
from app.data.advisory.reference_repo import get_agronomy_repo
from app.domain.advisory.ratelimit import SlidingWindowRateLimiter, advisory_rate_limiter
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.water_requirement_engine import calculate_irrigation_need
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.schemas.advisory import CropStageNorm
from jobs.review_advisory_feedback import review_feedback
from jobs.recompute_growth_stages import recompute_all_active_stages

client = TestClient(app)


def test_rate_limiter_sliding_window():
    """Verify that sliding window rate limiter blocks requests after exceeding threshold."""
    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=10)
    user = "farmer_test_123"

    ok1, rem1, _ = limiter.is_allowed(user)
    assert ok1 is True
    assert rem1 == 2

    ok2, rem2, _ = limiter.is_allowed(user)
    assert ok2 is True
    assert rem2 == 1

    ok3, rem3, _ = limiter.is_allowed(user)
    assert ok3 is True
    assert rem3 == 0

    # 4th request exceeds max_requests
    ok4, rem4, retry_after = limiter.is_allowed(user)
    assert ok4 is False
    assert rem4 == 0
    assert retry_after > 0


def test_api_advisory_ask_rate_limit_exceeded():
    """Verify POST /api/advisory/ask returns 429 when per-farmer limit is reached."""
    farmer_id = "test_rate_limited_farmer"
    advisory_rate_limiter.reset(farmer_id)

    payload = {
        "crop": "Wheat",
        "query": "Should I irrigate today?",
        "farmer_id": farmer_id,
        "sowing_date": "2026-10-01",
        "soil_type": "Loamy (दोमट)",
    }

    # Exhaust rate limit (max 20)
    for _ in range(20):
        advisory_rate_limiter.is_allowed(farmer_id)

    # Next call should return HTTP 429
    res = client.post("/api/advisory/ask", json=payload)
    assert res.status_code == 429
    data = res.json()
    assert "Rate limit exceeded" in data["detail"]

    # Reset limiter after test
    advisory_rate_limiter.reset(farmer_id)


def test_feedback_review_job_execution(tmp_path):
    """Verify review_advisory_feedback job extracts flagged queries and outputs json report."""
    query_repo = get_query_repo()
    qid = query_repo.log_query(
        user_query="How much urea should I spray on wheat?",
        context_snapshot={"crop": "Wheat", "growth_stage": {"stage_name": "Tillering"}},
        response_text="Apply 30 kg urea per acre.",
        retrieved_chunk_ids=[1, 2],
        confidence="grounded",
    )
    query_repo.record_feedback(query_id=qid, feedback=-1)

    out_file = str(tmp_path / "feedback_audit.json")
    results = review_feedback(limit=5, output_format="json", output_file=out_file)
    assert len(results) >= 1
    assert any(q.get("id") == qid or q.get("feedback") == -1 for q in results)


def test_recompute_growth_stages_job_execution():
    """Verify recompute_growth_stages runs batch calculation without error."""
    results = recompute_all_active_stages(dry_run=True)
    assert isinstance(results, list)
    if results:
        first = results[0]
        assert "accumulated_gdd" in first
        assert "stage_name" in first
        assert "water_deficit_7d_mm" in first


def test_mechanical_addition_of_new_crop():
    """
    Verify adding a 7th crop (Mustard) is a purely mechanical configuration task:
    populating norms in reference tables / fixture without altering engine codebase.
    Implementationplan_Advisory.md Phase 7 Acceptance.
    """
    repo = get_agronomy_repo()

    # 1. Register 7th crop in reference repository
    repo._fixture_data["Mustard"] = {
        "gdd_base_c": 5.0,
        "stages": [
            {
                "stage_order": 1,
                "stage_name": "Emergence & Early Vegetative",
                "gdd_cumulative_at_stage_end": 180.0,
                "typical_days_fallback": 18,
                "kc": 0.40,
                "source": "ICAR-DRMR Bharatpur Package of Practices",
            },
            {
                "stage_order": 2,
                "stage_name": "Branching & Floral Bud",
                "gdd_cumulative_at_stage_end": 480.0,
                "typical_days_fallback": 40,
                "kc": 0.95,
                "source": "ICAR-DRMR Bharatpur Package of Practices",
            },
            {
                "stage_order": 3,
                "stage_name": "Flowering & Pod Formation",
                "gdd_cumulative_at_stage_end": 950.0,
                "typical_days_fallback": 75,
                "kc": 1.15,
                "source": "ICAR-DRMR Bharatpur Package of Practices",
            },
            {
                "stage_order": 4,
                "stage_name": "Maturity & Seed Hardening",
                "gdd_cumulative_at_stage_end": 1450.0,
                "typical_days_fallback": 110,
                "kc": 0.45,
                "source": "ICAR-DRMR Bharatpur Package of Practices",
            },
        ],
        "soil": {
            "ideal_soil_types": ["Sandy Loam (बलुई दोमट)", "Loamy (दोमट)"],
            "ideal_ph_min": 6.0,
            "ideal_ph_max": 7.5,
            "source": "ICAR-DRMR",
        },
    }

    # 2. Verify growth stage engine automatically runs on Mustard
    sowing_date = date.today() - timedelta(days=30)
    stage_res = current_growth_stage(
        crop="Mustard",
        sowing_date=sowing_date,
        weather_history=[],
        as_of=date.today(),
    )
    assert stage_res.crop == "Mustard"
    assert stage_res.stage_name == "Branching & Floral Bud"
    assert stage_res.stage_order == 2


    # 5. Verify irrigation engine works with Mustard Kc
    water_res = calculate_irrigation_need(
        crop="Mustard",
        stage_name=stage_res.stage_name,
        weather_summary={
            "days": [{"phase": "past", "et0_mm": 4.0, "precip_mm": 0.0} for _ in range(6)]
            + [{"phase": "today", "et0_mm": 4.0, "precip_mm": 0.0}],
            "metrics": {"confidence": "medium"},
        },
    )
    assert water_res.crop == "Mustard"
    assert water_res.kc == 0.95
    assert water_res.deficit_mm > 0

    # 6. Verify soil suitability works with Mustard
    soil_flags = check_soil_suitability(
        crop="Mustard",
        soil_type="Sandy Loam (बलुई दोमट)",
        soil_npk={"ph": 6.8, "n": 220, "p": 18, "k": 180},
    )
    assert isinstance(soil_flags, list)
    assert len(soil_flags) == 0  # Perfect fit

