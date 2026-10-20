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


import threading

class GeminiKeyPool:
    """
    Multi-key pooling system for Gemini API keys.
    Provides round-robin distribution and automatic cooldown rotation on 429 rate limits.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._index = 0
        self._cooldowns: dict[str, float] = {}

    def get_keys(self) -> list[str]:
        settings = get_settings()
        keys = settings.gemini_api_keys
        if not keys and settings.GEMINI_API_KEY:
            keys = [settings.GEMINI_API_KEY]
        return keys

    def mark_cooldown(self, key: str, duration_seconds: float = 30.0, reason: str = "error"):
        with self._lock:
            self._cooldowns[key] = time.time() + duration_seconds
            logger.warning(f"Gemini API key ...{key[-6:]} {reason}. Cooldown for {duration_seconds}s.")

    def mark_rate_limited(self, key: str, duration_seconds: float = 60.0):
        self.mark_cooldown(key, duration_seconds, "hit rate limit (429)")

    def get_candidates(self) -> list[str]:
        keys = self.get_keys()
        if not keys:
            return []
        now = time.time()
        with self._lock:
            active = [k for k in keys if self._cooldowns.get(k, 0) <= now]
            if not active:
                active = sorted(keys, key=lambda k: self._cooldowns.get(k, 0))
            idx = self._index % len(active)
            self._index = (self._index + 1) % len(active)
            return active[idx:] + active[:idx]


key_pool = GeminiKeyPool()


def _thinking_config(model: str) -> dict[str, Any] | None:
    if model.startswith("gemini-2.5") and "lite" not in model:
        return {"thinkingBudget": 0}
    return None


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    cand = candidates[0]
    finish_reason = cand.get("finishReason")
    if finish_reason == "MAX_TOKENS":
        logger.warning("Gemini output hit MAX_TOKENS ceiling; consider increasing max_output_tokens")
    parts = (cand.get("content") or {}).get("parts") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought")]
    return "".join(texts).strip()


def generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 3500,
    response_mime_type: str | None = None,
    timeout: float = 25.0,
    image_b64: str | None = None,
    image_mime: str = "image/jpeg",
) -> tuple[str, str | None]:
    """
    Generate text with Gemini using multi-key pooling and model fallback.
    Returns (text, model_used). On any failure returns ("", None) so callers
    fall back to their deterministic path.
    """
    keys = key_pool.get_candidates()
    if not keys:
        return "", None

    settings = get_settings()
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

        model_5xx_count = 0
        for api_key in keys:
            try:
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post(
                        f"{GEMINI_BASE}/{model}:generateContent",
                        json=payload,
                        headers={"x-goog-api-key": api_key},
                    )
                if resp.status_code == 400 and thinking:
                    # Some models reject thinkingConfig; retry without it
                    payload_no_think = {**payload, "generationConfig": {k: v for k, v in gen_cfg.items() if k != "thinkingConfig"}}
                    with httpx.Client(timeout=timeout) as client:
                        resp = client.post(
                            f"{GEMINI_BASE}/{model}:generateContent",
                            json=payload_no_think,
                            headers={"x-goog-api-key": api_key},
                        )

                if resp.status_code == 200:
                    text = _extract_text(resp.json())
                    if text:
                        return text, model
                    logger.warning(f"Gemini {model} returned no text (finish reason may be MAX_TOKENS/SAFETY)")
                    continue

                if resp.status_code == 404:
                    logger.warning(f"Gemini model {model} not found (404); skipping to next model")
                    break

                if resp.status_code == 429:
                    key_pool.mark_rate_limited(api_key, 60.0)
                    logger.warning(f"Gemini key ...{api_key[-6:]} returned 429; rotating to next pooled key")
                    continue

                if resp.status_code in {500, 502, 503, 504}:
                    model_5xx_count += 1
                    logger.warning(f"Gemini model {model} server {resp.status_code} on key ...{api_key[-6:]}")
                    if model_5xx_count >= 2:
                        logger.warning(f"Gemini model {model} experiencing repeated 5xx errors; immediately switching to fallback model")
                        break
                    continue

                if resp.status_code in _RETRYABLE or resp.status_code == 400:
                    logger.warning(f"Gemini {model} returned {resp.status_code} with key ...{api_key[-6:]}; continuing")
                    continue
                logger.warning(f"Gemini {model} returned {resp.status_code}: {resp.text[:160]}")
                continue
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                key_pool.mark_cooldown(api_key, 30.0, f"call failed/timeout: {exc}")
                continue
            except Exception as exc:
                logger.warning(f"Gemini {model} unexpected error with key ...{api_key[-6:]}: {exc}")
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
    timeout: float = 3.5,
) -> list[float] | None:
    """
    Embed with gemini-embedding-001 using key pooling.
    Returns None when unavailable — callers should fall back to lexical retrieval.
    """
    keys = key_pool.get_candidates()
    if not keys:
        return None

    settings = get_settings()
    model = settings.GEMINI_EMBEDDING_MODEL
    payload = {
        "content": {"parts": [{"text": text[:8000]}]},
        "taskType": task_type,
        "outputDimensionality": output_dimensionality,
    }

    embed_5xx_or_timeout_count = 0
    for api_key in keys:
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
            if resp.status_code == 429:
                key_pool.mark_rate_limited(api_key, 60.0)
                continue
            if resp.status_code in {500, 502, 503, 504}:
                embed_5xx_or_timeout_count += 1
                logger.warning(f"Gemini embedding model {model} server {resp.status_code} on key ...{api_key[-6:]}")
                if embed_5xx_or_timeout_count >= 2:
                    logger.warning("Gemini embedding experiencing repeated 5xx; falling back to lexical search")
                    break
                continue
            logger.warning(f"Gemini embedding returned {resp.status_code}: {resp.text[:160]}")
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            embed_5xx_or_timeout_count += 1
            logger.warning(f"Gemini embedding timeout on key ...{api_key[-6:]}: {exc}")
            if embed_5xx_or_timeout_count >= 2:
                logger.warning("Gemini embedding experiencing repeated timeouts; falling back to lexical search")
                break
            continue
        except Exception as exc:
            logger.warning(f"Gemini embedding failed with key ...{api_key[-6:]}: {exc}")
            continue

    return None
