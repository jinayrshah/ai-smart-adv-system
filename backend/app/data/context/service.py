import logging
import math
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
import yaml

from app.core.timeutil import now_utc_iso, today_ist
from app.data.locations.repository import LocationsRepository
from app.data.mandi.repository import MandiRepository
from app.data.weather.service import WeatherService
from app.schemas.context import (
    ContextMarketWeatherResponse,
    PriceContextBlock,
    SignalDetail,
    WeatherContextBlock,
)

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parents[4] / "config" / "signals.yaml"


def load_signals_config() -> list[dict[str, Any]]:
    """Load context signals rules from config/signals.yaml."""
    if not CONFIG_PATH.exists():
        logger.warning(f"Signals config not found at {CONFIG_PATH}, using defaults.")
        return []
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            return data.get("rules", [])
    except Exception as exc:
        logger.error(f"Failed to load signals config: {exc}")
        return []


def evaluate_signal_condition(condition: str, price_ctx: dict[str, Any], weather_ctx: dict[str, Any]) -> bool:
    """
    Safely evaluate a rule condition expression using price and weather contexts.
    Restricted namespace with no __builtins__ and only safe math/abs.
    """
    safe_globals = {
        "__builtins__": None,
        "abs": abs,
        "math": math,
    }
    safe_locals = {
        "price": SimpleNamespace(**price_ctx),
        "weather": SimpleNamespace(**weather_ctx),
    }
    try:
        return bool(eval(condition, safe_globals, safe_locals))
    except Exception as exc:
        logger.debug(f"Condition evaluation failed for '{condition}': {exc}")
        return False


