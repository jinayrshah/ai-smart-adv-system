"""
Market Insight Generation.
Revisions_MarketWeather.md §2.3 & Architecture_MarketData_Weather.md §10.4.

A 2-3 sentence summary that may only re-phrase numbers already shown on the page. It
never forecasts. Two safeguards beyond the prompt:
- the context holds only real values (no placeholder "normal weather" line — the first
  version told the model there was "no transport disruption" without any data);
- the generated text is audited: if it contains a number that is not in the context,
  the deterministic summary is returned instead (Revisions §2.3 acceptance rule).
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.core.gemini import generate_text
from app.domain.advisory.audit import audit_number_grounding

logger = logging.getLogger(__name__)


def _fmt_pct(v: float | None) -> str:
    if v is None:
        return "not available"
    return f"+{v}%" if v > 0 else f"{v}%"


def format_context_for_prompt(ctx: dict[str, Any]) -> str:
    latest = ctx.get("latest_price")
    unit = ctx.get("unit", "Rs/Quintal")
    reports = ctx.get("reports_in_window")
    lines = [
        f"Commodity: {ctx.get('commodity', '')}",
        f"Market: {ctx.get('market', '')}, {ctx.get('state', '')}",
    ]
    if latest:
        lines.append(f"Latest modal price: ₹{latest} per quintal (₹{round(latest / 100, 2)} per kg)"
                     + (f", reported {ctx['latest_date']}" if ctx.get("latest_date") else ""))
    else:
        lines.append("Latest modal price: no report in the window")
    if reports is not None:
        lines.append(f"Market-days with a price report in the last {ctx.get('window_days', 30)} days: {reports}")
    lines.append(f"Change vs about 7 days earlier: {_fmt_pct(ctx.get('change7d_pct'))}")
    lines.append(f"Change vs about 30 days earlier: {_fmt_pct(ctx.get('change30d_pct'))}")
    lines.append(f"Reporting coverage: {ctx.get('coverage_pct', 0)}% of days")
    for sig in ctx.get("weather_signals") or []:
        lines.append(f"Weather signal: {sig}")
    if ctx.get("cost_c2") is not None:
        lines.append(f"Reference production cost (DES C2): ₹{ctx['cost_c2']} per quintal")
    if ctx.get("net_margin") is not None:
        lines.append(f"Margin vs that cost: ₹{ctx['net_margin']} per quintal")
    if ctx.get("breakeven_price") is not None:
        lines.append(f"Storage breakeven price: ₹{ctx['breakeven_price']} per quintal")
    return "\n".join(lines)


def generate_fallback_market_insight(ctx: dict[str, Any]) -> str:
    """Deterministic summary using only values in `ctx`."""
    commodity = ctx.get("commodity", "this crop")
    market = ctx.get("market", "the market")
    latest = ctx.get("latest_price")
    c7, c30 = ctx.get("change7d_pct"), ctx.get("change30d_pct")
    cov = ctx.get("coverage_pct", 0)
    reports = ctx.get("reports_in_window")

    out = []
    if latest:
        s = (f"The latest modal price for {commodity} in {market} is ₹{latest:,.0f} per quintal "
             f"(₹{round(latest / 100, 2)} per kg)")
        if c7 is not None:
            s += f", {'up' if c7 > 0 else 'down' if c7 < 0 else 'unchanged'}"
            s += f" {abs(c7)}% from about a week earlier" if c7 != 0 else " from about a week earlier"
        out.append(s + ".")
        if c30 is not None and c7 is None:
            out.append(f"Compared with about a month earlier it is {_fmt_pct(c30)}.")
    else:
        out.append(f"No price report for {commodity} in {market} was filed in this period.")

    if reports is not None and reports < 3:
        out.append(f"Only {reports} report(s) were filed in this window, so no trend can be read from them.")
    elif cov < 30:
        out.append(f"Reporting is patchy ({cov}% of days have a report), so treat these figures as indicative.")
    if ctx.get("net_margin") is not None:
        out.append(f"Against the reference production cost the margin is ₹{ctx['net_margin']:,.0f} per quintal.")
    return " ".join(out)


def _confidence(ctx: dict[str, Any]) -> str:
    cov = ctx.get("coverage_pct", 0)
    reports = ctx.get("reports_in_window")
    if reports is not None and reports < 3:
        return "low"
    return "high" if cov >= 70 else "medium" if cov >= 30 else "low"


def generate_market_insight(ctx: dict[str, Any]) -> dict[str, Any]:
    confidence = _confidence(ctx)
    cov = ctx.get("coverage_pct", 0)
    context_text = format_context_for_prompt(ctx)
    prompt = f"""Summarize this market information for an Indian farmer in 2-3 short, plain sentences.
No filler, no markdown, no bullet points.
Use ONLY the figures below; do not add any other number, fact or prediction, and never forecast prices.
If there are fewer than 3 reports or coverage is low, say plainly that the data is thin.

DATA:
{context_text}
"""
    text, model = generate_text(prompt, temperature=0.2, max_output_tokens=300, timeout=8.0)
    text = re.sub(r"\s+", " ", text or "").strip()
    if text:
        audit = audit_number_grounding(text, {"ctx": ctx, "context_text": context_text})
        if audit["ungrounded_numbers"]:
            logger.warning(f"Market insight contained untraceable numbers {audit['ungrounded_numbers']}; using fallback")
            text = ""
    if not text:
        text, model = generate_fallback_market_insight(ctx), None
    return {"insight": text, "confidence": confidence, "coverage_pct": cov, "generated_by": model or "deterministic"}
