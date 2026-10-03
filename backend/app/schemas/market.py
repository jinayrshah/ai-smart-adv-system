from datetime import date
from pydantic import BaseModel, Field


class DateRange(BaseModel):
    from_date: str = Field(..., serialization_alias="from")
    to_date: str = Field(..., serialization_alias="to")


class CoverageStats(BaseModel):
    expected_days: int
    days_with_data: int
    gaps: list[str]


class TrendPoint(BaseModel):
    date: str
    modal: float | None = None
    min: float | None = None
    max: float | None = None
    n_varieties: int = 0


class MarketTrendResponse(BaseModel):
    commodity: str
    market: str
    state: str
    unit: str = "Rs/Quintal"
    range: DateRange
    coverage: CoverageStats
    sources: dict[str, int]
    as_of: str
    stale: bool
    points: list[TrendPoint]


class LatestPriceRecord(BaseModel):
    id: int | None = None
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    grade: str
    arrival_date: str
    min_price: float | None = None
    max_price: float | None = None
    modal_price: float | None = None
    unit: str = "Rs/Quintal"
    source: str
    quality_flag: str = "ok"


class LatestPricesResponse(BaseModel):
    status: str = "ok"
    count: int
    records: list[LatestPriceRecord]
    as_of: str
    stale: bool


class MarketSearchResult(BaseModel):
    market: str
    district: str
    state: str
    latest_date: str | None = None
    latest_modal: float | None = None
    latest_min: float | None = None
    latest_max: float | None = None
    variety: str = ""
    source: str = ""
    records_available: int = 0


class MarketSearchResponse(BaseModel):
    status: str = "ok"
    commodity: str
    state: str
    market_filter: str = ""
    tier: str  # "advisory" or "explore"
    history_available: bool
    markets: list[MarketSearchResult]
    total_records: int
    as_of: str
