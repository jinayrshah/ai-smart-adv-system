"""
API endpoints for Agronomy Computation Engines (GDD, Water Deficit, Soil & Climate).
Architecture_Advisory.md §7, §8, §9, §9b.
"""

from datetime import date
import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from app.core.rate_limit import client_ip_from_request as client_ip
from app.core.timeutil import today_ist
from app.data.advisory.query_repo import get_query_repo
from app.data.advisory.reference_repo import get_agronomy_repo
from app.data.farmer.repository import FarmerRepository
from app.data.locations.grid import snap_to_grid
from app.data.weather.repository import WeatherRepository
from app.data.weather.service import WeatherService
from app.domain.advisory.climate_suitability_engine import check_climate_suitability
from app.domain.advisory.context import UnsupportedCropError, assemble_advisory_context
from app.domain.advisory.disease_detector import get_disease_detector
from app.domain.advisory.generator import generate_advisory_response
from app.domain.advisory.growth_stage_engine import current_growth_stage
from app.domain.advisory.ratelimit import advisory_rate_limiter
from app.domain.advisory.schemes import answer_scheme_query, get_all_schemes, get_scheme_by_code
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
    DiseaseCheckResponse,
    GovernmentScheme,
    IrrigationAdvice,
    SchemeAskRequest,
    SchemeAskResponse,
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
disease_detector = get_disease_detector()


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

    try:
        calc_as_of = date.fromisoformat(as_of) if as_of else today_ist()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid as_of format. Use YYYY-MM-DD.")
    if s_date > calc_as_of:
        raise HTTPException(status_code=400, detail="sowing_date is after the calculation date.")

    weather_history: list[dict[str, Any]] = []
    if lat is not None and lon is not None:
        grid_key = snap_to_grid(lat, lon).grid_key
        weather_service.ensure_grid_weather(grid_key, lat, lon)
        try:
            weather_history = weather_service.get_history_rows(grid_key, lat, lon, s_date, calc_as_of)
        except Exception as exc:
            logger.info(f"History backfill unavailable: {exc}")
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
            raise HTTPException(
                status_code=503,
                detail="No current temperature is available for this location; pass temp_c to check manually.",
            )

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
    farm_id: int = Query(..., description="Farm ID"),
    crop_id: int | None = Query(None, description="Optional specific farm crop ID"),
):
    """
    Complete 4-engine agronomic diagnostic for an onboarded farm and its active crop:
    growth stage (GDD), FAO-56 water balance, soil health and climate fit.
    """
    farm = farmer_repo.get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    crops = farmer_repo.get_crops(farm_id, status="active") or farmer_repo.get_crops(farm_id)
    if not crops:
        raise HTTPException(status_code=400, detail="No active crops registered for this farm.")
    selected = next((c for c in crops if crop_id is not None and c.id == crop_id), None) or crops[0]

    today = today_ist()
    s_date = selected.sowing_date
    if s_date > today:
        raise HTTPException(status_code=400, detail="Sowing date is in the future.")
    crop_name = selected.crop
    if not agronomy_repo.has_crop(crop_name):
        raise HTTPException(
            status_code=422,
            detail=f"Detailed diagnostics cover {', '.join(agronomy_repo.get_supported_crops())}.",
        )

    lat, lon = float(farm.lat), float(farm.lon)
    grid_key = farm.grid_key or snap_to_grid(lat, lon).grid_key

    weather_service.ensure_grid_weather(grid_key, lat, lon)
    w_sum = weather_service.get_summary(lat=lat, lon=lon)
    try:
        w_history = weather_service.get_history_rows(grid_key, lat, lon, s_date, today)
    except Exception as exc:
        logger.info(f"History backfill unavailable: {exc}")
        w_history = weather_repo.get_fused_range(grid_key, s_date, today)
    events = [e.model_dump() for e in farmer_repo.get_irrigation_events(farm_id, since=s_date)]

    stage_res = current_growth_stage(crop=crop_name, sowing_date=s_date, weather_history=w_history, as_of=today)
    irrigation_res = calculate_irrigation_need(
        crop=crop_name,
        stage_name=stage_res.stage_name,
        weather_summary=w_sum.model_dump(),
        history_rows=w_history,
        sowing_date=s_date,
        as_of=today,
        soil_type=farm.soil_type,
        irrigation_type=farm.irrigation_type,
        irrigation_events=events,
    )
    soil_flags = check_soil_suitability(crop=crop_name, soil_type=farm.soil_type, soil_npk=farm.soil_npk or {})

    # Climate: current observation, else today's fused mean; never an assumed value.
    temp = w_sum.current.temp_c if w_sum.current else None
    hum = w_sum.current.rh_pct if w_sum.current else None
    if temp is None:
        today_row = next((d for d in w_sum.days if d.phase == "today"), None)
        if today_row and today_row.tmax_c is not None and today_row.tmin_c is not None:
            temp = (today_row.tmax_c + today_row.tmin_c) / 2.0
            hum = hum if hum is not None else today_row.rh_mean_pct
    climate_res = None
    if temp is not None:
        climate_res = check_climate_suitability(
            crop=crop_name,
            stage_name=stage_res.stage_name,
            observed_temp_c=temp,
            observed_humidity_pct=hum,
            reading_source="weather_forecast",
        )

    return AgronomyDiagnosticResponse(
        crop=crop_name,
        farm_id=str(farm.id),
        farm_name=farm.name,
        sowing_date=s_date.isoformat(),
        as_of=today.isoformat(),
        stage=stage_res,
        irrigation=irrigation_res,
        soil_flags=soil_flags,
        climate=climate_res,
        irrigation_events_logged=len(events),
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


@router.get("/schemes/catalog", response_model=list[GovernmentScheme])
def list_government_schemes(
    query: str | None = Query(None, description="Optional search term"),
    category: str | None = Query(None, description="Optional category filter"),
):
    """
    List structured national agricultural welfare schemes with eligibility, benefits, and portals.
    Architecture §16.
    """
    return get_all_schemes(query=query, category=category)


@router.post("/schemes/ask", response_model=SchemeAskResponse)
def ask_government_scheme(payload: SchemeAskRequest):
    """
    RAG-grounded answering for farmer welfare and government subsidy queries.
    Architecture §16.
    """
    return answer_scheme_query(
        query=payload.query,
        scheme_code=payload.scheme_code,
        language=payload.language,
    )


@router.post("/ask", response_model=AdvisoryAskResponse)
def ask_crop_advisory(payload: AdvisoryAskRequest, request: Request):
    """
    Main Personalized Advisory pipeline:
    Assembles AdvisoryContext (profile, weather history, GDD stage, ETc deficit, soil & climate),
    executes RAG retrieval, invokes grounded generation, performs safety audit, and logs query.
    Architecture §4, §12, §14.
    """
    # Rate limit check per farmer / farm / anonymous caller (Architecture §18, Phase 7)
    # Anonymous callers are keyed by client IP — a single shared "anonymous" bucket let
    # one visitor exhaust the quota for every other logged-out user.
    rate_key = payload.farmer_id or (
        f"farm_{payload.farm_id}" if payload.farm_id else f"ip_{client_ip(request)}"
    )
    allowed, remaining, retry_after = advisory_rate_limiter.is_allowed(rate_key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Too many advisory requests. Please retry in {retry_after} seconds.",
        )

    try:
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
    except UnsupportedCropError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

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


@router.post("/disease-check", response_model=DiseaseCheckResponse)
async def check_crop_disease(
    file: UploadFile = File(..., description="Uploaded leaf photograph (JPEG/PNG/WebP)"),
    crop: str | None = Form(None, description="Optional crop hint (e.g. Tomato, Wheat, Maize)"),
    farm_id: int | None = Form(None, description="Optional farm ID to retrieve registered crop"),
):
    """
    Analyzes crop leaf photo for disease identification and automatically retrieves
    verified scientific treatments from ICAR and State Agricultural University guides.
    Architecture §11, §14.
    """
    if farm_id is not None and not crop:
        farm_crops = farmer_repo.get_crops(farm_id)
        if farm_crops:
            crop = farm_crops[0].crop

    content = await file.read()
    if not content or len(content) < 100:
        raise HTTPException(status_code=400, detail="Invalid or empty image file uploaded.")

    try:
        return disease_detector.diagnose(image_bytes=content, crop=crop)
    except Exception as exc:
        logger.error(f"Disease detection failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Failed to process image: {exc}")

