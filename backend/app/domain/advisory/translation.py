"""
Bhashini Translation Pipeline for Multilingual Advisory Support.
Architecture_Advisory.md §15.

Translates farmer queries (Hindi, Marathi, Gujarati) to English for RAG retrieval
and reasoning, then translates the grounded English response back to the farmer's
preferred language.
"""

import logging
import os
import re
from typing import Literal
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {"en", "hi", "mr", "gu"}


def is_indic_text(text: str) -> bool:
    """Check if string contains Devanagari or Gujarati Unicode characters."""
    # Devanagari: \u0900-\u097F, Gujarati: \u0A80-\u0AFF
    return bool(re.search(r"[\u0900-\u097F\u0A80-\u0AFF]", text))


# --------------------------------------------------------------------------- Bhashini
# Bhashini (ULCA) is a two-step API: the pipeline-config call returns, per language
# pair, the `serviceId` to use plus an inference key and endpoint; only then can the
# inference call be made. The earlier code skipped step 1 and sent the ULCA key as the
# inference Authorization header without a serviceId, so every call failed and all
# answers silently stayed in English.
ULCA_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
DEFAULT_PIPELINE_ID = "64392f96daac500b55c543cd"  # MeitY pipeline (public Bhashini docs)
_PIPELINE_CACHE: dict[tuple[str, str], tuple[str, str, str, str]] = {}


def _bhashini_credentials() -> tuple[str, str]:
    settings = get_settings()
    key = getattr(settings, "BHASHINI_API_KEY", "") or os.getenv("BHASHINI_API_KEY", "")
    user = getattr(settings, "BHASHINI_USER_ID", "") or os.getenv("BHASHINI_USER_ID", "")
    return key, user


def _pipeline_for(src: str, tgt: str, key: str, user: str) -> tuple[str, str, str, str] | None:
    """(inference_url, auth_header_name, auth_value, service_id) for a language pair."""
    if (src, tgt) in _PIPELINE_CACHE:
        return _PIPELINE_CACHE[(src, tgt)]
    pipeline_id = os.getenv("BHASHINI_PIPELINE_ID", DEFAULT_PIPELINE_ID)
    body = {
        "pipelineTasks": [
            {"taskType": "translation", "config": {"language": {"sourceLanguage": src, "targetLanguage": tgt}}}
        ],
        "pipelineRequestConfig": {"pipelineId": pipeline_id},
    }
    headers = {"userID": user, "ulcaApiKey": key, "Content-Type": "application/json"}
    with httpx.Client(timeout=8.0) as client:
        res = client.post(ULCA_CONFIG_URL, json=body, headers=headers)
    if res.status_code != 200:
        logger.warning(f"Bhashini pipeline config failed ({res.status_code})")
        return None
    data = res.json()
    endpoint = data.get("pipelineInferenceAPIEndPoint") or {}
    api_key = endpoint.get("inferenceApiKey") or {}
    url = endpoint.get("callbackUrl") or "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
    service_id = None
    for task in data.get("pipelineResponseConfig") or []:
        if task.get("taskType") != "translation":
            continue
        for cfg in task.get("config") or []:
            lang = cfg.get("language") or {}
            if lang.get("sourceLanguage") == src and lang.get("targetLanguage") == tgt:
                service_id = cfg.get("serviceId")
                break
    if not service_id or not api_key.get("value"):
        logger.warning(f"Bhashini has no translation service for {src}->{tgt}")
        return None
    entry = (url, api_key.get("name") or "Authorization", api_key["value"], service_id)
    _PIPELINE_CACHE[(src, tgt)] = entry
    return entry


def bhashini_translate(text: str, src: str, tgt: str) -> str | None:
    """Translate with Bhashini; None when not configured or on any failure."""
    key, user = _bhashini_credentials()
    if not (key and user) or src == tgt:
        return None
    try:
        pipe = _pipeline_for(src, tgt, key, user)
        if not pipe:
            return None
        url, auth_name, auth_value, service_id = pipe
        body = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {"sourceLanguage": src, "targetLanguage": tgt},
                        "serviceId": service_id,
                    },
                }
            ],
            "inputData": {"input": [{"source": text}]},
        }
        with httpx.Client(timeout=10.0) as client:
            res = client.post(url, json=body, headers={auth_name: auth_value, "Content-Type": "application/json"})
        if res.status_code != 200:
            logger.warning(f"Bhashini inference failed ({res.status_code})")
            _PIPELINE_CACHE.pop((src, tgt), None)
            return None
        out = res.json().get("pipelineResponse") or [{}]
        target = ((out[0].get("output") or [{}])[0]).get("target")
        return target or None
    except Exception as exc:
        logger.warning(f"Bhashini translation {src}->{tgt} failed: {exc}")
        return None


def detect_source_language(text: str, hint: str = "auto") -> str:
    """Gujarati script -> gu; Devanagari -> mr if the farmer's language is Marathi, else hi."""
    if re.search(r"[\u0A80-\u0AFF]", text):
        return "gu"
    if re.search(r"[\u0900-\u097F]", text):
        return "mr" if hint == "mr" else "hi"
    return "en"


def translate_to_english(text: str, source_lang: str = "auto") -> str:
    """
    Translates incoming user query to English for RAG retrieval and embedding matching.
    """
    if not text or not is_indic_text(text):
        return text
    src = detect_source_language(text, source_lang)
    translated = bhashini_translate(text, src, "en")
    if translated:
        return translated

    # Offline fallback: keyword glossary so retrieval still finds the right crop/topic
    replacements = {
        # Hindi / Marathi common queries
        "सिंचाई": "irrigation",
        "पानी": "water",
        "खाद": "fertilizer",
        "यूरिया": "urea",
        "डीएपी": "DAP",
        "कीट": "pest",
        "रोग": "disease",
        "गेहूं": "wheat",
        "टमाटर": "tomato",
        "कपास": "cotton",
        "सोयाबीन": "soybean",
        "चावल": "rice",
        "धान": "rice",
        "मक्का": "maize",
        "पीला रतुआ": "yellow rust",
        "गुलाबी सुंडी": "pink bollworm",
        # Gujarati common queries
        "પિયત": "irrigation",
        "ખાતર": "fertilizer",
        "ઘઉં": "wheat",
        "ટમેટા": "tomato",
        "કપાસ": "cotton",
        "સોયાબીન": "soybean",
        "ડાંગર": "rice",
        "મકાઈ": "maize",
    }
    translated = text
    for ind, eng in replacements.items():
        translated = translated.replace(ind, eng)
    return translated


def translate_from_english(text: str, target_lang: str) -> str:
    """
    Translates the grounded English response to the farmer's preferred language.
    Without Bhashini the English text is returned unchanged (README §8: Gemini is not
    used as a translator because its Gujarati/Marathi quality is uneven).
    """
    if target_lang not in SUPPORTED_LANGUAGES or target_lang == "en" or not text:
        return text
    return bhashini_translate(text, "en", target_lang) or text
