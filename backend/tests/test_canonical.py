from datetime import date
from app.data.mandi.canonical import Canonicalizer, clean_string, normalize_lookup_key
from app.data.types import CropScope, MandiRecord, TrackedScope


def get_mock_scope() -> TrackedScope:
    return TrackedScope(
        crops=[
            CropScope(key="wheat", display="Wheat", aliases=["Wheat", "WHEAT"]),
            CropScope(key="rice", display="Rice", aliases=["Rice", "Paddy(Dhan)(Common)", "RICE"]),
            CropScope(key="cotton", display="Cotton", aliases=["Cotton", "Cotton(Adhiya/Unhusked)"]),
        ],
        states=["Maharashtra", "Gujarat"],
        priority_markets={"Maharashtra": ["Lasalgaon"]},
        market_aliases={"Maharashtra": {"Lasalgaon": ["Lasalgaon", "Lasalgaon(Niphad)"]}},
    )


def test_clean_string():
    assert clean_string("  Wheat   Grain  ") == "Wheat Grain"
    assert clean_string(None) == ""
    assert normalize_lookup_key("Paddy(Dhan)(Common)") == "paddydhancommon"


def test_canonicalize_commodity_aliases():
    canonicalizer = Canonicalizer(get_mock_scope())
    assert canonicalizer.canonicalize_commodity("Paddy(Dhan)(Common)") == "Rice"
    assert canonicalizer.canonicalize_commodity("WHEAT") == "Wheat"
    assert canonicalizer.canonicalize_commodity("Cotton(Adhiya/Unhusked)") == "Cotton"
    assert canonicalizer.canonicalize_commodity("UnknownCropXYZ") is None


def test_canonicalize_market_aliases():
    canonicalizer = Canonicalizer(get_mock_scope())
    assert canonicalizer.canonicalize_market("Maharashtra", "Lasalgaon(Niphad)") == "Lasalgaon"
    # Unmapped market returns cleaned name
    assert canonicalizer.canonicalize_market("Maharashtra", "  Nashik Market  ") == "Nashik Market"


def test_canonicalize_record_strict_crop():
    canonicalizer = Canonicalizer(get_mock_scope())
    valid_rec = MandiRecord(
        state="Maharashtra",
        district="Nashik",
        market="Lasalgaon(Niphad)",
        commodity="Paddy(Dhan)(Common)",
        variety="Common",
        grade="FAQ",
        arrival_date=date(2026, 10, 2),
        min_price=2000.0,
        max_price=2400.0,
        modal_price=2200.0,
        source="datagov_live",
        source_priority=100,
    )
    canon = canonicalizer.canonicalize(valid_rec, strict_crop=True)
    assert canon is not None
    assert canon.commodity == "Rice"
    assert canon.market == "Lasalgaon"

    invalid_rec = MandiRecord(
        state="Maharashtra",
        district="Nashik",
        market="Lasalgaon",
        commodity="Dragonfruit",
        variety="Red",
        grade="FAQ",
        arrival_date=date(2026, 10, 2),
        min_price=100.0,
        max_price=120.0,
        modal_price=110.0,
        source="datagov_live",
        source_priority=100,
    )
    assert canonicalizer.canonicalize(invalid_rec, strict_crop=True) is None

    # Verify unmapped report tracks Dragonfruit
    report = canonicalizer.get_unmapped_report()
    assert "Dragonfruit" in report["unmapped_commodities"]
    assert report["unmapped_commodities"]["Dragonfruit"] == 1
