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
    # Optional upper development threshold (horizontal cut-off) for GDD, °C
    gdd_upper_c: float | None = None


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
    # None under the calendar fallback: thermal time was NOT measured, so no number
    # is shown (the old code displayed 75 % of the stage threshold as if measured).
    cumulative_gdd: float | None = None
    days_since_sowing: int
    method: Literal["gdd", "calendar_fallback"]
    source: str
    next_stage_name: str | None = None
    gdd_remaining_in_stage: float | None = None
    # Share of days since sowing with Tmax/Tmin on file, and how many missing days
    # were filled with the mean daily GDD of the observed days.
    weather_coverage_pct: float | None = None
    imputed_days: int = 0
    stage_progress_pct: float | None = None
    gdd_upper_c: float | None = None


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
    # --- added: method + FAO-56 root-zone water balance details -------------
    method: Literal["fao56_water_balance", "7day_deficit", "insufficient_data"] = "7day_deficit"
    data_available: bool = True
    effective_rain_7d_mm: float | None = None
    root_zone_depletion_mm: float | None = None
    taw_mm: float | None = None
    raw_mm: float | None = None
    root_depth_m: float | None = None
    days_to_stress: int | None = None
    forecast_rain_3d_mm: float | None = None
    forecast_rain_prob_max_pct: float | None = None
    net_irrigation_mm: float | None = None
    gross_irrigation_mm: float | None = None
    action: Literal["irrigate_now", "wait_for_rain", "no_irrigation_needed", "monitor", "unknown"] = "monitor"
    assumptions: list[str] = Field(default_factory=list)
    reading_source: str = "weather_estimate"  # weather_estimate | iot_live


class SoilFlag(BaseModel):
    flag_type: Literal[
        "soil_type_mismatch", "ph_out_of_range", "low_nitrogen", "low_phosphorus",
        "low_potassium", "high_nitrogen", "low_organic_carbon",
    ]
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
    climate: ClimateVerdict | None = None
    irrigation_events_logged: int = 0


class AdvisorySource(BaseModel):
    title: str
    page: int | None = None
    url: str | None = None


class AdvisoryComputedContext(BaseModel):
    growth_stage: StageResult | None = None
    irrigation: IrrigationAdvice | None = None
    soil_flags: list[SoilFlag] = Field(default_factory=list)
    climate: ClimateVerdict | None = None
    # Inputs that were defaulted because the farmer has not provided them (shown in the
    # UI so a generic answer is never mistaken for a personalised one).
    assumptions: list[str] = Field(default_factory=list)


class AdvisoryAskRequest(BaseModel):
    farm_id: int | None = None
    crop: str | None = None
    query: str = Field(..., min_length=1, max_length=1000)
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
    # §17.2 post-generation number audit result (numbers not traceable to context)
    ungrounded_numbers: list[str] = Field(default_factory=list)
    generated_by: str = "deterministic"  # gemini model id or 'deterministic'


class AdvisoryFeedbackRequest(BaseModel):
    up: bool | None = None
    feedback: int | None = None  # 1 for up, -1 for down


class AdvisoryFeedbackResponse(BaseModel):
    id: int
    feedback: int
    status: str = "recorded"


class DiseaseTreatmentExtract(BaseModel):
    source_title: str
    page_number: int | None = None
    treatment_text: str
    similarity: float


class DiseaseCheckResponse(BaseModel):
    crop: str
    label: str
    scientific_name: str | None = None
    confidence: float
    confidence_status: Literal["high", "moderate", "low"]
    advisory_note: str
    treatments: list[DiseaseTreatmentExtract] = Field(default_factory=list)
    # 'model' = trained classifier; 'unavailable' = no trained model installed (no
    # diagnosis is invented); 'rejected' = image unusable / outside known classes.
    status: Literal["model", "unavailable", "rejected"] = "model"
    model_version: str | None = None
    top_k: list[dict[str, Any]] = Field(default_factory=list)


class GovernmentScheme(BaseModel):
    code: str
    name: str
    category: Literal[
        "income_support",
        "crop_insurance",
        "credit_finance",
        "soil_health",
        "infrastructure",
        "organic_farming",
    ]
    benefit_summary: str
    eligibility: str
    application_process: str
    official_portal: str


class SchemeAskRequest(BaseModel):
    query: str
    scheme_code: str | None = None
    language: str = "en"


class SchemeAskResponse(BaseModel):
    query: str
    answer: str
    confidence: Literal["grounded", "partial", "insufficient"]
    schemes: list[GovernmentScheme] = Field(default_factory=list)
    sources: list[AdvisorySource] = Field(default_factory=list)
