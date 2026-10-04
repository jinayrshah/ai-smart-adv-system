from datetime import date
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.api.routes.context import get_context_service
from app.data.context.service import ContextService, evaluate_signal_condition
from app.main import app
from app.schemas.context import (
    ContextMarketWeatherResponse,
    PriceContextBlock,
    SignalDetail,
    WeatherContextBlock,
)

client = TestClient(app)


def test_evaluate_signal_condition():
    """Verify safe rule evaluation under restricted namespace."""
    price_ctx = {"latest_modal_price": 2500.0, "volatility_pct": 18.5, "coverage_ratio": 0.8}
    weather_ctx = {
        "rain_7d_mm": 62.0,
        "dry_spell_days": 2,
        "rain_30d_vs_normal_pct": -35.0,
        "tmax_7d_anomaly_c": 3.5,
    }

    # Weather rule
    assert evaluate_signal_condition("weather.rain_7d_mm >= 50.0", price_ctx, weather_ctx) is True
    assert evaluate_signal_condition("weather.dry_spell_days >= 14", price_ctx, weather_ctx) is False

    # Price volatility rule
    assert evaluate_signal_condition("price.volatility_pct >= 15.0", price_ctx, weather_ctx) is True

    # Compound condition
    assert evaluate_signal_condition(
        "weather.rain_30d_vs_normal_pct is not None and weather.rain_30d_vs_normal_pct <= -30.0",
        price_ctx,
        weather_ctx,
    ) is True


def test_context_endpoint_registered():
    """Verify /api/context/market-weather is registered in OpenAPI routes."""
    paths = app.openapi()["paths"]
    assert "/api/context/market-weather" in paths


def test_context_market_weather_mocked():
    """Verify ContextMarketWeatherResponse structure, evidence, and non-predictive copy."""
    mock_service = MagicMock(spec=ContextService)
    mock_service.get_market_weather_context.return_value = ContextMarketWeatherResponse(
        as_of="2026-10-04T12:00:00Z",
        stale=False,
        degraded=False,
        price=PriceContextBlock(
            commodity="Wheat",
            market="Malegaon",
            state="Maharashtra",
            latest_modal_price=2450.0,
            change_7d_pct=2.1,
            change_30d_pct=5.5,
            volatility_pct=4.2,
            coverage_ratio=0.75,
            days_requested=30,
            stale=False,
        ),
        weather=WeatherContextBlock(
            grid_key="20.5,74.5",
            district="Nashik",
            state="Maharashtra",
            rain_7d_mm=55.4,
            rain_30d_mm=120.0,
            rain_30d_vs_normal_pct=15.0,
            dry_spell_days=1,
            tmax_7d_anomaly_c=0.8,
            et0_7d_mm=26.5,
            confidence="high",
            stale=False,
        ),
        signals=[
            SignalDetail(
                rule="heavy_recent_rain",
                name="Heavy Recent Rainfall",
                strength="advisory",
                text="Heavy rainfall (55.4 mm in the last 7 days) recorded in this district. Field harvesting and mandi transit may experience temporary logistical disruption; no price effect is established.",
                evidence={"rain_7d_mm": 55.4},
            )
        ],
    )

    app.dependency_overrides[get_context_service] = lambda: mock_service
    try:
        resp = client.get("/api/context/market-weather?commodity=Wheat&market=Malegaon&days=30")
        assert resp.status_code == 200
        data = resp.json()
        assert data["price"]["commodity"] == "Wheat"
        assert data["price"]["market"] == "Malegaon"
        assert data["weather"]["rain_7d_mm"] == 55.4
        assert len(data["signals"]) == 1
        assert data["signals"][0]["rule"] == "heavy_recent_rain"
        assert data["signals"][0]["evidence"]["rain_7d_mm"] == 55.4

        # CRITICAL PHASE 4 ACCEPTANCE: Copy reviewed - no wording implies a price forecast
        forbidden_phrases = [
            "price will",
            "prices will",
            "expect price",
            "forecast price",
            "price forecast",
            "price target",
            "buy now",
            "sell now",
        ]
        for sig in data["signals"]:
            text_lower = sig["text"].lower()
            for phrase in forbidden_phrases:
                assert phrase not in text_lower, f"Forbidden predictive phrase '{phrase}' found in signal text: {sig['text']}"
    finally:
        app.dependency_overrides.pop(get_context_service, None)


def test_context_service_rule_evaluation_and_capping():
    """Verify ContextService synthesizes price + weather and caps at 3 signals."""
    mock_mandi_repo = MagicMock()
    mock_weather_service = MagicMock()
    mock_locations_repo = MagicMock()

    # Mock 30-day prices with high volatility
    mock_mandi_repo.get_latest_prices.return_value = [
        {"arrival_date": "2026-09-05", "modal_price": 2000.0, "state": "Maharashtra", "district": "Nashik"},
        {"arrival_date": "2026-09-12", "modal_price": 2800.0, "state": "Maharashtra", "district": "Nashik"},
        {"arrival_date": "2026-09-20", "modal_price": 1900.0, "state": "Maharashtra", "district": "Nashik"},
        {"arrival_date": "2026-10-04", "modal_price": 2600.0, "state": "Maharashtra", "district": "Nashik"},
    ]

    mock_locations_repo.get_tracked_locations.return_value = [
        {"name": "Lasalgaon", "district": "Nashik", "state": "Maharashtra", "lat": 20.0, "lon": 73.8, "grid_key": "20.0,73.8"}
    ]

    # Mock weather summary with heavy rain and heat anomaly
    mock_summary = MagicMock()
    mock_summary.stale = False
    mock_summary.degraded = False
    mock_summary.metrics.rain_7d_mm = 65.0
    mock_summary.metrics.rain_30d_mm = 180.0
    mock_summary.metrics.rain_30d_vs_normal_pct = 25.0
    mock_summary.metrics.dry_spell_days = 0
    mock_summary.metrics.tmax_7d_anomaly_c = 3.2
    mock_summary.metrics.et0_7d_mm = 30.0
    mock_summary.metrics.confidence = "high"
    mock_weather_service.get_summary.return_value = mock_summary

    service = ContextService(
        mandi_repo=mock_mandi_repo,
        weather_service=mock_weather_service,
        locations_repo=mock_locations_repo,
    )

    ctx_resp = service.get_market_weather_context("Onion", "Lasalgaon", days=30)
    assert ctx_resp.price.latest_modal_price == 2600.0
    assert ctx_resp.weather.rain_7d_mm == 65.0
    assert len(ctx_resp.signals) <= 3
    assert len(ctx_resp.signals) >= 1

    # Check evidence populated
    rules_triggered = [s.rule for s in ctx_resp.signals]
    assert "heavy_recent_rain" in rules_triggered
