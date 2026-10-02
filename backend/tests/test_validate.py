from datetime import date
from app.data.mandi.validate import flag_quality
from app.data.types import MandiRecord


def make_record(min_p: float | None, max_p: float | None, modal_p: float | None) -> MandiRecord:
    return MandiRecord(
        state="Maharashtra",
        district="Pune",
        market="Pune",
        commodity="Wheat",
        variety="Dara",
        grade="FAQ",
        arrival_date=date(2026, 10, 2),
        min_price=min_p,
        max_price=max_p,
        modal_price=modal_p,
    )


def test_flag_quality_ok():
    r = flag_quality(make_record(2000.0, 2500.0, 2200.0))
    assert r.quality_flag == "ok"


def test_flag_quality_missing_price():
    r1 = flag_quality(make_record(2000.0, 2500.0, None))
    assert r1.quality_flag == "missing_price"

    r2 = flag_quality(make_record(2000.0, 2500.0, 0.0))
    assert r2.quality_flag == "missing_price"


def test_flag_quality_nonpositive():
    r1 = flag_quality(make_record(-100.0, 2500.0, 2200.0))
    assert r1.quality_flag == "nonpositive"

    r2 = flag_quality(make_record(2000.0, -50.0, 2200.0))
    assert r2.quality_flag == "nonpositive"


def test_flag_quality_order_violation():
    # min > max
    r1 = flag_quality(make_record(3000.0, 2500.0, 2700.0))
    assert r1.quality_flag == "order_violation"

    # modal < min
    r2 = flag_quality(make_record(2000.0, 2500.0, 1800.0))
    assert r2.quality_flag == "order_violation"

    # modal > max
    r3 = flag_quality(make_record(2000.0, 2500.0, 2900.0))
    assert r3.quality_flag == "order_violation"
