"""
Schemas for RAG Knowledge Pipeline (Documents, Chunks & Retrieval).
Architecture_Advisory.md §10.
"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class RagDocumentCreate(BaseModel):
    title: str
    doc_type: Literal["agronomy_pop", "disease_treatment", "govt_scheme"]
    crop: str | None = None
    state: str | None = None
    source_url: str
    license_note: str
    version_tag: str | None = None


class RagDocument(RagDocumentCreate):
    id: int
    ingested_at: datetime


class RagChunk(BaseModel):
    id: int | None = None
    document_id: int
    crop: str | None = None
    doc_type: str
    chunk_text: str
    chunk_index: int
    page_number: int | None = None


class RetrievedChunk(BaseModel):
    chunk_text: str
    document_id: int | None = None
    page_number: int | None = None
    similarity: float
    crop: str | None = None
    doc_type: str | None = None
    source_title: str | None = None
    source_url: str | None = None
    # Hybrid retrieval diagnostics: how this chunk was found and its BM25 coverage.
    lexical_score: float | None = None
    retrieval_method: Literal["vector", "lexical", "hybrid"] = "vector"


class RetrievalRequest(BaseModel):
    query: str
    crop: str | None = None
    stage_name: str | None = None
    disease_label: str | None = None
    doc_types: list[str] | None = None
    top_k: int = 6
