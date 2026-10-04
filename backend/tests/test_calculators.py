import pytest
from fastapi.testclient import TestClient

from app.data.calculators.service import CalculatorService
from app.main import app
from app.schemas.calculators import MarginEstimateResponse, StorageEstimateResponse

client = TestClient(app)


def test_margin_calculator_known_crop_state():
    """
    Test margin calculation for a tracked crop and state on file in DES Cost of Cultivation reference.
    Must cite DES survey year, never fabricate numbers.
    """
    resp = client.get("/api/market/margin?crop=Wheat&state=Punjab&field_size_acres=2.5&price_per_qtl=2400")
    assert resp.status_code == 200
    data = resp.json()
    assert data is not None
    assert data["crop"] == "Wheat"
    assert data["state"] == "Punjab"
    assert data["field_size_acres"] == 2.5
    assert data["price_per_qtl"] == 2400.0
    assert data["cost_year"] == "2022-23"
    assert "DES Cost of Cultivation" in data["source"]
    assert data["cost_c2_per_qtl"] > 0
    assert data["margin_per_qtl"] == round(2400.0 - data["cost_c2_per_qtl"], 2)
    assert data["est_total_margin"] is not None
    assert "State reference average" in data["notice"]


def test_margin_calculator_unknown_crop_returns_null():
    """
    Architecture §9b.1 acceptance:
    Margin endpoint returns null with a clear reason for a crop/state combo with no cost data on file,
    never a fabricated number.
    """
    resp = client.get("/api/market/margin?crop=Dragonfruit&state=Punjab&field_size_acres=1.0")
    assert resp.status_code == 200
    assert resp.json() is None


def test_margin_calculator_unknown_state_returns_null():
    """
    Margin endpoint returns null if the state is not covered in DES for that crop.
    """
    resp = client.get("/api/market/margin?crop=Wheat&state=Goa&field_size_acres=1.0")
    assert resp.status_code == 200
    assert resp.json() is None


def test_storage_estimator_refuses_non_storable_crops():
    """
    Architecture §9b.2 acceptance:
    Storage endpoint correctly refuses non-storable crops (Sugarcane, Tomato)
    rather than calculating meaningless numbers.
    """
    # Test Sugarcane
    resp_sugar = client.get("/api/market/storage-estimate?crop=Sugarcane&market=Kolhapur&state=Maharashtra")
    assert resp_sugar.status_code == 200
    data_sugar = resp_sugar.json()
    assert data_sugar["storable"] is False
    assert data_sugar["breakeven_price_per_qtl"] is None
    assert "non-storable" in data_sugar["reason"].lower() or "sucrose" in data_sugar["reason"].lower()

    # Test Tomato
    resp_tomato = client.get("/api/market/storage-estimate?crop=Tomato&market=Kolar&state=Karnataka")
    assert resp_tomato.status_code == 200
    data_tomato = resp_tomato.json()
    assert data_tomato["storable"] is False
    assert data_tomato["breakeven_price_per_qtl"] is None
    assert "non-storable" in data_tomato["reason"].lower() or "perishable" in data_tomato["reason"].lower()


def test_storage_estimator_storable_crop_breakeven():
    """
    Storage estimator calculates holding fees, shrinkage loss, and breakeven price
    for storable commodities like Wheat, Potato, Maize.
    """
    resp = client.get(
        "/api/market/storage-estimate?crop=Wheat&market=Khanna&state=Punjab&storage_cost_per_qtl_per_month=30&months=3&current_price=2200"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["storable"] is True
    assert data["current_price_per_qtl"] == 2200.0
    assert data["storage_months"] == 3
    assert data["storage_cost_per_qtl_month"] == 30.0
    assert data["typical_loss_pct_per_month"] is not None
    # 3 months * 30 = 90 rs fee + shrinkage
    assert data["net_cost_per_qtl"] > 90.0
    assert data["breakeven_price_per_qtl"] == round(2200.0 + data["net_cost_per_qtl"], 2)
    assert "WDRA" in data["source"] or "Post-Harvest" in data["source"]


def test_calculator_service_direct():
    """Direct unit test of CalculatorService methods."""
    service = CalculatorService()
    
    # Margin test
    margin = service.calculate_margin("Rice", "Punjab", field_size_acres=2.0, price_per_qtl=2600.0)
    assert margin is not None
    assert isinstance(margin, MarginEstimateResponse)
    assert margin.cost_year == "2022-23"

    # Non storable test
    storage = service.calculate_storage("Sugarcane", "Meerut", "Uttar Pradesh")
    assert isinstance(storage, StorageEstimateResponse)
    assert storage.storable is False
