"""
Repository for RAG documents and vector chunks.
Supports Supabase pgvector RPC with in-memory cosine fallback.
Architecture_Advisory.md §10.1, §10.3.
"""

from datetime import datetime, timezone
import json
import logging
import math
import os
from pathlib import Path
from typing import Any

from app.data.mandi.repository import get_supabase_client
from app.domain.advisory.lexical import BM25Index, reciprocal_rank_fusion
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
        # Unit tests add throw-away chunks; never let them rewrite the committed fixture.
        if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("RAG_CACHE_READONLY"):
            return
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

        # Sanitize null characters for Postgres text compliance and skip passages that are
        # already stored for the same document (re-running ingestion or tests used to
        # append duplicates that then crowded out every other search result).
        existing = {
            (c.get("document_id"), (c.get("chunk_text") or "").strip())
            for c in RagRepository._local_chunks
        }
        sanitized_chunks = []
        for ch in chunks:
            item = dict(ch)
            if "chunk_text" in item and isinstance(item["chunk_text"], str):
                item["chunk_text"] = item["chunk_text"].replace("\x00", "")
            k = (item.get("document_id"), (item.get("chunk_text") or "").strip())
            if k in existing:
                continue
            existing.add(k)
            sanitized_chunks.append(item)
        if not sanitized_chunks:
            return 0

        # Try Supabase insert
        try:
            self.client.table("rag_chunks").insert(sanitized_chunks).execute()
        except Exception as exc:
            logger.debug(f"Supabase rag_chunks insert fallback: {exc}")

        # Always maintain in local memory store for instant offline availability
        RagRepository._local_chunks.extend(sanitized_chunks)
        self.save_cache()
        return len(sanitized_chunks)

    # ------------------------------------------------------------------ retrieval

    def _document_meta(self, doc_ids: list[int]) -> dict[int, dict[str, Any]]:
        """
        Title / type / URL for cited documents. The pgvector RPC only returns chunk rows,
        so without this lookup every Supabase hit was cited under a generic default
        title instead of its real source.
        """
        meta: dict[int, dict[str, Any]] = {}
        missing = []
        for d in doc_ids:
            if d in RagRepository._local_docs:
                meta[d] = RagRepository._local_docs[d]
            else:
                missing.append(d)
        if missing:
            try:
                res = (
                    self.client.table("rag_documents")
                    .select("id,title,doc_type,crop,source_url")
                    .in_("id", missing)
                    .execute()
                )
                for row in res.data or []:
                    meta[int(row["id"])] = row
                    RagRepository._local_docs.setdefault(int(row["id"]), row)
            except Exception as exc:
                logger.debug(f"rag_documents title lookup failed: {exc}")
        return meta

    def _match_supabase(
        self,
        query_embedding: list[float] | None,
        match_crop: str | None,
        doc_types: list[str],
        match_count: int,
        query_text: str | None,
    ) -> list[RetrievedChunk] | None:
        """Hybrid search against Supabase (pgvector RPC + optional Postgres FTS RPC)."""
        candidates = max(match_count * 4, 20)
        vec_rows: list[dict[str, Any]] = []
        lex_rows: list[dict[str, Any]] = []
        if query_embedding is not None:
            res = self.client.rpc("match_rag_chunks", {
                "query_embedding": query_embedding,
                "match_crop": match_crop,
                "match_doc_types": doc_types,
                "match_count": candidates,
            }).execute()
            vec_rows = res.data or []
        if query_text:
            try:
                res = self.client.rpc("search_rag_chunks_fts", {
                    "query_text": query_text,
                    "match_crop": match_crop,
                    "match_doc_types": doc_types,
                    "match_count": candidates,
                }).execute()
                lex_rows = res.data or []
            except Exception as exc:  # function not migrated yet → vector only
                logger.debug(f"search_rag_chunks_fts unavailable: {exc}")
        if not vec_rows and not lex_rows:
            return None

        def key(row: dict[str, Any]) -> tuple:
            return (row.get("document_id"), row.get("page_number"), (row.get("chunk_text") or "")[:80])

        rows: dict[tuple, dict[str, Any]] = {}
        vec_rank, lex_rank = [], []
        for row in vec_rows:
            k = key(row)
            rows.setdefault(k, dict(row))["similarity"] = float(row.get("similarity", 0.0))
            vec_rank.append(k)
        for row in lex_rows:
            k = key(row)
            rows.setdefault(k, dict(row))
            lex_rank.append(k)

        # lexical coverage is computed locally on the returned text so it is on the same
        # 0..1 scale whichever backend produced the row
        texts = [r.get("chunk_text") or "" for r in rows.values()]
        index = BM25Index(texts)
        keys = list(rows.keys())
        for i, k in enumerate(keys):
            rows[k]["lexical_score"] = index.coverage(query_text or "", i) if query_text else None

        id_of = {k: i for i, k in enumerate(keys)}
        fused = reciprocal_rank_fusion(
            [[id_of[k] for k in vec_rank], [id_of[k] for k in lex_rank]]
        )
        order = sorted(fused, key=lambda i: fused[i], reverse=True)[:match_count]
        method = "hybrid" if vec_rows and lex_rows else ("vector" if vec_rows else "lexical")
        meta = self._document_meta([int(rows[keys[i]]["document_id"]) for i in order if rows[keys[i]].get("document_id") is not None])

        out: list[RetrievedChunk] = []
        for i in order:
            row = rows[keys[i]]
            doc = meta.get(int(row["document_id"])) if row.get("document_id") is not None else None
            sim = row.get("similarity")
            if sim is None:  # found only lexically
                sim = row.get("lexical_score") or 0.0
            out.append(RetrievedChunk(
                chunk_text=row["chunk_text"],
                document_id=row.get("document_id"),
                page_number=row.get("page_number"),
                similarity=round(float(sim), 4),
                crop=(doc or {}).get("crop") or row.get("crop") or match_crop,
                doc_type=(doc or {}).get("doc_type") or row.get("doc_type"),
                source_title=(doc or {}).get("title"),
                source_url=(doc or {}).get("source_url"),
                lexical_score=row.get("lexical_score"),
                retrieval_method=method,
            ))
        return out

    def match_chunks(
        self,
        query_embedding: list[float] | None,
        match_crop: str | None = None,
        match_doc_types: list[str] | None = None,
        match_count: int = 6,
        query_text: str | None = None,
    ) -> list[RetrievedChunk]:
        """
        Hybrid retrieval (dense cosine + BM25, fused with Reciprocal Rank Fusion).

        `similarity` keeps its old meaning (cosine similarity) whenever an embedding
        was available, so the §17 confidence thresholds still apply. When the
        embedding API is unavailable (`query_embedding is None`) retrieval is purely
        lexical and `similarity` is the IDF-weighted query-term coverage (0..1).
        """
        doc_types = match_doc_types or ["agronomy_pop", "disease_treatment", "govt_scheme"]

        # 1. Supabase (pgvector + FTS)
        try:
            remote = self._match_supabase(query_embedding, match_crop, doc_types, match_count, query_text)
            if remote:
                return remote
        except Exception as exc:
            logger.debug(f"Supabase retrieval fallback to local store: {exc}")

        # 2. Local store (offline dev, tests, or Supabase unreachable)
        candidates: list[tuple[dict[str, Any], dict[str, Any]]] = []
        seen_text: set[str] = set()
        for ch in RagRepository._local_chunks:
            text_key = (ch.get("chunk_text") or "").strip()
            if not text_key or text_key in seen_text:
                continue  # identical passages would otherwise fill every top-k slot
            seen_text.add(text_key)
            ch_crop = ch.get("crop")
            if match_crop and ch_crop and ch_crop.lower() != match_crop.lower():
                continue
            if doc_types and ch.get("doc_type") not in doc_types:
                continue
            doc_info = RagRepository._local_docs.get(ch.get("document_id"), {})
            candidates.append((ch, doc_info))
        if not candidates:
            return []

        index = BM25Index([c["chunk_text"] for c, _ in candidates]) if query_text else None
        lexical_scores: list[float] = []
        coverage: list[float] = []
        if index is not None:
            lexical_scores = [index.score(query_text, i) for i in range(len(candidates))]
            coverage = [index.coverage(query_text, i) for i in range(len(candidates))]

        cosine: list[float | None] = [None] * len(candidates)
        if query_embedding is not None:
            for i, (ch, _) in enumerate(candidates):
                emb = ch.get("embedding")
                if emb:
                    cosine[i] = _cosine_similarity(query_embedding, emb)

        rankings: list[list[int]] = []
        vec_rank = sorted((i for i in range(len(candidates)) if cosine[i] is not None), key=lambda i: cosine[i], reverse=True)
        if vec_rank:
            rankings.append(vec_rank)
        lex_rank = sorted((i for i in range(len(candidates)) if lexical_scores and lexical_scores[i] > 0), key=lambda i: lexical_scores[i], reverse=True)
        if lex_rank:
            rankings.append(lex_rank)
        if not rankings:
            return []

        method = "hybrid" if (vec_rank and lex_rank) else ("vector" if vec_rank else "lexical")
        fused = reciprocal_rank_fusion(rankings)
        order = sorted(fused, key=lambda i: fused[i], reverse=True)[:match_count]

        retrieved = []
        for i in order:
            ch, doc_info = candidates[i]
            sim = cosine[i] if cosine[i] is not None else (coverage[i] if coverage else 0.0)
            retrieved.append(RetrievedChunk(
                chunk_text=ch["chunk_text"],
                document_id=ch.get("document_id"),
                page_number=ch.get("page_number"),
                similarity=round(float(sim), 4),
                crop=ch.get("crop") or doc_info.get("crop"),
                doc_type=ch.get("doc_type") or doc_info.get("doc_type"),
                source_title=doc_info.get("title"),
                source_url=doc_info.get("source_url"),
                lexical_score=coverage[i] if coverage else None,
                retrieval_method=method,
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
