from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any


@dataclass(frozen=True)
class MandiRecord:
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    grade: str
    arrival_date: date
    min_price: float | None
    max_price: float | None
    modal_price: float | None
    arrivals_tonnes: float | None = None
    unit: str = "Rs/Quintal"
    source: str = "datagov_live"  # datagov_live | agmarknet_pkg | ceda | kaggle_seed
    source_priority: int = 100
    quality_flag: str = "ok"

    def unique_key(self) -> tuple[str, str, str, str, str, str, date]:
        """Unique deduplication tuple matching DB constraint mandi_prices_uniq."""
        return (
            self.state,
            self.district,
            self.market,
            self.commodity,
            self.variety,
            self.grade,
            self.arrival_date,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize for Supabase RPC upsert_mandi_prices."""
        return {
            "state": self.state,
            "district": self.district,
            "market": self.market,
            "commodity": self.commodity,
            "variety": self.variety,
            "grade": self.grade,
            "arrival_date": self.arrival_date.isoformat(),
            "min_price": self.min_price,
            "max_price": self.max_price,
            "modal_price": self.modal_price,
            "arrivals_tonnes": self.arrivals_tonnes,
            "unit": self.unit,
            "source": self.source,
            "source_priority": self.source_priority,
            "quality_flag": self.quality_flag,
        }


@dataclass(frozen=True)
class GridPoint:
    grid_key: str
    lat: float
    lon: float


@dataclass
class WeatherDay:
    grid_key: str
    date: date
    source: str
    kind: str  # forecast | recent | archive
    tmax_c: float | None = None
    tmin_c: float | None = None
    tmean_c: float | None = None
    precip_mm: float | None = None
    precip_prob_pct: float | None = None
    rh_mean_pct: float | None = None
    wind_max_kmh: float | None = None
    radiation_mj_m2: float | None = None
    et0_mm: float | None = None
    soil_moisture_top: float | None = None
    spread_tmax_c: float | None = None
    spread_precip_mm: float | None = None
    models_rain_frac: float | None = None


@dataclass
class WeatherCurrent:
    grid_key: str
    observed_at: datetime
    source: str
    temp_c: float | None
    rh_pct: float | None
    wind_kmh: float | None
    precip_mm_1h: float | None
    weather_code: int | None
    confidence: str = "high"
    cross_check: dict[str, Any] = field(default_factory=dict)


@dataclass
class FusedDay:
    grid_key: str
    date: date
    phase: str  # past | today | future
    tmax_c: float | None = None
    tmin_c: float | None = None
    precip_mm: float | None = None
    precip_prob_pct: float | None = None
    rh_mean_pct: float | None = None
    radiation_mj_m2: float | None = None
    et0_mm: float | None = None
    primary_source: str = "open_meteo"
    validators: list[str] = field(default_factory=list)
    confidence: str = "high"  # high | medium | low
    degraded: bool = False
    disagreement: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "grid_key": self.grid_key,
            "date": self.date.isoformat(),
            "phase": self.phase,
            "tmax_c": self.tmax_c,
            "tmin_c": self.tmin_c,
            "precip_mm": self.precip_mm,
            "precip_prob_pct": self.precip_prob_pct,
            "rh_mean_pct": self.rh_mean_pct,
            "radiation_mj_m2": self.radiation_mj_m2,
            "et0_mm": self.et0_mm,
            "primary_source": self.primary_source,
            "validators": self.validators,
            "confidence": self.confidence,
            "degraded": self.degraded,
            "disagreement": self.disagreement,
        }


@dataclass
class AgroMetrics:
    rain_7d_mm: float = 0.0
    rain_30d_mm: float = 0.0
    rain_30d_vs_normal_pct: float | None = None
    dry_spell_days: int = 0
    tmax_7d_anomaly_c: float | None = None
    et0_7d_mm: float | None = None
    confidence: str = "medium"
    days_in_7d_window: int | None = None
    days_in_30d_window: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "days_in_7d_window": self.days_in_7d_window,
            "days_in_30d_window": self.days_in_30d_window,
            "rain_7d_mm": round(self.rain_7d_mm, 1),
            "rain_30d_mm": round(self.rain_30d_mm, 1),
            "rain_30d_vs_normal_pct": round(self.rain_30d_vs_normal_pct, 1) if self.rain_30d_vs_normal_pct is not None else None,
            "dry_spell_days": self.dry_spell_days,
            "tmax_7d_anomaly_c": round(self.tmax_7d_anomaly_c, 1) if self.tmax_7d_anomaly_c is not None else None,
            "et0_7d_mm": round(self.et0_7d_mm, 1) if self.et0_7d_mm is not None else None,
            "confidence": self.confidence,
        }


@dataclass
class CropScope:
    key: str
    display: str
    aliases: list[str]


@dataclass
class TrackedScope:
    crops: list[CropScope]
    states: list[str]
    priority_markets: dict[str, list[str]] = field(default_factory=dict)
    market_aliases: dict[str, dict[str, list[str]]] = field(default_factory=dict)
    mandi_watch_max_tracked: int = 300
    weather_ondemand_max_new_grids: int = 300
