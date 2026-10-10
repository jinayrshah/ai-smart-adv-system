from datetime import date
from fastapi import APIRouter, Depends, Query

from app.core.timeutil import now_utc_iso
from app.data.calculators.service import CalculatorService
from app.data.mandi.insight import generate_market_insight
from app.data.mandi.repository import MandiRepository
from app.data.mandi.series import build_market_trend, is_stale_data
from app.data.mandi.service import get_market_search
from app.schemas.calculators import MarginEstimateResponse, StorageEstimateResponse
from app.schemas.market import (
    LatestPriceRecord,
    LatestPricesResponse,
    MarketInsightResponse,
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
    include_flagged: bool = Query(False, description="Whether to include statistical outlier records"),
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
        include_flagged=include_flagged,
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


@router.get("/insight", response_model=MarketInsightResponse)
def get_market_insight_route(
    commodity: str = Query(..., description="Commodity name (e.g. Wheat)"),
    market: str = Query(..., description="Market name (e.g. Lasalgaon)"),
    state: str = Query(..., description="State name (e.g. Maharashtra)"),
    days: int = Query(30, description="Window size in days for trend context"),
    repo: MandiRepository = Depends(get_repo),
    calc_service: CalculatorService = Depends(get_calculator_service),
):
    """
    Grounded 2-3 sentence AI synthesis of market conditions (Gemini 2.5 Flash).
    Architecture §10.4 & Revisions Priority 2.3.
    Strictly non-predictive; only interprets existing numbers.
    """
    trend = build_market_trend(
        repo=repo,
        commodity=commodity,
        market=market,
        state=state,
        days=days,
    )

    expected = trend.coverage.expected_days or 1
    actual = trend.coverage.days_with_data
    cov = int(round((actual / expected) * 100))

    valid_points = [p for p in trend.points if p.modal is not None]
    change7d_pct = None
    change30d_pct = None
    latest_price = valid_points[-1].modal if valid_points else None

    if len(valid_points) >= 2:
        if len(valid_points) >= 7 and valid_points[-7].modal:
            base7 = valid_points[-7].modal
            if base7 > 0 and latest_price:
                change7d_pct = round(((latest_price - base7) / base7) * 100, 1)
        if len(valid_points) >= 1 and valid_points[0].modal:
            base30 = valid_points[0].modal
            if base30 > 0 and latest_price:
                change30d_pct = round(((latest_price - base30) / base30) * 100, 1)

    margin = calc_service.calculate_margin(
        crop=commodity,
        state=state,
        market=market,
        price_per_qtl=latest_price,
    )
    cost_c2 = margin.cost_c2_per_qtl if margin else None
    net_margin = margin.margin_per_qtl if margin else None

    storage = None
    try:
        storage = calc_service.calculate_storage(
            crop=commodity,
            market=market,
            state=state,
            current_price_per_qtl=latest_price,
        )
    except Exception:
        pass
    breakeven = storage.breakeven_price_per_qtl if (storage and storage.storable) else None

    ctx = {
        "commodity": commodity,
        "market": market,
        "state": state,
        "latest_price": latest_price,
        "unit": trend.unit,
        "change7d_pct": change7d_pct,
        "change30d_pct": change30d_pct,
        "coverage_pct": cov,
        "gaps_count": len(trend.coverage.gaps),
        "cost_c2": cost_c2,
        "net_margin": net_margin,
        "breakeven_price": breakeven,
        "weather_signals": [],
    }

    res = generate_market_insight(ctx)
    return MarketInsightResponse(
        status="ok",
        commodity=commodity,
        market=market,
        state=state,
        insight=res["insight"],
        confidence=res["confidence"],
        coverage_pct=res["coverage_pct"],
        as_of=now_utc_iso(),
    )

