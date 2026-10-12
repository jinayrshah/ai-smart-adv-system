"""
Unit & Integration Tests for Advisory Ask Generation, Safety Controls, and Audit.
Architecture_Advisory.md §12, §13, §14, §17, §18.
"""

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.data.advisory.query_repo import get_query_repo
from app.domain.advisory.audit import (
    audit_number_grounding,
    compute_advisory_confidence,
    extract_numbers_from_text,
)
from app.domain.advisory.context import assemble_advisory_context
from app.domain.advisory.generator import generate_advisory_response
from app.schemas.rag import RetrievedChunk


client = TestClient(app)


def test_confidence_computation():
    """Verify confidence rules (§17.3)."""
    # 1. Empty or low similarity -> insufficient
    assert compute_advisory_confidence([]) == "insufficient"
    low_chunks = [RetrievedChunk(chunk_text="Irrelevant", similarity=0.45, document_id=1)]
    assert compute_advisory_confidence(low_chunks) == "insufficient"

    # 2. Moderate similarity (0.60 - 0.64) -> partial
    mod_chunks = [RetrievedChunk(chunk_text="Moderate match", similarity=0.62, document_id=1)]
    assert compute_advisory_confidence(mod_chunks) == "partial"

    # 3. High similarity and good weather -> grounded
    high_chunks = [RetrievedChunk(chunk_text="Strong match", similarity=0.82, document_id=1)]
    assert compute_advisory_confidence(high_chunks, weather_confidence="high") == "grounded"

    # 4. High similarity but degraded weather -> partial
    assert compute_advisory_confidence(high_chunks, weather_confidence="low") == "partial"


def test_number_grounding_audit():
    """Verify regex extraction and audit comparison against context snapshot (§17.2)."""
    context_snapshot = {
        "crop": "Wheat",
        "stage": {"stage_name": "Crown Root Initiation", "cumulative_gdd": 210.5},
        "irrigation": {
            "etc_7d_mm": 28.0,
            "rain_7d_mm": 5.0,
            "deficit_mm": 23.0,
        },
        "location": {"lat": 20.0, "lon": 73.8},
        "retrieved_chunk_text": "Apply 120 kg/ha nitrogen in split doses with 1st irrigation at 21 days.",
    }

    # Case A: Response strictly grounded in context
    grounded_text = (
        "Your Wheat is in Crown Root Initiation stage. Over the past 7 days, "
        "your crop required 28mm and received 5mm rain, leaving a deficit of 23mm. "
        "Apply nitrogen at 21 days."
    )
    audit_pass = audit_number_grounding(grounded_text, context_snapshot)
    assert audit_pass["passed"] is True
    assert len(audit_pass["ungrounded_numbers"]) == 0

    # Case B: Response contains hallucinated numbers
    hallucinated_text = (
        "Spray compound at ₹9450 per acre and apply 849 liters at 350 days."
    )
    audit_fail = audit_number_grounding(hallucinated_text, context_snapshot)
    assert audit_fail["passed"] is False
    assert "9450" in audit_fail["ungrounded_numbers"]
    assert "849" in audit_fail["ungrounded_numbers"]
    assert "350" in audit_fail["ungrounded_numbers"]


def test_assemble_advisory_context():
    """Verify context assembly from user inputs and agronomic engines."""
    ctx = assemble_advisory_context(
        query="Should I irrigate my wheat today?",
        crop="Wheat",
        sowing_date_str=(date.today() - timedelta(days=25)).isoformat(),
        soil_type_str="Loamy (दोमट)",
        lat=20.0,
        lon=73.8,
    )

    assert ctx.crop == "Wheat"
    assert ctx.stage is not None
    assert ctx.stage.stage_name != ""
    assert ctx.irrigation is not None
    assert ctx.irrigation.deficit_mm is not None
    # No temperature reading is available offline, so no climate verdict is invented
    # (the old code assumed 25 °C).
    if ctx.weather_summary.get("current") is None and not any(
        d.get("phase") == "today" for d in ctx.weather_summary.get("days", [])
    ):
        assert ctx.climate is None
    else:
        assert ctx.climate is not None
    assert len(ctx.retrieved_chunks) > 0

    snapshot = ctx.to_snapshot()
    assert "stage" in snapshot
    assert "irrigation" in snapshot
    assert "weather_summary" in snapshot


def test_generation_safe_refusal_on_insufficient():
    """Verify safe refusal template triggers when confidence is insufficient (§17.3)."""
    ctx = assemble_advisory_context(
        query="What is the bitcoin price and how to mine crypto?",
        crop="Wheat",
    )
    # Manually simulate out-of-scope retrieval (low similarity)
    ctx.retrieved_chunks = [
        RetrievedChunk(chunk_text="Crypto mining", similarity=0.32, document_id=1)
    ]

    resp = generate_advisory_response(ctx, "What is the bitcoin price?", query_id=1, use_mock=True)

    assert resp.confidence == "insufficient"
    assert "Krishi Vigyan Kendra" in resp.response or "KVK" in resp.response
    assert len(resp.sources) == 0


def test_generation_grounded_response_with_citations():
    """Verify in-scope response cites sources and incorporates computed metrics (§12.2)."""
    ctx = assemble_advisory_context(
        query="How much water should I give to my wheat field?",
        crop="Wheat",
        sowing_date_str=(date.today() - timedelta(days=25)).isoformat(),
        lat=20.0,
        lon=73.8,
    )

    resp = generate_advisory_response(
        ctx,
        "How much water should I give to my wheat field?",
        query_id=2,
        use_mock=True,
    )

    assert resp.confidence in ("grounded", "partial")
    assert resp.computed.growth_stage is not None
    assert resp.computed.irrigation is not None
    assert len(resp.sources) > 0
    # Response includes calculated numbers and citations
    assert "Wheat" in resp.response
    assert "deficit" in resp.response.lower() or "water" in resp.response.lower()
    assert "Source:" in resp.response or len(resp.sources) > 0


def test_advisory_ask_api_endpoint():
    """Verify POST /api/advisory/ask integration endpoint."""
    payload = {
        "crop": "Wheat",
        "query": "Should I irrigate my wheat at crown root initiation?",
        "sowing_date": (date.today() - timedelta(days=22)).isoformat(),
        "soil_type": "Loamy (दोमट)",
        "lat": 20.0,
        "lon": 73.8,
    }

    res = client.post("/api/advisory/ask", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["id"] > 0
    assert data["confidence"] in ("grounded", "partial", "insufficient")
    assert "response" in data
    assert "computed" in data
    assert data["computed"]["growth_stage"]["crop"] == "Wheat"
    assert data["computed"]["irrigation"]["deficit_mm"] is not None


def test_advisory_feedback_api_endpoint():
    """Verify POST /api/advisory/queries/{id}/feedback records feedback."""
    query_repo = get_query_repo()
    q_id = query_repo.log_query(
        user_query="Test question",
        context_snapshot={"test": 1},
        response_text="Test response",
        retrieved_chunk_ids=[1, 2],
        confidence="grounded",
    )

    # Thumbs up
    res_up = client.post(f"/api/advisory/queries/{q_id}/feedback", json={"feedback": 1})
    assert res_up.status_code == 200
    assert res_up.json()["feedback"] == 1

    # Thumbs down
    res_down = client.post(f"/api/advisory/queries/{q_id}/feedback", json={"feedback": -1})
    assert res_down.status_code == 200
    assert res_down.json()["feedback"] == -1

    # Invalid feedback
    res_invalid = client.post(f"/api/advisory/queries/{q_id}/feedback", json={"feedback": 5})
    assert res_invalid.status_code == 400
