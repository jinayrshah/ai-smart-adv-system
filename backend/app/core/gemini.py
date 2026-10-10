"""
Single Gemini client used by every backend feature (advisory chat, scheme Q&A,
market insight, embeddings).

Why one module:
- Model ids are config, not code (Architecture_Advisory.md §20 — model lines get
  deprecated on a schedule). GEMINI_MODEL is tried first, then GEMINI_FALLBACK_MODELS
  on 404 (retired model), 429 (quota) or 5xx (overload).
- The API key travels in the `x-goog-api-key` header instead of the URL query string,
  so it never lands in proxy/access logs.
- Gemini 2.5 models "think" by default and thinking tokens count against
  maxOutputTokens; with small budgets that silently produced empty answers and pushed
  every request onto the offline fallback. Thinking is disabled for 2.5 models here
  because these prompts only re-phrase numbers that were already computed.
"""

from __future__ import annotations

import logging
import math
import time
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_RETRYABLE = {404, 429, 500, 502, 503, 504}


def _thinking_config(model: str) -> dict[str, Any] | None:
    if model.startswith("gemini-2.5"):
        return {"thinkingBudget": 0}
    return None


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought")]
    return "".join(texts).strip()


def generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
    response_mime_type: str | None = None,
    timeout: float = 15.0,
    image_b64: str | None = None,
    image_mime: str = "image/jpeg",
) -> tuple[str, str | None]:
    """
    Generate text with Gemini. Returns (text, model_used). On any failure returns
    ("", None) so callers fall back to their deterministic path.
    """
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return "", None

    parts: list[dict[str, Any]] = [{"text": prompt}]
    if image_b64:
        parts.append({"inline_data": {"mime_type": image_mime, "data": image_b64}})

    for model in settings.gemini_models:
        gen_cfg: dict[str, Any] = {"temperature": temperature, "maxOutputTokens": max_output_tokens}
        thinking = _thinking_config(model)
        if thinking:
            gen_cfg["thinkingConfig"] = thinking
        if response_mime_type:
            gen_cfg["responseMimeType"] = response_mime_type
        payload: dict[str, Any] = {"contents": [{"role": "user", "parts": parts}], "generationConfig": gen_cfg}
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    f"{GEMINI_BASE}/{model}:generateContent",
                    json=payload,
                    headers={"x-goog-api-key": api_key},
                )
            if resp.status_code == 200:
                text = _extract_text(resp.json())
                if text:
                    return text, model
                logger.warning(f"Gemini {model} returned no text (finish reason may be MAX_TOKENS/SAFETY)")
                continue
            if resp.status_code in _RETRYABLE:
                logger.warning(f"Gemini {model} returned {resp.status_code}; trying next model")
                if resp.status_code == 429:
                    time.sleep(0.5)
                continue
            logger.warning(f"Gemini {model} returned {resp.status_code}: {resp.text[:160]}")
            return "", None
        except Exception as exc:  # network errors, timeouts
            logger.warning(f"Gemini {model} call failed: {exc}")
            continue
    return "", None


def l2_normalize(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in values))
    if norm == 0:
        return values
    return [v / norm for v in values]


def embed_text(
    text: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
    output_dimensionality: int = 768,
    timeout: float = 12.0,
) -> list[float] | None:
    """
    Embed with gemini-embedding-001. Returns None when unavailable — callers must NOT
    substitute a fake vector (comparing a random vector against real document vectors
    yields meaningless similarities); they should fall back to lexical retrieval.

    taskType matters: RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT produce asymmetric
    embeddings tuned for search. Truncated (768-d) outputs are not unit-normalised by
    the API, so they are normalised here.
    """
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
    model = settings.GEMINI_EMBEDDING_MODEL
    payload = {
        "content": {"parts": [{"text": text[:8000]}]},
        "taskType": task_type,
        "outputDimensionality": output_dimensionality,
    }
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(
                f"{GEMINI_BASE}/{model}:embedContent",
                json=payload,
                headers={"x-goog-api-key": api_key},
            )
        if resp.status_code == 200:
            vals = (resp.json().get("embedding") or {}).get("values") or []
            if len(vals) == output_dimensionality:
                return l2_normalize([float(v) for v in vals])
        logger.warning(f"Gemini embedding returned {resp.status_code}: {resp.text[:160]}")
    except Exception as exc:
        logger.warning(f"Gemini embedding request failed: {exc}")
    return None
