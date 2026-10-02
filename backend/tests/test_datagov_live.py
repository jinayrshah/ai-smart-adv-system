from datetime import date
from unittest.mock import AsyncMock, MagicMock
import httpx
import pytest

from app.core.http import ProviderQuotaError
from app.data.mandi.sources.datagov_live import DatagovLiveSource


@pytest.mark.asyncio
async def test_demo_key_detector():
    source = DatagovLiveSource(api_key="mock_demo_key")

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    # In httpx, resp = await client.get(...), but resp.json() is synchronous
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "total": 1500,
        "count": 10,
        "records": [{"dummy": i} for i in range(10)],
    }
    mock_client.get.return_value = mock_response

    with pytest.raises(ProviderQuotaError) as exc_info:
        await source.check_demo_key(mock_client)

    assert "Sample/demo key detected" in str(exc_info.value)


def test_parse_record_case_insensitive():
    source = DatagovLiveSource(api_key="mock_key")
    raw = {
        "State": "Gujarat",
        "District": "Rajkot",
        "Market": "Rajkot APMC",
        "Commodity": "Cotton",
        "Variety": "Shankar-6",
        "Grade": "FAQ",
        "Arrival_Date": "02/10/2026",
        "Min_Price": "7,100",
        "Max_Price": "7,800",
        "Modal_Price": "7,450",
    }
    parsed = source.parse_record(raw)
    assert parsed is not None
    assert parsed.state == "Gujarat"
    assert parsed.district == "Rajkot"
    assert parsed.commodity == "Cotton"
    assert parsed.arrival_date == date(2026, 10, 2)
    assert parsed.min_price == 7100.0
    assert parsed.max_price == 7800.0
    assert parsed.modal_price == 7450.0
    assert parsed.source == "datagov_live"
    assert parsed.source_priority == 100


@pytest.mark.asyncio
async def test_pagination_advances_by_returned_length():
    source = DatagovLiveSource(api_key="mock_key")
    mock_client = AsyncMock(spec=httpx.AsyncClient)

    # First call returns 3 records with total=5
    # Second call returns 2 records with total=5
    # Total records = 5
    page1 = {
        "total": 5,
        "records": [
            {
                "state": "Gujarat",
                "district": "Rajkot",
                "market": "Rajkot",
                "commodity": "Cotton",
                "arrival_date": "02/10/2026",
                "modal_price": 7000 + i,
            }
            for i in range(3)
        ],
    }
    page2 = {
        "total": 5,
        "records": [
            {
                "state": "Gujarat",
                "district": "Rajkot",
                "market": "Gondal",
                "commodity": "Cotton",
                "arrival_date": "02/10/2026",
                "modal_price": 7010 + i,
            }
            for i in range(2)
        ],
    }

    resp1 = MagicMock(spec=httpx.Response)
    resp1.status_code = 200
    resp1.json.return_value = page1

    resp2 = MagicMock(spec=httpx.Response)
    resp2.status_code = 200
    resp2.json.return_value = page2

    mock_client.get.side_effect = [resp1, resp2]

    results = await source.fetch_scope_pair(mock_client, state="Gujarat", commodity="Cotton")
    assert len(results) == 5
    # Verify offset in second call was 3 (len of page1), not 1000
    assert mock_client.get.call_count == 2
    second_call_params = mock_client.get.call_args_list[1].kwargs["params"]
    assert second_call_params["offset"] == "3"
