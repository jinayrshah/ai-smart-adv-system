from fastapi import APIRouter, Depends, Query

from app.data.context.service import ContextService
from app.schemas.context import ContextMarketWeatherResponse

router = APIRouter(prefix="/api/context", tags=["Context"])


def get_context_service() -> ContextService:
    return ContextService()


@router.get("/market-weather", response_model=ContextMarketWeatherResponse)
def get_market_weather_context(
    commodity: str = Query(..., description="Crop commodity name (e.g. Onion, Wheat)"),
    market: str = Query(..., description="Mandi market name (e.g. Lasalgaon, Pune)"),
    state: str | None = Query(None, description="State name (optional)"),
    days: int = Query(30, ge=7, le=90, description="Analysis window in days (7, 30, or 90)"),
    service: ContextService = Depends(get_context_service),
):
    """
    Unified Context endpoint (Architecture §10.4):
    Returns coherent price block + district weather block + up to 3 rule-based
    descriptive signals with numerical evidence backing each observation.
    """
    return service.get_market_weather_context(
        commodity=commodity,
        market=market,
        state=state,
        days=days,
    )
