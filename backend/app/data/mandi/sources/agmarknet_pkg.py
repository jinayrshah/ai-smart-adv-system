from datetime import date, timedelta
import logging
from typing import Any
import pandas as pd

from app.core.http import ProviderError, ProviderSchemaError
from app.core.timeutil import parse_date_ist
from app.data.types import MandiRecord, TrackedScope

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = [
    "arrival_date",
    "state_name",
    "district_name",
    "market_name",
    "cmdt_name",
    "variety_name",
    "grade_name",
    "min_price",
    "max_price",
    "model_price",
]


def _parse_float(val: Any) -> float | None:
    if val is None or pd.isna(val):
        return None
    try:
        val_str = str(val).replace(",", "").strip()
        f = float(val_str)
        return f if f > 0 else None
    except (ValueError, TypeError):
        return None


def split_date_range(start: date, end: date, max_days: int = 30) -> list[tuple[date, date]]:
    """Split a date range into sub-ranges of at most max_days."""
    ranges = []
    curr = start
    while curr <= end:
        chunk_end = min(curr + timedelta(days=max_days - 1), end)
        ranges.append((curr, chunk_end))
        curr = chunk_end + timedelta(days=1)
    return ranges


class AgmarknetPkgSource:
    name: str = "agmarknet_pkg"
    priority: int = 80

    def __init__(self):
        try:
            from agmarknet import Agmarknet
            self.api = Agmarknet()
        except ImportError as exc:
            logger.error(f"agmarknet package not installed: {exc}")
            self.api = None

    def _convert_df_to_records(self, df: pd.DataFrame) -> list[MandiRecord]:
        if df is None or df.empty:
            return []

        # Check required columns
        df_cols_lower = {c.lower(): c for c in df.columns}
        missing = [col for col in REQUIRED_COLUMNS if col.lower() not in df_cols_lower]
        if missing:
            raise ProviderSchemaError(
                f"agmarknet DataFrame missing required columns: {missing}. Actual columns: {list(df.columns)}"
            )

        records: list[MandiRecord] = []
        for _, row in df.iterrows():
            try:
                date_val = row[df_cols_lower["arrival_date"]]
                if isinstance(date_val, (pd.Timestamp, date)):
                    arrival_d = date_val.date() if isinstance(date_val, pd.Timestamp) else date_val
                else:
                    arrival_d = parse_date_ist(str(date_val))

                state = str(row[df_cols_lower["state_name"]]).strip()
                district = str(row[df_cols_lower["district_name"]]).strip()
                market = str(row[df_cols_lower["market_name"]]).strip()
                commodity = str(row[df_cols_lower["cmdt_name"]]).strip()
                variety = str(row[df_cols_lower["variety_name"]]).strip()
                grade = str(row[df_cols_lower["grade_name"]]).strip()

                min_p = _parse_float(row[df_cols_lower["min_price"]])
                max_p = _parse_float(row[df_cols_lower["max_price"]])
                modal_p = _parse_float(row[df_cols_lower["model_price"]])

                # Arrivals tonnes conversion if available
                arrivals_tonnes = None
                if "arrival_quantity" in df_cols_lower:
                    raw_qty = _parse_float(row[df_cols_lower["arrival_quantity"]])
                    if raw_qty is not None:
                        unit_str = str(row.get(df_cols_lower.get("unit_name_arrival", ""), "")).lower()
                        if "quintal" in unit_str or "qtl" in unit_str:
                            arrivals_tonnes = round(raw_qty / 10.0, 3)
                        elif "tonne" in unit_str or "ton" in unit_str:
                            arrivals_tonnes = round(raw_qty, 3)

                rec = MandiRecord(
                    state=state,
                    district=district,
                    market=market,
                    commodity=commodity,
                    variety=variety,
                    grade=grade,
                    arrival_date=arrival_d,
                    min_price=min_p,
                    max_price=max_p,
                    modal_price=modal_p,
                    arrivals_tonnes=arrivals_tonnes,
                    unit="Rs/Quintal",
                    source=self.name,
                    source_priority=self.priority,
                    quality_flag="ok",
                )
                records.append(rec)
            except Exception as exc:
                logger.warning(f"Error parsing agmarknet row: {exc}")

        return records

    def fetch_window(self, start: date, end: date, state: str, commodity: str) -> list[MandiRecord]:
        """Fetch a single <= 31 day window for a state and commodity."""
        if not self.api:
            raise ProviderError("agmarknet API client is not initialized")

        try:
            logger.info(f"Querying agmarknet for {state} / {commodity} ({start} to {end})")
            df = self.api.report(
                from_date=start.isoformat(),
                to_date=end.isoformat(),
                commodity=commodity,
                state=state,
                data_type="both",
            )
            return self._convert_df_to_records(df)
        except Exception as exc:
            logger.warning(f"agmarknet query failed for {state} / {commodity} ({start} to {end}): {exc}")
            return []

    async def fetch(
        self,
        start: date,
        end: date,
        scope: TrackedScope,
    ) -> list[MandiRecord]:
        """Fetch mandi records chunked into <= 30 day windows across tracked scope."""
        results: list[MandiRecord] = []
        date_chunks = split_date_range(start, end, max_days=30)

        for chunk_start, chunk_end in date_chunks:
            for crop in scope.crops:
                for state in scope.states:
                    recs = self.fetch_window(chunk_start, chunk_end, state=state, commodity=crop.display)
                    results.extend(recs)

        return results
