from datetime import date

from app.data.types import WeatherDay
from app.data.weather.agro import compute_agro_metrics
from app.data.weather.fusion import DEFAULT_FUSION_CONFIG, fuse_day, get_rain_bucket, within_tolerance


def test_rain_buckets():
    buckets = [0.1, 2.5, 15.6, 64.5, 115.6, 204.5]
    assert get_rain_bucket(0.0, buckets) == 0
    assert get_rain_bucket(0.05, buckets) == 0
    assert get_rain_bucket(1.2, buckets) == 1
    assert get_rain_bucket(10.0, buckets) == 2
    assert get_rain_bucket(35.0, buckets) == 3
    assert get_rain_bucket(75.0, buckets) == 4
    assert get_rain_bucket(150.0, buckets) == 5
    assert get_rain_bucket(250.0, buckets) == 6


def test_within_tolerance_precip_same_bucket():
    tolerances = {"precip": {"abs_mm": 2.0, "rel": 0.30}}
    buckets = [0.1, 2.5, 15.6, 64.5, 115.6, 204.5]
    # Both in bucket 2 (2.5 to 15.6)
    assert within_tolerance("precip_mm", 5.0, 8.0, tolerances, buckets) is True


def test_within_tolerance_precip_different_bucket_large_diff():
    tolerances = {"precip": {"abs_mm": 2.0, "rel": 0.30}}
    buckets = [0.1, 2.5, 15.6, 64.5, 115.6, 204.5]
    # 1.0 mm (bucket 1) vs 14.2 mm (bucket 2) -> different buckets and diff 13.2 > max(2, 0.3*14.2)
    assert within_tolerance("precip_mm", 1.0, 14.2, tolerances, buckets) is False


# =========================================================================
# The 6 mandatory fusion cases from Architecture §15:
# =========================================================================


def test_case_a_all_agree_yields_high_confidence():
    """Case (a): All validators agree within tolerances -> confidence='high'."""
    today = date(2026, 10, 4)
    target_date = date(2026, 10, 5)  # future

    om_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="open_meteo",
        kind="forecast",
        tmax_c=30.0,
        tmin_c=21.0,
        precip_mm=2.0,
        rh_mean_pct=65.0,
    )
    ow_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="openweather",
        kind="forecast",
        tmax_c=30.5,  # diff 0.5 <= 2.5
        tmin_c=20.5,  # diff 0.5 <= 2.5
        precip_mm=2.2,  # diff 0.2 <= 2.0
        rh_mean_pct=68.0,  # diff 3.0 <= 15.0
    )

    rows_by_source = {"open_meteo": [om_row], "openweather": [ow_row]}
    fused = fuse_day("20.0,73.8", target_date, today, rows_by_source, DEFAULT_FUSION_CONFIG)

    assert fused is not None
    assert fused.confidence == "high"
    assert fused.degraded is False
    assert fused.disagreement is None
    assert "openweather" in fused.validators


def test_case_b_precip_mismatch_yields_low_confidence():
    """Case (b): Precipitation bucket mismatch / tolerance violation -> confidence='low'."""
    today = date(2026, 10, 4)
    target_date = date(2026, 10, 5)

    om_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="open_meteo",
        kind="forecast",
        tmax_c=30.0,
        tmin_c=21.0,
        precip_mm=14.2,  # Moderate rain
        rh_mean_pct=75.0,
    )
    ow_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="openweather",
        kind="forecast",
        tmax_c=29.5,
        tmin_c=21.5,
        precip_mm=1.0,  # Very light rain mismatch!
        rh_mean_pct=72.0,
    )

    rows_by_source = {"open_meteo": [om_row], "openweather": [ow_row]}
    fused = fuse_day("20.0,73.8", target_date, today, rows_by_source, DEFAULT_FUSION_CONFIG)

    assert fused is not None
    assert fused.confidence == "low"
    assert fused.disagreement is not None
    assert "precip_mm" in fused.disagreement
    assert fused.disagreement["precip_mm"]["open_meteo"] == 14.2
    assert fused.disagreement["precip_mm"]["openweather"] == 1.0


def test_case_c_primary_missing_yields_fallback_degraded_medium():
    """Case (c): Primary missing -> fallback + degraded=True + confidence='medium'."""
    today = date(2026, 10, 4)
    target_date = date(2026, 10, 5)

    # Open-Meteo failed/missing; only OpenWeather returned
    ow_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="openweather",
        kind="forecast",
        tmax_c=29.5,
        tmin_c=21.0,
        precip_mm=0.0,
        rh_mean_pct=65.0,
    )

    rows_by_source = {"openweather": [ow_row]}
    fused = fuse_day("20.0,73.8", target_date, today, rows_by_source, DEFAULT_FUSION_CONFIG)

    assert fused is not None
    assert fused.primary_source == "openweather"
    assert fused.degraded is True
    assert fused.confidence == "medium"


def test_case_d_no_validators_yields_medium_confidence():
    """Case (d): No validators available (single-source) -> confidence='medium'."""
    today = date(2026, 10, 4)
    target_date = date(2026, 10, 5)

    om_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="open_meteo",
        kind="forecast",
        tmax_c=30.0,
        tmin_c=21.0,
        precip_mm=0.0,
        rh_mean_pct=60.0,
    )

    # Only primary available
    rows_by_source = {"open_meteo": [om_row]}
    fused = fuse_day("20.0,73.8", target_date, today, rows_by_source, DEFAULT_FUSION_CONFIG)

    assert fused is not None
    assert fused.primary_source == "open_meteo"
    assert fused.degraded is False
    assert fused.validators == []
    assert fused.confidence == "medium"


def test_case_e_wide_model_spread_yields_medium_confidence():
    """Case (e): Wide multi-model forecast spread -> confidence='medium' even if validators agree."""
    today = date(2026, 10, 4)
    target_date = date(2026, 10, 6)

    om_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="open_meteo",
        kind="forecast",
        tmax_c=30.0,
        tmin_c=21.0,
        precip_mm=2.0,
        rh_mean_pct=65.0,
        spread_tmax_c=4.5,  # Exceeds spread tolerance 3.0
    )
    ow_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="openweather",
        kind="forecast",
        tmax_c=30.2,
        tmin_c=21.1,
        precip_mm=2.1,
        rh_mean_pct=66.0,
    )

    rows_by_source = {"open_meteo": [om_row], "openweather": [ow_row]}
    fused = fuse_day("20.0,73.8", target_date, today, rows_by_source, DEFAULT_FUSION_CONFIG)

    assert fused is not None
    assert fused.confidence == "medium"


def test_case_f_metrics_inherit_lowest_confidence():
    """Case (f): Agro metrics inherit the lowest confidence of the days they use."""
    today = date(2026, 10, 4)

    # Build 7 fused days: 6 high confidence, 1 low confidence
    from app.data.types import FusedDay
    from datetime import timedelta

    days = []
    for i in range(7):
        d = today - timedelta(days=i)
        conf = "low" if i == 2 else "high"
        days.append(
            FusedDay(
                grid_key="20.0,73.8",
                date=d,
                phase="past" if i > 0 else "today",
                tmax_c=30.0,
                precip_mm=5.0,
                confidence=conf,
            )
        )

    metrics = compute_agro_metrics(days, normals=None, ref_today=today)
    assert metrics.confidence == "low"
    assert metrics.rain_7d_mm == 35.0
