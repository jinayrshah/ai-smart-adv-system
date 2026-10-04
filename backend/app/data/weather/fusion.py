import bisect
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Any
import yaml

from app.core.timeutil import today_ist
from app.data.types import FusedDay, WeatherDay

logger = logging.getLogger(__name__)

# Default fusion config if file cannot be read
DEFAULT_FUSION_CONFIG = {
    "primary_order": {
        "past_archive": ["open_meteo", "nasa_power"],
        "past_recent": ["open_meteo", "nasa_power"],
        "today": ["open_meteo", "openweather"],
        "future": ["open_meteo", "openweather"],
    },
    "validators": {
        "past_archive": ["nasa_power"],
        "past_recent": ["nasa_power"],
        "today": ["openweather"],
        "future": ["openweather"],
    },
    "tolerances": {
        "temp_c": 2.5,
        "rh_pct": 15.0,
        "radiation_rel": 0.20,
        "precip": {
            "abs_mm": 2.0,
            "rel": 0.30,
            "bucket_mismatch_is_disagreement": True,
        },
    },
    "spread": {
        "tmax_c": 3.0,
    },
    "rain_buckets_mm": [0.1, 2.5, 15.6, 64.5, 115.6, 204.5],
}

VALIDATED_FIELDS: dict[str, list[str]] = {
    "nasa_power": ["tmax_c", "tmin_c", "precip_mm", "rh_mean_pct", "radiation_mj_m2"],
    "openweather": ["tmax_c", "tmin_c", "precip_mm", "rh_mean_pct"],
    "open_meteo": ["tmax_c", "tmin_c", "precip_mm", "rh_mean_pct", "radiation_mj_m2"],
}


def load_fusion_config(config_path: Path | None = None) -> dict[str, Any]:
    if config_path is None:
        root_dir = Path(__file__).resolve().parents[4]
        config_path = root_dir / "config" / "fusion.yaml"

    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or DEFAULT_FUSION_CONFIG
        except Exception as exc:
            logger.warning(f"Error loading {config_path}: {exc}; using default fusion config")
    return DEFAULT_FUSION_CONFIG


def get_rain_bucket(val: float | None, buckets: list[float]) -> int:
    """Classify 24h precipitation into IMD rainfall class index."""
    if val is None or val < buckets[0]:
        return 0
    return bisect.bisect_right(buckets, val)


def within_tolerance(
    field_name: str,
    val_a: float,
    val_b: float,
    tolerances: dict[str, Any],
    rain_buckets: list[float],
) -> bool:
    """Pure comparison function checking whether two provider values are within tolerance."""
    if field_name in ("tmax_c", "tmin_c", "tmean_c"):
        max_diff = tolerances.get("temp_c", 2.5)
        return abs(val_a - val_b) <= max_diff

    if field_name == "rh_mean_pct":
        max_diff = tolerances.get("rh_pct", 15.0)
        return abs(val_a - val_b) <= max_diff

    if field_name == "radiation_mj_m2":
        rel_tol = tolerances.get("radiation_rel", 0.20)
        denom = max(abs(val_a), abs(val_b), 1.0)
        return (abs(val_a - val_b) / denom) <= rel_tol

    if field_name == "precip_mm":
        precip_cfg = tolerances.get("precip", {})
        abs_mm = precip_cfg.get("abs_mm", 2.0)
        rel_tol = precip_cfg.get("rel", 0.30)

        bucket_a = get_rain_bucket(val_a, rain_buckets)
        bucket_b = get_rain_bucket(val_b, rain_buckets)

        # Equal IMD class indicates agreement
        if bucket_a == bucket_b:
            return True

        # Otherwise check numerical tolerance
        max_allowed_diff = max(abs_mm, rel_tol * max(val_a, val_b))
        if abs(val_a - val_b) <= max_allowed_diff:
            return True

        # Bucket mismatch and outside numerical tolerance
        return False

    return True


def phase_key(d: date, today: date) -> str:
    """Compute routing key for primary and validator order."""
    if d == today:
        return "today"
    if d > today:
        return "future"
    if (today - d).days > 6:
        return "past_archive"
    return "past_recent"


def select_best_row_for_source(rows: list[WeatherDay]) -> WeatherDay | None:
    """Prioritize archive > recent > forecast if multiple kinds exist for a source."""
    if not rows:
        return None
    priority = {"archive": 3, "recent": 2, "forecast": 1}
    sorted_rows = sorted(rows, key=lambda r: priority.get(r.kind, 0), reverse=True)
    return sorted_rows[0]


