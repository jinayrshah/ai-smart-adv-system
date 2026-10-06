"""
Pydantic schemas for the Personalized Crop Advisory domain engines.
Architecture_Advisory.md §7, §8, §9, §9b.
"""

from datetime import date
from typing import Any, Literal
from pydantic import BaseModel, Field


class CropStageNorm(BaseModel):
    crop: str
    stage_order: int
    stage_name: str
    gdd_base_c: float
    gdd_cumulative_at_stage_end: float
    typical_days_fallback: int | None = None
    source: str


class CropKcReference(BaseModel):
    crop: str
    stage_name: str
    kc: float
    source: str = "FAO-56 Table 12"


class CropSoilSuitability(BaseModel):
    crop: str
    ideal_soil_types: list[str]
    ideal_ph_min: float
    ideal_ph_max: float
    notes: str | None = None
    source: str


class CropClimateSuitability(BaseModel):
    crop: str
    stage_name: str | None = None
    ideal_temp_min_c: float
    ideal_temp_max_c: float
    ideal_humidity_min_pct: float | None = None
    ideal_humidity_max_pct: float | None = None
    notes: str | None = None
    source: str


class StageResult(BaseModel):
    crop: str
    stage_name: str
    stage_order: int
    cumulative_gdd: float
    days_since_sowing: int
    method: Literal["gdd", "calendar_fallback"]
    source: str
    next_stage_name: str | None = None
    gdd_remaining_in_stage: float | None = None


class IrrigationAdvice(BaseModel):
    crop: str
    stage_name: str
    kc: float
    etc_today_mm: float
    etc_7d_mm: float
    rain_7d_mm: float
    deficit_mm: float
    recommendation: str
    confidence: Literal["high", "medium", "low"] = "medium"
    source: str


class SoilFlag(BaseModel):
    flag_type: Literal["soil_type_mismatch", "ph_out_of_range", "low_nitrogen", "low_phosphorus", "low_potassium", "high_nitrogen"]
    actual_value: Any
    expected: Any
    notes: str | None = None
    source: str


class ClimateVerdict(BaseModel):
    crop: str
    stage_name: str | None = None
    verdict: Literal["suitable", "marginal", "unsuitable"]
    observed_temp_c: float
    observed_humidity_pct: float | None = None
    ideal_temp_range: tuple[float, float]
    ideal_humidity_range: tuple[float, float] | None = None
    margin_c: float
    reading_source: Literal["weather_forecast", "iot_live", "manual_input"] = "weather_forecast"
    notes: str | None = None
    source: str


class SoilCheckRequest(BaseModel):
    crop: str
    soil_type: str | None = None
    shc_n: float | None = None
    shc_p: float | None = None
    shc_k: float | None = None
    shc_ph: float | None = None


class AgronomyDiagnosticResponse(BaseModel):
    crop: str
    farm_id: str | None = None
    farm_name: str | None = None
    sowing_date: str
    as_of: str
    stage: StageResult
    irrigation: IrrigationAdvice
    soil_flags: list[SoilFlag]
    climate: ClimateVerdict


class AdvisorySource(BaseModel):
    title: str
    page: int | None = None
    url: str | None = None


class AdvisoryComputedContext(BaseModel):
    growth_stage: StageResult | None = None
    irrigation: IrrigationAdvice | None = None
    soil_flags: list[SoilFlag] = Field(default_factory=list)
    climate: ClimateVerdict | None = None


class AdvisoryAskRequest(BaseModel):
    farm_id: int | None = None
    crop: str | None = None
    query: str
    farmer_id: str | None = None
    language: str = "en"
    sowing_date: str | None = None
    soil_type: str | None = None
    lat: float | None = None
    lon: float | None = None
    disease_label: str | None = None


class AdvisoryAskResponse(BaseModel):
    id: int
    response: str
    confidence: Literal["grounded", "partial", "insufficient"]
    sources: list[AdvisorySource] = Field(default_factory=list)
    computed: AdvisoryComputedContext
    retrieved_chunk_ids: list[int] = Field(default_factory=list)


class AdvisoryFeedbackRequest(BaseModel):
    up: bool | None = None
    feedback: int | None = None  # 1 for up, -1 for down


class AdvisoryFeedbackResponse(BaseModel):
    id: int
    feedback: int
    status: str = "recorded"
