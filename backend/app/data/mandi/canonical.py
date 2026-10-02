import re
from collections import defaultdict
from pathlib import Path
from typing import Any
import yaml

from app.data.types import CropScope, MandiRecord, TrackedScope


def clean_string(val: str | None) -> str:
    """Trim, collapse whitespace, and strip unwanted characters."""
    if not val:
        return ""
    # Collapse multiple whitespaces
    cleaned = re.sub(r"\s+", " ", val).strip()
    return cleaned


def clean_market_name(val: str | None) -> str:
    cleaned = clean_string(val)
    cleaned = re.sub(r"(?i)^\s*apmc\s+", "", cleaned)
    cleaned = re.sub(r"(?i)\s+apmc\s*$", "", cleaned)
    return clean_string(cleaned)


def normalize_lookup_key(val: str) -> str:
    """Lowercase and remove non-alphanumeric characters for fuzzy alias matching."""
    cleaned = clean_string(val).casefold()
    return re.sub(r"[^a-z0-9]", "", cleaned)


class Canonicalizer:
    def __init__(self, scope: TrackedScope):
        self.scope = scope
        self.commodity_alias_map: dict[str, str] = {}
        self.market_alias_map: dict[str, dict[str, str]] = defaultdict(dict)
        self.unmapped_commodities: dict[str, int] = defaultdict(int)
        self.unmapped_markets: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._build_indexes()

    def _build_indexes(self) -> None:
        for crop in self.scope.crops:
            # Map canonical display name
            self.commodity_alias_map[normalize_lookup_key(crop.display)] = crop.display
            # Map all aliases
            for alias in crop.aliases:
                self.commodity_alias_map[normalize_lookup_key(alias)] = crop.display

        for state, markets in self.scope.market_aliases.items():
            st_key = clean_string(state)
            for canon_mkt, aliases in markets.items():
                self.market_alias_map[st_key][normalize_lookup_key(canon_mkt)] = canon_mkt
                for alias in aliases:
                    self.market_alias_map[st_key][normalize_lookup_key(alias)] = canon_mkt

    def canonicalize_commodity(self, raw_commodity: str) -> str | None:
        cleaned = clean_string(raw_commodity)
        key = normalize_lookup_key(cleaned)
        if key in self.commodity_alias_map:
            return self.commodity_alias_map[key]
        self.unmapped_commodities[cleaned] += 1
        return None

    def canonicalize_market(self, state: str, raw_market: str) -> str:
        st_clean = clean_string(state)
        mkt_clean = clean_market_name(raw_market)
        key = normalize_lookup_key(mkt_clean)
        if st_clean in self.market_alias_map and key in self.market_alias_map[st_clean]:
            return self.market_alias_map[st_clean][key]
        # Keep unmapped markets as cleaned original string per Architecture §9.1
        self.unmapped_markets[st_clean][mkt_clean] += 1
        return mkt_clean

    def canonicalize(self, record: MandiRecord, strict_crop: bool = True) -> MandiRecord | None:
        """
        Canonicalize a MandiRecord.
        If strict_crop is True and the commodity does not match any tracked crop, returns None.
        """
        canon_commodity = self.canonicalize_commodity(record.commodity)
        if strict_crop and not canon_commodity:
            return None

        commodity_final = canon_commodity if canon_commodity else clean_string(record.commodity)
        state_clean = clean_string(record.state)
        district_clean = clean_string(record.district)
        market_clean = self.canonicalize_market(state_clean, record.market)
        variety_clean = clean_string(record.variety)
        grade_clean = clean_string(record.grade)

        return MandiRecord(
            state=state_clean,
            district=district_clean,
            market=market_clean,
            commodity=commodity_final,
            variety=variety_clean,
            grade=grade_clean,
            arrival_date=record.arrival_date,
            min_price=record.min_price,
            max_price=record.max_price,
            modal_price=record.modal_price,
            arrivals_tonnes=record.arrivals_tonnes,
            unit=clean_string(record.unit) or "Rs/Quintal",
            source=record.source,
            source_priority=record.source_priority,
            quality_flag=record.quality_flag,
        )

    def get_unmapped_report(self) -> dict[str, Any]:
        """Return counts of unmapped commodity and market names."""
        return {
            "unmapped_commodities": dict(self.unmapped_commodities),
            "unmapped_markets": {k: dict(v) for k, v in self.unmapped_markets.items() if v},
        }


def load_tracked_scope(config_path: str | Path | None = None) -> TrackedScope:
    """Load tracked crops, states, and aliases from tracked_scope.yaml."""
    if not config_path:
        # Search from workspace root
        config_path = Path(__file__).resolve().parents[4] / "config" / "tracked_scope.yaml"
    else:
        config_path = Path(config_path)

    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    crops = [
        CropScope(
            key=c["key"],
            display=c["display"],
            aliases=c.get("aliases", []),
        )
        for c in data.get("crops", [])
    ]
    states = data.get("states", [])
    priority_markets = data.get("priority_markets", {})
    market_aliases = data.get("market_aliases", {})
    tier_b = data.get("tier_b", {})

    return TrackedScope(
        crops=crops,
        states=states,
        priority_markets=priority_markets,
        market_aliases=market_aliases,
        mandi_watch_max_tracked=tier_b.get("mandi_watch_max_tracked", 300),
        weather_ondemand_max_new_grids=tier_b.get("weather_ondemand_max_new_grids", 300),
    )
