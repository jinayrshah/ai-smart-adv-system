"""
Ingest Kisan Call Centre (KCC) farmer questions and expert answers into the advisor's
knowledge base, so answers can draw on what KCC experts told real farmers.

Source: "Kisan Call Centre (KCC) - Transcripts of farmers queries & answers" on
data.gov.in (Government Open Data License - India). Download a CSV (or a Parquet mirror)
and point this job at it:

    PYTHONPATH=backend python -m jobs.ingest_kcc --file kcc.csv --state Gujarat --per-crop 400

Only the app's crops are kept; empty, one-word and duplicate answers are dropped.
Column names are matched loosely (QueryText / KccAns / Crop / StateName / ...).
"""

from __future__ import annotations

import argparse
import logging
import re
import sys

import pandas as pd

from app.schemas.rag import RagDocumentCreate
from jobs.ingest_document import store_passages

logger = logging.getLogger("ingest_kcc")

CROPS = {"wheat": "Wheat", "paddy": "Rice", "rice": "Rice", "cotton": "Cotton", "soybean": "Soybean",
         "soyabean": "Soybean", "maize": "Maize", "tomato": "Tomato"}
COLS = {
    "question": ["querytext", "query_text", "question", "query"],
    "answer": ["kccans", "kcc_ans", "answer", "kccanswer", "ans"],
    "crop": ["crop", "cropname", "crop_name"],
    "state": ["statename", "state_name", "state"],
    "district": ["districtname", "district_name", "district"],
    "season": ["season"],
    "date": ["createdon", "created_on", "date"],
}


def _pick(df: pd.DataFrame, key: str) -> str | None:
    norm = {re.sub(r"[^a-z_]", "", c.lower()): c for c in df.columns}
    return next((norm[c] for c in COLS[key] if c in norm), None)


def _clean(s: object) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def kcc_passages(df: pd.DataFrame, state: str | None = None, per_crop: int = 400) -> list[dict]:
    q, a, c = _pick(df, "question"), _pick(df, "answer"), _pick(df, "crop")
    if not (q and a and c):
        raise ValueError(f"Need question, answer and crop columns; found {list(df.columns)}")
    st, di, se = _pick(df, "state"), _pick(df, "district"), _pick(df, "season")
    if state and st:
        df = df[df[st].astype(str).str.strip().str.lower() == state.lower()]
    df = df.assign(_crop=df[c].astype(str).str.strip().str.lower().map(CROPS)).dropna(subset=["_crop"])
    df = df.assign(_q=df[q].map(_clean), _a=df[a].map(_clean))
    df = df[(df._a.str.split().str.len() >= 4) & (df._q.str.len() >= 8)]
    df = df.drop_duplicates(subset=["_crop", "_q", "_a"])
    out = []
    for crop, g in df.groupby("_crop"):
        for _, r in g.head(per_crop).iterrows():
            where = ", ".join(x for x in [_clean(r[di]) if di else "", _clean(r[st]) if st else ""] if x)
            season = f" ({_clean(r[se])} season)" if se and _clean(r[se]) else ""
            out.append({"crop": crop, "page": None,
                        "text": f"Farmer question to Kisan Call Centre about {crop}{f' from {where}' if where else ''}{season}: {r._q} KCC expert answer: {r._a}"})
    return out


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="Ingest Kisan Call Centre Q&A into the RAG store.")
    ap.add_argument("--file", required=True, help="KCC CSV or Parquet file")
    ap.add_argument("--state", help="Keep one state only (e.g. Gujarat)")
    ap.add_argument("--per-crop", type=int, default=400, help="Max Q&A pairs per crop")
    a = ap.parse_args()
    df = pd.read_parquet(a.file) if a.file.endswith(".parquet") else pd.read_csv(a.file, low_memory=False)
    passages = kcc_passages(df, a.state, a.per_crop)
    if not passages:
        logger.warning("No usable Q&A pairs for the supported crops.")
        return 1
    by_crop: dict[str, list[dict]] = {}
    for p in passages:
        by_crop.setdefault(p["crop"], []).append(p)
    for crop, ps in by_crop.items():
        n = store_passages(RagDocumentCreate(
            title=f"Kisan Call Centre Q&A: {crop}{f' ({a.state})' if a.state else ''}",
            doc_type="kcc_qa", crop=crop, state=a.state,
            source_url="https://data.gov.in/resource/kisan-call-centre-kcc-transcripts-farmers-queries-answers",
            license_note="Government Open Data License - India",
        ), ps)
        logger.info(f"{crop}: stored {n} Q&A passages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
