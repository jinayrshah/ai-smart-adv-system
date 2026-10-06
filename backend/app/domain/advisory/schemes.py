"""
Government Schemes Domain Service & Answering Engine.
Architecture_Advisory.md §16.

Provides static curated metadata for the 6 national agricultural schemes,
semantic search via RAG (doc_type='govt_scheme'), and grounded Q&A answering.
"""

import logging
from typing import Any
import httpx

from app.core.config import get_settings
from app.domain.advisory.retrieve import retrieve
from app.domain.advisory.translation import translate_from_english
from app.schemas.advisory import AdvisorySource, GovernmentScheme, SchemeAskResponse

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

NATIONAL_SCHEMES: list[dict[str, Any]] = [
    {
        "code": "PM-KISAN",
        "name": "Pradhan Mantri Kisan Samman Nidhi",
        "category": "income_support",
        "benefit_summary": "₹6,000 per year direct income support transferred in 3 equal installments of ₹2,000 every 4 months via DBT.",
        "eligibility": "All landholding farmer families with cultivable land in their names. Requires Aadhaar-linked active bank account and eKYC completion.",
        "application_process": "Register online at pmkisan.gov.in, via PM-KISAN mobile app, or through local Common Service Centers (CSC).",
        "official_portal": "https://pmkisan.gov.in",
    },
    {
        "code": "PMFBY",
        "name": "Pradhan Mantri Fasal Bima Yojana",
        "category": "crop_insurance",
        "benefit_summary": "Comprehensive yield & crop loss insurance cover. Farmers pay fixed subsidized premium: 2.0% for Kharif crops, 1.5% for Rabi crops, and 5.0% for commercial/horticultural crops.",
        "eligibility": "All farmers growing notified crops in notified areas including sharecroppers and tenant farmers.",
        "application_process": "Enroll through commercial banks, PACS, CSC centers, or directly on pmfby.gov.in before the seasonal cut-off date.",
        "official_portal": "https://pmfby.gov.in",
    },
    {
        "code": "KCC",
        "name": "Kisan Credit Card Scheme",
        "category": "credit_finance",
        "benefit_summary": "Short-term production credit up to ₹3,00,000 with collateral-free limit up to ₹1,60,000. Base interest rate is 7% with 3% prompt repayment subvention, resulting in 4% effective annual borrowing rate.",
        "eligibility": "All individual and joint borrowers who are owner cultivators, tenant farmers, oral lessees, or self-help groups (SHGs).",
        "application_process": "Apply at any rural, public, or private commercial bank branch, or online via bank portals and myscheme.gov.in.",
        "official_portal": "https://myscheme.gov.in",
    },
    {
        "code": "SHC",
        "name": "Soil Health Card Scheme",
        "category": "soil_health",
        "benefit_summary": "Free comprehensive laboratory testing of 12 soil parameters (N, P, K, S, Zn, Fe, Cu, Mn, Bo, pH, EC, OC) with crop-specific dosage recommendations issued every 3 years.",
        "eligibility": "All agricultural landowners across all States and Union Territories in India.",
        "application_process": "Soil samples are collected by state agriculture department field staff, or farmers can submit samples directly to nearest Soil Testing Labs (STL).",
        "official_portal": "https://soilhealth.dac.gov.in",
    },
    {
        "code": "AIF",
        "name": "Agriculture Infrastructure Fund",
        "category": "infrastructure",
        "benefit_summary": "Medium-to-long term debt financing facility providing ₹1 Lakh Crore with 3% per annum interest subvention up to ₹2 Crores for up to 7 years, plus CGTMSE credit guarantee coverage.",
        "eligibility": "Primary Agricultural Credit Societies (PACS), Marketing Cooperative Societies, Farmer Producers Organizations (FPOs), SHGs, and Agri-entrepreneurs.",
        "application_process": "Submit project proposal directly on the national AIF online portal at agriinfra.dac.gov.in.",
        "official_portal": "https://agriinfra.dac.gov.in",
    },
    {
        "code": "PKVY",
        "name": "Paramparagat Krishi Vikas Yojana",
        "category": "organic_farming",
        "benefit_summary": "Financial support of ₹50,000 per hectare over 3 years for organic farming clusters (minimum 20 hectares). Includes ₹31,000 for on-farm organic inputs and bio-fertilizers, plus free PGS-India certification.",
        "eligibility": "Farmer groups and clusters practicing or converting to traditional chemical-free organic farming.",
        "application_process": "Form a cluster of 20 or more farmers and register through the District Agriculture Officer or Regional Councils under PGS-India.",
        "official_portal": "https://pgsindia-ncof.gov.in",
    },
]


