"""
Document ingestion job for RAG knowledge pipeline.
Extracts PDF text, segments into semantic chunks, generates 768-dim embeddings,
and stores in rag_documents and rag_chunks.
Architecture_Advisory.md §10.2.
"""

import argparse
import logging
from pathlib import Path
import re
import sys
from typing import Any, Literal
import pypdf

from app.data.advisory.rag_repo import get_rag_repo
from app.domain.advisory.embeddings import get_gemini_embedding
from app.schemas.rag import RagDocumentCreate

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SUPPORTED_CROPS = ["Wheat", "Tomato", "Cotton", "Soybean", "Rice", "Maize"]


def extract_text_per_page(pdf_path: str, max_pages: int | None = None) -> list[tuple[int, str]]:
    """Extracts text per page using pypdf."""
    p_path = Path(pdf_path)
    if not p_path.exists():
        raise FileNotFoundError(f"PDF not found at {pdf_path}")

    reader = pypdf.PdfReader(str(p_path))
    pages: list[tuple[int, str]] = []
    total = len(reader.pages)
    limit = min(total, max_pages) if max_pages else total

    for idx in range(limit):
        try:
            txt = reader.pages[idx].extract_text() or ""
            txt_clean = re.sub(r"\s+", " ", txt).strip()
            if len(txt_clean) > 80:  # skip blank or header-only pages
                pages.append((idx + 1, txt_clean))
        except Exception as e:
            logger.warning(f"Error reading page {idx + 1}: {e}")

    logger.info(f"Extracted text from {len(pages)} pages (out of {total}).")
    return pages


