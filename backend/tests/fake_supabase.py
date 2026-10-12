"""
Minimal in-memory stand-in for the supabase-py query builder, so API tests run with
no network (CI uses a dummy SUPABASE_URL). Supports the subset the repositories use:
select / eq / ilike / gte / lte / order / limit / execute / insert / upsert.
"""

from __future__ import annotations

import fnmatch
from types import SimpleNamespace
from typing import Any


class _Query:
    def __init__(self, store: dict[str, list[dict[str, Any]]], table: str):
        self._store = store
        self._table = table
        self._filters: list = []
        self._order: tuple[str, bool] | None = None
        self._limit: int | None = None
        self._payload: Any = None
        self._op = "select"

    # builders -------------------------------------------------------------
    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def eq(self, col, val):
        self._filters.append(lambda r: str(r.get(col)) == str(val))
        return self

    def ilike(self, col, pattern):
        pat = str(pattern).lower().replace("%", "*").replace("_", "?")
        self._filters.append(lambda r: fnmatch.fnmatchcase(str(r.get(col, "")).lower(), pat))
        return self

    def gte(self, col, val):
        self._filters.append(lambda r: str(r.get(col)) >= str(val))
        return self

    def lte(self, col, val):
        self._filters.append(lambda r: str(r.get(col)) <= str(val))
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    upsert = insert

    # execution ------------------------------------------------------------
    def execute(self):
        rows = self._store.setdefault(self._table, [])
        if self._op == "insert":
            items = self._payload if isinstance(self._payload, list) else [self._payload]
            for it in items:
                it = dict(it)
                it.setdefault("id", len(rows) + 1)
                rows.append(it)
            return SimpleNamespace(data=items)
        out = [r for r in rows if all(f(r) for f in self._filters)]
        if self._order:
            col, desc = self._order
            out.sort(key=lambda r: str(r.get(col)), reverse=desc)
        if self._limit is not None:
            out = out[: self._limit]
        return SimpleNamespace(data=[dict(r) for r in out])


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, Any]]] | None = None):
        self.store = {k: list(v) for k, v in (tables or {}).items()}

    def table(self, name):
        return _Query(self.store, name)

    def rpc(self, *_a, **_k):
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=None))
