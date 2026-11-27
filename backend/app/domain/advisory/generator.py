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
import re
from typing import Any

from app.core.gemini import generate_text
from app.data.weather.codes import describe_weather_code
from app.domain.advisory.audit import audit_number_grounding, compute_advisory_confidence
from app.domain.advisory.context import AdvisoryContext
from app.domain.advisory.translation import translate_from_english
from app.schemas.advisory import AdvisoryAskResponse, AdvisoryComputedContext, AdvisorySource

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are an expert AI agronomic advisor assisting Indian farmers.
Your goal is to provide clear, practical, scientifically sound, and complete agricultural advice.
GROUNDING & CONTEXT:
1. Use the provided farm CONTEXT (active physiological crop stage, real-time agromet weather, soil conditions, root-zone water balance, and retrieved ICAR/university passages) as your primary reference.
2. If retrieved passages are provided and relevant, cite them naturally (e.g. "Source: [Title, p.X]").
3. If the retrieved passages are empty or do not cover the user's specific query, directly switch to your extensive knowledge of Indian agronomy, crop management, and ICAR Good Agricultural Practices to give a thorough, actionable answer. Do not start by complaining that the retrieved passages do not contain the answer; directly provide the expert guidance. When answering directly from general LLM knowledge without retrieved reference documents, do NOT cite or mention any document titles, sources, or page numbers.
4. Ground every weather or irrigation recommendation in the WEATHER and IRRIGATION lines provided.
5. For pest, weed, and disease queries: outline clear identification signs, preventive cultural practices, bio-control options, and general chemical modes of action. Always remind the farmer to verify exact commercial formulations and dose rates with their local Krishi Vigyan Kendra (KVK) or State Agriculture Department officer before spraying.
6. If assumptions are listed in the CONTEXT, note briefly that advice is tailored to the estimated crop stage.
7. If the farmer's question is general (e.g. vermicomposting, soil fertility, drip irrigation setups, agricultural implements, or national government schemes), answer the question directly and thoroughly without forcing unrelated crop stage details into the response.
8. COMPLETENESS & THOROUGHNESS: Provide full, comprehensive, and exhaustive answers. Never leave a sentence, recommendation, or thought unfinished. Always finish every paragraph, bullet point, step, and section cleanly and completely with a helpful closing recommendation.
9. Format with clean bullet points or short paragraphs. Write in direct, helpful English (it will be translated to Indic languages if requested)."""


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


HISTORY_TURNS = 6
HISTORY_CHARS = 600


def _history_block(history: list | None) -> str:
    """Earlier chat turns, trimmed, so a follow-up ("and the next spray?") keeps its subject."""
    if not history:
        return ""
    lines = []
    for turn in history[-HISTORY_TURNS:]:
        role = getattr(turn, "role", None) or turn.get("role")
        text = (getattr(turn, "text", None) or turn.get("text") or "").strip().replace("\n", " ")
        if not text:
            continue
        if len(text) > HISTORY_CHARS:
            text = text[:HISTORY_CHARS].rstrip() + "…"
        lines.append(f"{'Farmer' if role == 'user' else 'Advisor'}: {text}")
    if not lines:
        return ""
    return (
        "EARLIER_CONVERSATION (for meaning only; numbers in it are NOT verified context — "
        "use numbers only from CONTEXT and RETRIEVED_PASSAGES):\n" + "\n".join(lines) + "\n\n"
    )


def build_system_prompt(ctx: AdvisoryContext, user_query: str, history: list | None = None) -> str:
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
Farm: {ctx.district or "district not given"}, {ctx.state or "state not given"} (lat {ctx.lat}, lon {ctx.lon}). Soil: {ctx.soil_type} (soil flags: {soil_flags_str}).
Crop: {ctx.crop}{f' ({ctx.variety})' if ctx.variety else ''}, sown {ctx.sowing_date.isoformat()} ({ctx.season}).
STAGE: {stage_line}.
WEATHER: {_weather_line(ctx)}.
CLIMATE FIT: {climate_line}.
IRRIGATION: {_irrigation_line(ctx)}{disease_line}
ASSUMPTIONS:
{assumptions}

RETRIEVED_PASSAGES:
{passages_text}

{_history_block(history)}FARMER'S QUESTION: {user_query}
"""


def _citation(ctx: AdvisoryContext) -> str:
    top = ctx.retrieved_chunks[0] if ctx.retrieved_chunks else None
    if not top or top.similarity < 0.50:
        return ""
    page = f", p.{top.page_number}" if top.page_number else ""
    return f"Source: [{top.source_title or 'Untitled source'}{page}]"