def fuse_day(
    grid_key: str,
    d: date,
    today: date,
    rows_by_source: dict[str, list[WeatherDay]],
    cfg: dict[str, Any] | None = None,
) -> FusedDay | None:
    """
    Pure fusion function implementing Architecture §4.2 and §9.2.
    Routes by horizon, validates like-with-like, detects disagreement,
    and assigns confidence ('high', 'medium', 'low').
    """
    if cfg is None:
        cfg = DEFAULT_FUSION_CONFIG

    pk = phase_key(d, today)
    phase = "past" if d < today else ("today" if d == today else "future")

    order = cfg.get("primary_order", {}).get(pk, ["open_meteo"])
    cfg_validators = cfg.get("validators", {}).get(pk, [])
    tolerances = cfg.get("tolerances", {})
    rain_buckets = cfg.get("rain_buckets_mm", [0.1, 2.5, 15.6, 64.5, 115.6, 204.5])
    spread_cfg = cfg.get("spread", {})

    # Select primary source based on priority order
    primary: WeatherDay | None = None
    for src in order:
        if src in rows_by_source and rows_by_source[src]:
            primary = select_best_row_for_source(rows_by_source[src])
            break

    if primary is None:
        # Check any remaining source
        for src, r_list in rows_by_source.items():
            if r_list:
                primary = select_best_row_for_source(r_list)
                break

    if primary is None:
        return None

    degraded = primary.source != order[0]

    # Gather validators
    validators: list[WeatherDay] = []
    for v_src in cfg_validators:
        if v_src in rows_by_source and rows_by_source[v_src] and v_src != primary.source:
            v_row = select_best_row_for_source(rows_by_source[v_src])
            if v_row:
                validators.append(v_row)

    disagreement: dict[str, dict[str, float]] = {}
    valid_comparisons = 0

    for v in validators:
        v_fields = VALIDATED_FIELDS.get(v.source, [])
        for field in v_fields:
            a = getattr(primary, field, None)
            b = getattr(v, field, None)
            if a is None or b is None:
                continue

            valid_comparisons += 1
            if not within_tolerance(field, float(a), float(b), tolerances, rain_buckets):
                if field not in disagreement:
                    disagreement[field] = {}
                disagreement[field][primary.source] = round(float(a), 2)
                disagreement[field][v.source] = round(float(b), 2)

    # Spread flag for future forecast days
    spread_tmax_thresh = spread_cfg.get("tmax_c", 3.0)
    spread_flag = False
    if phase == "future":
        models_rain = primary.models_rain_frac
        spread_tmax = primary.spread_tmax_c or 0.0
        if models_rain is not None and (0.34 <= models_rain <= 0.66):
            spread_flag = True
        elif spread_tmax > spread_tmax_thresh:
            spread_flag = True

    # Confidence assignment (§9.2 and §15):
    # (a) all agree -> high
    # (b) precip bucket mismatch or tolerance violation -> low
    # (c) primary missing -> fallback + degraded + medium
    # (d) no validators -> medium
    # (e) wide model spread -> medium
    if disagreement:
        confidence = "low"
    elif degraded:
        confidence = "medium"
    elif spread_flag:
        confidence = "medium"
    elif valid_comparisons >= 1:
        confidence = "high"
    else:
        confidence = "medium"

    return FusedDay(
        grid_key=grid_key,
        date=d,
        phase=phase,
        tmax_c=primary.tmax_c,
        tmin_c=primary.tmin_c,
        precip_mm=primary.precip_mm,
        precip_prob_pct=primary.precip_prob_pct,
        rh_mean_pct=primary.rh_mean_pct,
        radiation_mj_m2=primary.radiation_mj_m2,
        et0_mm=primary.et0_mm,
        primary_source=primary.source,
        validators=[v.source for v in validators],
        confidence=confidence,
        degraded=degraded,
        disagreement=disagreement if disagreement else None,
    )


def fuse_range(
    grid_key: str,
    raw_rows: list[WeatherDay],
    start_date: date,
    end_date: date,
    today: date | None = None,
    cfg: dict[str, Any] | None = None,
) -> list[FusedDay]:
    """
    Idempotent re-fusion for a date range.
    Groups raw daily records by date, executes fuse_day for each day, and returns sorted FusedDay list.
    """
    if today is None:
        today = today_ist()
    if cfg is None:
        cfg = load_fusion_config()

    rows_by_date: dict[date, dict[str, list[WeatherDay]]] = {}
    for r in raw_rows:
        if r.grid_key == grid_key and start_date <= r.date <= end_date:
            if r.date not in rows_by_date:
                rows_by_date[r.date] = {}
            if r.source not in rows_by_date[r.date]:
                rows_by_date[r.date][r.source] = []
            rows_by_date[r.date][r.source].append(r)

    fused_days: list[FusedDay] = []
    curr = start_date
    while curr <= end_date:
        by_src = rows_by_date.get(curr, {})
        if by_src:
            fused = fuse_day(grid_key, curr, today, by_src, cfg)
            if fused:
                fused_days.append(fused)
        curr += timedelta(days=1)

    return fused_days
