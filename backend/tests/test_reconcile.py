from datetime import date
from app.data.mandi.reconcile import dedupe_by_key
from app.data.types import MandiRecord


def test_dedupe_by_key_priority():
    arrival_d = date(2026, 10, 2)
    # Record from Kaggle (priority 10)
    rec_kaggle = MandiRecord(
        state="Maharashtra",
        district="Nashik",
        market="Lasalgaon",
        commodity="Wheat",
        variety="Lokwan",
        grade="FAQ",
        arrival_date=arrival_d,
        min_price=1800.0,
        max_price=2200.0,
        modal_price=2000.0,
        source="kaggle_seed",
        source_priority=10,
    )

    # Record from Agmarknet Package (priority 80)
    rec_agmarknet = MandiRecord(
        state="Maharashtra",
        district="Nashik",
        market="Lasalgaon",
        commodity="Wheat",
        variety="Lokwan",
        grade="FAQ",
        arrival_date=arrival_d,
        min_price=1850.0,
        max_price=2250.0,
        modal_price=2050.0,
        source="agmarknet_pkg",
        source_priority=80,
    )

    # Record from datagov live (priority 100)
    rec_live = MandiRecord(
        state="Maharashtra",
        district="Nashik",
        market="Lasalgaon",
        commodity="Wheat",
        variety="Lokwan",
        grade="FAQ",
        arrival_date=arrival_d,
        min_price=1900.0,
        max_price=2300.0,
        modal_price=2100.0,
        source="datagov_live",
        source_priority=100,
    )

    # When fed in any order, highest priority must win
    batch1 = [rec_kaggle, rec_live, rec_agmarknet]
    deduped1 = dedupe_by_key(batch1)
    assert len(deduped1) == 1
    assert deduped1[0].source == "datagov_live"
    assert deduped1[0].modal_price == 2100.0

    batch2 = [rec_live, rec_kaggle]
    deduped2 = dedupe_by_key(batch2)
    assert len(deduped2) == 1
    assert deduped2[0].source == "datagov_live"


def test_dedupe_by_key_tie_breaking():
    arrival_d = date(2026, 10, 2)
    rec_first = MandiRecord(
        state="Punjab",
        district="Ludhiana",
        market="Khanna",
        commodity="Wheat",
        variety="Dara",
        grade="FAQ",
        arrival_date=arrival_d,
        min_price=2200.0,
        max_price=2400.0,
        modal_price=2300.0,
        source="datagov_live",
        source_priority=100,
    )
    rec_later = MandiRecord(
        state="Punjab",
        district="Ludhiana",
        market="Khanna",
        commodity="Wheat",
        variety="Dara",
        grade="FAQ",
        arrival_date=arrival_d,
        min_price=2250.0,
        max_price=2450.0,
        modal_price=2350.0,
        source="datagov_live",
        source_priority=100,
    )

    # Equal priority: later record in batch wins
    deduped = dedupe_by_key([rec_first, rec_later])
    assert len(deduped) == 1
    assert deduped[0].modal_price == 2350.0
