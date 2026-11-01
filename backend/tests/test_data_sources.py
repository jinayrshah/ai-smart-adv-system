"""SoilGrids parsing, KCC Q&A filtering and IMD district bulletins (no network)."""
from datetime import date

import pandas as pd

from app.data.soil.soilgrids import parse, usda_texture
from jobs.ingest_kcc import kcc_passages
from jobs.ingest_imd_agromet import bulletin_date, bulletin_passages


def test_usda_texture_corners():
    assert usda_texture(90, 5, 5) == "Sand"
    assert usda_texture(40, 40, 20) == "Loam"
    assert usda_texture(20, 20, 60) == "Clay"
    assert usda_texture(65, 20, 15) == "Sandy loam"


def test_soilgrids_parse_converts_units_and_flags_no_data():
    layer = lambda name, mean, f: {"name": name, "unit_measure": {"d_factor": f},
                                   "depths": [{"values": {"mean": mean}}, {"values": {"mean": mean}}]}
    data = {"properties": {"layers": [layer("phh2o", 78, 10), layer("clay", 450, 10), layer("sand", 200, 10),
                                      layer("silt", 350, 10), layer("soc", 60, 10)]}}
    out = parse(data)
    assert out["ph"] == 7.8 and out["clay_pct"] == 45.0 and out["texture_class"] == "Clay"
    assert out["suggested_soil_type"] is None  # clay is not mapped to "Black" by guesswork
    assert parse({"properties": {"layers": []}}) is None


def test_kcc_keeps_supported_crops_and_drops_junk():
    df = pd.DataFrame({
        "StateName": ["GUJARAT", "GUJARAT", "GUJARAT", "BIHAR", "GUJARAT"],
        "Crop": ["Cotton", "Cotton", "Groundnut", "Paddy", "Cotton"],
        "QueryText": ["pink bollworm control in cotton", "pink bollworm control in cotton", "tikka disease", "blast in paddy", "ok"],
        "KccAns": ["Install pheromone traps 5 per acre and spray as advised", "Install pheromone traps 5 per acre and spray as advised", "x", "Tricyclazole as advised by KVK", "ok"],
    })
    out = kcc_passages(df, state="gujarat")
    assert len(out) == 1 and out[0]["crop"] == "Cotton" and "KCC expert answer" in out[0]["text"]


def test_bulletin_date_and_passages():
    text = "Agromet Advisory Bulletin Date: 03-11-2026 District Rajkot. Cotton: pick bolls in dry hours."
    assert bulletin_date(text) == date(2026, 11, 3)
    ps = bulletin_passages([(1, text * 3)], "Rajkot", date(2026, 11, 3))
    assert ps and ps[0]["text"].startswith("IMD agromet advisory for Rajkot district, issued 2026-11-03.")


def test_advisor_reads_latest_bulletin_for_the_farm_district(monkeypatch):
    from app.data.advisory.rag_repo import RagRepository, get_rag_repo
    from app.domain.advisory.context import _district_bulletin
    from app.schemas.rag import RagDocumentCreate

    repo = get_rag_repo()
    monkeypatch.setattr(RagRepository, "client", property(lambda self: (_ for _ in ()).throw(RuntimeError("offline"))))
    monkeypatch.setattr(RagRepository, "save_cache", lambda self: None)
    for d, day in [("Rajkot", 1), ("Rajkot", 5), ("Amreli", 6)]:
        doc_id = repo.create_document(RagDocumentCreate(title=f"IMD {d} {day}", doc_type="agromet_advisory", district=d,
                                                        published_on=date(2026, 11, day), source_url="x", license_note="x"))
        repo.add_chunks([{"document_id": doc_id, "crop": None, "doc_type": "agromet_advisory", "chunk_index": 0,
                          "chunk_text": f"{d} day {day}: wheat sowing advice", "page_number": 1, "embedding": None},
                         {"document_id": doc_id, "crop": None, "doc_type": "agromet_advisory", "chunk_index": 1,
                          "chunk_text": f"{d} day {day}: cotton picking advice", "page_number": 1, "embedding": None}])
    got = _district_bulletin("rajkot", "Cotton")
    assert got and got[0].chunk_text == "Rajkot day 5: cotton picking advice"
    assert _district_bulletin("Surat", "Cotton") == []


def test_agromet_endpoint_strips_header_and_404s(monkeypatch):
    from fastapi.testclient import TestClient
    from app.data.advisory.rag_repo import RagRepository
    from app.main import app

    monkeypatch.setattr(RagRepository, "latest_district_document", lambda self, t, d: None if d == "Surat" else (
        {"id": 1, "title": "IMD Agromet Advisory, Rajkot", "district": "Rajkot", "published_on": "2026-11-03", "source_url": "u"},
        [{"chunk_text": "IMD agromet advisory for Rajkot district, issued 2026-11-03. Wheat: sow after 10 Nov."},
         {"chunk_text": "IMD agromet advisory for Rajkot district, issued 2026-11-03. Cotton: pick in dry hours."}]))
    c = TestClient(app)
    body = c.get("/api/advisory/agromet-bulletin?district=Rajkot&crop=Cotton").json()
    assert body["passages"][0] == "Cotton: pick in dry hours."
    assert c.get("/api/advisory/agromet-bulletin?district=Surat").status_code == 404