def chunk_text_semantically(
    text: str,
    page_num: int,
    target_chars: int = 1200,
    overlap_chars: int = 200,
) -> list[dict[str, Any]]:
    """
    Splits text by paragraph/sentence boundaries into ~250-350 token chunks.
    """
    # Split by common section delimiters or paragraphs
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current_chunk = ""

    min_split = min(150, max(50, target_chars // 3))
    for s in sentences:
        if len(current_chunk) + len(s) > target_chars and len(current_chunk) >= min_split:
            chunks.append({
                "text": current_chunk.strip(),
                "page": page_num,
            })
            # Overlap with end of current chunk
            overlap = current_chunk[-overlap_chars:] if len(current_chunk) > overlap_chars else ""
            current_chunk = overlap + " " + s
        else:
            current_chunk = current_chunk + " " + s if current_chunk else s

    if len(current_chunk.strip()) > 100:
        chunks.append({
            "text": current_chunk.strip(),
            "page": page_num,
        })

    return chunks


def detect_crop_in_text(text: str, default_crop: str | None = None) -> str | None:
    if default_crop:
        return default_crop
    for c in SUPPORTED_CROPS:
        if re.search(rf"\b{c}\b", text, re.IGNORECASE):
            return c
    return None


def detect_doc_type(text: str, default_type: str | None = None) -> str:
    if default_type:
        return default_type
    t_lower = text.lower()
    if any(k in t_lower for k in ["scheme", "pm-kisan", "pmfby", "kredit", "subsidy", "fund"]):
        return "govt_scheme"
    if any(k in t_lower for k in ["disease", "fungicide", "infestation", "blight", "bollworm", "pest"]):
        return "disease_treatment"
    return "agronomy_pop"


def ingest_document(
    pdf_path: str,
    title: str,
    doc_type: Literal["agronomy_pop", "disease_treatment", "govt_scheme"],
    crop: str | None = None,
    state: str | None = None,
    source_url: str = "https://icar.org.in",
    license_note: str = "Government Public Domain Agricultural Advisory",
    version_tag: str | None = "ICAR-2025",
    max_pages: int | None = 50,
    use_mock_embedding: bool = False,
) -> int:
    """
    Ingest a document into rag_documents and rag_chunks.
    Architecture_Advisory.md §10.2.
    """
    repo = get_rag_repo()

    doc_create = RagDocumentCreate(
        title=title,
        doc_type=doc_type,
        crop=crop,
        state=state,
        source_url=source_url,
        license_note=license_note,
        version_tag=version_tag,
    )
    doc_id = repo.create_document(doc_create)
    logger.info(f"Registered document id={doc_id}: {title}")

    # Extract pages
    pages = extract_text_per_page(pdf_path, max_pages=max_pages)
    all_chunks = []
    chunk_idx = 0

    for page_num, page_text in pages:
        page_chunks = chunk_text_semantically(page_text, page_num=page_num)
        for pc in page_chunks:
            c_text = pc["text"]
            detected_crop = detect_crop_in_text(c_text, default_crop=crop)
            detected_type = detect_doc_type(c_text, default_type=doc_type)

            emb = get_gemini_embedding(
                text=c_text,
                task_type="RETRIEVAL_DOCUMENT",
                use_mock=use_mock_embedding,
            )
            if emb is None:
                # Never store a placeholder vector: it would poison every future search.
                raise RuntimeError(
                    "Embedding unavailable (GEMINI_API_KEY missing or API error). "
                    "Re-run once the key works, or pass --mock-emb for an offline test build."
                )

            all_chunks.append({
                "document_id": doc_id,
                "crop": detected_crop,
                "doc_type": detected_type,
                "chunk_text": c_text,
                "chunk_index": chunk_idx,
                "page_number": page_num,
                "embedding": emb,
            })
            chunk_idx += 1

    # Batch insert chunks
    count = repo.add_chunks(all_chunks)
    logger.info(f"Successfully ingested {count} chunks for document id={doc_id}.")
    return count


def seed_core_schemes_and_advisories(use_mock_embedding: bool = False):
    """
    Seeds comprehensive agronomic guidelines, pest treatments, and government schemes.
    """
    repo = get_rag_repo()

    # Document 1: Government Schemes
    schemes_doc_id = repo.create_document(RagDocumentCreate(
        title="National Agricultural Welfare & Credit Schemes (PM-KISAN, PMFBY, KCC, SHC, AIF, PKVY)",
        doc_type="govt_scheme",
        crop=None,
        state=None,
        source_url="https://farmer.gov.in",
        license_note="Ministry of Agriculture & Farmers Welfare Public Domain",
        version_tag="Govt-Schemes-2025",
    ))

    scheme_texts = [
        (
            "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi): Provides direct income support of ₹6,000 per year "
            "to all eligible landholding farmer families across India. The financial benefit is transferred "
            "directly into bank accounts in three equal installments of ₹2,000 every four months through DBT. "
            "Eligibility requires verified Aadhaar-linked bank accounts and land ownership records.",
            1,
        ),
        (
            "PMFBY (Pradhan Mantri Fasal Bima Yojana): Offers comprehensive risk insurance cover for crop failure, "
            "post-harvest losses, localized calamities, and prevented sowing. Farmers pay nominal subsidized "
            "premium rates: 2.0% for Kharif foodgrain and oilseed crops, 1.5% for Rabi crops, and 5.0% for annual "
            "commercial/horticultural crops. The remainder premium is subsidized equally by Central and State Governments.",
            2,
        ),
        (
            "KCC (Kisan Credit Card): Provides accessible institutional short-term credit to farmers for crop production, "
            "harvesting expenses, farm asset maintenance, and post-harvest storage. Concessional interest rate is 7% per annum "
            "with an additional 3% Interest Subvention for prompt repayment, effectively reducing the net borrowing rate to 4% "
            "per annum for credit limits up to ₹3,00,000 without collateral.",
            3,
        ),
        (
            "Soil Health Card (SHC) Scheme: Provides farmers with customized crop-wise nutrient recommendations based on "
            "laboratory analysis of 12 soil health parameters (N, P, K, S, Zn, Fe, Cu, Mn, Bo, pH, EC, OC). Soil testing "
            "is conducted every 3 years to prevent fertilizer over-application and restore micro-nutrient balance.",
            4,
        ),
        (
            "AIF (Agriculture Infrastructure Fund): A medium-to-long term debt financing facility providing ₹1 Lakh Crore "
            "for post-harvest management infrastructure including cold chains, primary processing centers, modern silos, "
            "and e-marketing platforms. Loans carry an interest subvention of 3% per annum up to ₹2 Crores for a maximum of 7 years.",
            5,
        ),
        (
            "PKVY (Paramparagat Krishi Vikas Yojana): Financial support for traditional organic farming clusters. Farmers receive "
            "₹50,000 per hectare over 3 years, of which ₹31,000 is directly provided for organic inputs (bio-fertilizers, vermicompost, "
            "botanical extracts) and ₹8,800 for value addition, packaging, and PGS certification.",
            6,
        ),
    ]

    scheme_chunks = []
    for idx, (txt, pg) in enumerate(scheme_texts):
        emb = get_gemini_embedding(txt, task_type="RETRIEVAL_DOCUMENT", use_mock=use_mock_embedding)
        if emb is None:
            raise RuntimeError("Embedding unavailable; set GEMINI_API_KEY or pass --mock-emb.")
        scheme_chunks.append({
            "document_id": schemes_doc_id,
            "crop": None,
            "doc_type": "govt_scheme",
            "chunk_text": txt,
            "chunk_index": idx,
            "page_number": pg,
            "embedding": emb,
        })
    repo.add_chunks(scheme_chunks)
    logger.info("Successfully seeded National Agricultural Welfare Schemes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest PDF document into RAG knowledge store.")
    parser.add_argument("--pdf", type=str, default="docs/advisory/sources/ICAR En-Kharif Agro-Advisories for Farmers 2025.pdf", help="Path to PDF")
    parser.add_argument("--title", type=str, default="ICAR Kharif Agro-Advisories for Farmers 2025", help="Document title")
    parser.add_argument("--doc-type", type=str, default="agronomy_pop", choices=["agronomy_pop", "disease_treatment", "govt_scheme"])
    parser.add_argument("--crop", type=str, default=None, help="Target crop")
    parser.add_argument("--max-pages", type=int, default=40, help="Max pages to extract")
    parser.add_argument("--mock-emb", action="store_true", help="Use deterministic mock embedding")
    args = parser.parse_args()

    seed_core_schemes_and_advisories(use_mock_embedding=args.mock_emb)

    if Path(args.pdf).exists():
        ingest_document(
            pdf_path=args.pdf,
            title=args.title,
            doc_type=args.doc_type,
            crop=args.crop,
            max_pages=args.max_pages,
            use_mock_embedding=args.mock_emb,
        )
