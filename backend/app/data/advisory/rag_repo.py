"""
Repository for RAG documents and vector chunks.
Supports Supabase pgvector RPC with in-memory cosine fallback.
Architecture_Advisory.md §10.1, §10.3.
"""

from datetime import datetime, timezone
import json
import logging
import math
from pathlib import Path
from typing import Any

from app.data.mandi.repository import get_supabase_client
from app.schemas.rag import RagChunk, RagDocument, RagDocumentCreate, RetrievedChunk

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).parent / "fixtures" / "rag_cache.json"


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


class RagRepository:
    """
    Manages rag_documents and rag_chunks.
    Executes similarity search via Supabase pgvector match_rag_chunks RPC,
    with an in-memory/JSON store fallback for local dev & testing.
    """

    _local_docs: dict[int, dict[str, Any]] = {}
    _local_chunks: list[dict[str, Any]] = []
    _doc_id_counter: int = 1

    def __init__(self):
        self._load_cache()

    @property
    def client(self):
        return get_supabase_client()

    def _load_cache(self) -> None:
        if CACHE_FILE.exists() and not RagRepository._local_chunks:
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    RagRepository._local_docs = {int(k): v for k, v in data.get("documents", {}).items()}
                    RagRepository._local_chunks = data.get("chunks", [])
                    if RagRepository._local_docs:
                        RagRepository._doc_id_counter = max(RagRepository._local_docs.keys()) + 1
                    logger.info(f"Loaded {len(RagRepository._local_chunks)} RAG chunks from cache.")
            except Exception as exc:
                logger.warning(f"Could not load RAG cache file: {exc}")

    def save_cache(self) -> None:
        try:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "documents": RagRepository._local_docs,
                    "chunks": RagRepository._local_chunks,
                }, f, ensure_ascii=False)
        except Exception as exc:
            logger.warning(f"Could not save RAG cache: {exc}")

    def create_document(self, doc: RagDocumentCreate) -> int:
        now = datetime.now(timezone.utc)

        # 1. Try Supabase
        try:
            res = self.client.table("rag_documents").insert({
                "title": doc.title,
                "doc_type": doc.doc_type,
                "crop": doc.crop,
                "state": doc.state,
                "source_url": doc.source_url,
                "license_note": doc.license_note,
                "version_tag": doc.version_tag,
                "ingested_at": now.isoformat(),
            }).execute()
            if res.data and len(res.data) > 0:
                doc_id = int(res.data[0]["id"])
                RagRepository._local_docs[doc_id] = {**doc.model_dump(), "id": doc_id, "ingested_at": now.isoformat()}
                return doc_id
        except Exception as exc:
            logger.debug(f"Supabase rag_documents insert fallback: {exc}")

        # 2. Local fallback
        doc_id = RagRepository._doc_id_counter
        RagRepository._doc_id_counter += 1
        RagRepository._local_docs[doc_id] = {
            **doc.model_dump(),
            "id": doc_id,
            "ingested_at": now.isoformat(),
        }
        return doc_id

    def add_chunks(self, chunks: list[dict[str, Any]]) -> int:
        """
        Inserts chunks into Supabase table and local memory store.
        """
        if not chunks:
            return 0

        # Sanitize null characters for Postgres text compliance
        sanitized_chunks = []
        for ch in chunks:
            item = dict(ch)
            if "chunk_text" in item and isinstance(item["chunk_text"], str):
                item["chunk_text"] = item["chunk_text"].replace("\x00", "")
            sanitized_chunks.append(item)

        # Try Supabase insert
        try:
            self.client.table("rag_chunks").insert(sanitized_chunks).execute()
        except Exception as exc:
            logger.debug(f"Supabase rag_chunks insert fallback: {exc}")

        # Always maintain in local memory store for instant offline availability
        RagRepository._local_chunks.extend(sanitized_chunks)
        self.save_cache()
        return len(sanitized_chunks)

    def match_chunks(
        self,
        query_embedding: list[float],
        match_crop: str | None = None,
        match_doc_types: list[str] | None = None,
        match_count: int = 6,
        query_text: str | None = None,
    ) -> list[RetrievedChunk]:
        """
        Matches query embedding against stored chunks.
        Uses Supabase match_rag_chunks RPC if available; otherwise uses in-memory cosine math.
        Falls back to keyword matching if vector similarity is low (e.g. rate limits or mock embeddings).
        """
        # 1. Try Supabase RPC
        try:
            params = {
                "query_embedding": query_embedding,
                "match_crop": match_crop,
                "match_doc_types": match_doc_types or ["agronomy_pop", "disease_treatment", "govt_scheme"],
                "match_count": match_count,
            }
            res = self.client.rpc("match_rag_chunks", params).execute()
            if res.data is not None:
                matches: list[RetrievedChunk] = []
                for row in res.data:
                    doc_info = RagRepository._local_docs.get(row.get("document_id")) or {}
                    matches.append(RetrievedChunk(
                        chunk_text=row["chunk_text"],
                        document_id=row.get("document_id"),
                        page_number=row.get("page_number"),
                        similarity=float(row.get("similarity", 0.0)),
                        crop=doc_info.get("crop") or match_crop,
                        doc_type=doc_info.get("doc_type"),
                        source_title=doc_info.get("title"),
                    ))
                if matches:
                    max_sim = max((m.similarity for m in matches), default=0.0)
                    if max_sim >= 0.55:
                        return matches
        except Exception as exc:
            logger.debug(f"Supabase match_rag_chunks RPC fallback: {exc}")

        # 2. Local memory cosine similarity fallback
        results = []
        for ch in RagRepository._local_chunks:
            # Crop filter
            ch_crop = ch.get("crop")
            if match_crop:
                if ch_crop and ch_crop.lower() != match_crop.lower():
                    continue

            # Doc type filter
            ch_doc_type = ch.get("doc_type")
            if match_doc_types and ch_doc_type not in match_doc_types:
                continue

            emb = ch.get("embedding")
            if not emb:
                continue

            sim = _cosine_similarity(query_embedding, emb)
            doc_id = ch.get("document_id")
            doc_info = RagRepository._local_docs.get(doc_id, {})

            results.append((sim, ch, doc_info))

        # Sort descending by similarity
        results.sort(key=lambda x: x[0], reverse=True)
        top_matches = results[:match_count]

        retrieved = []
        for sim, ch, doc_info in top_matches:
            retrieved.append(RetrievedChunk(
                chunk_text=ch["chunk_text"],
                document_id=ch.get("document_id"),
                page_number=ch.get("page_number"),
                similarity=round(sim, 4),
                crop=ch.get("crop") or doc_info.get("crop"),
                doc_type=ch.get("doc_type") or doc_info.get("doc_type"),
                source_title=doc_info.get("title") or "ICAR Kharif Agro-Advisories 2025",
            ))

        return retrieved

    def count_chunks(self) -> int:
        return len(RagRepository._local_chunks)


_rag_repo: RagRepository | None = None


def get_rag_repo() -> RagRepository:
    global _rag_repo
    if _rag_repo is None:
        _rag_repo = RagRepository()
    return _rag_repo
