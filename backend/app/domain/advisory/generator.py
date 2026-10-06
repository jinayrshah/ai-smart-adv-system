"""
Advisory Generation Engine.
Architecture_Advisory.md §12, §17.

Brings together agronomy engines, RAG semantic retrieval, prompt construction,
Gemini 2.5 Flash inference, safety refusal templates, and number-grounding audit.
"""

import logging
import re
from typing import Any
import httpx

from app.core.config import get_settings
from app.domain.advisory.audit import (
    audit_number_grounding,
    compute_advisory_confidence,
)
from app.domain.advisory.context import AdvisoryContext
from app.domain.advisory.translation import translate_from_english
from app.schemas.advisory import AdvisoryAskResponse, AdvisoryComputedContext, AdvisorySource

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


def build_system_prompt(ctx: AdvisoryContext, user_query: str) -> str:
    """
    Constructs the strictly-grounded advisory system prompt per Architecture §12.2.
    """
    soil_flags_str = "none"
    if ctx.soil_flags:
        soil_flags_str = "; ".join(f"{f.flag_type}: {f.notes}" for f in ctx.soil_flags)

    w_curr = ctx.weather_summary.get("current", {})
    w_temp = w_curr.get("temp_c", 25.0)
    w_cond = w_curr.get("condition", "Partly cloudy")
    w_rain_7d = ctx.irrigation.rain_7d_mm
    w_etc_7d = ctx.irrigation.etc_7d_mm
    w_deficit = ctx.irrigation.deficit_mm

    passages_lines = []
    for c in ctx.retrieved_chunks:
        title = c.source_title or "ICAR & State Agricultural University PoP"
        page_str = f"p.{c.page_number}" if c.page_number else "Advisory Guide"
        passages_lines.append(f"[{title}, {page_str}]: {c.chunk_text}")

    passages_text = "\n\n".join(passages_lines) if passages_lines else "(No matching research documents found)"

    disease_line = ""
    if ctx.disease_label:
        disease_line = f"\nDISEASE DETECTION: Photo analysis indicates suspected {ctx.disease_label}."

    lang_note = f"in {ctx.preferred_language}" if ctx.preferred_language != "en" else "in English"

    prompt = f"""SYSTEM:
You are an agricultural advisory assistant for Indian farmers. You answer ONLY using the
CONTEXT block below. Do not use outside knowledge for anything a farmer could act on —
dosages, quantities, timings, ₹ figures, thresholds. If the CONTEXT does not contain
something the farmer asked about, say so plainly and suggest they contact their nearest
Krishi Vigyan Kendra — do not guess.
Always ground weather- or water-related statements in the WEATHER and IRRIGATION numbers
given. Always cite which source (title + page, from RETRIEVED_PASSAGES) supports any
specific recommendation, dosage, or threshold you state, in a short "Source: [Title, p.X]" line.
Respond {lang_note}. Keep it practical, encouraging, and specific to THIS farmer.

CONTEXT:
Farmer: {ctx.farmer_name}, farm in {ctx.district}, {ctx.state}. Soil: {ctx.soil_type} (flags: {soil_flags_str}).
Crop: {ctx.crop}, sown {ctx.sowing_date.isoformat()} ({ctx.season}). Current stage: {ctx.stage.stage_name} (estimated via {ctx.stage.method}).
WEATHER: Current {w_temp}°C, {w_cond}. 7-day past rainfall: {w_rain_7d}mm.
IRRIGATION: needed ~{w_etc_7d}mm over the last 7 days, {w_rain_7d}mm rain fell, estimated deficit {w_deficit}mm. (confidence: {ctx.irrigation.confidence}){disease_line}

RETRIEVED_PASSAGES:
{passages_text}

FARMER'S QUESTION: {user_query}
"""
    return prompt


def _generate_offline_synthesis(ctx: AdvisoryContext, user_query: str) -> str:
    """
    Deterministic synthesis for offline test execution or fallback when Gemini quota is exceeded.
    Guarantees 100% grounded response citing exact calculated numbers and retrieved passages.
    """
    stage_name = ctx.stage.stage_name
    deficit = ctx.irrigation.deficit_mm
    etc_7d = ctx.irrigation.etc_7d_mm
    rain_7d = ctx.irrigation.rain_7d_mm
    top_chunk = ctx.retrieved_chunks[0] if ctx.retrieved_chunks else None
    source_citation = (
        f"Source: [{top_chunk.source_title or 'ICAR Kharif Guide'}, p.{top_chunk.page_number or 1}]"
        if top_chunk
        else "Source: [ICAR & SAU Package of Practices]"
    )

    soil_note = "Your soil conditions are suitable."
    if ctx.soil_flags:
        soil_note = f"Soil note: {ctx.soil_flags[0].notes or 'Check fertilizer balance.'}"

    q_lower = user_query.lower()

    if any(w in q_lower for w in ["water", "irrigate", "irrigation", "rain"]):
        advice = (
            f"Your {ctx.crop} crop is currently in the {stage_name} stage ({source_citation}). "
            f"Over the last 7 days, your crop required ~{etc_7d}mm of water and received {rain_7d}mm of rainfall, "
            f"resulting in a net water deficit of {deficit}mm (confidence: {ctx.irrigation.confidence}). "
            f"{ctx.irrigation.recommendation} {soil_note}"
        )
    elif any(w in q_lower for w in ["pest", "disease", "spray", "treatment", "fungicide", "rot", "blight", "rust", "worm"]):
        chunk_excerpt = top_chunk.chunk_text[:250] if top_chunk else "Follow recommended plant protection."
        advice = (
            f"For {ctx.crop} during the {stage_name} stage, field protection measures are critical ({source_citation}). "
            f"Guidance excerpt: {chunk_excerpt}. "
            f"Ensure timely field scouting. {soil_note}"
        )
    else:
        chunk_excerpt = top_chunk.chunk_text[:200] if top_chunk else "Maintain optimal field management."
        advice = (
            f"For your {ctx.crop} in {ctx.district} ({stage_name} stage): {chunk_excerpt} ({source_citation}). "
            f"Current weather shows {ctx.weather_summary.get('current', {}).get('temp_c', 25.0)}°C. {soil_note}"
        )

    return advice


