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
    first_reported_date: str | None = None
    max_gap_days: int = 0
    varieties_included: list[str] = Field(default_factory=list)
    # Honest thin-data handling (Revisions §2.7): number of market-days with a report in
    # the window; changes are only computed against a real report ~7 / ~30 days earlier.
    reports_in_window: int = 0
    thin_data: bool = False
    latest_date: str | None = None
    latest_modal: float | None = None
    change_7d_pct: float | None = None
    change_7d_base_date: str | None = None
    change_30d_pct: float | None = None
    change_30d_base_date: str | None = None
    market_names_merged: list[str] = Field(default_factory=list)


class MarketInsightResponse(BaseModel):
    status: str = "ok"
    commodity: str
    market: str
    state: str
    insight: str
    confidence: str = "medium"  # "high" | "medium" | "low"
    coverage_pct: int
    as_of: str
    generated_by: str = "deterministic"
    reports_in_window: int | None = None


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
