from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.core.timeutil import now_utc_iso
from app.data.ops.service import OpsService
from app.main import app

client = TestClient(app)


def test_health_data_endpoint_structure():
    """Verify /api/health/data returns expected schema per Architecture §10.3."""
    resp = client.get("/api/health/data")
    assert resp.status_code == 200
    data = resp.json()

    assert "status" in data
    assert data["status"] in ("ok", "degraded")
    assert "as_of" in data
    assert "jobs" in data
    assert "database" in data
    assert "warnings" in data

    # Verify all expected jobs are tracked
    for expected_job in ("ingest_mandi_daily", "ingest_weather", "reconcile_recent", "power_validate", "prune"):
        assert expected_job in data["jobs"]
        job_info = data["jobs"][expected_job]
        assert "job" in job_info
        assert "status" in job_info
        assert "threshold_hours" in job_info

    # Verify database telemetry
    db = data["database"]
    assert "estimated_size_mb" in db
    assert db["max_budget_mb"] == 400.0
    assert db["db_cap_mb"] == 500.0
    assert isinstance(db["alert"], bool)


def test_health_flips_to_degraded_when_job_artificially_stale():
    """
    Phase 5 Acceptance Criterion:
    Health endpoint flips to degraded when a job is artificially stale.
    """
    service = OpsService()
    now = datetime.now(timezone.utc)

    # 1. Artificially stale run: ingest_mandi_daily last ran 48h ago (threshold is 36h)
    stale_started_at = (now - timedelta(hours=48)).isoformat()
    overrides = {
        "ingest_mandi_daily": {
            "job": "ingest_mandi_daily",
            "started_at": stale_started_at,
            "finished_at": stale_started_at,
            "status": "ok",
            "rows_upserted": 100,
        },
        "ingest_weather": {
            "job": "ingest_weather",
            "started_at": (now - timedelta(hours=2)).isoformat(),
            "finished_at": (now - timedelta(hours=2)).isoformat(),
            "status": "ok",
            "rows_upserted": 20,
        },
        "reconcile_recent": {
            "job": "reconcile_recent",
            "started_at": (now - timedelta(hours=5)).isoformat(),
            "finished_at": (now - timedelta(hours=5)).isoformat(),
            "status": "ok",
            "rows_upserted": 10,
        },
        "power_validate": {
            "job": "power_validate",
            "started_at": (now - timedelta(hours=6)).isoformat(),
            "finished_at": (now - timedelta(hours=6)).isoformat(),
            "status": "ok",
            "rows_upserted": 5,
        },
        "prune": {
            "job": "prune",
            "started_at": (now - timedelta(hours=24)).isoformat(),
            "finished_at": (now - timedelta(hours=24)).isoformat(),
            "status": "ok",
            "rows_upserted": 0,
        },
    }

    health = service.evaluate_health(artificial_job_overrides=overrides)
    assert health.status == "degraded"
    assert health.jobs["ingest_mandi_daily"].status == "stale"
    assert health.jobs["ingest_mandi_daily"].age_hours >= 47.0
    assert any("ingest_mandi_daily" in w and "stale" in w for w in health.warnings)


def test_health_ok_when_all_jobs_fresh():
    """Verify health evaluates to 'ok' when all jobs are within threshold and DB < 400 MB."""
    service = OpsService()
    now = datetime.now(timezone.utc)

    fresh_overrides = {
        "ingest_mandi_daily": {
            "job": "ingest_mandi_daily",
            "started_at": (now - timedelta(hours=2)).isoformat(),
            "finished_at": (now - timedelta(hours=2)).isoformat(),
            "status": "ok",
            "rows_upserted": 250,
        },
        "ingest_weather": {
            "job": "ingest_weather",
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "finished_at": (now - timedelta(hours=1)).isoformat(),
            "status": "ok",
            "rows_upserted": 45,
        },
        "reconcile_recent": {
            "job": "reconcile_recent",
            "started_at": (now - timedelta(hours=4)).isoformat(),
            "finished_at": (now - timedelta(hours=4)).isoformat(),
            "status": "ok",
            "rows_upserted": 15,
        },
        "power_validate": {
            "job": "power_validate",
            "started_at": (now - timedelta(hours=5)).isoformat(),
            "finished_at": (now - timedelta(hours=5)).isoformat(),
            "status": "ok",
            "rows_upserted": 10,
        },
        "prune": {
            "job": "prune",
            "started_at": (now - timedelta(hours=12)).isoformat(),
            "finished_at": (now - timedelta(hours=12)).isoformat(),
            "status": "ok",
            "rows_upserted": 0,
        },
    }

    health = service.evaluate_health(artificial_job_overrides=fresh_overrides)
    assert health.status == "ok"
    assert health.database.alert is False
    assert len(health.warnings) == 0


def test_rate_limiting_headers_and_enforcement():
    """Rate-limit headers are present (enforcement is covered by the middleware tests).
    Uses a DB-free endpoint so the test runs offline."""
    # Test headers are present
    resp = client.get("/api/advisory/crops")
    assert resp.status_code == 200
    assert "X-RateLimit-Limit" in resp.headers
    assert resp.headers["X-RateLimit-Limit"] == "60"
    assert "X-RateLimit-Remaining" in resp.headers
