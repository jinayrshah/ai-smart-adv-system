"""
Unit & Integration Tests for Government Schemes Section and Q&A Engine.
Architecture_Advisory.md §16, Implementationplan_Advisory.md Phase 6.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domain.advisory.schemes import (
    NATIONAL_SCHEMES,
    answer_scheme_query,
    get_all_schemes,
    get_scheme_by_code,
)

client = TestClient(app)


def test_national_schemes_catalog_structure():
    """Verify that all 6 core national schemes exist with complete metadata."""
    schemes = get_all_schemes()
    assert len(schemes) == 6
    codes = {s.code for s in schemes}
    assert codes == {"PM-KISAN", "PMFBY", "KCC", "SHC", "AIF", "PKVY"}

    pm_kisan = get_scheme_by_code("PM-KISAN")
    assert pm_kisan is not None
    assert "₹6,000" in pm_kisan.benefit_summary
    assert pm_kisan.category == "income_support"
    assert "pmkisan.gov.in" in pm_kisan.official_portal


def test_scheme_catalog_filtering():
    """Verify category filtering and text search over scheme catalog."""
    credit_schemes = get_all_schemes(category="credit_finance")
    assert len(credit_schemes) == 1
    assert credit_schemes[0].code == "KCC"

    insurance_schemes = get_all_schemes(query="crop loss failure")
    assert len(insurance_schemes) >= 1
    assert any(s.code == "PMFBY" for s in insurance_schemes)


def test_known_scheme_question_pm_kisan():
    """Verify PM-KISAN question returns correctly-sourced answer with ₹6,000 and 3 installments (§16 Acceptance)."""
    resp = answer_scheme_query(
        query="How much annual financial assistance does PM-KISAN provide and in how many installments?",
        scheme_code="PM-KISAN",
        use_mock=True,
    )
    assert resp.confidence in ("grounded", "partial")
    assert "6,000" in resp.answer or "6000" in resp.answer
    assert "2,000" in resp.answer or "installment" in resp.answer.lower()
    assert len(resp.sources) > 0


def test_known_scheme_question_pmfby_premium():
    """Verify PMFBY premium rate question returns correctly-sourced answer (§16 Acceptance)."""
    resp = answer_scheme_query(
        query="What is the subsidized premium rate under PMFBY for Kharif and Rabi crops?",
        scheme_code="PMFBY",
        use_mock=True,
    )
    assert resp.confidence in ("grounded", "partial")
    assert "2.0%" in resp.answer or "2%" in resp.answer
    assert "1.5%" in resp.answer or "Rabi" in resp.answer
    assert len(resp.sources) > 0


def test_known_scheme_question_kcc_interest():
    """Verify KCC interest subvention question returns correctly-sourced answer (§16 Acceptance)."""
    resp = answer_scheme_query(
        query="What is the effective net interest rate on Kisan Credit Card loans with prompt repayment?",
        scheme_code="KCC",
        use_mock=True,
    )
    assert resp.confidence in ("grounded", "partial")
    assert "4%" in resp.answer or "7%" in resp.answer
    assert "subvention" in resp.answer.lower() or "interest" in resp.answer.lower()


def test_out_of_scope_scheme_safe_refusal():
    """Verify ungrounded/unknown scheme query triggers safe refusal without hallucinations (§16)."""
    resp = answer_scheme_query(
        query="How to claim free gold tokens in the National Satellite Moon Mining Grant?",
        use_mock=True,
    )
    assert resp.confidence == "insufficient"
    assert "farmer.gov.in" in resp.answer or "Krishi Vigyan Kendra" in resp.answer or "KVK" in resp.answer


def test_api_schemes_catalog_endpoint():
    """Verify GET /api/advisory/schemes/catalog endpoint."""
    res = client.get("/api/advisory/schemes/catalog")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 6
    codes = [item["code"] for item in data]
    assert "PM-KISAN" in codes
    assert "KCC" in codes


def test_api_schemes_ask_endpoint():
    """Verify POST /api/advisory/schemes/ask endpoint."""
    payload = {
        "query": "What are the benefits and interest subvention under Kisan Credit Card?",
        "scheme_code": "KCC",
    }
    res = client.post("/api/advisory/schemes/ask", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["query"] == payload["query"]
    assert data["confidence"] in ("grounded", "partial")
    assert "answer" in data
    assert len(data["schemes"]) > 0
    assert data["schemes"][0]["code"] == "KCC"
