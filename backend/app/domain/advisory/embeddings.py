"""
Gemini Embedding client generating 768-dimensional vectors.
Architecture_Advisory.md §10.1, §10.2.

Changes vs. the first version:
- `taskType` is now actually sent (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT); it was
  dropped from the request before, which degrades asymmetric search quality.
- Truncated 768-d vectors are L2-normalised (the API only normalises 3072-d output).
- A network/quota failure no longer silently returns a hash-based "mock" vector.
  Comparing a random vector with real document vectors produced meaningless
  similarity scores; now the function returns None and retrieval falls back to
  lexical (BM25) search instead. The deterministic mock is only used when a caller
  explicitly asks for it (unit tests, offline fixture builds).
"""

import hashlib
import json
import logging
import math
import os
from pathlib import Path
from typing import Literal

from app.core.gemini import embed_text, l2_normalize

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 768

_CACHE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "advisory" / "fixtures" / "query_embeddings_cache.json"
_EMBEDDING_CACHE: dict[str, list[float]] = {}


def _deterministic_mock_embedding(text: str) -> list[float]:
    """
    Deterministic 768-dim unit vector for tests/CI only. Never used as a stand-in for
    a real embedding at request time.
    """
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    vals = []
    for i in range(EMBEDDING_DIMENSIONS):
        byte_val = seed[i % len(seed)]
        val = ((byte_val ^ (i & 0xFF)) / 128.0) - 1.0
        vals.append(val)
    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return [round(v / norm, 6) for v in vals]


def _load_disk_cache() -> None:
    if _CACHE_FILE.exists():
        try:
            with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                _EMBEDDING_CACHE.update(json.load(f))
        except Exception as exc:
            logger.debug(f"Could not load embedding disk cache: {exc}")


_load_disk_cache()


def _save_disk_cache() -> None:
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("RAG_CACHE_READONLY"):
        return
    try:
        _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_EMBEDDING_CACHE, f)
    except Exception as exc:  # read-only FS on serverless hosts is fine
        logger.debug(f"Could not save embedding disk cache: {exc}")


def get_gemini_embedding(
    text: str,
    task_type: Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"] = "RETRIEVAL_DOCUMENT",
    use_mock: bool = False,
) -> list[float] | None:
    """
    768-d Matryoshka embedding from gemini-embedding-001, or None when the API is not
    configured/reachable. `use_mock=True` returns the deterministic test vector.
    """
    if use_mock:
        return _deterministic_mock_embedding(text)

    cache_key = f"{task_type}:{text.strip()[:2048]}"
    cached = _EMBEDDING_CACHE.get(cache_key)
    if cached:
        return l2_normalize(cached)

    vals = embed_text(text, task_type=task_type, output_dimensionality=EMBEDDING_DIMENSIONS)
    if vals is None:
        return None
    if task_type == "RETRIEVAL_QUERY":
        _EMBEDDING_CACHE[cache_key] = vals
        _save_disk_cache()
    return vals
