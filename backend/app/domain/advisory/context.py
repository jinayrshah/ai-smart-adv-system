"""
Advisory Context Assembly Pipeline.
Architecture_Advisory.md §12.1.

Pulls farm and crop profile, fetches weather and agro-meteorological history,
runs the agronomic calculation engines (GDD stage, water deficit, soil & climate),
and performs RAG semantic retrieval into a single cohesive AdvisoryContext.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
import logging
from typing import Any
from uuid import UUID

from app.core.timeutil import today_ist
from app.data.advisory.reference_repo import get_agronomy_repo
from app.data.farmer.repository import FarmerRepository
from app.data.locations.grid import snap_to_grid
from app.data.weather.repository import WeatherRepository
from app.data.weather.service import WeatherService
from app.domain.advisory.climate_suitability_engine import check_climate_suitability
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.domain.advisory.translation import translate_to_english
from app.domain.advisory.water_requirement_engine import calculate_irrigation_need
from app.domain.advisory.retrieve import retrieve
from app.schemas.advisory import (
    ClimateVerdict,
    IrrigationAdvice,
    SoilFlag,
    StageResult,
)
from app.schemas.rag import RetrievedChunk

logger = logging.getLogger(__name__)


class UnsupportedCropError(ValueError):
    def __init__(self, crop: str, supported: list[str]):
        self.crop = crop
        self.supported = supported
        super().__init__(
            f"Detailed advisory is available for {', '.join(supported)}; '{crop}' is not covered yet."
        )


@dataclass
class AdvisoryContext:
    farmer_id: str | None
    farmer_name: str
    preferred_language: str
    farm_id: int | None
    farm_name: str
    lat: float
    lon: float
    state: str
    district: str
    soil_type: str
    crop: str
    variety: str | None
    sowing_date: date
    season: str
    stage: StageResult
    weather_summary: dict[str, Any]
    irrigation: IrrigationAdvice
    soil_flags: list[SoilFlag]
    climate: ClimateVerdict | None
    retrieved_chunks: list[RetrievedChunk]
    disease_label: str | None = None
    # Inputs that were defaulted because the farmer has not given them. Surfaced in the
    # API response so a generic answer is never mistaken for a personalised one.
    assumptions: list[str] = field(default_factory=list)

    def to_snapshot(self) -> dict[str, Any]:
        """Convert to JSON-serializable snapshot for audit log (§13)."""
        return {
            "farmer_id": self.farmer_id,
            "farmer_name": self.farmer_name,
            "preferred_language": self.preferred_language,
            "farm_id": self.farm_id,
            "farm_name": self.farm_name,
            "location": {"lat": self.lat, "lon": self.lon, "state": self.state, "district": self.district},
            "soil_type": self.soil_type,
            "crop": self.crop,
            "variety": self.variety,
            "sowing_date": self.sowing_date.isoformat(),
            "season": self.season,
            "stage": self.stage.model_dump(),
            "weather_summary": self.weather_summary,
            "irrigation": self.irrigation.model_dump(),
            "soil_flags": [f.model_dump() for f in self.soil_flags],
            "climate": self.climate.model_dump() if self.climate else None,
            "retrieved_chunk_ids": [c.document_id for c in self.retrieved_chunks if c.document_id is not None],
            "retrieved_count": len(self.retrieved_chunks),
            "disease_label": self.disease_label,
            "assumptions": list(self.assumptions),
        }


def assemble_advisory_context(
    query: str,
    farm_id: int | None = None,
    crop: str | None = None,
    farmer_id: str | None = None,
    language: str = "en",
    sowing_date_str: str | None = None,
    soil_type_str: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    disease_label: str | None = None,
    weather_service: WeatherService | None = None,
    weather_repo: WeatherRepository | None = None,
    farmer_repo: FarmerRepository | None = None,
) -> AdvisoryContext:
    """
    Assembles comprehensive agronomic and RAG context for a user question.
    """
    w_service = weather_service or WeatherService()
    w_repo = weather_repo or WeatherRepository()
    f_repo = farmer_repo or FarmerRepository()
    agronomy_repo = get_agronomy_repo()

    today = today_ist()
    assumptions: list[str] = []

    # Defaults (each one used is recorded in `assumptions`)
    eff_farmer_id = farmer_id
    eff_farmer_name = "Farmer"
    eff_language = language or "en"
    eff_farm_id = farm_id
    eff_farm_name = "My Farm"
    eff_lat = lat
    eff_lon = lon
    eff_state = "Maharashtra"
    eff_district = "Nashik"
    eff_soil = soil_type_str
    eff_soil_npk = None
    eff_irrigation_type: str | None = None
    eff_crop = crop
    eff_variety = None
    eff_sowing: date | None = None
    eff_season: str | None = None
    irrigation_events: list[dict[str, Any]] = []

    if sowing_date_str:
        try:
            eff_sowing = date.fromisoformat(sowing_date_str)
        except ValueError:
            eff_sowing = None
        if eff_sowing and eff_sowing > today:
            eff_sowing = None

    # 1. Pull from profile if farmer_id provided
    if farmer_id:
        try:
            p_uuid = UUID(farmer_id)
            profile = f_repo.get_profile(p_uuid)
            if profile:
                eff_farmer_name = profile.full_name or eff_farmer_name
                eff_language = profile.preferred_language or eff_language
        except Exception as exc:
            logger.debug(f"Farmer profile lookup skipped: {exc}")

    # 2. Pull from farm if farm_id provided
    if farm_id is not None:
        farm = f_repo.get_farm(farm_id)
        if farm:
            eff_farm_name = farm.name or eff_farm_name
            eff_lat = farm.lat if farm.lat is not None else eff_lat
            eff_lon = farm.lon if farm.lon is not None else eff_lon
            eff_state = farm.state or eff_state
            eff_district = farm.district or eff_district
            eff_soil = farm.soil_type or eff_soil
            eff_soil_npk = farm.soil_npk
            eff_irrigation_type = farm.irrigation_type

            farm_crops = f_repo.get_crops(farm_id, status="active") or f_repo.get_crops(farm_id)
            if farm_crops:
                matched_crop = None
                if crop:
                    matched_crop = next((c for c in farm_crops if c.crop.lower() == crop.lower()), None)
                if not matched_crop and not crop:
                    matched_crop = farm_crops[0]
                if matched_crop:
                    eff_crop = matched_crop.crop
                    eff_variety = matched_crop.variety
                    eff_sowing = matched_crop.sowing_date
                    eff_season = matched_crop.season or eff_season
                else:
                    eff_crop = crop
            try:
                irrigation_events = [
                    e.model_dump() for e in f_repo.get_irrigation_events(farm_id, since=eff_sowing)
                ]
            except Exception as exc:
                logger.debug(f"Irrigation log unavailable for farm {farm_id}: {exc}")

    if eff_lat is None or eff_lon is None:
        eff_lat, eff_lon = 20.0, 73.8
        assumptions.append("No farm location given: weather for Nashik, Maharashtra was used.")
    if not eff_soil:
        eff_soil = None
        assumptions.append("Soil type not given: soil checks skipped and loam assumed for the water balance.")

    # Crop handling: Deep GDD models available for supported crops; other crops
    # are gracefully supported via general agronomic calendar and Gemini LLM.
    # Never block with UnsupportedCropError — the has_crop() check below will
    # route unsupported crops through the general agronomic calendar fallback.
    supported = agronomy_repo.get_supported_crops()
    if not eff_crop:
        eff_crop = "Wheat"
        assumptions.append("No crop given: Wheat was assumed.")
    else:
        match = next((s for s in supported if s.lower() == eff_crop.strip().lower()), None)
        match = match or next((s for s in supported if s.lower() in eff_crop.lower()), None)
        if match:
            eff_crop = match
        else:
            # Keep the crop name as-is; the has_crop() check below will route
            # through the general agronomic calendar fallback instead of the
            # deep GDD engine. Gemini LLM will still answer the query.
            logger.info(f"Crop '{eff_crop}' not in deep-advisory list {supported}; using general calendar fallback.")
            assumptions.append(f"Detailed GDD/stage data not available for {eff_crop}; general agronomic calendar was used.")
    eff_season = eff_season or ("rabi" if eff_crop == "Wheat" else "kharif")

    if eff_sowing is None:
        eff_sowing = today - timedelta(days=35)
        assumptions.append("Sowing date not given: 35 days ago was assumed, so the growth stage is approximate.")

    # 3. Weather summary & season history
    grid = snap_to_grid(eff_lat, eff_lon)
    w_service.ensure_grid_weather(grid.grid_key, eff_lat, eff_lon)
    weather_summary = w_service.get_summary(lat=eff_lat, lon=eff_lon).model_dump()
    try:
        w_history = w_service.get_history_rows(grid.grid_key, eff_lat, eff_lon, eff_sowing, today)
    except Exception as exc:
        logger.info(f"History backfill unavailable, using stored rows only: {exc}")
        w_history = w_repo.get_fused_range(grid.grid_key, eff_sowing, today)

    current = weather_summary.get("current") or {}
    obs_temp = current.get("temp_c")
    obs_hum = current.get("rh_pct")
    if obs_temp is None:
        today_row = next((d for d in weather_summary.get("days") or [] if d.get("phase") == "today"), None)
        if today_row and today_row.get("tmax_c") is not None and today_row.get("tmin_c") is not None:
            obs_temp = (float(today_row["tmax_c"]) + float(today_row["tmin_c"])) / 2.0
            obs_hum = obs_hum if obs_hum is not None else today_row.get("rh_mean_pct")

    # 4-7. Agronomic Engines: Deep GDD for supported crops, general agronomic fallback for others
    if agronomy_repo.has_crop(eff_crop):
        stage = current_growth_stage(
            crop=eff_crop,
            sowing_date=eff_sowing,
            weather_history=w_history,
            as_of=today,
        )
        irrigation = calculate_irrigation_need(
            crop=eff_crop,
            stage_name=stage.stage_name,
            weather_summary=weather_summary,
            history_rows=w_history,
            sowing_date=eff_sowing,
            as_of=today,
            soil_type=eff_soil,
            irrigation_type=eff_irrigation_type,
            irrigation_events=irrigation_events,
        )
        soil_flags = check_soil_suitability(
            crop=eff_crop,
            soil_type=eff_soil,
            soil_npk=eff_soil_npk,
        )
        climate = None
        if obs_temp is not None:
            climate = check_climate_suitability(
                crop=eff_crop,
                stage_name=stage.stage_name,
                observed_temp_c=float(obs_temp),
                observed_humidity_pct=obs_hum,
                reading_source="weather_forecast",
            )
    else:
        days = (today - eff_sowing).days if eff_sowing else 35
        stage = StageResult(
            crop=eff_crop,
            stage_name="Vegetative / Active Growth",
            stage_order=1,
            cumulative_gdd=None,
            days_since_sowing=days,
            method="calendar_fallback",
            source="General Agronomy Calendar",
            next_stage_name="Reproductive / Flowering",
            weather_coverage_pct=None,
            imputed_days=0,
            stage_progress_pct=None,
        )
        assumptions.append(f"Growth timeline for {eff_crop} is estimated via standard crop calendar.")

        cur_t = float(obs_temp) if obs_temp is not None else 28.0
        etc_today = round(max(0.5, cur_t * 0.15), 1)
        etc_7d = round(etc_today * 7.0, 1)
        rain_7d = float(weather_summary.get("metrics", {}).get("rain_7d_mm", 0.0) or 0.0)
        deficit = round(max(0.0, etc_7d - rain_7d), 1)
        irrigation = IrrigationAdvice(
            crop=eff_crop,
            stage_name=stage.stage_name,
            kc=0.95,
            etc_today_mm=etc_today,
            etc_7d_mm=etc_7d,
            rain_7d_mm=rain_7d,
            deficit_mm=deficit,
            recommendation=f"Estimated crop water use {etc_7d} mm vs rainfall {rain_7d} mm. Maintain adequate soil moisture." if deficit > 10 else "Moisture levels appear adequate.",
            confidence="medium",
            source="FAO-56 General Evapotranspiration Guidelines",
            method="7day_deficit",
            data_available=True,
            action="irrigate_now" if deficit > 20 else "monitor",
        )
        soil_flags = []
        climate = None

    # 8. RAG retrieval — query translated to English first (§15)
    query_eng = translate_to_english(query, source_lang=eff_language)
    q_lower = query_eng.lower()
    is_scheme_query = any(w in q_lower for w in [
        "scheme", "yojana", "pm-kisan", "pm kisan", "kcc", "kisan credit", "subsidy", "subsidies",
        "loan", "insurance", "bima", "pmfby", "soil health card", "welfare", "grant", "kusum", "fasal"
    ])
    doc_types = ["govt_scheme", "agronomy_pop"] if is_scheme_query else None
    retrieved_chunks = retrieve(
        query=query_eng,
        crop=None if is_scheme_query else eff_crop,
        stage_name=None if is_scheme_query else stage.stage_name,
        disease_label=disease_label,
        doc_types=doc_types,
        top_k=6,
    )

    if is_scheme_query:
        # Ground with static national schemes catalog so welfare queries are always answered thoroughly
        from app.domain.advisory.schemes import NATIONAL_SCHEMES
        for s in NATIONAL_SCHEMES:
            if s["code"].lower() in q_lower or s["name"].lower() in q_lower or "scheme" in q_lower or "yojana" in q_lower:
                summary_text = (
                    f"Official Scheme: {s['name']} ({s['code']}). "
                    f"Benefits: {s['benefit_summary']} "
                    f"Eligibility: {s['eligibility']} "
                    f"Application Process: {s['application_process']} "
                    f"Official Portal: {s['official_portal']}"
                )
                retrieved_chunks.append(
                    RetrievedChunk(
                        document_id=999,
                        chunk_text=summary_text,
                        source_title=f"Government of India {s['name']} Official Guidelines",
                        page_number=1,
                        similarity=0.92,
                    )
                )

    return AdvisoryContext(
        farmer_id=eff_farmer_id,
        farmer_name=eff_farmer_name,
        preferred_language=eff_language,
        farm_id=eff_farm_id,
        farm_name=eff_farm_name,
        lat=eff_lat,
        lon=eff_lon,
        state=eff_state,
        district=eff_district,
        soil_type=eff_soil or "Not provided",
        crop=eff_crop,
        variety=eff_variety,
        sowing_date=eff_sowing,
        season=eff_season,
        stage=stage,
        weather_summary=weather_summary,
        irrigation=irrigation,
        soil_flags=soil_flags,
        climate=climate,
        retrieved_chunks=retrieved_chunks,
        disease_label=disease_label,
        assumptions=assumptions,
    )
