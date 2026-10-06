"""
API endpoints for Agronomy Computation Engines (GDD, Water Deficit, Soil & Climate).
Architecture_Advisory.md §7, §8, §9, §9b.
"""

from datetime import date
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from app.data.advisory.query_repo import get_query_repo
from app.data.advisory.reference_repo import get_agronomy_repo
from app.data.farmer.repository import FarmerRepository
from app.data.locations.grid import snap_to_grid
from app.data.weather.repository import WeatherRepository
from app.data.weather.service import WeatherService
from app.domain.advisory.climate_suitability_engine import check_climate_suitability
from app.domain.advisory.context import assemble_advisory_context
from app.domain.advisory.generator import generate_advisory_response
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.soil_suitability_engine import check_soil_suitability
from app.domain.advisory.water_requirement_engine import calculate_irrigation_need
from app.domain.advisory.retrieve import retrieve
from app.schemas.advisory import (
    AdvisoryAskRequest,
    AdvisoryAskResponse,
    AdvisoryFeedbackRequest,
    AdvisoryFeedbackResponse,
    AgronomyDiagnosticResponse,
    ClimateVerdict,
    CropStageNorm,
    IrrigationAdvice,
    SoilCheckRequest,
    SoilFlag,
    StageResult,
)
from app.schemas.rag import RetrievalRequest, RetrievedChunk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/advisory", tags=["Advisory Engines"])

weather_service = WeatherService()
weather_repo = WeatherRepository()
agronomy_repo = get_agronomy_repo()
farmer_repo = FarmerRepository()
query_repo = get_query_repo()


@router.get("/crops", response_model=list[str])
def list_crops():
    """Return all supported agronomic deep-advisory crops."""
    return agronomy_repo.get_supported_crops()


@router.get("/crops/{crop}/stages", response_model=list[CropStageNorm])
def get_crop_stages(crop: str):
    """Return stage norms, GDD thresholds, and fallback days for a given crop."""
    try:
        return agronomy_repo.get_stages(crop)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/stage", response_model=StageResult)
