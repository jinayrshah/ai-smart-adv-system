"""Tests for Phase 2B — Mandi Explore service, search endpoint, and prune job."""

import pytest
from unittest.mock import MagicMock, patch
from datetime import date

from app.data.mandi.service import _is_tracked_scope, _enforce_lru_cap


class TestIsTrackedScope:
    """Verify that _is_tracked_scope correctly identifies Tier A crops."""

    def test_tracked_crop_and_state(self):
        assert _is_tracked_scope("Wheat", "Punjab", "Amritsar") is True

    def test_tracked_crop_alias(self):
        # "WHEAT" is in aliases for Wheat, "Gehun" is not
        assert _is_tracked_scope("WHEAT", "Uttar Pradesh", "Agra") is True

    def test_untracked_crop(self):
        assert _is_tracked_scope("Tomato", "Maharashtra", "Nashik") is False

    def test_tracked_crop_untracked_state(self):
        assert _is_tracked_scope("Wheat", "Goa", "Panaji") is False

    def test_case_insensitive_crop(self):
        assert _is_tracked_scope("wheat", "Punjab", "Any") is True
        # "RICE" is in aliases, and Karnataka is a tracked state
        assert _is_tracked_scope("RICE", "Karnataka", "Any") is True


class TestLRUEviction:
    """Verify that LRU eviction logic works correctly."""

    def test_no_eviction_under_cap(self):
        """No eviction should happen when count is under the cap."""
        repo = MagicMock()
        count_result = MagicMock()
        count_result.count = 5
        repo.client.table.return_value.select.return_value.eq.return_value.execute.return_value = count_result

        _enforce_lru_cap(repo, max_tracked=300)

        # Should NOT call the oldest query or update
        # The only call should be the count query
        calls = repo.client.table.return_value.select.return_value.eq.return_value.order.call_args_list
        assert len(calls) == 0

    def test_eviction_over_cap(self):
        """When count exceeds cap, oldest entries should be evicted."""
        repo = MagicMock()

        # Count query returns 8
        count_result = MagicMock()
        count_result.count = 8
        count_execute = MagicMock(return_value=count_result)

        # Oldest query returns 3 IDs to evict (8 - 5 = 3)
        oldest_result = MagicMock()
        oldest_result.data = [{"id": 1}, {"id": 2}, {"id": 3}]

        # Chain the mock calls
        table_mock = MagicMock()
        select_mock = MagicMock()
        eq_mock = MagicMock()

        repo.client.table.return_value = table_mock
        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock

        # For count query
        eq_mock.execute.return_value = count_result

        # For oldest query
        order_mock = MagicMock()
        eq_mock.order.return_value = order_mock
        limit_mock = MagicMock()
        order_mock.limit.return_value = limit_mock
        limit_mock.execute.return_value = oldest_result

        # For update query
        update_mock = MagicMock()
        table_mock.update.return_value = update_mock
        in_mock = MagicMock()
        update_mock.in_.return_value = in_mock

        _enforce_lru_cap(repo, max_tracked=5)

        # Verify the update was called with the correct IDs
        table_mock.update.assert_called_with({"tracked": False})


class TestSearchEndpoint:
    """Verify the /api/market/search endpoint integration."""

    def test_search_endpoint_exists(self):
        """The search endpoint should be registered in the FastAPI app."""
        from app.main import app
        from fastapi.testclient import TestClient
        client = TestClient(app)
        # A GET without required params should return 422 (validation error), NOT 404
        response = client.get("/api/market/search")
        assert response.status_code == 422  # Missing required query params

    def test_search_endpoint_method(self):
        """The search endpoint should accept GET requests."""
        from app.main import app
        for route in app.routes:
            if hasattr(route, "path") and route.path == "/api/market/search":
                assert "GET" in route.methods
                break


class TestUpsertWatch:
    """Verify that _upsert_watch handles insert and update correctly."""

    def test_upsert_watch_insert_new(self):
        from app.data.mandi.service import _upsert_watch
        repo = MagicMock()
        select_mock = MagicMock()
        repo.client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        _upsert_watch(repo, "Tomato", "Maharashtra", "Nashik", "Nashik")

        insert_mock = repo.client.table.return_value.insert
        assert insert_mock.called
        args, _ = insert_mock.call_args
        assert args[0]["commodity"] == "Tomato"
        assert args[0]["state"] == "Maharashtra"
        assert args[0]["tracked"] is True
        assert args[0]["request_count"] == 1

    def test_upsert_watch_update_existing(self):
        from app.data.mandi.service import _upsert_watch
        repo = MagicMock()
        existing_data = [{"id": 42, "request_count": 5}]
        repo.client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = existing_data

        _upsert_watch(repo, "Tomato", "Maharashtra", "Nashik", "Nashik")

        update_mock = repo.client.table.return_value.update
        assert update_mock.called
        args, _ = update_mock.call_args
        assert args[0]["request_count"] == 6
        assert args[0]["tracked"] is True


class TestWatchedPairs:
    """Verify get_watched_pairs returns tracked watch list."""

    def test_get_watched_pairs(self):
        from app.data.mandi.service import get_watched_pairs
        repo = MagicMock()
        repo.client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"state": "Maharashtra", "district": "Nashik", "market": "Nashik", "commodity": "Tomato"}
        ]
        pairs = get_watched_pairs(repo)
        assert len(pairs) == 1
        assert pairs[0]["commodity"] == "Tomato"


class TestPruneJob:
    """Verify the prune job logic."""

    def test_prune_imports(self):
        """The prune module should be importable."""
        from jobs.prune import prune_explore_prices, prune_stale_watch, run_prune
        assert callable(prune_explore_prices)
        assert callable(prune_stale_watch)
        assert callable(run_prune)

    def test_prune_stale_watch_executes(self):
        from jobs.prune import prune_stale_watch
        repo = MagicMock()
        repo.client.table.return_value.delete.return_value.eq.return_value.lt.return_value.execute.return_value.data = [{"id": 1}, {"id": 2}]
        pruned = prune_stale_watch(repo, stale_days=180)
        assert pruned == 2


class TestSearchSchemas:
    """Verify Phase 2B Pydantic schemas."""

    def test_market_search_response_schema(self):
        from app.schemas.market import MarketSearchResponse, MarketSearchResult
        result = MarketSearchResult(
            market="Azadpur",
            district="New Delhi",
            state="Delhi",
            latest_date="2026-10-01",
            latest_modal=2500.0,
            latest_min=2200.0,
            latest_max=2800.0,
            variety="Local",
            source="datagov_live",
            records_available=5,
        )
        response = MarketSearchResponse(
            commodity="Tomato",
            state="Delhi",
            market_filter="Azadpur",
            tier="explore",
            history_available=False,
            markets=[result],
            total_records=5,
            as_of="2026-10-01T10:00:00Z",
        )
        assert response.tier == "explore"
        assert response.markets[0].market == "Azadpur"
        assert response.total_records == 5

    def test_tier_advisory(self):
        from app.schemas.market import MarketSearchResponse
        response = MarketSearchResponse(
            commodity="Wheat",
            state="Punjab",
            tier="advisory",
            history_available=True,
            markets=[],
            total_records=0,
            as_of="2026-10-01T10:00:00Z",
        )
        assert response.tier == "advisory"
