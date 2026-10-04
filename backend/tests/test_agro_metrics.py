from datetime import date, timedelta

from app.data.types import FusedDay
from app.data.weather.agro import compute_agro_metrics


def test_agro_metrics_dry_spell():
    today = date(2026, 10, 4)
    days = []

    # 4 consecutive dry days ending today (precip < 1.0)
    # Day 0 (today): 0.2 mm
    # Day 1: 0.0 mm
    # Day 2: 0.8 mm
    # Day 3: 0.1 mm
    # Day 4: 15.0 mm (rainy day that broke previous dry spell)
    precips = [0.2, 0.0, 0.8, 0.1, 15.0, 0.0]
    for i, p in enumerate(precips):
        d = today - timedelta(days=i)
        days.append(
            FusedDay(
                grid_key="20.0,73.8",
                date=d,
                phase="today" if i == 0 else "past",
                tmax_c=31.0,
                precip_mm=p,
                confidence="high",
            )
        )

    metrics = compute_agro_metrics(days, normals=None, ref_today=today)
    assert metrics.dry_spell_days == 4


def test_agro_metrics_rain_vs_normal():
    today = date(2026, 10, 4)
    days = []

    # 30 days of data with 3.0 mm per day = 90 mm total
    for i in range(30):
        d = today - timedelta(days=i)
        days.append(
            FusedDay(
                grid_key="20.0,73.8",
                date=d,
                phase="today" if i == 0 else "past",
                tmax_c=30.0,
                precip_mm=3.0,
                confidence="high",
            )
        )

    # Mock normals: September (month 9) = 60 mm, October (month 10) = 40 mm
    # Average daily normal is around ~1.5 - 2 mm, total normal ~50-60 mm
    normals = [
        {"month": 9, "precip_mm_month": 60.0, "tmax_c": 29.5},
        {"month": 10, "precip_mm_month": 40.0, "tmax_c": 31.0},
    ]

    metrics = compute_agro_metrics(days, normals=normals, ref_today=today)
    assert metrics.rain_30d_mm == 90.0
    assert metrics.rain_30d_vs_normal_pct is not None
    # 90 mm is greater than normal, so pct should be positive
    assert metrics.rain_30d_vs_normal_pct > 0
