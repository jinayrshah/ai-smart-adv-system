from datetime import date
from fastapi import APIRouter, Depends, Query

from app.core.timeutil import now_utc_iso
from app.data.calculators.service import CalculatorService
from app.data.mandi.repository import MandiRepository
from app.data.mandi.series import build_market_trend, is_stale_data
from app.data.mandi.service import get_market_search
from app.schemas.calculators import MarginEstimateResponse, StorageEstimateResponse
from app.schemas.market import (
    LatestPriceRecord,
    LatestPricesResponse,
    MarketSearchResponse,
    MarketSearchResult,
    MarketTrendResponse,
)

router = APIRouter(prefix="/api/market", tags=["Market"])


def get_repo() -> MandiRepository:
    return MandiRepository()


def get_calculator_service() -> CalculatorService:
    return CalculatorService()


@router.get("/prices/latest", response_model=LatestPricesResponse)
def get_latest_prices(
    commodity: str | None = Query(None, description="Commodity name (e.g. Wheat, Rice)"),
    state: str | None = Query(None, description="State name (e.g. Maharashtra, Gujarat)"),
    district: str | None = Query(None, description="District name"),
    market: str | None = Query(None, description="Market name (e.g. Lasalgaon, Rajkot)"),
    limit: int = Query(50, ge=1, le=500, description="Max rows to return"),
    repo: MandiRepository = Depends(get_repo),
):
    """
    Query the latest mandi price reports.
    Maintains backward compatibility with the existing market route parameters.
    """
    rows = repo.get_latest_prices(
        commodity=commodity,
        state=state,
        district=district,
        market=market,
        limit=limit,
    )
    records = [
        LatestPriceRecord(
            id=r.get("id"),
            state=r.get("state", ""),
            district=r.get("district", ""),
            market=r.get("market", ""),
            commodity=r.get("commodity", ""),
            variety=r.get("variety", ""),
            grade=r.get("grade", ""),
            arrival_date=str(r.get("arrival_date", "")),
            min_price=float(r["min_price"]) if r.get("min_price") is not None else None,
            max_price=float(r["max_price"]) if r.get("max_price") is not None else None,
            modal_price=float(r["modal_price"]) if r.get("modal_price") is not None else None,
            unit=r.get("unit", "Rs/Quintal"),
            source=r.get("source", "datagov_live"),
            quality_flag=r.get("quality_flag", "ok"),
        )
        for r in rows
    ]

    newest_date: date | None = None
    if records and records[0].arrival_date:
        try:
            newest_date = date.fromisoformat(records[0].arrival_date)
        except ValueError:
            pass

    return LatestPricesResponse(
        status="ok",
        count=len(records),
        records=records,
        as_of=now_utc_iso(),
        stale=is_stale_data(newest_date),
    )


@router.get("/trend", response_model=MarketTrendResponse)
def get_price_trend(
    commodity: str = Query(..., description="Canonical commodity name (e.g. Wheat)"),
    market: str = Query(..., description="Market name (e.g. Lasalgaon)"),
    state: str = Query(..., description="State name (e.g. Maharashtra)"),
    days: int = Query(30, description="Number of days: 7, 30, 90, 180"),
    repo: MandiRepository = Depends(get_repo),
):
    """
    Retrieve unbroken date-spine price trend series for Recharts.
    Missing dates within the requested window are rendered as nulls with gaps listed.
    """
    return build_market_trend(
        repo=repo,
        commodity=commodity,
        market=market,
        state=state,
        days=days,
    )


@router.get("/search", response_model=MarketSearchResponse)
def search_market(
    commodity: str = Query(..., description="Commodity name (any crop)"),
    state: str = Query(..., description="State name"),
    market: str = Query("", description="Market name (optional)"),
    district: str = Query("", description="District name (optional)"),
    repo: MandiRepository = Depends(get_repo),
):
    """
    Search any crop at any market in India (Tier B Explore).
    Returns today's price (live lookup on cache miss for untracked pairs),
    registers the pair in mandi_watch for future daily ingestion,
    and enforces LRU eviction at the configured cap.
    """
    result = get_market_search(
        repo=repo,
        commodity=commodity,
        state=state,
        market=market,
        district=district,
    )
    return MarketSearchResponse(
        commodity=result["commodity"],
        state=result["state"],
        market_filter=result["market_filter"],
        tier=result["tier"],
        history_available=result["history_available"],
        markets=[MarketSearchResult(**m) for m in result["markets"]],
        total_records=result["total_records"],
        as_of=now_utc_iso(),
    )


@router.get("/margin", response_model=MarginEstimateResponse | None)
def get_crop_margin(
    crop: str = Query(..., description="Crop commodity name (e.g. Wheat, Rice, Cotton)"),
    state: str = Query(..., description="State name (e.g. Maharashtra, Punjab)"),
    field_size_acres: float = Query(1.0, ge=0.01, le=10000.0, description="Field size in acres"),
    market: str | None = Query(None, description="Optional mandi market name"),
    price_per_qtl: float | None = Query(None, description="Optional current price (if omitted, latest market price is used)"),
    service: CalculatorService = Depends(get_calculator_service),
):
    """
    Calculate estimated crop margin using DES Cost of Cultivation reference data.
    Architecture §9b.1.
    Returns null if no reference cost data exists for this crop and state (never fabricates).
    """
    return service.calculate_margin(
        crop=crop,
        state=state,
        field_size_acres=field_size_acres,
        market=market,
        price_per_qtl=price_per_qtl,
    )


@router.get("/storage-estimate", response_model=StorageEstimateResponse)
def get_storage_estimate(
    crop: str = Query(..., description="Crop commodity name (e.g. Wheat, Potato, Sugarcane)"),
    market: str = Query(..., description="Mandi market name"),
    state: str | None = Query(None, description="State name (optional, resolved from market if omitted)"),
    storage_cost_per_qtl_per_month: float = Query(25.0, ge=0.0, description="Farmer's monthly storage cost ₹/qtl"),
    months: int = Query(1, ge=1, le=12, description="Storage duration in months"),
    current_price: float | None = Query(None, description="Optional baseline intake price ₹/qtl"),
    service: CalculatorService = Depends(get_calculator_service),
):
    """
    Estimate hold-vs-sell storage costs and breakeven price.
    Architecture §9b.2.
    Explicitly refuses non-storable crops (e.g. Sugarcane, Tomato).
    """
    resolved_state = state or ""
    if not resolved_state:
        latest = service.mandi_repo.get_latest_prices(market=market, commodity=crop, limit=1)
        if latest and latest[0].get("state"):
            resolved_state = latest[0]["state"]

    return service.calculate_storage(
        crop=crop,
        market=market,
        state=resolved_state,
        storage_cost_per_qtl_month=storage_cost_per_qtl_per_month,
        months=months,
        current_price_per_qtl=current_price,
    )
