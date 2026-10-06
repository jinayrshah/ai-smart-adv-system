"""
Unit tests for RAG Knowledge Pipeline (Chunking, Embeddings, Semantic Matching).
Architecture_Advisory.md §10.1, §10.2, §10.3, §17.4, §18.
"""

import pytest
from fastapi.testclient import TestClient

from app.data.advisory.rag_repo import get_rag_repo
from app.domain.advisory.embeddings import get_gemini_embedding
from app.domain.advisory.retrieve import retrieve
from jobs.ingest_document import chunk_text_semantically, detect_crop_in_text
from app.main import app

client = TestClient(app)


def test_semantic_chunking():
    sample_text = (
        "Wheat is an essential rabi cereal crop. Optimum sowing time is between November 1 and November 20. "
        "Apply recommended dose of fertilizers: 120 kg N, 60 kg P2O5, and 40 kg K2O per hectare. "
        "Irrigation at Crown Root Initiation (CRI) stage is critical to prevent yield decline. "
        "Yellow rust is a major fungal threat in the north-western plain zone. Monitor weekly."
    )
    chunks = chunk_text_semantically(sample_text, page_num=12, target_chars=200, overlap_chars=40)
    assert len(chunks) >= 2
    assert chunks[0]["page"] == 12
    assert "Wheat" in chunks[0]["text"]


def test_crop_detection():
    assert detect_crop_in_text("High yielding Rice varieties like BPT 5204") == "Rice"
    assert detect_crop_in_text("Cotton square formation and boll development") == "Cotton"
    assert detect_crop_in_text("General tractor maintenance guide") is None


def test_embedding_shape_and_norm():
    """Verify gemini embedding produces exact 768-dimensional unit-normalized vector."""
    emb = get_gemini_embedding("Wheat nitrogen fertilizer management", use_mock=True)
    assert len(emb) == 768
    # Test normalization
    norm = sum(v * v for v in emb)
    assert pytest.approx(norm, abs=0.01) == 1.0


def test_in_scope_retrieval_relevance():
    """Verify retrieval returns relevant knowledge chunks with high similarity."""
    results = retrieve(
        query="PM-KISAN financial income support installment amount",
        doc_types=["govt_scheme"],
        top_k=3,
        use_mock_embedding=False,
    )

    assert len(results) > 0
    top = results[0]
    assert "PM-KISAN" in top.chunk_text or "₹6,000" in top.chunk_text or "installment" in top.chunk_text
    assert top.similarity >= 0.50


def test_crop_filtering_isolation():
    """Verify crop-filtered query does not leak into other crops."""
    repo = get_rag_repo()
    repo.add_chunks([
        {
            "document_id": 998,
            "crop": "Cotton",
            "doc_type": "disease_treatment",
            "chunk_text": "Pink bollworm management in Bt cotton using pheromone traps.",
            "chunk_index": 0,
            "page_number": 45,
            "embedding": get_gemini_embedding("Pink bollworm Bt cotton pheromone traps", use_mock=True),
        },
        {
            "document_id": 999,
            "crop": "Wheat",
            "doc_type": "disease_treatment",
            "chunk_text": "Yellow rust management in wheat using propiconazole 25 EC.",
            "chunk_index": 0,
            "page_number": 88,
            "embedding": get_gemini_embedding("Yellow rust wheat propiconazole", use_mock=True),
        },
    ])

    results = retrieve(
        query="yellow rust treatment",
        crop="Wheat",
        doc_types=["disease_treatment"],
        top_k=2,
        use_mock_embedding=True,
    )

    assert len(results) > 0
    for r in results:
        assert r.crop in ("Wheat", None)
        assert r.crop != "Cotton"


def test_out_of_scope_query_distinguishable():
    """
    Architecture §17.4 rule: out-of-scope query must return low similarity
    distinguishable from grounded threshold (similarity < 0.60).
    """
    results = retrieve(
        query="quantum chromodynamics quark gluon plasma particle accelerator",
        crop="Wheat",
        top_k=3,
        use_mock_embedding=True,
    )
    # Even if top match returned, similarity must be low
    if results:
        assert results[0].similarity < 0.60


def test_api_retrieval_and_schemes_routes():
    """Test REST API endpoints for RAG semantic search and government schemes."""
    # 1. POST /api/advisory/retrieve
    res = client.post("/api/advisory/retrieve", json={
        "query": "crop insurance premium subsidy PMFBY",
        "top_k": 3
    })
    assert res.status_code == 200
    chunks = res.json()
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    assert "PMFBY" in chunks[0]["chunk_text"] or "insurance" in chunks[0]["chunk_text"]

    # 2. GET /api/advisory/schemes
    res_schemes = client.get("/api/advisory/schemes?query=Kisan Credit Card loan interest rate")
    assert res_schemes.status_code == 200
    scheme_chunks = res_schemes.json()
    assert isinstance(scheme_chunks, list)
    assert len(scheme_chunks) > 0
    assert any("KCC" in c["chunk_text"] or "Credit" in c["chunk_text"] for c in scheme_chunks)
