"""
Advisory Generation Engine.
Architecture_Advisory.md §12, §15, §17.

Brings together agronomy engines, RAG retrieval, prompt construction, Gemini
inference (via the shared app.core.gemini client), safety refusal templates and the
post-generation number-grounding audit.

Language rule (README §8 / Architecture §15): the model always reasons and answers in
English; Bhashini translates the final text. Asking Gemini to answer "in hi" and then
also running English->Hindi translation on that answer (what the first version did)
double-translates and garbles the reply.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.gemini import generate_text
from app.data.weather.codes import describe_weather_code
from app.domain.advisory.audit import audit_number_grounding, compute_advisory_confidence
from app.domain.advisory.context import AdvisoryContext
from app.domain.advisory.translation import translate_from_english
from app.schemas.advisory import AdvisoryAskResponse, AdvisoryComputedContext, AdvisorySource

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are an agricultural advisory assistant for Indian farmers.
Answer ONLY from the CONTEXT you are given. Never state a number (dose, quantity, timing,
price, threshold, date) that does not appear in the CONTEXT. If the CONTEXT does not cover
what the farmer asked, say so plainly and suggest the nearest Krishi Vigyan Kendra (KVK).
Ground every weather or water statement in the WEATHER and IRRIGATION lines.
After any specific recommendation, cite its passage as "Source: [Title, p.X]".
If the CONTEXT lists ASSUMPTIONS, mention briefly that the advice is approximate because of them.
Write in plain English (it is translated afterwards), 3-6 short sentences, practical and specific."""


def _current_weather(ctx: AdvisoryContext) -> dict[str, Any]:
    return ctx.weather_summary.get("current") or {}


def _weather_line(ctx: AdvisoryContext) -> str:
    cur = _current_weather(ctx)
    bits = []
    if cur.get("temp_c") is not None:
        bits.append(f"now {cur['temp_c']}°C")
    if cur.get("rh_pct") is not None:
        bits.append(f"humidity {cur['rh_pct']}%")
    cond = describe_weather_code(cur.get("weather_code"))
    if cond:
        bits.append(cond.lower())
    metrics = ctx.weather_summary.get("metrics") or {}
    if metrics.get("rain_7d_mm") is not None:
        bits.append(f"rain in the last 7 days {metrics['rain_7d_mm']} mm")
    fc = ctx.irrigation.forecast_rain_3d_mm
    if fc is not None:
        bits.append(f"rain forecast next 3 days {fc} mm")
    return ", ".join(bits) if bits else "no current weather data on file"


def _irrigation_line(ctx: AdvisoryContext) -> str:
    irr = ctx.irrigation
    if irr.method == "fao56_water_balance":
        line = (
            f"root-zone water used {irr.root_zone_depletion_mm} mm of {irr.taw_mm} mm available; "
            f"stress begins at {irr.raw_mm} mm; action: {irr.action.replace('_', ' ')}"
        )
        if irr.net_irrigation_mm is not None:
            line += f"; net irrigation {irr.net_irrigation_mm} mm"
        if irr.gross_irrigation_mm is not None:
            line += f" (gross {irr.gross_irrigation_mm} mm)"
        if irr.days_to_stress is not None:
            line += f"; days until stress without rain: {irr.days_to_stress}"
    elif irr.method == "insufficient_data":
        line = "not enough weather data to estimate crop water use"
    else:
        line = (
            f"crop water use last 7 days {irr.etc_7d_mm} mm, effective rain {irr.effective_rain_7d_mm} mm, "
            f"deficit {irr.deficit_mm} mm; action: {irr.action.replace('_', ' ')}"
        )
    return f"{line}. Engine summary: {irr.recommendation} (confidence: {irr.confidence})"


