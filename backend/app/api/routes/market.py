from datetime import date
from fastapi import APIRouter, Depends, Query

from app.core.timeutil import now_utc_iso
from app.data.mandi.repository import MandiRepository
from app.data.mandi.series import build_market_trend, is_stale_data
from app.schemas.market import (
    LatestPriceRecord,
    LatestPricesResponse,
    MarketTrendResponse,
)

router = APIRouter(prefix="/api/market", tags=["Market"])


def get_repo() -> MandiRepository:
    return MandiRepository()


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
