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
import re
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

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
_groq_index = 0
_groq_discovered: dict[bool, list[str]] = {}
_NOT_CHAT = ("whisper", "guard", "tts", "playai", "orpheus", "distil", "embed", "prompt")


def groq_available_models(key: str) -> list[str]:
    with httpx.Client(timeout=15.0) as client:
        r = client.get(GROQ_MODELS_URL, headers={"Authorization": f"Bearer {key}"})
    r.raise_for_status()
    return [m["id"] for m in r.json().get("data", []) if m.get("active", True)]


def _discover_groq_models(key: str, vision: bool) -> list[str]:
    """When the configured model ids are retired, pick live ones from the account's model list."""
    if vision in _groq_discovered:
        return _groq_discovered[vision]
    try:
        ids = groq_available_models(key)
    except Exception as exc:
        logger.warning(f"Groq model list unavailable: {exc}")
        return []
    chat = [i for i in ids if not any(t in i.lower() for t in _NOT_CHAT)]
    if vision:
        picks = [i for i in chat if any(t in i.lower() for t in ("scout", "maverick", "vision", "llama-4", "-vl", "vl-", "gemma", "pixtral", "llava", "omni"))]
    else:
        prefs = ("llama-3.3-70b", "gpt-oss-120b", "llama-4-maverick", "qwen", "llama-3.1-8b", "gpt-oss-20b", "llama")
        picks = sorted(chat, key=lambda i: next((n for n, p in enumerate(prefs) if p in i.lower()), len(prefs)))
    _groq_discovered[vision] = picks[:3]
    logger.warning(f"Groq: configured models unavailable; using {picks[:3]} (set GROQ_MODELS / GROQ_VISION_MODELS to pin)")
    return _groq_discovered[vision]


def _groq_generate(
    prompt: str, system_instruction: str | None, temperature: float, max_output_tokens: int,
    response_mime_type: str | None, timeout: float, image_b64: str | None, image_mime: str,
) -> tuple[str, str | None]:
    """Groq first when configured: keys rotate (one per account), models fall through on 404/decommission."""
    global _groq_index
    settings = get_settings()
    keys = settings.groq_api_keys
    if not keys:
        return "", None
    models = settings.GROQ_VISION_MODELS if image_b64 else settings.GROQ_MODELS
    content: Any = prompt if not image_b64 else [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:{image_mime};base64,{image_b64}"}},
    ]
    messages = ([{"role": "system", "content": system_instruction}] if system_instruction else []) + [{"role": "user", "content": content}]
    _groq_index += 1
    keys = keys[_groq_index % len(keys):] + keys[: _groq_index % len(keys)]
    configured = [m.strip() for m in models.split(",") if m.strip()]
    tried: set[str] = set()
    for model in configured + ["__discover__"]:
        if model == "__discover__":
            extra = [m for m in _discover_groq_models(keys[0], bool(image_b64)) if m not in tried]
            text, used = _groq_try(extra, keys, messages, temperature, max_output_tokens, response_mime_type, timeout)
            return text, used
        tried.add(model)
        text, used = _groq_try([model], keys, messages, temperature, max_output_tokens, response_mime_type, timeout)
        if text:
            return text, used
    return "", None


def _groq_try(models: list[str], keys: list[str], messages: list[dict[str, Any]], temperature: float,
              max_output_tokens: int, response_mime_type: str | None, timeout: float) -> tuple[str, str | None]:
    for model in models:
        body: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature,
                                "max_tokens": min(max_output_tokens, 8000)}
        if response_mime_type == "application/json":
            body["response_format"] = {"type": "json_object"}
        for key in keys:
            try:
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {key}"})
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                logger.warning(f"Groq {model} unreachable with key ...{key[-6:]}: {exc}")
                continue
            if resp.status_code == 200:
                text = (resp.json().get("choices") or [{}])[0].get("message", {}).get("content") or ""
                # Reasoning models (qwen3) may prepend their thinking; farmers only get the answer.
                text = re.sub(r"<think>.*?</think>\s*", "", text, flags=re.S).strip()
                if text:
                    return text, f"groq/{model}"
                continue
            if resp.status_code in (401, 403, 429):
                logger.warning(f"Groq key ...{key[-6:]} returned {resp.status_code}; trying next key")
                continue
            # 404 / 400 (model retired or unsupported request): next model
            logger.warning(f"Groq {model} returned {resp.status_code}: {resp.text[:160]}")
            break
    return "", None


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
    text, model = _groq_generate(prompt, system_instruction, temperature, max_output_tokens,
                                 response_mime_type, timeout, image_b64, image_mime)
    if text:
        return text, model

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
