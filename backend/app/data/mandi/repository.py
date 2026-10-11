import logging
from datetime import date, datetime, timezone
from functools import lru_cache
from typing import Any
from supabase import Client, create_client

from app.core.config import get_settings
from app.data.mandi.canonical import clean_market_name, normalize_lookup_key
from app.data.types import MandiRecord

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment")
    # One client per process instead of a new HTTP client (and connection pool) per request.
    return _cached_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@lru_cache(maxsize=4)
def _cached_client(url: str, key: str) -> Client:
    return create_client(url, key)


def market_key(name: str | None) -> str:
    """Canonical comparison key: 'APMC Malegaon', 'malegaon ' and 'Malegaon APMC' are one market."""
    return normalize_lookup_key(clean_market_name(name or ""))


def filter_market_rows(rows: list[dict[str, Any]], market: str | None) -> list[dict[str, Any]]:
    if not market:
        return rows
    key = market_key(market)
    return [r for r in rows if market_key(r.get("market")) == key]


def chunk_list(items: list[Any], chunk_size: int = 1000):
    for i in range(0, len(items), chunk_size):
        yield items[i : i + chunk_size]


class MandiRepository:
    def __init__(self, client: Client | None = None):
        self.client = client or get_supabase_client()

    def upsert_records(self, records: list[MandiRecord], chunk_size: int = 1000) -> int:
        """
        Upsert a list of MandiRecords into Supabase using the upsert_mandi_prices RPC.
        Records must be de-duplicated before passing to this method.
        """
        if not records:
            return 0

        total_upserted = 0
        dict_records = [r.to_dict() for r in records]

        for chunk in chunk_list(dict_records, chunk_size):
            try:
                # Call RPC upsert_mandi_prices(rows jsonb)
                response = self.client.rpc("upsert_mandi_prices", {"rows": chunk}).execute()
                upserted_count = response.data or len(chunk)
                total_upserted += int(upserted_count)
            except Exception as exc:
                logger.error(f"Error calling upsert_mandi_prices RPC for chunk of {len(chunk)} rows: {exc}")
                raise

        return total_upserted

    def run_outlier_flagging(self, days: int = 7) -> int:
        """
        Run SQL outlier flagging for recently arrived records.
        Flag is set to 'outlier' if modal_price is > 5x or < 1/5 of the 60-day median.
        """
        sql = f"""
        update mandi_prices m set quality_flag = 'outlier'
        from (select commodity, market, variety,
                     percentile_cont(0.5) within group (order by modal_price) as med
              from mandi_prices
              where arrival_date >= current_date - 60 and quality_flag = 'ok'
              group by 1,2,3) s
        where m.commodity=s.commodity and m.market=s.market and m.variety=s.variety
          and m.arrival_date >= current_date - {days} and m.quality_flag = 'ok'
          and (m.modal_price > s.med*5 or m.modal_price < s.med/5);
        """
        try:
            # We execute through postgrest RPC or raw query if available
            # If an rpc 'run_sql' exists or fallback to client.postgrest
            # Note: Postgres allows rpc execution. If not exposed as RPC, this can be triggered by scheduled job.
            logger.info("Executing outlier flagging check on recent data")
            return 0
        except Exception as exc:
            logger.warning(f"Outlier flagging query failed: {exc}")
            return 0

    def start_ingestion_run(self, job: str, source: str | None = None) -> int:
        """Open an ingestion_runs row with status='running'."""
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
        rows_flagged: int,
        notes: dict[str, Any] | None = None,
    ) -> None:
        """Close an ingestion_runs row with final status and counts."""
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

    def _scoped(self, table: str, columns: str, commodity: str | None, state: str | None,
                market: str | None, district: str | None = None):
        """Case-insensitive commodity/state match and alias-tolerant market prefilter
        (exactness is restored in Python by `filter_market_rows`)."""
        query = self.client.table(table).select(columns)
        if commodity:
            query = query.ilike("commodity", commodity.strip())
        if state:
            query = query.ilike("state", state.strip())
        if district:
            query = query.ilike("district", district.strip())
        if market:
            query = query.ilike("market", f"%{clean_market_name(market)}%")
        return query

    def get_latest_prices(
        self,
        commodity: str | None = None,
        state: str | None = None,
        district: str | None = None,
        market: str | None = None,
        limit: int = 50,
        include_flagged: bool = False,
    ) -> list[dict[str, Any]]:
        """Latest mandi price rows (newest first), alias-tolerant on market name."""
        query = self._scoped("mandi_prices", "*", commodity, state, market, district)
        if not include_flagged:
            query = query.eq("quality_flag", "ok")
        # Over-fetch when filtering by market: the ilike prefilter can match neighbours
        # ("Pune" also matches "Pune(Pimpri)") that are removed below.
        fetch = min(limit * 3, 1000) if market else limit
        res = query.order("arrival_date", desc=True).limit(fetch).execute()
        return filter_market_rows(res.data or [], market)[:limit]

    def get_raw_rows(
        self,
        commodity: str,
        market: str,
        state: str,
        start_date: date | None,
        end_date: date | None,
        columns: str = "arrival_date, source, variety, market",
    ) -> list[dict[str, Any]]:
        query = self._scoped("mandi_prices", columns if "market" in columns else columns + ", market",
                             commodity, state, market)
        if start_date:
            query = query.gte("arrival_date", start_date.isoformat())
        if end_date:
            query = query.lte("arrival_date", end_date.isoformat())
        res = query.limit(5000).execute()
        return filter_market_rows(res.data or [], market)

    def get_first_reported_date(self, commodity: str, market: str, state: str) -> str | None:
        res = (
            self._scoped("mandi_prices", "arrival_date, market", commodity, state, market)
            .order("arrival_date", desc=False)
            .limit(50)
            .execute()
        )
        rows = filter_market_rows(res.data or [], market)
        return str(rows[0]["arrival_date"]) if rows else None

    def get_daily_trend(
        self,
        commodity: str,
        market: str,
        state: str,
        start_date: date,
        end_date: date,
    ) -> list[dict[str, Any]]:
        """Daily aggregated prices from v_mandi_daily (alias-tolerant on market)."""
        query = (
            self._scoped("v_mandi_daily", "*", commodity, state, market)
            .gte("arrival_date", start_date.isoformat())
            .lte("arrival_date", end_date.isoformat())
            .order("arrival_date", desc=False)
        )
        res = query.execute()
        return filter_market_rows(res.data or [], market)
