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
                if not matched_crop:
                    matched_crop = farm_crops[0]
                eff_crop = matched_crop.crop
                eff_variety = matched_crop.variety
                eff_sowing = matched_crop.sowing_date
                eff_season = matched_crop.season or eff_season
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

    # Crop must be one of the deep-advisory crops. Never silently answer for a different
    # crop (the old code swapped any unknown crop for Wheat).
    supported = agronomy_repo.get_supported_crops()
    if not eff_crop:
        eff_crop = "Wheat"
        assumptions.append("No crop given: Wheat was assumed.")
    elif eff_crop not in supported:
        match = next((s for s in supported if s.lower() == eff_crop.strip().lower()), None)
        match = match or next((s for s in supported if s.lower() in eff_crop.lower()), None)
        if not match:
            raise UnsupportedCropError(eff_crop, supported)
        eff_crop = match
    eff_season = eff_season or ("rabi" if eff_crop == "Wheat" else "kharif")

    if eff_sowing is None:
        eff_sowing = today - timedelta(days=35)
        assumptions.append("Sowing date not given: 35 days ago was assumed, so the growth stage is approximate.")

    # 3. Weather summary & season history (backfilled from the sowing date so the GDD
    #    engine can use thermal time instead of the calendar fallback — cleanup doc A4)
    grid = snap_to_grid(eff_lat, eff_lon)
    w_service.ensure_grid_weather(grid.grid_key, eff_lat, eff_lon)
    weather_summary = w_service.get_summary(lat=eff_lat, lon=eff_lon).model_dump()
    try:
        w_history = w_service.get_history_rows(grid.grid_key, eff_lat, eff_lon, eff_sowing, today)
    except Exception as exc:
        logger.info(f"History backfill unavailable, using stored rows only: {exc}")
        w_history = w_repo.get_fused_range(grid.grid_key, eff_sowing, today)

    # 4. Engine 1: Growth Stage (GDD accumulation)
    stage = current_growth_stage(
        crop=eff_crop,
        sowing_date=eff_sowing,
        weather_history=w_history,
        as_of=today,
    )

    # 5. Engine 2: Irrigation (FAO-56 root-zone water balance, 7-day fallback)
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

    # 6. Engine 3: Soil Suitability
    soil_flags = check_soil_suitability(
        crop=eff_crop,
        soil_type=eff_soil,
        soil_npk=eff_soil_npk,
    )

    # 7. Engine 4: Climate Suitability — current observation, else today's fused mean.
    #    No reading at all -> no verdict (never a made-up temperature).
    current = weather_summary.get("current") or {}
    obs_temp = current.get("temp_c")
    obs_hum = current.get("rh_pct")
    if obs_temp is None:
        today_row = next((d for d in weather_summary.get("days") or [] if d.get("phase") == "today"), None)
        if today_row and today_row.get("tmax_c") is not None and today_row.get("tmin_c") is not None:
            obs_temp = (float(today_row["tmax_c"]) + float(today_row["tmin_c"])) / 2.0
            obs_hum = obs_hum if obs_hum is not None else today_row.get("rh_mean_pct")
    climate = None
    if obs_temp is not None:
        climate = check_climate_suitability(
            crop=eff_crop,
            stage_name=stage.stage_name,
            observed_temp_c=float(obs_temp),
            observed_humidity_pct=obs_hum,
            reading_source="weather_forecast",
        )

    # 8. RAG retrieval — query translated to English first (§15)
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
