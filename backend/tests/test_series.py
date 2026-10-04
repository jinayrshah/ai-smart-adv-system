from datetime import date, timedelta
from app.data.mandi.series import generate_date_spine, is_stale_data


def test_generate_date_spine_continuous():
    start = date(2026, 9, 1)
    end = date(2026, 9, 10)
    spine = generate_date_spine(start, end)
    assert len(spine) == 10
    assert spine[0] == start
    assert spine[-1] == end
    for i in range(len(spine) - 1):
        assert spine[i + 1] - spine[i] == timedelta(days=1)


def test_is_stale_data_none():
    assert is_stale_data(None) is True


from app.core.timeutil import today_ist


def test_is_stale_data_fresh_vs_stale():
    today = today_ist()
    # Today's date is not stale
    assert is_stale_data(today) is False
    # A date 10 days ago is definitely stale
    old_date = today - timedelta(days=10)
    assert is_stale_data(old_date) is True
