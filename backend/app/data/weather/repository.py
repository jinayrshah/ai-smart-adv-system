import logging
from datetime import date, datetime, timezone
from typing import Any
from supabase import Client

from app.data.mandi.repository import get_supabase_client
from app.data.types import WeatherCurrent, WeatherDay

logger = logging.getLogger(__name__)


WEATHER_DAY_FIELDS = (
    "tmax_c", "tmin_c", "tmean_c", "precip_mm", "precip_prob_pct", "rh_mean_pct",
    "wind_max_kmh", "radiation_mj_m2", "et0_mm", "soil_moisture_top",
    "spread_tmax_c", "spread_precip_mm", "models_rain_frac",
)


def weather_day_from_row(row: dict[str, Any], grid_key: str | None = None) -> WeatherDay:
    """
    Rebuild a WeatherDay from a weather_daily row, keeping EVERY measured field.

    The jobs used to copy only a hand-picked subset (no et0_mm, tmean, precip
    probability...). Because archive rows outrank recent/forecast rows during fusion,
    re-fused past days lost their ET0 and the irrigation engine under-counted crop
    water demand for those days.
    """
    d_val = row["date"]
    d_obj = date.fromisoformat(d_val) if isinstance(d_val, str) else d_val
    kwargs = {f: row.get(f) for f in WEATHER_DAY_FIELDS}
    return WeatherDay(
        grid_key=grid_key or row["grid_key"],
        date=d_obj,
        source=row["source"],
        kind=row["kind"],
        **kwargs,
    )


def chunk_list(items: list[Any], chunk_size: int = 500):
    for i in range(0, len(items), chunk_size):
        yield items[i : i + chunk_size]


class WeatherRepository:
    def __init__(self, client: Client | None = None):
        self._client = client

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    # ==================== WEATHER_DAILY ====================

    def upsert_daily_records(self, records: list[WeatherDay]) -> int:
        if not records:
            return 0

        rows = []
        for r in records:
            rows.append({
                "grid_key": r.grid_key,
                "date": r.date.isoformat(),
                "source": r.source,
                "kind": r.kind,
                "tmax_c": r.tmax_c,
                "tmin_c": r.tmin_c,
                "tmean_c": r.tmean_c,
                "precip_mm": r.precip_mm,
                "precip_prob_pct": r.precip_prob_pct,
                "rh_mean_pct": r.rh_mean_pct,
                "wind_max_kmh": r.wind_max_kmh,
                "radiation_mj_m2": r.radiation_mj_m2,
                "et0_mm": r.et0_mm,
                "soil_moisture_top": r.soil_moisture_top,
                "spread_tmax_c": r.spread_tmax_c,
                "spread_precip_mm": r.spread_precip_mm,
                "models_rain_frac": r.models_rain_frac,
            })

        total = 0
        for chunk in chunk_list(rows, 500):
            try:
                res = self.client.table("weather_daily").upsert(
                    chunk,
                    on_conflict="grid_key,date,source,kind"
                ).execute()
                total += len(res.data) if res.data else len(chunk)
            except Exception as exc:
                logger.error(f"Error upserting weather_daily rows: {exc}")
                raise
        return total

    def get_raw_daily_range(
        self,
        grid_key: str,
        start_date: date,
        end_date: date,
    ) -> list[dict[str, Any]]:
        try:
            res = (
                self.client.table("weather_daily")
                .select("*")
                .eq("grid_key", grid_key)
                .gte("date", start_date.isoformat())
                .lte("date", end_date.isoformat())
                .execute()
            )
            return res.data or []
        except Exception as exc:
            logger.error(f"Error fetching weather_daily range for {grid_key}: {exc}")
            return []

    # ==================== WEATHER_DAILY_FUSED ====================

    def upsert_fused_days(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        total = 0
        for chunk in chunk_list(rows, 500):
            try:
                res = self.client.table("weather_daily_fused").upsert(
                    chunk,
                    on_conflict="grid_key,date"
                ).execute()
                total += len(res.data) if res.data else len(chunk)
            except Exception as exc:
                logger.error(f"Error upserting weather_daily_fused: {exc}")
                raise
        return total

    def get_fused_range(
        self,
        grid_key: str,
        start_date: date,
        end_date: date,
    ) -> list[dict[str, Any]]:
        try:
            res = (
                self.client.table("weather_daily_fused")
                .select("*")
                .eq("grid_key", grid_key)
                .gte("date", start_date.isoformat())
                .lte("date", end_date.isoformat())
                .order("date")
                .execute()
            )
            return res.data or []
        except Exception as exc:
            logger.error(f"Error fetching weather_daily_fused for {grid_key}: {exc}")
            return []

    # ==================== WEATHER_CURRENT ====================

    def upsert_current(self, current: WeatherCurrent) -> bool:
        row = {
            "grid_key": current.grid_key,
            "observed_at": current.observed_at.isoformat(),
            "temp_c": current.temp_c,
            "rh_pct": current.rh_pct,
            "wind_kmh": current.wind_kmh,
            "precip_mm_1h": current.precip_mm_1h,
            "weather_code": current.weather_code,
            "source": current.source,
            "confidence": current.confidence,
            "cross_check": current.cross_check or {},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            self.client.table("weather_current").upsert(
                row,
                on_conflict="grid_key"
            ).execute()
            return True
        except Exception as exc:
            logger.error(f"Error upserting weather_current for {current.grid_key}: {exc}")
            return False

    def get_current(self, grid_key: str) -> dict[str, Any] | None:
        try:
            res = self.client.table("weather_current").select("*").eq("grid_key", grid_key).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as exc:
            logger.error(f"Error fetching weather_current for {grid_key}: {exc}")
            return None

    # ==================== WEATHER_NORMALS_MONTHLY ====================

    def upsert_normals(self, normals: list[dict[str, Any]]) -> int:
        if not normals:
            return 0
        total = 0
        for chunk in chunk_list(normals, 100):
            try:
                res = self.client.table("weather_normals_monthly").upsert(
                    chunk,
                    on_conflict="grid_key,month"
                ).execute()
                total += len(res.data) if res.data else len(chunk)
            except Exception as exc:
                logger.error(f"Error upserting weather_normals_monthly: {exc}")
                raise
        return total

    def get_normals(self, grid_key: str) -> list[dict[str, Any]]:
        try:
            res = self.client.table("weather_normals_monthly").select("*").eq("grid_key", grid_key).order("month").execute()
            return res.data or []
        except Exception as exc:
            logger.error(f"Error fetching weather_normals_monthly for {grid_key}: {exc}")
            return []

    # ==================== INGESTION RUNS ====================

    def start_ingestion_run(self, job: str, source: str | None = None) -> int:
        try:
            res = self.client.table("ingestion_runs").insert({
                "job": job,
                "source": source,
                "status": "running",
                "started_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]["id"]
        except Exception as exc:
            logger.warning(f"Could not write ingestion_runs start: {exc}")
        return 0

    def finish_ingestion_run(
        self,
        run_id: int,
        status: str,
        rows_in: int,
        rows_upserted: int,
        rows_flagged: int = 0,
        notes: dict[str, Any] | None = None,
    ) -> None:
        if not run_id:
            return
        try:
            self.client.table("ingestion_runs").update({
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "status": status,
                "rows_in": rows_in,
                "rows_upserted": rows_upserted,
                "rows_flagged": rows_flagged,
                "notes": notes or {},
            }).eq("id", run_id).execute()
        except Exception as exc:
            logger.warning(f"Could not finish ingestion_runs: {exc}")
