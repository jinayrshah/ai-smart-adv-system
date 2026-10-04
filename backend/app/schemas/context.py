from typing import Any
from pydantic import BaseModel, Field


class PriceContextBlock(BaseModel):
    commodity: str = Field(..., description="Crop commodity name")
    market: str = Field(..., description="Mandi market name")
    state: str = Field(..., description="State name")
    latest_modal_price: float | None = Field(None, description="Latest modal price in ₹/quintal")
    change_7d_pct: float | None = Field(None, description="7-day modal price change in %")
    change_30d_pct: float | None = Field(None, description="30-day modal price change in %")
    volatility_pct: float | None = Field(None, description="30-day price coefficient of variation in %")
    coverage_ratio: float = Field(..., description="Fraction of days with recorded arrivals in window (0.0 - 1.0)")
    days_requested: int = Field(30, description="Analysis window in days")
    stale: bool = Field(False, description="True if latest price arrival is older than 36 hours")


class WeatherContextBlock(BaseModel):
    grid_key: str = Field(..., description="0.1° ERA5-Land grid coordinate")
    district: str = Field("", description="District name for this grid")
    state: str = Field("", description="State name for this grid")
    rain_7d_mm: float = Field(0.0, description="7-day accumulated rainfall in mm")
    rain_30d_mm: float = Field(0.0, description="30-day accumulated rainfall in mm")
    rain_30d_vs_normal_pct: float | None = Field(None, description="30-day rainfall vs 15-yr normal %")
    dry_spell_days: int = Field(0, description="Consecutive dry days with <1mm rain")
    tmax_7d_anomaly_c: float | None = Field(None, description="7-day max temperature anomaly in °C")
    et0_7d_mm: float | None = Field(None, description="7-day evapotranspiration in mm")
    confidence: str = Field("medium", description="Fused weather confidence: high | medium | low")
    stale: bool = Field(False, description="True if weather observations are older than 12 hours")


class SignalDetail(BaseModel):
    rule: str = Field(..., description="Rule identifier from signals.yaml")
    name: str = Field(..., description="Human-readable signal title")
    strength: str = Field("info", description="Signal strength: advisory | info")
    text: str = Field(..., description="Strictly descriptive observation text (non-predictive)")
    evidence: dict[str, Any] = Field(default_factory=dict, description="Numerical evidence values backing the signal")


class ContextMarketWeatherResponse(BaseModel):
    as_of: str = Field(..., description="UTC ISO timestamp of generation")
    stale: bool = Field(False, description="True if price or weather data is stale")
    degraded: bool = Field(False, description="True if fallback source or proxy was used")
    price: PriceContextBlock
    weather: WeatherContextBlock
    signals: list[SignalDetail] = Field(default_factory=list, description="Descriptive context signals (max 3)")
