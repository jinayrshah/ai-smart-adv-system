import logging
from datetime import date
from typing import Any
import httpx

from app.core.config import get_settings
from app.core.http import ProviderQuotaError, ProviderSchemaError, fetch_with_retry
from app.core.timeutil import parse_date_ist, today_ist
from app.data.types import MandiRecord, TrackedScope

logger = logging.getLogger(__name__)

RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"


def _parse_price(val: Any) -> float | None:
    if val is None:
        return None
    val_str = str(val).replace(",", "").strip()
    if not val_str or val_str.upper() in ("NA", "NAN", "NULL", "NONE"):
        return None
    try:
        p = float(val_str)
        return p if p > 0 else None
    except ValueError:
        return None


def _get_field(record: dict[str, Any], *candidate_names: str) -> Any:
    """Retrieve a value matching any candidate name case-insensitively."""
    lower_map = {k.lower(): v for k, v in record.items()}
    for name in candidate_names:
        name_lower = name.lower()
        if name_lower in lower_map:
            return lower_map[name_lower]
    return None


class DatagovLiveSource:
    name: str = "datagov_live"
    priority: int = 100

    def __init__(self, api_key: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.effective_data_gov_key

    def _build_params(
        self,
        state: str | None = None,
        commodity: str | None = None,
        district: str | None = None,
        market: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> dict[str, str]:
        params = {
            "api-key": self.api_key,
            "format": "json",
            "limit": str(limit),
            "offset": str(offset),
        }
        if state:
            params["filters[state]"] = state
        if district:
            params["filters[district]"] = district
        if commodity:
            params["filters[commodity]"] = commodity
        if market:
            params["filters[market]"] = market
        return params

    async def check_demo_key(self, client: httpx.AsyncClient) -> None:
        """
        Verify that the configured API key is not the public demo key.
        The demo key returns total > 10 but caps records at 10.
        """
        params = self._build_params(limit=1000, offset=0)
        data = await fetch_with_retry(client, BASE_URL, params=params, retries=2, timeout=15.0)
        records = data.get("records", [])
        total = int(data.get("total", 0) or 0)

        if total > 10 and len(records) <= 10:
            msg = (
                f"Sample/demo key detected (total={total}, records_returned={len(records)}). "
                "data.gov.in demo key caps responses at 10 records per request. "
                "Please configure a personal key in DATA_GOV_IN_KEY."
            )
            logger.error(msg)
            raise ProviderQuotaError(msg)

    def parse_record(self, raw: dict[str, Any]) -> MandiRecord | None:
        try:
            state = str(_get_field(raw, "state", "State") or "").strip()
            district = str(_get_field(raw, "district", "District") or "").strip()
            market = str(_get_field(raw, "market", "Market") or "").strip()
            commodity = str(_get_field(raw, "commodity", "Commodity") or "").strip()
            variety = str(_get_field(raw, "variety", "Variety") or "").strip()
            grade = str(_get_field(raw, "grade", "Grade") or "").strip()
            arrival_date_str = str(_get_field(raw, "arrival_date", "Arrival_Date") or "").strip()

            if not (state and market and commodity and arrival_date_str):
                return None

            arrival_date = parse_date_ist(arrival_date_str)
            min_price = _parse_price(_get_field(raw, "min_price", "Min_Price"))
            max_price = _parse_price(_get_field(raw, "max_price", "Max_Price"))
            modal_price = _parse_price(_get_field(raw, "modal_price", "Modal_Price"))

            return MandiRecord(
                state=state,
                district=district,
                market=market,
                commodity=commodity,
                variety=variety,
                grade=grade,
                arrival_date=arrival_date,
                min_price=min_price,
                max_price=max_price,
                modal_price=modal_price,
                arrivals_tonnes=None,
                unit="Rs/Quintal",
                source=self.name,
                source_priority=self.priority,
                quality_flag="ok",
            )
        except Exception as exc:
            logger.warning(f"Failed to parse raw record {raw}: {exc}")
            return None

    async def fetch_scope_pair(
        self,
        client: httpx.AsyncClient,
        state: str,
        commodity: str,
        max_pages: int = 50,
    ) -> list[MandiRecord]:
        """Fetch all records for a state x commodity pair using correct offset pagination."""
        records: list[MandiRecord] = []
        offset = 0

        for _ in range(max_pages):
            params = self._build_params(state=state, commodity=commodity, limit=1000, offset=offset)
            try:
                data = await fetch_with_retry(client, BASE_URL, params=params, retries=2, timeout=10.0)
            except Exception as exc:
                logger.error(f"Error fetching {state} / {commodity} at offset {offset}: {exc}")
                raise exc

            raw_records = data.get("records", [])
            if not raw_records:
                break

            for r in raw_records:
                parsed = self.parse_record(r)
                if parsed:
                    records.append(parsed)

            total = int(data.get("total", 0) or 0)
            # CRITICAL: Advance offset by len(records) returned, not by requested limit
            returned_count = len(raw_records)
            offset += returned_count

            if offset >= total or returned_count == 0:
                break

        return records

    async def fetch(
        self,
        start: date,
        end: date,
        scope: TrackedScope,
    ) -> list[MandiRecord]:
        """Fetch current data for all tracked states x tracked crops with circuit breaker."""
        results: list[MandiRecord] = []
        self.circuit_broken = False
        consecutive_failures = 0

        async with httpx.AsyncClient() as client:
            # Check demo key once
            try:
                await self.check_demo_key(client)
            except ProviderQuotaError:
                raise
            except Exception as exc:
                logger.warning(f"Demo key pre-check warning: {exc}")

            for crop in scope.crops:
                if self.circuit_broken:
                    break
                for state in scope.states:
                    try:
                        records = await self.fetch_scope_pair(client, state=state, commodity=crop.display)
                        results.extend(records)
                        consecutive_failures = 0
                    except Exception:
                        consecutive_failures += 1
                        if consecutive_failures >= 5:
                            logger.warning(
                                "Circuit breaker tripped after 5 consecutive failures from data.gov.in. "
                                "Halting requests for the remainder of this run."
                            )
                            self.circuit_broken = True
                            break

        return results

    async def fetch_today(
        self,
        state: str,
        commodity: str,
        market: str | None = None,
    ) -> list[MandiRecord]:
        """
        Synchronous single-request lookup for Tier B Explore search.
        Called on a cache miss to fetch today's price.
        """
        results: list[MandiRecord] = []
        async with httpx.AsyncClient() as client:
            params = self._build_params(state=state, commodity=commodity, market=market, limit=100, offset=0)
            data = await fetch_with_retry(client, BASE_URL, params=params, retries=2, timeout=15.0)
            for r in data.get("records", []):
                parsed = self.parse_record(r)
                if parsed:
                    results.append(parsed)
        return results
