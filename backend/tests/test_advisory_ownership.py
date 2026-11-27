"""Advisory routes must not expose or act on another farmer's farm or answers."""

from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from tests.test_farmer_auth import TEST_SECRET, _make_jwt

client = TestClient(app)

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200


def _farm_for(owner: str, monkeypatch) -> int:
    """Create a farm owned by `owner` with auth switched off, then switch auth on."""
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(get_settings(), "JWT_SECRET", "")
    client.post("/api/farmer/profile", json={"id": owner, "full_name": "Owner"})
    res = client.post("/api/farmer/farms", json={
        "farmer_id": owner, "name": "Plot", "lat": 21.1, "lon": 72.8, "state": "Gujarat", "district": "Surat",
    })
    assert res.status_code == 201, res.text
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    return res.json()["id"]


def test_diagnostic_rejects_other_farmer(monkeypatch):
    farm_id = _farm_for(str(uuid4()), monkeypatch)
    other = _make_jwt(str(uuid4()))
    res = client.get(f"/api/advisory/diagnostic?farm_id={farm_id}", headers={"Authorization": f"Bearer {other}"})
    assert res.status_code == 403


def test_diagnostic_requires_sign_in_when_auth_on(monkeypatch):
    farm_id = _farm_for(str(uuid4()), monkeypatch)
    res = client.get(f"/api/advisory/diagnostic?farm_id={farm_id}")
    assert res.status_code == 401


def test_ask_rejects_other_farmers_farm(monkeypatch):
    farm_id = _farm_for(str(uuid4()), monkeypatch)
    other = _make_jwt(str(uuid4()))
    res = client.post("/api/advisory/ask", json={"query": "When to irrigate?", "farm_id": farm_id},
                      headers={"Authorization": f"Bearer {other}"})
    assert res.status_code == 403


def test_ask_rejects_other_farmer_id(monkeypatch):
    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", TEST_SECRET)
    me = _make_jwt(str(uuid4()))
    res = client.post("/api/advisory/ask", json={"query": "hi", "farmer_id": str(uuid4())},
                      headers={"Authorization": f"Bearer {me}"})
    assert res.status_code == 403


def test_disease_check_rejects_large_upload(monkeypatch):
    monkeypatch.setattr(get_settings(), "DISEASE_MAX_UPLOAD_BYTES", 1000)
    res = client.post("/api/advisory/disease-check",
                      files={"file": ("leaf.png", _PNG + b"\x00" * 2000, "image/png")})
    assert res.status_code == 413


def test_disease_check_rejects_non_image(monkeypatch):
    res = client.post("/api/advisory/disease-check", files={"file": ("x.txt", b"a" * 500, "text/plain")})
    assert res.status_code == 415