def build_system_prompt(ctx: AdvisoryContext, user_query: str) -> str:
    """Grounded prompt per Architecture §12.2 (CONTEXT block + question)."""
    soil_flags_str = "; ".join(f"{f.flag_type}: {f.notes}" for f in ctx.soil_flags) or "none"
    passages = []
    for c in ctx.retrieved_chunks:
        title = c.source_title or "Untitled source"
        page = f"p.{c.page_number}" if c.page_number else "n.p."
        passages.append(f"[{title}, {page}]: {c.chunk_text}")
    passages_text = "\n\n".join(passages) if passages else "(No matching documents found)"

    stage = ctx.stage
    stage_line = f"{stage.stage_name} (estimated by {stage.method.replace('_', ' ')}"
    if stage.cumulative_gdd is not None:
        stage_line += f", {stage.cumulative_gdd} growing degree-days since sowing"
    stage_line += f", day {stage.days_since_sowing})"
    if stage.next_stage_name:
        stage_line += f"; next stage: {stage.next_stage_name}"

    climate_line = "not assessed (no temperature reading)"
    if ctx.climate:
        climate_line = f"{ctx.climate.verdict} — {ctx.climate.notes or ''}".strip(" —")

    disease_line = f"\nDISEASE: photo analysis suggests {ctx.disease_label}." if ctx.disease_label else ""
    assumptions = "\n".join(f"- {a}" for a in (ctx.assumptions + ctx.irrigation.assumptions)) or "- none"

    return f"""CONTEXT:
Farm: {ctx.district}, {ctx.state}. Soil: {ctx.soil_type} (soil flags: {soil_flags_str}).
Crop: {ctx.crop}{f' ({ctx.variety})' if ctx.variety else ''}, sown {ctx.sowing_date.isoformat()} ({ctx.season}).
STAGE: {stage_line}.
WEATHER: {_weather_line(ctx)}.
CLIMATE FIT: {climate_line}.
IRRIGATION: {_irrigation_line(ctx)}{disease_line}
ASSUMPTIONS:
{assumptions}

RETRIEVED_PASSAGES:
{passages_text}

FARMER'S QUESTION: {user_query}
"""


def _citation(ctx: AdvisoryContext) -> str:
    top = ctx.retrieved_chunks[0] if ctx.retrieved_chunks else None
    if not top:
        return ""
    page = f", p.{top.page_number}" if top.page_number else ""
    return f"Source: [{top.source_title or 'Untitled source'}{page}]"


def _generate_offline_synthesis(ctx: AdvisoryContext, user_query: str) -> str:
    """
    Deterministic answer used when Gemini is unavailable or its answer failed the
    number audit. Uses only computed values and retrieved text.
    """
    cite = _citation(ctx)
    q = user_query.lower()
    stage = ctx.stage.stage_name
    soil_note = f" Soil note: {ctx.soil_flags[0].notes}" if ctx.soil_flags and ctx.soil_flags[0].notes else ""
    top = ctx.retrieved_chunks[0] if ctx.retrieved_chunks else None

    if any(w in q for w in ["water", "irrigat", "rain", "moisture"]):
        text = f"Your {ctx.crop} crop is in the {stage} stage. {ctx.irrigation.recommendation}"
        if cite:
            text += f" {cite}"
    elif any(w in q for w in ["pest", "disease", "spray", "treatment", "fungicide", "rot", "blight", "rust", "worm", "insect"]):
        excerpt = top.chunk_text[:280].rstrip() + "…" if top else ""
        text = f"For {ctx.crop} at the {stage} stage, the relevant guidance says: {excerpt} {cite}".strip()
        text += " Scout the field regularly and confirm product and dose with your KVK before spraying."
    else:
        excerpt = top.chunk_text[:240].rstrip() + "…" if top else ""
        text = f"For your {ctx.crop} in {ctx.district} ({stage} stage): {excerpt} {cite}".strip()
        weather = _weather_line(ctx)
        if not weather.startswith("no current"):
            text += f" Weather: {weather}."
    if ctx.assumptions:
        text += " Note: this advice is approximate because " + "; ".join(a.rstrip(".").lower() for a in ctx.assumptions) + "."
    return text + soil_note


