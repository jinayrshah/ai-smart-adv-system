from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_latest_prices_endpoint():
    resp = client.get("/api/market/prices/latest?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "records" in data
    assert "count" in data
    assert "as_of" in data


def test_market_trend_endpoint_structure():
    resp = client.get("/api/market/trend?commodity=Wheat&market=Pune&state=Maharashtra&days=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data["commodity"] == "Wheat"
    assert data["market"] == "Pune"
    assert data["state"] == "Maharashtra"
    assert data["coverage"]["expected_days"] == 30
    assert len(data["points"]) == 30
    assert "gaps" in data["coverage"]
    assert "sources" in data
    assert "as_of" in data