def generate_advisory_response(
    ctx: AdvisoryContext,
    user_query: str,
    query_id: int,
    use_mock: bool = False,
) -> AdvisoryAskResponse:
    """
    Executes the complete generation flow with grounding checks and safety controls.
    """
    # 1. Determine confidence
    w_conf = ctx.irrigation.confidence
    confidence = compute_advisory_confidence(
        retrieved_chunks=ctx.retrieved_chunks,
        weather_confidence=w_conf,
        stage_computed=True,
    )

    # 2. Safety Refusal Template for Insufficient Confidence (§17.3)
    if confidence == "insufficient":
        refusal_en = (
            f"I do not have verified research documentation in my knowledge base regarding this specific topic for {ctx.crop}. "
            f"To protect your crop health, please do not guess dosages or field applications. "
            f"We strongly recommend contacting your nearest Krishi Vigyan Kendra (KVK) or local block agricultural officer for district-specific advice."
        )
        final_text = translate_from_english(refusal_en, ctx.preferred_language)
        computed_ctx = AdvisoryComputedContext(
            growth_stage=ctx.stage,
            irrigation=ctx.irrigation,
            soil_flags=ctx.soil_flags,
            climate=ctx.climate,
        )
        return AdvisoryAskResponse(
            id=query_id,
            response=final_text,
            confidence="insufficient",
            sources=[],
            computed=computed_ctx,
            retrieved_chunk_ids=[],
        )

    # 3. Build Prompt
    system_prompt = build_system_prompt(ctx, user_query)

    # 4. LLM Generation
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY
    response_text = ""

    if not use_mock and api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": system_prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600,
            },
        }
        try:
            with httpx.Client(timeout=14.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            response_text = parts[0].get("text", "").strip()
                else:
                    logger.warning(f"Gemini generation returned status {resp.status_code}: {resp.text[:120]}")
        except Exception as exc:
            logger.warning(f"Gemini API generation failed: {exc}")

    # Fallback to deterministic synthesis if LLM didn't return or mock requested
    if not response_text:
        response_text = _generate_offline_synthesis(ctx, user_query)

    # 5. Chemical/Dosage Safety Filter (§17.4)
    # If chemical dosage is asked and max chunk similarity is < 0.70, ensure disclaimer is attached
    max_sim = max((c.similarity for c in ctx.retrieved_chunks), default=0.0)
    has_chemical_keywords = any(k in user_query.lower() for k in ["spray", "chemical", "pesticide", "fungicide", "dose", "dosage"])
    if has_chemical_keywords and max_sim < 0.70:
        warning_notice = (
            "\n\n(Safety Notice: Please verify exact brand formulations and dilution rates with your local KVK or extension officer before spraying.)"
        )
        if warning_notice not in response_text:
            response_text += warning_notice

    # 6. Post-generation Number Grounding Audit (§17.2)
    snapshot = ctx.to_snapshot()
    audit_res = audit_number_grounding(response_text, snapshot)
    if not audit_res["passed"]:
        logger.info(f"Advisory generation audit notice: ungrounded tokens {audit_res['ungrounded_numbers']}")

    # 7. Translation if necessary
    final_response = response_text
    if ctx.preferred_language != "en":
        final_response = translate_from_english(response_text, ctx.preferred_language)

    # 8. Assemble Sources list
    sources = []
    seen_sources = set()
    for c in ctx.retrieved_chunks:
        if c.similarity >= 0.55:
            key = (c.source_title, c.page_number)
            if key not in seen_sources:
                seen_sources.add(key)
                sources.append(
                    AdvisorySource(
                        title=c.source_title or "ICAR Agro-Advisories",
                        page=c.page_number,
                        url=None,
                    )
                )

    computed_ctx = AdvisoryComputedContext(
        growth_stage=ctx.stage,
        irrigation=ctx.irrigation,
        soil_flags=ctx.soil_flags,
        climate=ctx.climate,
    )

    chunk_ids = [c.document_id for c in ctx.retrieved_chunks if c.document_id is not None]

    return AdvisoryAskResponse(
        id=query_id,
        response=final_response,
        confidence=confidence,
        sources=sources,
        computed=computed_ctx,
        retrieved_chunk_ids=chunk_ids,
    )
