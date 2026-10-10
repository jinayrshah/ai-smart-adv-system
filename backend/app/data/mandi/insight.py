"""
Market Insight Generation Engine.
Revisions - Market & Weather UI (Priority 2.3) & Architecture_MarketData_Weather.md §10.4.

Grounded 2-3 sentence market synthesis using Gemini 2.5 Flash.
Strict non-predictive discipline: narrates existing numbers only, never forecasts prices.
"""

import logging
import re
from typing import Any
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


def format_context_for_prompt(ctx: dict[str, Any]) -> str:
    commodity = ctx.get("commodity", "")
    market = ctx.get("market", "")
    state = ctx.get("state", "")
    latest_price = ctx.get("latest_price")
    unit = ctx.get("unit", "Rs/Quintal")
    c7 = ctx.get("change7d_pct")
    c30 = ctx.get("change30d_pct")
    cov = ctx.get("coverage_pct", 0)
    gaps = ctx.get("gaps_count", 0)
    weather_sig = ctx.get("weather_signals", [])

    lines = [
        f"Commodity: {commodity}",
        f"Market: {market}, {state}",
        f"Latest Price: ₹{latest_price} /{unit} (₹{round(latest_price / 100, 1)} /kg)" if latest_price else "Latest Price: Unavailable",
        f"7-Day Price Change: {f'+{c7}%' if c7 and c7 > 0 else f'{c7}%' if c7 is not None else 'N/A'}",
        f"30-Day Price Change: {f'+{c30}%' if c30 and c30 > 0 else f'{c30}%' if c30 is not None else 'N/A'}",
        f"Mandi Data Reporting Coverage: {cov}% (Missing/unreported days: {gaps})",
    ]

    if weather_sig:
        lines.append(f"District Weather Signals: {'; '.join(weather_sig)}")
    else:
        lines.append("District Weather Signals: Normal seasonal rainfall, no transport disruption detected")

    if ctx.get("cost_c2") is not None:
        lines.append(f"DES Reference Production Cost (C2): ₹{ctx['cost_c2']} /qtl (₹{round(ctx['cost_c2'] / 100, 1)} /kg)")
    if ctx.get("net_margin") is not None:
        lines.append(f"Estimated Farm Margin vs Benchmark: ₹{ctx['net_margin']} /qtl (₹{round(ctx['net_margin'] / 100, 1)} /kg)")
    if ctx.get("breakeven_price") is not None:
        lines.append(f"Storage Breakeven Price: ₹{ctx['breakeven_price']} /qtl (₹{round(ctx['breakeven_price'] / 100, 1)} /kg)")

    return "\n".join(lines)


def generate_fallback_market_insight(ctx: dict[str, Any]) -> str:
    """
    Deterministic factual summary for offline execution, test runs, or when LLM quota is exhausted.
    Strictly uses only computed values from context.
    """
    commodity = ctx.get("commodity", "this crop")
    market = ctx.get("market", "the market")
    latest_price = ctx.get("latest_price")
    c7 = ctx.get("change7d_pct")
    cov = ctx.get("coverage_pct", 0)

    sentences = []
    if latest_price:
        per_kg = round(latest_price / 100, 1)
        if c7 is not None and c7 != 0:
            trend_dir = "risen" if c7 > 0 else "declined"
            sentences.append(
                f"The latest reported modal price for {commodity} in {market} is ₹{int(latest_price):,} per quintal (₹{per_kg} per kg), having {trend_dir} by {abs(c7)}% over the last 7 days."
            )
        else:
            sentences.append(
                f"The latest reported modal price for {commodity} in {market} is ₹{int(latest_price):,} per quintal (₹{per_kg} per kg)."
            )
    else:
        sentences.append(f"No recent modal price report has been filed for {commodity} in {market}.")

    if cov < 30:
        sentences.append(
            f"Mandi reporting consistency is limited ({cov}% coverage over the window), so current figures should be treated as indicative."
        )
    elif ctx.get("weather_signals"):
        signals_summary = "; ".join(ctx["weather_signals"])
        sentences.append(f"Local district weather indicates: {signals_summary}.")
    else:
        sentences.append("District weather conditions show normal logistics without major arrival disruptions.")

    return " ".join(sentences)


def generate_market_insight(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Generates a 2-3 sentence grounded market summary using Gemini 2.5 Flash, falling back to deterministic synthesis.
    """
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY
    context_text = format_context_for_prompt(ctx)
    cov = ctx.get("coverage_pct", 50)
    confidence = "high" if cov >= 70 else "medium" if cov >= 30 else "low"

    if not api_key:
        logger.info("GEMINI_API_KEY not configured; using deterministic market insight.")
        return {
            "insight": generate_fallback_market_insight(ctx),
            "confidence": confidence,
            "coverage_pct": cov,
        }

    prompt = f"""Summarize the following market information for an Indian farmer in 2-3 short, plain sentences.
Do not use conversational filler (such as 'Here is the summary:').
Do not use markdown bolding or bullet points.
Use ONLY the figures and facts given below. Do not add any outside number, fact, or prediction.
DO NOT forecast future prices. If data coverage is low or degraded, state that plainly.

DATA:
{context_text}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 600,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "").strip()
                        # Clean any stray formatting
                        text = re.sub(r"\s+", " ", text)
                        if text:
                            return {
                                "insight": text,
                                "confidence": confidence,
                                "coverage_pct": cov,
                            }
            else:
                logger.warning(f"Gemini market insight returned {resp.status_code}: {resp.text[:120]}")
    except Exception as exc:
        logger.warning(f"Gemini market insight call failed: {exc}")

    # Fallback
    return {
        "insight": generate_fallback_market_insight(ctx),
        "confidence": confidence,
        "coverage_pct": cov,
    }
