from typing import Any
from pydantic import BaseModel, Field


class JobHealthInfo(BaseModel):
    job: str = Field(..., description="Job identifier")
    last_success_at: str | None = Field(None, description="ISO timestamp of last successful run")
    age_hours: float | None = Field(None, description="Hours since last successful run")
    status: str = Field(..., description="Health status: ok | stale | failed | never_run")
    rows_upserted: int | None = Field(None, description="Rows upserted in the most recent run")
    threshold_hours: float = Field(..., description="Max age in hours before job flips to stale")
    notes: dict[str, Any] | None = Field(None, description="Diagnostic notes or disagreement metrics")


class DatabaseHealthInfo(BaseModel):
    estimated_size_mb: float = Field(..., description="Estimated storage consumed by user tables (MB)")
    max_budget_mb: float = Field(default=400.0, description="Warning threshold budget (MB)")
    db_cap_mb: float = Field(default=500.0, description="Supabase free tier hard cap (MB)")
    alert: bool = Field(default=False, description="True if database exceeds max_budget_mb")
    table_counts: dict[str, int] = Field(default_factory=dict, description="Row counts by table")


class HealthDataResponse(BaseModel):
    status: str = Field(..., description="Overall data layer status: ok | degraded")
    as_of: str = Field(..., description="UTC ISO timestamp of the health check")
    jobs: dict[str, JobHealthInfo] = Field(..., description="Health status breakdown per pipeline job")
    database: DatabaseHealthInfo = Field(..., description="Database size and storage budget telemetry")
    warnings: list[str] = Field(default_factory=list, description="Active system warnings or threshold alerts")
