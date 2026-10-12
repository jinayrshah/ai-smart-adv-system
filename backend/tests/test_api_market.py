"""
Market API tests — fully offline. The repository is backed by an in-memory fake of the
Supabase query builder (tests/fake_supabase.py) injected with FastAPI dependency
overrides, so these run in CI with a dummy SUPABASE_URL.
"""

from collections import defaultdict
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.routes import market as market_routes
from app.core.timeutil import today_ist
from app.data.calculators.service import CalculatorService
from app.data.mandi.repository import MandiRepository
from app.data.reference.repository import ReferenceRepository
from app.main import app
from tests.fake_supabase import FakeSupabase

client = TestClient(app)


def _row(days_ago, market, modal, variety="Lokwan", source="datagov_live", flag="ok", district="Nashik"):
    d = (today_ist() - timedelta(days=days_ago)).isoformat()
    return {
        "state": "Maharashtra", "district": district, "market": market, "commodity": "Wheat",
        "variety": variety, "grade": "FAQ", "arrival_date": d,
        "min_price": modal - 100, "max_price": modal + 100, "modal_price": modal,
        "unit": "Rs/Quintal", "source": source, "source_priority": 100, "quality_flag": flag,
    }


def _daily_view(rows):
    """Replicates v_mandi_daily: groups by the *raw* market string, like the SQL view."""
    groups = defaultdict(list)
    for r in rows:
        if r["quality_flag"] != "ok":
            continue
        groups[(r["commodity"], r["state"], r["district"], r["market"], r["arrival_date"])].append(r)
    out = []
    for (c, s, dist, m, d), g in groups.items():
        modals = sorted(x["modal_price"] for x in g)
        n = len(modals)
        med = modals[n // 2] if n % 2 else (modals[n // 2 - 1] + modals[n // 2]) / 2
        out.append({
            "commodity": c, "state": s, "district": dist, "market": m, "arrival_date": d,
            "modal_price": med, "min_price": min(x["min_price"] for x in g),
            "max_price": max(x["max_price"] for x in g), "n_varieties": n,
        })
    return out


def _install(rows):
    fake = FakeSupabase({"mandi_prices": rows, "v_mandi_daily": _daily_view(rows)})
    repo = MandiRepository(client=fake)
    app.dependency_overrides[market_routes.get_repo] = lambda: repo
    app.dependency_overrides[market_routes.get_calculator_service] = lambda: CalculatorService(
        ref_repo=ReferenceRepository(client=fake), mandi_repo=repo
    )
    return fake


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


# A rich series (Pune: daily reports for 40 days) and the thin, duplicated pair from the
# QA screenshots (Malegaon reported twice, once under "APMC Malegaon").
RICH = [_row(i, "Pune", 2400 + (40 - i) * 5) for i in range(0, 40)]
THIN = [
    _row(3, "Malegaon", 2500),
    _row(3, "APMC Malegaon", 2500),
    _row(10, "APMC Malegaon", 2340),
]


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_latest_prices_endpoint():
    _install(RICH + [_row(0, "Pune", 9999, variety="Bad", flag="outlier")])
    resp = client.get("/api/market/prices/latest?limit=5&commodity=wheat&market=pune")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["count"] == 5
    assert all(r["quality_flag"] == "ok" for r in data["records"])
    assert data["records"][0]["arrival_date"] == today_ist().isoformat()
    assert "as_of" in data


def test_latest_prices_include_flagged():
    _install(RICH + [_row(0, "Pune", 9999, variety="Bad", flag="outlier")])
    resp = client.get("/api/market/prices/latest?limit=50&include_flagged=true&market=Pune")
    assert resp.status_code == 200
    flags = {r["quality_flag"] for r in resp.json()["records"]}
    assert "outlier" in flags


def test_market_trend_endpoint_structure():
    _install(RICH)
    resp = client.get("/api/market/trend?commodity=Wheat&market=Pune&state=Maharashtra&days=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data["commodity"] == "Wheat"
    assert data["coverage"]["expected_days"] == 30
    assert len(data["points"]) == 30
    assert data["coverage"]["days_with_data"] == 30
    assert data["reports_in_window"] == 30
    assert data["thin_data"] is False
    assert data["max_gap_days"] == 0
    assert data["varieties_included"] == ["Lokwan"]
    # 7-day change is against the report exactly 7 days before the latest
    latest = 2400 + 40 * 5
    base7 = 2400 + 33 * 5
    assert data["change_7d_pct"] == round((latest - base7) / base7 * 100, 1)
    assert data["change_30d_pct"] is not None
    assert data["change_7d_pct"] != data["change_30d_pct"]
    assert data["first_reported_date"] == (today_ist() - timedelta(days=39)).isoformat()


def test_trend_merges_alias_markets_and_is_honest_when_thin():
    _install(THIN)
    resp = client.get("/api/market/trend?commodity=Wheat&market=Malegaon&state=Maharashtra&days=30")
    assert resp.status_code == 200
    data = resp.json()
    # Day -3 exists under both spellings: one merged market-day, not two
    assert data["reports_in_window"] == 2
    assert data["thin_data"] is True
    assert data["change_7d_pct"] is None and data["change_30d_pct"] is None
    assert set(data["market_names_merged"]) == {"Malegaon", "APMC Malegaon"}
    # Gap is measured between the two reports only (days -9..-4 = 6 days)
    assert data["max_gap_days"] == 6


def test_search_dedupes_apmc_spellings():
    _install(THIN + [_row(2, "Shahada", 2450, district="Nandurbar"), _row(2, "APMC Shahada", 2450, district="Nandurbar")])
    resp = client.get("/api/market/search?commodity=Wheat&state=Maharashtra")
    assert resp.status_code == 200
    names = [m["market"] for m in resp.json()["markets"]]
    assert sorted(names) == ["Malegaon", "Shahada"]


def test_market_insight_endpoint():
    _install(RICH)
    resp = client.get("/api/market/insight?commodity=Wheat&market=Pune&state=Maharashtra&days=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["confidence"] in ["high", "medium", "low"]
    assert data["coverage_pct"] == 100
    assert len(data["insight"]) > 0
    assert "normal" not in data["insight"].lower()  # no invented weather/logistics claims


def test_market_insight_thin_data_says_so():
    _install(THIN)
    resp = client.get("/api/market/insight?commodity=Wheat&market=Malegaon&state=Maharashtra&days=30")
    data = resp.json()
    assert data["confidence"] == "low"
    assert any(needle in data["insight"].lower() for needle in ("only 2 report", "only two", "data is thin"))
    assert "%" not in data["insight"]
