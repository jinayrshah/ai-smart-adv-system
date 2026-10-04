from datetime import date
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.api.routes.weather import get_weather_service
from app.data.weather.service import WeatherService
from app.main import app

client = TestClient(app)


def test_weather_endpoints_registered():
    """Verify all weather routes are mounted."""
    paths = app.openapi()["paths"]
    assert "/api/weather/current" in paths
    assert "/api/weather/forecast" in paths
    assert "/api/weather/history" in paths
    assert "/api/weather/summary" in paths


def test_weather_summary_contract_mocked():
    """Verify WeatherSummaryResponse conforms to Pydantic schema."""
    mock_service = MagicMock(spec=WeatherService)
    mock_service.get_summary.return_value = {
        "location": {
            "id": 1,
            "name": "Nashik",
            "state": "Maharashtra",
            "district": "Nashik",
            "grid_key": "20.0,73.8",
            "lat": 20.0,
            "lon": 73.8,
        },
        "as_of": "2026-10-04T12:00:00Z",
        "stale": False,
        "degraded": False,
        "current": {
            "observed_at": "2026-10-04T12:00:00Z",
            "temp_c": 29.5,
            "rh_pct": 68,
            "wind_kmh": 12.0,
            "precip_mm_1h": 0.0,
            "weather_code": 0,
            "source": "open_meteo",
            "confidence": "high",
            "cross_check": {"openweather": {"temp_c": 29.0}},
        },
        "days": [
            {
                "date": "2026-10-04",
                "phase": "today",
                "tmax_c": 31.0,
                "tmin_c": 21.0,
                "precip_mm": 0.0,
                "precip_prob_pct": 10,
                "rh_mean_pct": 65,
                "primary_source": "open_meteo",
                "validators": ["openweather"],
                "confidence": "high",
                "degraded": False,
                "disagreement": None,
            }
        ],
        "metrics": {
            "rain_7d_mm": 12.5,
            "rain_30d_mm": 65.0,
            "rain_30d_vs_normal_pct": 10.5,
            "dry_spell_days": 2,
            "tmax_7d_anomaly_c": 0.5,
            "et0_7d_mm": 28.0,
            "confidence": "high",
        },
    }

    app.dependency_overrides[get_weather_service] = lambda: mock_service
    try:
        resp = client.get("/api/weather/summary?lat=20.0&lon=73.8")
        assert resp.status_code == 200
        data = resp.json()
        assert data["location"]["name"] == "Nashik"
        assert data["current"]["temp_c"] == 29.5
        assert len(data["days"]) == 1
        assert data["metrics"]["rain_7d_mm"] == 12.5
    finally:
        app.dependency_overrides.pop(get_weather_service, None)


def test_provider_outage_resilience_never_500():
    """
    CRITICAL ACCEPTANCE TEST:
    Forcing Open-Meteo to fail yields a degraded/stale response, never a 500 error.
    """
    mock_weather_repo = MagicMock()
    mock_locations_repo = MagicMock()
    mock_open_meteo = MagicMock()

    # Force Open-Meteo to raise network exception
    mock_open_meteo.fetch_forecast_and_recent.side_effect = RuntimeError("Open-Meteo 503 Outage")

    mock_locations_repo.get_by_id.return_value = None
    mock_locations_repo.get_by_grid_key.return_value = {
        "id": 1,
        "name": "Nashik",
        "state": "Maharashtra",
        "district": "Nashik",
        "grid_key": "20.0,73.8",
        "lat": 20.0,
        "lon": 73.8,
    }
    mock_locations_repo.get_tracked_locations.return_value = [
        {"id": 1, "name": "Nashik", "grid_key": "20.0,73.8", "lat": 20.0, "lon": 73.8}
    ]

    # Return cached data from repository
    today_str = date.today().isoformat()
    mock_weather_repo.get_fused_range.return_value = [
        {
            "grid_key": "20.0,73.8",
            "date": today_str,
            "phase": "today",
            "tmax_c": 28.0,
            "tmin_c": 20.0,
            "precip_mm": 0.0,
            "primary_source": "openweather",
            "confidence": "medium",
            "degraded": True,
        }
    ]
    mock_weather_repo.get_current.return_value = {
        "grid_key": "20.0,73.8",
        "observed_at": "2026-10-04T00:00:00Z",
        "temp_c": 27.5,
        "rh_pct": 70,
        "wind_kmh": 10.0,
        "source": "openweather",
        "confidence": "medium",
    }
    mock_weather_repo.get_normals.return_value = []

    resilient_service = WeatherService(
        weather_repo=mock_weather_repo,
        locations_repo=mock_locations_repo,
        open_meteo=mock_open_meteo,
    )

    app.dependency_overrides[get_weather_service] = lambda: resilient_service
    try:
        resp = client.get("/api/weather/summary?lat=20.0&lon=73.8")
        assert resp.status_code == 200
        data = resp.json()
        assert data["degraded"] is True
    finally:
        app.dependency_overrides.pop(get_weather_service, None)


def test_weather_search_endpoint(monkeypatch):
    """Test /api/weather/search endpoint for Tier B Explore."""
    class MockHttpxResponse:
        status_code = 200
        def json(self):
            return {
                "results": [
                    {
                        "name": "Nagpur",
                        "latitude": 21.15,
                        "longitude": 79.08,
                        "admin1": "Maharashtra",
                        "admin2": "Nagpur",
                    }
                ]
            }

    class MockHttpxClient:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def get(self, url):
            return MockHttpxResponse()

    import httpx
    monkeypatch.setattr(httpx, "Client", MockHttpxClient)

    resp = client.get("/api/weather/search?query=Nagpur")
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) == 1
    assert data["results"][0]["name"] == "Nagpur"
    assert data["results"][0]["lat"] == 21.15
    assert data["results"][0]["lon"] == 79.08


def test_weather_explore_cap_exceeded_serves_nearest_tracked_grid_degraded():
    """
    CRITICAL ACCEPTANCE TEST (Phase 3B):
    Exceeding the daily new-grid cap serves the nearest tracked grid with degraded=true instead of failing.
    """
    mock_locations_repo = MagicMock()
    mock_weather_repo = MagicMock()
    mock_open_meteo = MagicMock()

    # Cap exceeded
    mock_locations_repo.get_by_id.return_value = None
    mock_locations_repo.get_by_grid_key.return_value = None
    mock_locations_repo.count_new_grids_today.return_value = 301  # over cap (300)
    mock_locations_repo.find_nearest_tracked_grid.return_value = {
        "id": 1,
        "name": "Nashik",
        "state": "Maharashtra",
        "district": "Nashik",
        "grid_key": "20.0,73.8",
        "lat": 20.0,
        "lon": 73.8,
    }

    mock_weather_repo.get_fused_range.return_value = []
    mock_weather_repo.get_current.return_value = None
    mock_weather_repo.get_normals.return_value = []

    service = WeatherService(
        weather_repo=mock_weather_repo,
        locations_repo=mock_locations_repo,
        open_meteo=mock_open_meteo,
    )

    app.dependency_overrides[get_weather_service] = lambda: service
    try:
        # Request a distant untracked coordinate (e.g. 25.5, 85.0)
        resp = client.get("/api/weather/summary?lat=25.5&lon=85.0")
        assert resp.status_code == 200
        data = resp.json()
        # Must serve nearest tracked location with degraded=true
        assert data["degraded"] is True
        assert data["location"]["name"] == "Nashik"
    finally:
        app.dependency_overrides.pop(get_weather_service, None)

