from typing import Any
from pydantic import BaseModel, Field


class WeatherLocationInfo(BaseModel):
    id: int | None = None
    name: str = ""
    state: str = ""
    district: str = ""
    grid_key: str
    lat: float | None = None
    lon: float | None = None


class CurrentWeatherDetail(BaseModel):
    observed_at: str
    temp_c: float | None = None
    rh_pct: float | None = None
    wind_kmh: float | None = None
    precip_mm_1h: float | None = None
    weather_code: int | None = None
    source: str = "open_meteo"
    confidence: str = "medium"  # high | medium | low
    cross_check: dict[str, Any] = Field(default_factory=dict)


class FusedDayDetail(BaseModel):
    date: str
    phase: str  # past | today | future
    tmax_c: float | None = None
    tmin_c: float | None = None
    precip_mm: float | None = None
    precip_prob_pct: float | None = None
    rh_mean_pct: float | None = None
    radiation_mj_m2: float | None = None
    et0_mm: float | None = None
    primary_source: str = "open_meteo"
    validators: list[str] = Field(default_factory=list)
    confidence: str = "medium"
    degraded: bool = False
    disagreement: dict[str, Any] | None = None


class AgroMetricsDetail(BaseModel):
    rain_7d_mm: float = 0.0
    rain_30d_mm: float = 0.0
    rain_30d_vs_normal_pct: float | None = None
    dry_spell_days: int = 0
    tmax_7d_anomaly_c: float | None = None
    et0_7d_mm: float | None = None
    confidence: str = "medium"
    # How many days of each window are actually on file (honesty about coverage)
    days_in_7d_window: int | None = None
    days_in_30d_window: int | None = None


class WeatherCurrentResponse(BaseModel):
    location: WeatherLocationInfo
    as_of: str
    stale: bool
    degraded: bool
    current: CurrentWeatherDetail


class WeatherForecastResponse(BaseModel):
    location: WeatherLocationInfo
    as_of: str
    stale: bool
    degraded: bool
    days: list[FusedDayDetail]


class WeatherHistoryResponse(BaseModel):
    location: WeatherLocationInfo
    as_of: str
    stale: bool
    degraded: bool
    days: list[FusedDayDetail]


class WeatherSummaryResponse(BaseModel):
    location: WeatherLocationInfo
    as_of: str
    stale: bool
    degraded: bool
    current: CurrentWeatherDetail | None = None
    days: list[FusedDayDetail]
    metrics: AgroMetricsDetail
