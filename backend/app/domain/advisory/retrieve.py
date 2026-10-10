"""
RAG retrieval engine for query embedding and semantic search.
Architecture_Advisory.md §10.3, §17.4.
"""

import logging
from app.data.advisory.rag_repo import get_rag_repo
from app.domain.advisory.embeddings import get_gemini_embedding
from app.schemas.rag import RetrievedChunk

logger = logging.getLogger(__name__)


def retrieve(
    query: str,
    crop: str | None = None,
    stage_name: str | None = None,
    disease_label: str | None = None,
    doc_types: list[str] | None = None,
    top_k: int = 6,
    use_mock_embedding: bool = False,
) -> list[RetrievedChunk]:
    """
    Retrieves top-k relevant knowledge chunks for a query.
    Embeds query with gemini-embedding-001 (768 dims) and matches against rag_chunks.
    Architecture §10.3.
    """
    # 1. Synthesize grounded query text
    parts = []
    if crop:
        parts.append(crop)
    if stage_name:
        parts.append(stage_name)
    if disease_label:
        parts.append(disease_label)
    parts.append(query)
    query_text = " ".join(parts).strip()

    # 2. Determine targeted doc types
    if not doc_types:
        if disease_label:
            target_types = ["disease_treatment", "agronomy_pop"]
        else:
            target_types = ["agronomy_pop", "disease_treatment", "govt_scheme"]
    else:
        target_types = doc_types

    # 3. Generate query embedding
    query_embedding = get_gemini_embedding(
        text=query_text,
        task_type="RETRIEVAL_QUERY",
        use_mock=use_mock_embedding,
    )

    # 4. Execute vector match
    repo = get_rag_repo()
    chunks = repo.match_chunks(
        query_embedding=query_embedding,
        match_crop=crop,
        match_doc_types=target_types,
        match_count=top_k,
        query_text=query_text,
    )

    return chunks
