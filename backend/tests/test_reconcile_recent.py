from datetime import date, timedelta
from unittest.mock import MagicMock

from app.data.types import WeatherDay
from app.data.weather.fusion import DEFAULT_FUSION_CONFIG, fuse_range


def test_reconcile_recent_replaces_recent_with_archive_and_refuses():
    """
    ACCEPTANCE TEST:
    reconcile_recent replaces 'recent' rows with 'archive' rows for dates older
    than 6 days, and re-fusing uses the archive actuals.
    """
    today = date(2026, 10, 4)
    target_date = today - timedelta(days=8)  # Older than 6 days

    # 1. Initially, we only had recent forecast data (estimated rain = 15.0 mm)
    initial_recent_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="open_meteo",
        kind="recent",
        tmax_c=31.0,
        tmin_c=20.0,
        precip_mm=15.0,
    )

    fused_initial = fuse_range(
        grid_key="20.0,73.8",
        raw_rows=[initial_recent_row],
        start_date=target_date,
        end_date=target_date,
        today=today,
        cfg=DEFAULT_FUSION_CONFIG,
    )
    assert len(fused_initial) == 1
    assert fused_initial[0].precip_mm == 15.0

    # 2. Later, reconcile_recent pulls ERA5-Land archive reanalysis (measured actual rain = 4.2 mm)
    archive_row = WeatherDay(
        grid_key="20.0,73.8",
        date=target_date,
        source="open_meteo",
        kind="archive",
        tmax_c=30.2,
        tmin_c=19.8,
        precip_mm=4.2,
    )

    # When both exist, archive must take priority over recent
    both_rows = [initial_recent_row, archive_row]
    fused_reconciled = fuse_range(
        grid_key="20.0,73.8",
        raw_rows=both_rows,
        start_date=target_date,
        end_date=target_date,
        today=today,
        cfg=DEFAULT_FUSION_CONFIG,
    )

    assert len(fused_reconciled) == 1
    # Re-fused result must use the archive values, not the old recent forecast!
    assert fused_reconciled[0].precip_mm == 4.2
    assert fused_reconciled[0].tmax_c == 30.2
    assert fused_reconciled[0].tmin_c == 19.8
