"""
Ingest IMD district agromet advisory bulletins (Gramin Krishi Mausam Sewa) for every
district that has a registered farm, so the advisor can quote this week's official advice.

IMD/AMFUs publish them twice a week (Tuesday and Friday) as PDFs. Each run replaces the
district's previous bulletin. Usage:

    PYTHONPATH=backend python -m jobs.ingest_imd_agromet                 # districts of all farms
    PYTHONPATH=backend python -m jobs.ingest_imd_agromet --district Rajkot --state Gujarat
    PYTHONPATH=backend python -m jobs.ingest_imd_agromet --pdf bulletin.pdf --district Rajkot

The PDF URL pattern is configurable (IMD_AGROMET_PDF_URL, with {district}) because IMD
moves files between site versions; the default was taken from IMD's public site.
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import tempfile
from datetime import date, datetime

import httpx

from app.core.timeutil import today_ist
from app.data.advisory.rag_repo import get_rag_repo
from app.schemas.rag import RagDocumentCreate
from jobs.ingest_document import chunk_text_semantically, detect_crop_in_text, extract_text_per_page, store_passages

logger = logging.getLogger("ingest_imd_agromet")

DEFAULT_URL = "https://mausam.imd.gov.in/imd_latest/contents/agromet/agromet-data/district/current/english-pdf/{district}.pdf"
_DATE_RE = re.compile(r"(\d{1,2})[./-](\d{1,2})[./-](20\d{2})")


def bulletin_date(text: str) -> date:
    """First dd-mm-yyyy in the bulletin; today when none is printed."""
    for d, m, y in _DATE_RE.findall(text[:3000]):
        try:
            return date(int(y), int(m), int(d))
        except ValueError:
            continue
    return today_ist()


def bulletin_passages(pages: list[tuple[int, str]], district: str, issued: date) -> list[dict]:
    head = f"IMD agromet advisory for {district} district, issued {issued.isoformat()}."
    out = []
    for page_num, text in pages:
        for ch in chunk_text_semantically(text, page_num=page_num):
            t = ch["text"].strip()
            if len(t) < 40:
                continue
            out.append({"text": f"{head} {t}", "page": page_num, "crop": detect_crop_in_text(t)})
    return out


def download(district: str) -> str:
    url = (os.getenv("IMD_AGROMET_PDF_URL") or DEFAULT_URL).format(district=district.replace(" ", "_"))
    with httpx.Client(timeout=40.0, follow_redirects=True) as client:
        r = client.get(url)
    if r.status_code != 200 or not r.content.startswith(b"%PDF"):
        raise RuntimeError(f"No bulletin PDF at {url} (HTTP {r.status_code})")
    f = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    f.write(r.content)
    f.close()
    return f.name


def ingest_district(district: str, state: str | None = None, pdf_path: str | None = None) -> int:
    path = pdf_path or download(district)
    pages = extract_text_per_page(path, max_pages=12)
    full = " ".join(t for _, t in pages)
    if len(full.strip()) < 200:
        raise RuntimeError(f"Bulletin for {district} has no extractable text (scanned PDF?)")
    issued = bulletin_date(full)
    passages = bulletin_passages(pages, district, issued)
    repo = get_rag_repo()
    repo.delete_documents("agromet_advisory", district)
    doc = RagDocumentCreate(
        title=f"IMD Agromet Advisory, {district} ({issued.strftime('%d %b %Y')})",
        doc_type="agromet_advisory", state=state, district=district, published_on=issued,
        source_url=(os.getenv("IMD_AGROMET_PDF_URL") or DEFAULT_URL).format(district=district.replace(" ", "_")),
        license_note="India Meteorological Department / Gramin Krishi Mausam Sewa public bulletin",
        version_tag=issued.isoformat(),
    )
    return store_passages(doc, passages)


def farm_districts() -> list[tuple[str, str | None]]:
    from app.data.mandi.repository import get_supabase_client
    rows = get_supabase_client().table("farms").select("district,state").execute().data or []
    seen = {}
    for r in rows:
        if r.get("district"):
            seen[r["district"].strip().title()] = r.get("state")
    return sorted(seen.items())


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--district")
    ap.add_argument("--state")
    ap.add_argument("--pdf", help="Use a local bulletin PDF instead of downloading")
    a = ap.parse_args()
    targets = [(a.district, a.state)] if a.district else farm_districts()
    if not targets:
        logger.warning("No farm districts found; nothing to ingest.")
        return 0
    failed = 0
    for district, state in targets:
        try:
            n = ingest_district(district, state, a.pdf if a.district else None)
            logger.info(f"{district}: stored {n} passages")
        except Exception as exc:
            failed += 1
            logger.error(f"{district}: {exc}")
    logger.info(f"Done at {datetime.now().isoformat(timespec='seconds')}: {len(targets) - failed} ok, {failed} failed")
    return 1 if failed == len(targets) else 0


if __name__ == "__main__":
    sys.exit(main())
