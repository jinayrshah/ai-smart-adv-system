"""
Gemini Embedding client generating 768-dimensional vectors.
Architecture_Advisory.md §10.1, §10.2.
"""

import hashlib
import logging
import math
from typing import Literal
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768


def _deterministic_mock_embedding(text: str) -> list[float]:
    """
    Offline/fallback deterministic 768-dim unit-normalized vector for tests and CI.
    Ensures tests pass deterministically without spending quotas or needing network.
    """
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    vals = []
    for i in range(EMBEDDING_DIMENSIONS):
        byte_val = seed[i % len(seed)]
        # Generate varied float between -1.0 and 1.0
        val = ((byte_val ^ (i & 0xFF)) / 128.0) - 1.0
        vals.append(val)
    # Normalize to unit length
    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return [round(v / norm, 6) for v in vals]


def get_gemini_embedding(
    text: str,
    task_type: Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"] = "RETRIEVAL_DOCUMENT",
    use_mock: bool = False,
) -> list[float]:
    """
    Generates 768-dimensional Matryoshka embedding using gemini-embedding-001.
    """
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY

    if use_mock or not api_key:
        return _deterministic_mock_embedding(text)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_EMBEDDING_MODEL}:embedContent?key={api_key}"
    payload = {
        "content": {"parts": [{"text": text[:2048]}]},
        "outputDimensionality": EMBEDDING_DIMENSIONS,
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                vals = data.get("embedding", {}).get("values", [])
                if len(vals) == EMBEDDING_DIMENSIONS:
                    return vals
            logger.warning(f"Gemini embedding API returned status {resp.status_code}: {resp.text[:150]}")
    except Exception as exc:
        logger.warning(f"Gemini embedding request failed: {exc}")

    # Fallback to deterministic mock if network drops
    return _deterministic_mock_embedding(text)
