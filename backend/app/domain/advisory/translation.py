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


def translate_to_english(text: str, source_lang: str = "auto") -> str:
    """
    Translates incoming user query to English for RAG retrieval and embedding matching.
    """
    if not text or source_lang == "en" and not is_indic_text(text):
        return text

    settings = get_settings()
    bhashini_key = getattr(settings, "BHASHINI_API_KEY", "") or os.getenv("BHASHINI_API_KEY", "")
    bhashini_user_id = getattr(settings, "BHASHINI_USER_ID", "") or os.getenv("BHASHINI_USER_ID", "")

    # Live Bhashini integration if credentials exist
    if bhashini_key and bhashini_user_id:
        try:
            headers = {
                "Authorization": bhashini_key,
                "userID": bhashini_user_id,
                "Content-Type": "application/json",
            }
            payload = {
                "pipelineTasks": [
                    {
                        "taskType": "translation",
                        "config": {
                            "language": {
                                "sourceLanguage": "hi" if source_lang not in ("mr", "gu") else source_lang,
                                "targetLanguage": "en",
                            }
                        },
                    }
                ],
                "inputData": {"input": [{"source": text}]},
            }
            with httpx.Client(timeout=8.0) as client:
                res = client.post(
                    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
                    json=payload,
                    headers=headers,
                )
                if res.status_code == 200:
                    out = res.json()
                    translated = out.get("pipelineResponse", [{}])[0].get("output", [{}])[0].get("target")
                    if translated:
                        return translated
        except Exception as exc:
            logger.warning(f"Bhashini incoming translation failed: {exc}")

    # Fallback / Indic transliteration dictionary for key agricultural concepts
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
    Translates the final grounded English advisory response back to the farmer's preferred language.
    """
    if target_lang == "en" or not text:
        return text

    settings = get_settings()
    bhashini_key = getattr(settings, "BHASHINI_API_KEY", "") or os.getenv("BHASHINI_API_KEY", "")
    bhashini_user_id = getattr(settings, "BHASHINI_USER_ID", "") or os.getenv("BHASHINI_USER_ID", "")

    if bhashini_key and bhashini_user_id:
        try:
            headers = {
                "Authorization": bhashini_key,
                "userID": bhashini_user_id,
                "Content-Type": "application/json",
            }
            payload = {
                "pipelineTasks": [
                    {
                        "taskType": "translation",
                        "config": {
                            "language": {
                                "sourceLanguage": "en",
                                "targetLanguage": target_lang,
                            }
                        },
                    }
                ],
                "inputData": {"input": [{"source": text}]},
            }
            with httpx.Client(timeout=8.0) as client:
                res = client.post(
                    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
                    json=payload,
                    headers=headers,
                )
                if res.status_code == 200:
                    out = res.json()
                    translated = out.get("pipelineResponse", [{}])[0].get("output", [{}])[0].get("target")
                    if translated:
                        return translated
        except Exception as exc:
            logger.warning(f"Bhashini outgoing translation failed: {exc}")

    # For development/demo without live Bhashini API key, keep English prose with language notice
    # or localized header
    return text