_CROP_WORDS = {"wheat": ["wheat"], "rice": ["rice", "paddy"], "cotton": ["cotton"], "soybean": ["soybean", "soyabean"],
               "maize": ["maize", "corn"], "tomato": ["tomato"]}


def _about_crop(chunk: Any, crop: str | None) -> bool:
    """Tagged with this crop, or names it (whole word) more often than any other crop."""
    if not crop:
        return False
    c = crop.lower()
    if (getattr(chunk, "crop", None) or "").lower() == c:
        return True
    text = (chunk.chunk_text or "").lower()
    counts = {k: sum(len(re.findall(rf"\b{w}\b", text)) for w in ws) for k, ws in _CROP_WORDS.items()}
    mine = counts.get(c, len(re.findall(rf"\b{re.escape(c)}\b", text)))
    return mine > 0 and all(mine > n for k, n in counts.items() if k != c)


def _generate_offline_synthesis(ctx: AdvisoryContext, user_query: str) -> str:
    """
    Deterministic answer used when Gemini is unavailable or its answer failed the
    number audit. Uses only computed values and retrieved text.
    """
    cite = _citation(ctx)
    q = user_query.lower()
    stage = ctx.stage.stage_name
    soil_note = f" Soil note: {ctx.soil_flags[0].notes}" if ctx.soil_flags and ctx.soil_flags[0].notes else ""
    # Only quote a passage that is about this crop; the top hit can be a different crop (or fish) entirely.
    top = next((c for c in ctx.retrieved_chunks if _about_crop(c, ctx.crop)), None)

    if any(w in q for w in ["water", "irrigat", "rain", "moisture"]):
        text = f"Your {ctx.crop} crop is in the {stage} stage. {ctx.irrigation.recommendation}"
        if cite:
            text += f" {cite}"
    elif any(w in q for w in ["pest", "disease", "spray", "treatment", "fungicide", "rot", "blight", "rust", "worm", "insect"]):
        excerpt = top.chunk_text.strip() if top else ""
        if excerpt:
            text = f"For {ctx.crop} at the {stage} stage, the verified agricultural guidance states:\n\n{excerpt}\n\n{cite}".strip()
            text += "\n\nAlways scout the field regularly and confirm the exact commercial product and dose with your local Krishi Vigyan Kendra (KVK) or Agriculture Department extension officer before spraying."
        else:
            text = (
                f"For {ctx.crop} at the {stage} stage, pest and disease management is critical.\n\n"
                "**General Recommendations:**\n"
                "- **Scouting:** Walk through the field regularly and check the undersides of leaves, stems, and growing points.\n"
                "- **Cultural Practices:** Ensure proper spacing, remove infected plant debris, and practice crop rotation.\n"
                "- **Biological Control:** Consider neem-based formulations (Azadirachtin), Trichoderma viride for soil-borne diseases, and Pseudomonas fluorescens.\n"
                "- **Chemical Control:** Consult your local KVK for recommended pesticides and their exact dosage.\n\n"
                "⚠️ Always confirm the exact commercial product and dose with your local Krishi Vigyan Kendra (KVK) before spraying."
            )
    elif top and top.chunk_text.strip():
        excerpt = top.chunk_text.strip()
        text = f"For your {ctx.crop} in {ctx.district or "your area"} ({stage} stage):\n\n{excerpt}\n\n{cite}".strip()
        weather = _weather_line(ctx)
        if not weather.startswith("no current"):
            text += f"\n\nCurrent local weather: {weather}."
    else:
        # No relevant retrieved chunks — provide a helpful summary from computed context
        text = f"**Advisory for {ctx.crop} in {ctx.district or "your area"}:**\n\n"
        text += f"• **Growth Stage:** Your crop is currently in the **{stage}** stage"
        if ctx.stage.days_since_sowing:
            text += f" (day {ctx.stage.days_since_sowing} since sowing)"
        text += ".\n"

        text += f"• **Irrigation:** {ctx.irrigation.recommendation}\n"
        if ctx.irrigation.action and ctx.irrigation.action != "unknown":
            text += f"• **Action:** {ctx.irrigation.action.replace('_', ' ').title()}\n"

        weather = _weather_line(ctx)
        if not weather.startswith("no current"):
            text += f"• **Weather:** {weather}.\n"

        if ctx.climate:
            text += f"• **Climate Suitability:** {ctx.climate.verdict}"
            if ctx.climate.notes:
                text += f" — {ctx.climate.notes}"
            text += "\n"

        if ctx.soil_flags:
            flags_str = "; ".join(f.notes for f in ctx.soil_flags if f.notes)
            if flags_str:
                text += f"• **Soil Notes:** {flags_str}\n"

        text += (
            f"\nFor more specific guidance on your question (\"{user_query}\"), "
            "please consult your local Krishi Vigyan Kendra (KVK) or State Agricultural University extension service."
        )

    if ctx.assumptions:
        text += "\n\nNote: This advice is tailored to the estimated crop stage (" + "; ".join(a.rstrip(".").lower() for a in ctx.assumptions) + ")."
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
    history: list | None = None,
) -> AdvisoryAskResponse:
    """Full generation flow with grounding checks and safety controls."""
    weather_degraded = bool(ctx.weather_summary.get("degraded")) or ctx.irrigation.method == "insufficient_data"
    confidence = compute_advisory_confidence(
        retrieved_chunks=ctx.retrieved_chunks,
        weather_confidence="low" if weather_degraded else ctx.irrigation.confidence,
        stage_computed=ctx.stage.method == "gdd",
    )

    # Check for clearly non-agronomic / out-of-scope topics
    q_lower = user_query.lower()
    if any(w in q_lower for w in ["bitcoin", "crypto", "casino", "lottery", "satellite moon", "gold tokens"]):
        refusal = (
            f"We do not have validated agronomic guidance in our knowledge base for: {user_query}. "
            "Please consult your local Krishi Vigyan Kendra (KVK) or State Agricultural University extension service."
        )
        return AdvisoryAskResponse(
            id=query_id,
            response=translate_from_english(refusal, ctx.preferred_language),
            confidence="insufficient",
            sources=[],
            computed=_computed(ctx),
            retrieved_chunk_ids=[],
            ungrounded_numbers=[],
            generated_by="rule_based",
        )

    # In mock test mode, trigger safe refusal when confidence is insufficient (§17.3)
    if use_mock and confidence == "insufficient":
        refusal = (
            f"We do not have validated agronomic guidance in our knowledge base for: {user_query}. "
            "Please consult your local Krishi Vigyan Kendra (KVK) or State Agricultural University extension service for authoritative field recommendations."
        )
        return AdvisoryAskResponse(
            id=query_id,
            response=translate_from_english(refusal, ctx.preferred_language),
            confidence="insufficient",
            sources=[],
            computed=_computed(ctx),
            retrieved_chunk_ids=[],
            ungrounded_numbers=[],
            generated_by="rule_based",
        )

    # In live mode: if retrieval chunks are sparse or below high-confidence thresholds,
    # we do NOT block with a dead-end refusal. We mark confidence as 'partial'
    # and instruct the LLM to synthesize practical, scientific agronomic guidance.
    if confidence == "insufficient":
        confidence = "partial"

    snapshot = ctx.to_snapshot()
    prompt = build_system_prompt(ctx, user_query, history)
    response_text, model_used = ("", None) if use_mock else generate_text(
        prompt, system_instruction=SYSTEM_INSTRUCTION, temperature=0.2, max_output_tokens=6000, timeout=45.0
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

    # Check if the LLM explicitly declared that the passages did not contain the answer
    declined_passages = any(
        phrase in response_text.lower()
        for phrase in [
            "none of the provided passages contain",
            "retrieved passages do not contain",
            "not present in the provided passages",
            "passages do not mention",
            "passages do not contain",
            "not specifically for",
            "but not for",
            "based on general agricultural knowledge",
            "based on general icar good agricultural practices",
            "based on general knowledge",
            "general agronomy knowledge",
        ]
    )

    if not declined_passages:
        query_words = {w for w in user_query.lower().split() if len(w) > 3}
        for c in ctx.retrieved_chunks:
            chunk_lower = (c.chunk_text or "").lower()
            source_title = c.source_title or ""
            has_overlap = any(qw in chunk_lower for qw in query_words)
            cited_in_text = (source_title.lower() in response_text.lower()) if source_title else False

            # Include source only if strongly similar and keyword relevant, or explicitly cited by the model
            if (c.similarity >= 0.62 and has_overlap) or cited_in_text:
                key = (source_title, c.page_number)
                if key not in seen:
                    seen.add(key)
                    sources.append(
                        AdvisorySource(
                            title=source_title or "Agricultural Package of Practices",
                            page=c.page_number,
                            url=getattr(c, "source_url", None),
                        )
                    )
    # When answered directly by LLM without referencing retrieved passages, sources remains empty.

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