def compute_growth_stage(
    crop: str = Query(..., description="Crop name (e.g. Wheat, Rice, Cotton)"),
    sowing_date: str = Query(..., description="Sowing date (YYYY-MM-DD)"),
    lat: float | None = Query(None, description="Farm latitude"),
    lon: float | None = Query(None, description="Farm longitude"),
    as_of: str | None = Query(None, description="Calculation reference date (YYYY-MM-DD)"),
):
    """
    Compute current physiological growth stage using cumulative GDD over weather history.
    Degrades gracefully to calendar fallback if weather history is incomplete.
    """
    try:
        s_date = date.fromisoformat(sowing_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid sowing_date format. Use YYYY-MM-DD.")

    calc_as_of = date.fromisoformat(as_of) if as_of else date.today()

    weather_history: list[dict[str, Any]] = []
    if lat is not None and lon is not None:
        grid_key = snap_to_grid(lat, lon)
        weather_service.ensure_grid_weather(grid_key, lat, lon)
        weather_history = weather_repo.get_fused_range(grid_key, s_date, calc_as_of)

    try:
        return current_growth_stage(
            crop=crop,
            sowing_date=s_date,
            weather_history=weather_history,
            as_of=calc_as_of,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/water", response_model=IrrigationAdvice)
def compute_irrigation(
    crop: str = Query(..., description="Crop name"),
    stage_name: str = Query(..., description="Growth stage name"),
    lat: float | None = Query(None, description="Latitude"),
    lon: float | None = Query(None, description="Longitude"),
):
    """
    Compute crop evapotranspiration (ETc) and 7-day irrigation deficit.
    """
    eff_lat = lat if lat is not None else 20.0
    eff_lon = lon if lon is not None else 73.8

    try:
        weather_sum = weather_service.get_summary(lat=eff_lat, lon=eff_lon).model_dump()
        return calculate_irrigation_need(crop=crop, stage_name=stage_name, weather_summary=weather_sum)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/soil", response_model=list[SoilFlag])
def check_soil(payload: SoilCheckRequest):
    """
    Evaluate soil texture and Soil Health Card parameters against crop requirements.
    """
    try:
        soil_npk = {
            "n": payload.shc_n,
            "p": payload.shc_p,
            "k": payload.shc_k,
            "ph": payload.shc_ph,
        }
        return check_soil_suitability(
            crop=payload.crop,
            soil_type=payload.soil_type,
            soil_npk=soil_npk,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/climate", response_model=ClimateVerdict)
def check_climate(
    crop: str = Query(..., description="Crop name"),
    stage_name: str | None = Query(None, description="Growth stage name"),
    temp_c: float | None = Query(None, description="Ambient or IoT temperature (°C)"),
    humidity_pct: float | None = Query(None, description="Relative humidity (%)"),
    lat: float | None = Query(None, description="Farm latitude"),
    lon: float | None = Query(None, description="Farm longitude"),
):
    """
    Evaluate temperature & humidity suitability against crop thermal tolerances.
    """
    obs_temp = temp_c
    obs_hum = humidity_pct
    reading_src = "manual_input" if temp_c is not None else "weather_forecast"

    if obs_temp is None:
        eff_lat = lat if lat is not None else 20.0
        eff_lon = lon if lon is not None else 73.8
        w_sum = weather_service.get_summary(lat=eff_lat, lon=eff_lon)
        if w_sum.current and w_sum.current.temp_c is not None:
            obs_temp = w_sum.current.temp_c
            obs_hum = w_sum.current.rh_pct
        else:
            obs_temp = 25.0

    try:
        return check_climate_suitability(
            crop=crop,
            stage_name=stage_name,
            observed_temp_c=obs_temp,
            observed_humidity_pct=obs_hum,
            reading_source=reading_src,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/diagnostic", response_model=AgronomyDiagnosticResponse)
def get_farm_diagnostic(
    farm_id: str = Query(..., description="UUID or ID of the farm"),
    crop_id: str | None = Query(None, description="Optional specific farm crop ID"),
):
    """
    Executes a complete 4-engine agronomic diagnostic for an onboarded farm and its active crop.
    Runs Growth Stage (GDD), Water Deficit (ETc), Soil Health Check, and Climate Check.
    """
    farm = farmer_repo.get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    crops = farmer_repo.get_crops_by_farm(farm_id)
    if not crops:
        raise HTTPException(status_code=400, detail="No active crops registered for this farm.")

    selected_crop = None
    if crop_id:
        selected_crop = next((c for c in crops if c.id == crop_id), None)
    if not selected_crop:
        selected_crop = crops[0]

    try:
        s_date = date.fromisoformat(selected_crop.sowing_date)
    except ValueError:
        s_date = date.today()

    lat = farm.lat or 20.0
    lon = farm.lon or 73.8
    grid_key = farm.agromet_grid_id or snap_to_grid(lat, lon)

    # 1. Fetch weather summary & history
    weather_service.ensure_grid_weather(grid_key, lat, lon)
    w_sum = weather_service.get_summary(lat=lat, lon=lon)
    w_history = weather_repo.get_fused_range(grid_key, s_date, date.today())

    # 2. Growth stage
    stage_res = current_growth_stage(
        crop=selected_crop.crop_name,
        sowing_date=s_date,
        weather_history=w_history,
        as_of=date.today(),
    )

    # 3. Water deficit
    irrigation_res = calculate_irrigation_need(
        crop=selected_crop.crop_name,
        stage_name=stage_res.stage_name,
        weather_summary=w_sum.model_dump(),
    )

    # 4. Soil flags
    soil_npk = {
        "n": farm.shc_n,
        "p": farm.shc_p,
        "k": farm.shc_k,
        "ph": farm.shc_ph,
    }
    soil_flags = check_soil_suitability(
        crop=selected_crop.crop_name,
        soil_type=farm.soil_type,
        soil_npk=soil_npk,
    )

    # 5. Climate check
    curr_temp = w_sum.current.temp_c if w_sum.current and w_sum.current.temp_c is not None else 25.0
    curr_hum = w_sum.current.rh_pct if w_sum.current else None
    climate_res = check_climate_suitability(
        crop=selected_crop.crop_name,
        stage_name=stage_res.stage_name,
        observed_temp_c=curr_temp,
        observed_humidity_pct=curr_hum,
        reading_source="weather_forecast",
    )

    return AgronomyDiagnosticResponse(
        crop=selected_crop.crop_name,
        farm_id=farm.id,
        farm_name=farm.farm_name,
        sowing_date=selected_crop.sowing_date,
        as_of=date.today().isoformat(),
        stage=stage_res,
        irrigation=irrigation_res,
        soil_flags=soil_flags,
        climate=climate_res,
    )


@router.post("/retrieve", response_model=list[RetrievedChunk])
def retrieve_knowledge_chunks(payload: RetrievalRequest):
    """
    RAG semantic search: matches query embedding against ICAR & agronomy knowledge chunks.
    Architecture §10.3.
    """
    return retrieve(
        query=payload.query,
        crop=payload.crop,
        stage_name=payload.stage_name,
        disease_label=payload.disease_label,
        doc_types=payload.doc_types,
        top_k=payload.top_k,
    )


@router.get("/schemes", response_model=list[RetrievedChunk])
def search_government_schemes(
    query: str = Query("agricultural loan insurance subsidy welfare", description="Scheme topic or question"),
    top_k: int = Query(6, description="Max results to return"),
):
    """
    Search national agricultural government schemes (PM-KISAN, PMFBY, KCC, SHC, AIF, PKVY).
    Architecture §16.
    """
    return retrieve(
        query=query,
        crop=None,
        doc_types=["govt_scheme"],
        top_k=top_k,
    )


@router.post("/ask", response_model=AdvisoryAskResponse)
def ask_crop_advisory(payload: AdvisoryAskRequest):
    """
    Main Personalized Advisory pipeline:
    Assembles AdvisoryContext (profile, weather history, GDD stage, ETc deficit, soil & climate),
    executes RAG retrieval, invokes grounded generation, performs safety audit, and logs query.
    Architecture §4, §12, §14.
    """
    ctx = assemble_advisory_context(
        query=payload.query,
        farm_id=payload.farm_id,
        crop=payload.crop,
        farmer_id=payload.farmer_id,
        language=payload.language,
        sowing_date_str=payload.sowing_date,
        soil_type_str=payload.soil_type,
        lat=payload.lat,
        lon=payload.lon,
        disease_label=payload.disease_label,
        weather_service=weather_service,
        weather_repo=weather_repo,
        farmer_repo=farmer_repo,
    )

    # Generate response
    response = generate_advisory_response(
        ctx=ctx,
        user_query=payload.query,
        query_id=0,
    )

    # Persist auditable snapshot in advisory_queries (§13)
    logged_id = query_repo.log_query(
        user_query=payload.query,
        context_snapshot=ctx.to_snapshot(),
        response_text=response.response,
        retrieved_chunk_ids=response.retrieved_chunk_ids,
        confidence=response.confidence,
        farmer_id=ctx.farmer_id,
        farm_id=ctx.farm_id,
    )
    response.id = logged_id
    return response


@router.post("/queries/{query_id}/feedback", response_model=AdvisoryFeedbackResponse)
def record_query_feedback(query_id: int, payload: AdvisoryFeedbackRequest):
    """
    Records farmer feedback (+1 thumbs-up, -1 thumbs-down) for an advisory response.
    Architecture §2 idea 3, §14.
    """
    val = payload.feedback
    if val is None and payload.up is not None:
        val = 1 if payload.up else -1
    if val not in (1, -1):
        raise HTTPException(status_code=400, detail="Feedback must be 1 (thumbs-up) or -1 (thumbs-down).")

    success = query_repo.record_feedback(query_id=query_id, feedback=val)
    if not success:
        logger.warning(f"Failed to record feedback for query_id {query_id}")

    return AdvisoryFeedbackResponse(id=query_id, feedback=val, status="recorded")

