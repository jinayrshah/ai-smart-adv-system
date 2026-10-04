import logging
from typing import Any
from fastapi import APIRouter, Depends, Query
import httpx

from app.data.weather.service import WeatherService
from app.schemas.weather import (
    WeatherCurrentResponse,
    WeatherForecastResponse,
    WeatherHistoryResponse,
    WeatherSummaryResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/weather", tags=["Weather"])


def get_weather_service() -> WeatherService:
    return WeatherService()


@router.get("/current", response_model=WeatherCurrentResponse)
def get_current_weather(
    location_id: int | None = Query(None, description="Location database ID"),
    lat: float | None = Query(None, ge=-90.0, le=90.0, description="Latitude coordinate"),
    lon: float | None = Query(None, ge=-180.0, le=180.0, description="Longitude coordinate"),
    service: WeatherService = Depends(get_weather_service),
):
    """
    Get current weather observation with cross-check validator details.
    Architecture §10.2.
    """
    return service.get_current(location_id=location_id, lat=lat, lon=lon)


@router.get("/forecast", response_model=WeatherForecastResponse)
def get_weather_forecast(
    location_id: int | None = Query(None, description="Location database ID"),
    lat: float | None = Query(None, ge=-90.0, le=90.0, description="Latitude coordinate"),
    lon: float | None = Query(None, ge=-180.0, le=180.0, description="Longitude coordinate"),
    days: int = Query(7, ge=1, le=16, description="Forecast horizon in days"),
    service: WeatherService = Depends(get_weather_service),
):
    """
    Get multi-source fused daily weather forecast with confidence ratings.
    Architecture §10.2.
    """
    return service.get_forecast(location_id=location_id, lat=lat, lon=lon, days=days)


@router.get("/history", response_model=WeatherHistoryResponse)
def get_weather_history(
    location_id: int | None = Query(None, description="Location database ID"),
    lat: float | None = Query(None, ge=-90.0, le=90.0, description="Latitude coordinate"),
    lon: float | None = Query(None, ge=-180.0, le=180.0, description="Longitude coordinate"),
    days: int = Query(30, ge=1, le=90, description="History window in days"),
    service: WeatherService = Depends(get_weather_service),
):
    """
    Get fused past weather observations up to 90 days.
    Architecture §10.2.
    """
    return service.get_history(location_id=location_id, lat=lat, lon=lon, days=days)


@router.get("/summary", response_model=WeatherSummaryResponse)
def get_weather_summary(
    location_id: int | None = Query(None, description="Location database ID"),
    lat: float | None = Query(None, ge=-90.0, le=90.0, description="Latitude coordinate"),
    lon: float | None = Query(None, ge=-180.0, le=180.0, description="Longitude coordinate"),
    service: WeatherService = Depends(get_weather_service),
):
    """
    Primary unified weather endpoint: returns current conditions, 7 past days, today,
    7 future forecast days, and agro metrics (Architecture §10.2).
    """
    return service.get_summary(location_id=location_id, lat=lat, lon=lon)


@router.get("/search")
def search_locations(
    query: str = Query(..., min_length=2, description="Place, town, or district name in India"),
) -> dict[str, list[dict[str, Any]]]:
    """
    Search any location in India via Open-Meteo geocoding API for Tier B Explore.
    """
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={query}&count=6&language=en&format=json&country_code=IN"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("results", []):
                    results.append({
                        "name": item.get("name"),
                        "state": item.get("admin1", ""),
                        "district": item.get("admin2", ""),
                        "lat": item.get("latitude"),
                        "lon": item.get("longitude"),
                    })
                return {"results": results}
    except Exception as exc:
        logger.warning(f"Geocoding search failed: {exc}")
    return {"results": []}