class ContextService:
    def __init__(
        self,
        mandi_repo: MandiRepository | None = None,
        weather_service: WeatherService | None = None,
        locations_repo: LocationsRepository | None = None,
        rules: list[dict[str, Any]] | None = None,
    ):
        self.mandi_repo = mandi_repo or MandiRepository()
        self.weather_service = weather_service or WeatherService()
        self.locations_repo = locations_repo or LocationsRepository()
        self.rules = rules if rules is not None else load_signals_config()

    def get_market_weather_context(
        self,
        commodity: str,
        market: str,
        state: str | None = None,
        days: int = 30,
    ) -> ContextMarketWeatherResponse:
        """
        Aggregate market price metrics, district weather agro-metrics, and
        evaluate config-driven descriptive signals (max 3).
        Architecture §10.4.
        """
        today = today_ist()
        start_date = today - timedelta(days=days)

        # 1. Fetch Market Prices
        resolved_state = state or ""
        resolved_district = ""

        # Query prices from repo
        prices = self.mandi_repo.get_latest_prices(
            commodity=commodity,
            market=market,
            state=state,
            limit=days * 2,
        )

        # Filter to requested window and sort ascending by date
        window_prices = [
            p for p in prices
            if p.get("arrival_date") and date.fromisoformat(str(p["arrival_date"])) >= start_date
        ]
        window_prices.sort(key=lambda x: str(x["arrival_date"]))

        latest_price: float | None = None
        change_7d_pct: float | None = None
        change_30d_pct: float | None = None
        volatility_pct: float | None = None
        coverage_ratio: float = 0.0
        price_stale = False

        if window_prices:
            latest_row = window_prices[-1]
            if not resolved_state:
                resolved_state = latest_row.get("state", "")
            resolved_district = latest_row.get("district", "")

            latest_modal = latest_row.get("modal_price")
            if latest_modal is not None:
                latest_price = float(latest_modal)

            # Check staleness (latest arrival > 36 hours old)
            latest_arrival = date.fromisoformat(str(latest_row["arrival_date"]))
            if (today - latest_arrival).days > 1:
                price_stale = True

            # Distinct arrival dates in window
            arrival_dates = {str(p["arrival_date"]) for p in window_prices if p.get("modal_price") is not None}
            coverage_ratio = round(len(arrival_dates) / max(days, 1), 2)

            # Change over 7 days
            target_7d = latest_arrival - timedelta(days=7)
            row_7d = None
            for p in window_prices:
                if date.fromisoformat(str(p["arrival_date"])) <= target_7d:
                    row_7d = p
            if row_7d and row_7d.get("modal_price") and latest_price:
                p7 = float(row_7d["modal_price"])
                if p7 > 0:
                    change_7d_pct = round(((latest_price - p7) / p7) * 100.0, 1)

            # Change over 30 days
            oldest_row = window_prices[0]
            if oldest_row and oldest_row.get("modal_price") and latest_price:
                p30 = float(oldest_row["modal_price"])
                if p30 > 0:
                    change_30d_pct = round(((latest_price - p30) / p30) * 100.0, 1)

            # Price volatility (coefficient of variation: std / mean * 100)
            valid_modals = [float(p["modal_price"]) for p in window_prices if p.get("modal_price") is not None]
            if len(valid_modals) >= 2:
                mean_p = sum(valid_modals) / len(valid_modals)
                var_p = sum((x - mean_p) ** 2 for x in valid_modals) / (len(valid_modals) - 1)
                std_p = math.sqrt(var_p)
                if mean_p > 0:
                    volatility_pct = round((std_p / mean_p) * 100.0, 1)
        else:
            price_stale = True

        price_block = PriceContextBlock(
            commodity=commodity,
            market=market,
            state=resolved_state,
            latest_modal_price=latest_price,
            change_7d_pct=change_7d_pct,
            change_30d_pct=change_30d_pct,
            volatility_pct=volatility_pct,
            coverage_ratio=coverage_ratio,
            days_requested=days,
            stale=price_stale,
        )

        # 2. Resolve Location and Fetch Weather
        loc = None
        # Look for market in locations repository
        tracked_locs = self.locations_repo.get_tracked_locations()
        for tl in tracked_locs:
            if market.lower() in tl.get("name", "").lower():
                loc = tl
                break
            if resolved_district and resolved_district.lower() in tl.get("district", "").lower():
                loc = tl
                break

        # Fallback to Nashik if unresolved
        if loc:
            loc_lat = float(loc.get("lat") or 20.0)
            loc_lon = float(loc.get("lon") or 73.8)
            loc_grid = loc.get("grid_key", "20.0,73.8")
            weather_district = loc.get("district") or resolved_district or market
            weather_state = loc.get("state") or resolved_state
        else:
            loc_lat = 20.0
            loc_lon = 73.8
            loc_grid = "20.0,73.8"
            weather_district = resolved_district or market
            weather_state = resolved_state

        weather_summary = self.weather_service.get_summary(lat=loc_lat, lon=loc_lon)
        metrics = weather_summary.metrics

        weather_block = WeatherContextBlock(
            grid_key=loc_grid,
            district=weather_district,
            state=weather_state,
            rain_7d_mm=metrics.rain_7d_mm,
            rain_30d_mm=metrics.rain_30d_mm,
            rain_30d_vs_normal_pct=metrics.rain_30d_vs_normal_pct,
            dry_spell_days=metrics.dry_spell_days,
            tmax_7d_anomaly_c=metrics.tmax_7d_anomaly_c,
            et0_7d_mm=metrics.et0_7d_mm,
            confidence=metrics.confidence,
            stale=weather_summary.stale,
        )

        # 3. Rule-based Signals Evaluation
        price_ctx = {
            "latest_modal_price": price_block.latest_modal_price,
            "change_7d_pct": price_block.change_7d_pct,
            "change_30d_pct": price_block.change_30d_pct,
            "volatility_pct": price_block.volatility_pct,
            "coverage_ratio": price_block.coverage_ratio,
        }
        weather_ctx = {
            "rain_7d_mm": weather_block.rain_7d_mm,
            "rain_30d_mm": weather_block.rain_30d_mm,
            "rain_30d_vs_normal_pct": weather_block.rain_30d_vs_normal_pct,
            "dry_spell_days": weather_block.dry_spell_days,
            "tmax_7d_anomaly_c": weather_block.tmax_7d_anomaly_c,
            "et0_7d_mm": weather_block.et0_7d_mm,
            "confidence": weather_block.confidence,
        }

        matched_signals: list[SignalDetail] = []
        for rule in self.rules:
            cond = rule.get("condition", "")
            if not cond:
                continue

            if evaluate_signal_condition(cond, price_ctx, weather_ctx):
                # Build evidence dict
                evidence = {}
                for field in rule.get("evidence_fields", []):
                    if field in price_ctx and price_ctx[field] is not None:
                        evidence[field] = price_ctx[field]
                    elif field in weather_ctx and weather_ctx[field] is not None:
                        evidence[field] = weather_ctx[field]

                # Format text
                template = rule.get("template", "")
                try:
                    format_args = {**price_ctx, **weather_ctx}
                    signal_text = template.format(**format_args)
                except Exception:
                    signal_text = template

                matched_signals.append(
                    SignalDetail(
                        rule=rule.get("id", "rule"),
                        name=rule.get("name", "Market Signal"),
                        strength=rule.get("strength", "info"),
                        text=signal_text,
                        evidence=evidence,
                    )
                )

        # Cap at max 3 signals (Architecture §10.4)
        active_signals = matched_signals[:3]

        is_degraded = weather_summary.degraded or price_block.coverage_ratio < 0.20
        overall_stale = price_block.stale or weather_block.stale

        return ContextMarketWeatherResponse(
            as_of=now_utc_iso(),
            stale=overall_stale,
            degraded=is_degraded,
            price=price_block,
            weather=weather_block,
            signals=active_signals,
        )
