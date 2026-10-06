"""
Safety, Grounding, and Hallucination Controls for Advisory Generation.
Architecture_Advisory.md §17.
"""

import logging
import re
from typing import Any, Literal
from app.schemas.rag import RetrievedChunk

logger = logging.getLogger(__name__)

# Permitted general small numbers, calendar counts, and common unit terms
ALLOWED_CONVERSATIONAL_NUMBERS = {
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "12", "14", "15", "20", "21", "24", "25", "30", "48", "72", "100"
}


def compute_advisory_confidence(
    retrieved_chunks: list[RetrievedChunk],
    weather_confidence: str | None = None,
    stage_computed: bool = True,
) -> Literal["grounded", "partial", "insufficient"]:
    """
    Computes groundedness confidence based on objective retrieval similarity and data quality.
    Architecture §17.3.
    """
    if not retrieved_chunks:
        return "insufficient"

    max_sim = max((c.similarity for c in retrieved_chunks), default=0.0)

    # Threshold per §17.4: below 0.60 is out-of-scope / unreliable
    if max_sim < 0.60:
        return "insufficient"

    # If weather was degraded or max similarity is borderline (0.60 - 0.65)
    if max_sim < 0.65 or weather_confidence == "low" or not stage_computed:
        return "partial"

    return "grounded"


def extract_numbers_from_text(text: str) -> list[str]:
    """
    Extracts numerical tokens from prose (e.g. '28mm', '₹2200', '6.8', '240kg').
    """
    pattern = r"(?:₹\s*|\b)\d+(?:,\d+)*(?:\.\d+)?(?:mm|cm|kg|g|qtl|%|°C|days?|acres?)?\b"
    matches = re.findall(pattern, text, flags=re.IGNORECASE)
    cleaned = []
    for m in matches:
        # Strip unit and commas to isolate core numeric value
        c = re.sub(r"[^\d.]", "", m).strip()
        if c:
            cleaned.append(c)
    return cleaned


def extract_context_numbers(context_dict: dict[str, Any]) -> set[str]:
    """
    Recursively extracts all numeric values present in the assembled context snapshot.
    """
    context_numbers: set[str] = set()

    def _walk(obj: Any):
        if isinstance(obj, (int, float)):
            # Add integer version and rounded version
            val_str = str(obj)
            context_numbers.add(val_str)
            if isinstance(obj, float):
                context_numbers.add(str(round(obj)))
                context_numbers.add(str(round(obj, 1)))
                context_numbers.add(str(round(obj, 2)))
        elif isinstance(obj, str):
            for num in extract_numbers_from_text(obj):
                context_numbers.add(num)
        elif isinstance(obj, dict):
            for v in obj.values():
                _walk(v)
        elif isinstance(obj, (list, tuple, set)):
            for v in obj:
                _walk(v)

    _walk(context_dict)
    return context_numbers


def audit_number_grounding(
    response_text: str,
    context_snapshot: dict[str, Any],
) -> dict[str, Any]:
    """
    Post-generation number-grounding check (§17.2).
    Scans the response for numbers and checks if they trace back to context_snapshot.
    """
    found_nums = extract_numbers_from_text(response_text)
    ctx_nums = extract_context_numbers(context_snapshot)

    grounded: list[str] = []
    ungrounded: list[str] = []

    for num in found_nums:
        # Check direct presence or conversational numbers
        if num in ctx_nums or num in ALLOWED_CONVERSATIONAL_NUMBERS:
            grounded.append(num)
        else:
            # Check float match within tolerance (e.g., 28.0 vs 28)
            try:
                f_val = float(num)
                matched = any(abs(f_val - float(c)) < 0.05 for c in ctx_nums if c.replace(".", "", 1).isdigit())
                if matched:
                    grounded.append(num)
                else:
                    ungrounded.append(num)
            except ValueError:
                ungrounded.append(num)

    passed = len(ungrounded) == 0

    if not passed:
        logger.warning(
            f"[Grounding Audit] Potential ungrounded numerals found in response: {ungrounded}. "
            f"Context snapshot contained {len(ctx_nums)} numerical anchor points."
        )

    return {
        "passed": passed,
        "found_numbers": found_nums,
        "grounded_numbers": grounded,
        "ungrounded_numbers": ungrounded,
    }
