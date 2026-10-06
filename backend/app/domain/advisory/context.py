"""
Advisory Context Assembly Pipeline.
Architecture_Advisory.md §12.1.

Pulls farm and crop profile, fetches weather and agro-meteorological history,
runs the agronomic calculation engines (GDD stage, water deficit, soil & climate),
and performs RAG semantic retrieval into a single cohesive AdvisoryContext.
"""

from dataclasses import dataclass
from datetime import date, timedelta
import logging
from typing import Any
from uuid import UUID

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
    climate: ClimateVerdict
    retrieved_chunks: list[RetrievedChunk]
    disease_label: str | None = None

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
            "climate": self.climate.model_dump(),
            "retrieved_chunk_ids": [c.document_id for c in self.retrieved_chunks if c.document_id is not None],
            "retrieved_count": len(self.retrieved_chunks),
            "disease_label": self.disease_label,
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

    # Defaults
    eff_farmer_id = farmer_id
    eff_farmer_name = "Farmer"
    eff_language = language or "en"
    eff_farm_id = farm_id
    eff_farm_name = "My Farm"
    eff_lat = lat if lat is not None else 20.0
    eff_lon = lon if lon is not None else 73.8
    eff_state = "Maharashtra"
    eff_district = "Nashik"
    eff_soil = soil_type_str or "Loamy (दोमट)"
    eff_soil_npk = None
    eff_crop = crop or "Wheat"
    eff_variety = None
    eff_season = "rabi" if eff_crop == "Wheat" else "kharif"

    # Sowing date default (30 days ago if not provided)
    if sowing_date_str:
        try:
            eff_sowing = date.fromisoformat(sowing_date_str)
        except ValueError:
            eff_sowing = date.today() - timedelta(days=35)
    else:
        eff_sowing = date.today() - timedelta(days=35)

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

            # Match active farm crop
            farm_crops = f_repo.get_crops(farm_id)
            if farm_crops:
                matched_crop = None
                if crop:
                    matched_crop = next((c for c in farm_crops if c.crop.lower() == crop.lower()), None)
                if not matched_crop:
                    matched_crop = farm_crops[0]
                eff_crop = matched_crop.crop
                eff_variety = matched_crop.variety
                eff_sowing = matched_crop.sowing_date
                eff_season = matched_crop.season or eff_season

    # Ensure crop is recognized in agronomy catalog; fallback to closest match if necessary
    supported = agronomy_repo.get_supported_crops()
    if eff_crop not in supported:
        for s in supported:
            if s.lower() in eff_crop.lower():
                eff_crop = s
                break
        else:
            eff_crop = "Wheat"  # safe default

    # 3. Weather summaries & history
    grid = snap_to_grid(eff_lat, eff_lon)
    w_service.ensure_grid_weather(grid.grid_key, eff_lat, eff_lon)
    weather_summary = w_service.get_summary(lat=eff_lat, lon=eff_lon).model_dump()
    w_history = w_repo.get_fused_range(grid.grid_key, eff_sowing, date.today())

    # 4. Engine 1: Growth Stage (GDD accumulation)
    stage = current_growth_stage(
        crop=eff_crop,
        sowing_date=eff_sowing,
        weather_history=w_history,
        as_of=date.today(),
    )

    # 5. Engine 2: Irrigation (Water Deficit)
    irrigation = calculate_irrigation_need(
        crop=eff_crop,
        stage_name=stage.stage_name,
        weather_summary=weather_summary,
    )

    # 6. Engine 3: Soil Suitability
    soil_flags = check_soil_suitability(
        crop=eff_crop,
        soil_type=eff_soil,
        soil_npk=eff_soil_npk,
    )

    # 7. Engine 4: Climate Suitability
    curr_temp = weather_summary.get("current", {}).get("temp_c") if weather_summary.get("current") else None
    curr_hum = weather_summary.get("current", {}).get("rh_pct") if weather_summary.get("current") else None
    climate = check_climate_suitability(
        crop=eff_crop,
        stage_name=stage.stage_name,
        observed_temp_c=curr_temp if curr_temp is not None else 25.0,
        observed_humidity_pct=curr_hum,
        reading_source="weather_forecast",
    )

    # 8. RAG Semantic Retrieval
    # Translate query to English if necessary before embedding lookup (§15)
    query_eng = translate_to_english(query, source_lang=eff_language)
    retrieved_chunks = retrieve(
        query=query_eng,
        crop=eff_crop,
        stage_name=stage.stage_name,
        disease_label=disease_label,
        top_k=6,
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
        soil_type=eff_soil,
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
    )