def get_all_schemes(query: str | None = None, category: str | None = None) -> list[GovernmentScheme]:
    """Return all national schemes with optional text filtering and category filter."""
    res = [GovernmentScheme(**s) for s in NATIONAL_SCHEMES]
    if category:
        res = [s for s in res if s.category == category]
    if query:
        terms = [t.lower() for t in query.split() if len(t) > 2]
        if not terms:
            terms = [query.lower()]
        res = [
            s for s in res
            if any(
                t in s.code.lower()
                or t in s.name.lower()
                or t in s.benefit_summary.lower()
                or t in s.eligibility.lower()
                for t in terms
            )
        ]
    return res


def get_scheme_by_code(code: str) -> GovernmentScheme | None:
    """Retrieve specific scheme by code (e.g. PM-KISAN, KCC)."""
    for s in NATIONAL_SCHEMES:
        if s["code"].lower() == code.lower():
            return GovernmentScheme(**s)
    return None


def answer_scheme_query(
    query: str,
    scheme_code: str | None = None,
    language: str = "en",
    use_mock: bool = False,
) -> SchemeAskResponse:
    """
    RAG-grounded answering for national agricultural government schemes.
    Architecture §16.
    """
    # 1. Retrieve RAG chunks matching govt_scheme
    retrieved = retrieve(
        query=query,
        crop=None,
        doc_types=["govt_scheme"],
        top_k=4,
    )

    max_sim = max((c.similarity for c in retrieved), default=0.0)

    # 2. Check confidence & safety threshold
    if not retrieved or max_sim < 0.55:
        refusal_en = (
            "I do not have verified official information on this specific scheme query. "
            "To review official guidelines and welfare benefits, please visit the Government of India Farmers' Portal "
            "(https://farmer.gov.in) or consult your nearest Krishi Vigyan Kendra (KVK)."
        )
        final_answer = translate_from_english(refusal_en, language)
        return SchemeAskResponse(
            query=query,
            answer=final_answer,
            confidence="insufficient",
            schemes=[],
            sources=[],
        )

    confidence = "grounded" if max_sim >= 0.65 else "partial"

    # 3. Identify matching schemes from static catalog
    matched_schemes = []
    for s in NATIONAL_SCHEMES:
        if (
            (scheme_code and s["code"].lower() == scheme_code.lower())
            or s["code"].lower() in query.lower()
            or s["name"].lower() in query.lower()
        ):
            matched_schemes.append(GovernmentScheme(**s))

    if not matched_schemes and retrieved:
        # Match based on retrieved text mention
        first_txt = retrieved[0].chunk_text.upper()
        for s in NATIONAL_SCHEMES:
            if s["code"] in first_txt:
                matched_schemes.append(GovernmentScheme(**s))

    # 4. Generate grounded answer
    sources = []
    seen = set()
    for c in retrieved:
        title = c.source_title or "Government of India Agricultural Welfare Guidelines"
        key = (title, c.page_number)
        if key not in seen:
            seen.add(key)
            sources.append(AdvisorySource(title=title, page=c.page_number, url=None))

    passages = "\n\n".join(f"[{c.source_title or 'Ministry of Agriculture', c.page_number}]: {c.chunk_text}" for c in retrieved)

    prompt = f"""SYSTEM:
You are an expert government welfare advisor assisting Indian farmers.
Answer the question ONLY using the verified government scheme information below.
State precise financial figures (₹, %, terms), eligibility requirements, and application procedures.
Do not invent benefits or criteria not in the passages.
Cite the source in a short "Source:" line.
Respond in {language if language != 'en' else 'English'}.

VERIFIED SCHEME PASSAGES:
{passages}

FARMER'S QUESTION: {query}
"""

    answer_text = ""
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY

    if not use_mock and api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 450},
        }
        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            answer_text = parts[0].get("text", "").strip()
        except Exception as exc:
            logger.warning(f"Scheme Q&A Gemini API failed: {exc}")

    if not answer_text:
        # Deterministic grounded synthesis
        top_chunk = retrieved[0]
        answer_text = (
            f"{top_chunk.chunk_text} "
            f"(Source: [{top_chunk.source_title or 'Ministry of Agriculture Guidelines'}, p.{top_chunk.page_number or 1}])."
        )

    if language != "en":
        answer_text = translate_from_english(answer_text, language)

    return SchemeAskResponse(
        query=query,
        answer=answer_text,
        confidence=confidence,
        schemes=matched_schemes,
        sources=sources,
    )
