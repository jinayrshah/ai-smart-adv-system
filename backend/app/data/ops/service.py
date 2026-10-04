import logging
from datetime import datetime, timezone
from typing import Any

from supabase import Client

from app.core.timeutil import now_utc_iso
from app.data.mandi.repository import get_supabase_client
from app.schemas.health import (
    DatabaseHealthInfo,
    HealthDataResponse,
    JobHealthInfo,
)

logger = logging.getLogger(__name__)

JOB_THRESHOLDS: dict[str, float] = {
    "ingest_mandi_daily": 36.0,   # twice-daily job (15:30, 21:30 IST)
    "ingest_weather": 12.0,       # 4x daily job (05:45, 11:45, 17:45, 23:45 IST)
    "reconcile_recent": 36.0,     # daily job (08:00 IST)
    "power_validate": 36.0,       # daily job (08:30 IST)
    "prune": 192.0,               # weekly job (Sunday 01:30 IST, ~8 days)
}

ESTIMATED_BYTES_PER_ROW: dict[str, int] = {
    "mandi_prices": 400,
    "weather_daily": 350,
    "weather_daily_fused": 400,
    "locations": 250,
    "mandi_watch": 150,
    "ingestion_runs": 300,
    "crop_cost_reference": 200,
    "crop_storage_reference": 200,
}


class OpsService:
    def __init__(self, client: Client | None = None):
        self._client = client

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def get_job_runs(self) -> list[dict[str, Any]]:
        """Fetch latest ingestion_runs rows ordered by started_at desc."""
        try:
            res = (
                self.client.table("ingestion_runs")
                .select("*")
                .order("started_at", desc=True)
                .limit(100)
                .execute()
            )
            return res.data or []
        except Exception as exc:
            logger.warning(f"Could not fetch ingestion_runs: {exc}")
            return []

    def get_table_counts(self) -> dict[str, int]:
        """Fetch exact row counts for all application tables."""
        counts = {}
        for table in ESTIMATED_BYTES_PER_ROW.keys():
            try:
                # Use count='exact' with limit 0
                res = self.client.table(table).select("*", count="exact").limit(0).execute()
                counts[table] = res.count if res.count is not None else 0
            except Exception as exc:
                logger.debug(f"Could not count rows for {table}: {exc}")
                counts[table] = 0
        return counts

    def evaluate_health(
        self,
        artificial_job_overrides: dict[str, dict[str, Any]] | None = None,
    ) -> HealthDataResponse:
        """
        Evaluate full system health for /api/health/data.
        Architecture §10.3 & §13.
        Thresholds:
          mandi > 36 h, weather > 12 h, reconcile > 36 h -> degraded.
          DB size > 400 MB -> alert and degraded.
        """
        runs = self.get_job_runs()
        now = datetime.now(timezone.utc)
        warnings: list[str] = []
        is_degraded = False

        # Group runs by job name (latest first)
        latest_runs: dict[str, dict[str, Any]] = {}
        for r in runs:
            job_name = r.get("job")
            if job_name and job_name not in latest_runs:
                latest_runs[job_name] = r

        # Apply artificial test overrides if provided (for testing acceptance criteria)
        if artificial_job_overrides:
            for job_name, override in artificial_job_overrides.items():
                latest_runs[job_name] = override

        jobs_health: dict[str, JobHealthInfo] = {}

        for job_name, threshold in JOB_THRESHOLDS.items():
            run = latest_runs.get(job_name)

            if not run:
                jobs_health[job_name] = JobHealthInfo(
                    job=job_name,
                    last_success_at=None,
                    age_hours=None,
                    status="never_run",
                    rows_upserted=None,
                    threshold_hours=threshold,
                    notes=None,
                )
                warnings.append(f"Job '{job_name}' has never completed a recorded run.")
                is_degraded = True
                continue

            run_status = run.get("status", "running")
            started_at_str = run.get("started_at")
            age_hours: float | None = None

            if started_at_str:
                try:
                    dt = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
                    age_hours = round((now - dt).total_seconds() / 3600.0, 1)
                except Exception:
                    pass

            # Determine job health status
            if run_status == "failed":
                job_health_status = "failed"
                warnings.append(f"Job '{job_name}' failed in its last execution.")
                is_degraded = True
            elif age_hours is not None and age_hours > threshold:
                job_health_status = "stale"
                warnings.append(
                    f"Job '{job_name}' is stale: last run {age_hours}h ago (threshold: {threshold}h)."
                )
                is_degraded = True
            elif run_status in ("ok", "partial"):
                job_health_status = "ok"
            else:
                job_health_status = run_status

            jobs_health[job_name] = JobHealthInfo(
                job=job_name,
                last_success_at=run.get("finished_at") or started_at_str,
                age_hours=age_hours,
                status=job_health_status,
                rows_upserted=run.get("rows_upserted"),
                threshold_hours=threshold,
                notes=run.get("notes") if isinstance(run.get("notes"), dict) else None,
            )

        # Database telemetry & size check
        table_counts = self.get_table_counts()
        total_data_bytes = sum(
            table_counts.get(t, 0) * bytes_row
            for t, bytes_row in ESTIMATED_BYTES_PER_ROW.items()
        )
        # Factor in indexes & Postgres engine overhead (approx 1.8x)
        estimated_total_bytes = total_data_bytes * 1.8
        estimated_size_mb = round(estimated_total_bytes / (1024.0 * 1024.0), 2)

        # Base engine allocation (~2.0 MB minimal)
        estimated_size_mb = max(2.1, estimated_size_mb)

        db_alert = estimated_size_mb >= 400.0
        if db_alert:
            warnings.append(
                f"Storage alert: Database size ({estimated_size_mb:.1f} MB) exceeds warning budget of 400.0 MB!"
            )
            is_degraded = True

        db_health = DatabaseHealthInfo(
            estimated_size_mb=estimated_size_mb,
            max_budget_mb=400.0,
            db_cap_mb=500.0,
            alert=db_alert,
            table_counts=table_counts,
        )

        return HealthDataResponse(
            status="degraded" if is_degraded else "ok",
            as_of=now_utc_iso(),
            jobs=jobs_health,
            database=db_health,
            warnings=warnings,
        )