def _computed(ctx: AdvisoryContext) -> AdvisoryComputedContext:
    return AdvisoryComputedContext(
        growth_stage=ctx.stage,
        irrigation=ctx.irrigation,
        soil_flags=ctx.soil_flags,
        climate=ctx.climate,
        assumptions=list(ctx.assumptions),
    )


def generate_advisory_response(
    ctx: AdvisoryContext,
    user_query: str,
    query_id: int,
    use_mock: bool = False,
) -> AdvisoryAskResponse:
    """Full generation flow with grounding checks and safety controls."""
    weather_degraded = bool(ctx.weather_summary.get("degraded")) or ctx.irrigation.method == "insufficient_data"
    confidence = compute_advisory_confidence(
        retrieved_chunks=ctx.retrieved_chunks,
        weather_confidence="low" if weather_degraded else ctx.irrigation.confidence,
        stage_computed=ctx.stage.method == "gdd",
    )

    if confidence == "insufficient":
        refusal_en = (
            f"I don't have verified guidance on this topic for {ctx.crop}. "
            "Please don't guess doses or field applications — contact your nearest Krishi Vigyan "
            "Kendra (KVK) or block agriculture officer for district-specific advice."
        )
        return AdvisoryAskResponse(
            id=query_id,
            response=translate_from_english(refusal_en, ctx.preferred_language),
            confidence="insufficient",
            sources=[],
            computed=_computed(ctx),
            retrieved_chunk_ids=[],
        )

    snapshot = ctx.to_snapshot()
    prompt = build_system_prompt(ctx, user_query)
    response_text, model_used = ("", None) if use_mock else generate_text(
        prompt, system_instruction=SYSTEM_INSTRUCTION, temperature=0.2, max_output_tokens=700
    )

    ungrounded: list[str] = []
    if response_text:
        # §17.2: numbers must be traceable to the context (prompt text included, since
        # retrieved passages are part of what the model was allowed to use).
        audit = audit_number_grounding(response_text, {"snapshot": snapshot, "prompt": prompt})
        ungrounded = audit["ungrounded_numbers"]
        if ungrounded:
            # Spec §17.2: log and surface for review rather than auto-block, but never
            # let such an answer claim full grounding.
            logger.warning(f"LLM answer had untraceable numbers {ungrounded} (query logged for review)")
            if confidence == "grounded":
                confidence = "partial"

    if not response_text:
        response_text = _generate_offline_synthesis(ctx, user_query)
        model_used = None

    # §17.4: chemical/dose questions need a strong retrieval match
    max_sim = max((c.similarity for c in ctx.retrieved_chunks), default=0.0)
    if any(k in user_query.lower() for k in ["spray", "chemical", "pesticide", "fungicide", "insecticide", "dose", "dosage"]) and max_sim < 0.70:
        response_text += (
            "\n\n(Safety notice: confirm the exact product and dilution with your local KVK or "
            "extension officer before spraying.)"
        )

    sources: list[AdvisorySource] = []
    seen: set[tuple[Any, Any]] = set()
    for c in ctx.retrieved_chunks:
        if c.similarity < 0.55:
            continue
        key = (c.source_title, c.page_number)
        if key in seen:
            continue
        seen.add(key)
        sources.append(
            AdvisorySource(
                title=c.source_title or "Untitled source",
                page=c.page_number,
                url=getattr(c, "source_url", None),
            )
        )

    return AdvisoryAskResponse(
        id=query_id,
        response=translate_from_english(response_text, ctx.preferred_language),
        confidence=confidence,
        sources=sources,
        computed=_computed(ctx),
        retrieved_chunk_ids=[c.document_id for c in ctx.retrieved_chunks if c.document_id is not None],
        ungrounded_numbers=ungrounded,
        generated_by=model_used or "deterministic",
    )
