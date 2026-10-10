"""
Lexical (BM25) retrieval and Reciprocal Rank Fusion for hybrid RAG search.

Why: dense embeddings alone miss exact agronomy terms (product names, pest names,
scheme acronyms like "PMFBY", variety codes like "HD-2967"), and when the embedding
API is unavailable the old code compared a random hash vector against real vectors.
Hybrid search (BM25 + dense, fused with RRF, k=60 — Cormack, Clarke & Büttcher,
SIGIR 2009) is the standard fix and needs no score calibration between the two lists.

Everything here is pure Python and dependency-free so it runs offline and in tests.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Iterable

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:[-.][a-z0-9]+)*|[ऀ-ॿ઀-૿]+")

STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "by", "at", "from",
    "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these", "those",
    "as", "if", "then", "than", "so", "do", "does", "did", "can", "could", "should", "would",
    "will", "shall", "may", "might", "must", "i", "my", "me", "we", "our", "you", "your",
    "what", "which", "who", "whom", "when", "where", "why", "how", "much", "many", "about",
    "into", "per", "via", "any", "all", "some", "more", "most", "other", "such", "not", "no",
    "there", "their", "they", "them", "he", "she", "his", "her", "has", "have", "had",
    "today", "now", "please", "tell", "give", "need",
}


def tokenize(text: str) -> list[str]:
    tokens = _TOKEN_RE.findall((text or "").lower())
    out = []
    for t in tokens:
        if t in STOPWORDS or len(t) < 2:
            continue
        # light plural stemming keeps "diseases"~"disease", "pests"~"pest"
        if len(t) > 4 and t.endswith("es") and not t.endswith("ses"):
            t = t[:-2]
        elif len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        out.append(t)
    return out


class BM25Index:
    """Okapi BM25 over a fixed list of documents (k1=1.2, b=0.75)."""

    def __init__(self, documents: Iterable[str], k1: float = 1.2, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_tokens: list[list[str]] = [tokenize(d) for d in documents]
        self.doc_tf: list[Counter] = [Counter(t) for t in self.doc_tokens]
        self.doc_len = [len(t) for t in self.doc_tokens]
        self.n_docs = len(self.doc_tokens)
        self.avgdl = (sum(self.doc_len) / self.n_docs) if self.n_docs else 0.0
        df: Counter = Counter()
        for tf in self.doc_tf:
            df.update(tf.keys())
        self.df = df

    def idf(self, term: str) -> float:
        n = self.df.get(term, 0)
        # BM25+ style floor keeps idf positive for very common terms
        return math.log(1.0 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query: str, doc_idx: int) -> float:
        q_terms = tokenize(query)
        tf = self.doc_tf[doc_idx]
        dl = self.doc_len[doc_idx] or 1
        total = 0.0
        for term in set(q_terms):
            f = tf.get(term, 0)
            if not f:
                continue
            denom = f + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1.0))
            total += self.idf(term) * (f * (self.k1 + 1)) / denom
        return total

    def coverage(self, query: str, doc_idx: int) -> float:
        """
        IDF-weighted share of distinct query terms present in the document, in [0, 1].
        Used as the relevance score when no embedding is available — it is
        interpretable ("60% of the informative query words appear in this passage")
        and comparable to the cosine-similarity thresholds used for gating.
        """
        q_terms = set(tokenize(query))
        if not q_terms:
            return 0.0
        tf = self.doc_tf[doc_idx]
        total = sum(self.idf(t) for t in q_terms)
        if total <= 0:
            return 0.0
        hit = sum(self.idf(t) for t in q_terms if t in tf)
        return round(hit / total, 4)


def reciprocal_rank_fusion(rankings: list[list[int]], k: int = 60) -> dict[int, float]:
    """RRF: score(d) = Σ 1 / (k + rank_d) over every ranking that contains d (rank from 1)."""
    fused: dict[int, float] = {}
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            fused[doc] = fused.get(doc, 0.0) + 1.0 / (k + rank)
    return fused
