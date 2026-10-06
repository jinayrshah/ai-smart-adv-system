"""
Advisory Queries Logging and Feedback Repository.
Architecture_Advisory.md §13, §14.
"""

from datetime import datetime, timezone
import logging
from typing import Any
from supabase import Client

from app.data.mandi.repository import get_supabase_client

logger = logging.getLogger(__name__)


class AdvisoryQueryRepository:
    """
    Manages audit logging for farmer queries, context snapshots, generated responses,
    and thumbs-up/down feedback loops.
    """

    _memory_store: dict[int, dict[str, Any]] = {}
    _id_counter: int = 1000

    def __init__(self, client: Client | None = None):
        self._client = client

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def log_query(
        self,
        user_query: str,
        context_snapshot: dict[str, Any],
        response_text: str,
        retrieved_chunk_ids: list[int],
        confidence: str,
        farmer_id: str | None = None,
        farm_id: int | None = None,
    ) -> int:
        """
        Logs a generated query and its context snapshot into advisory_queries.
        Returns the new query ID.
        """
        payload: dict[str, Any] = {
            "farmer_id": farmer_id,
            "farm_id": farm_id,
            "user_query": user_query,
            "context_snapshot": context_snapshot,
            "response_text": response_text,
            "retrieved_chunk_ids": retrieved_chunk_ids,
            "confidence": confidence,
            "feedback": None,
        }

        try:
            res = self.client.table("advisory_queries").insert(payload).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]["id"]
        except Exception as exc:
            logger.debug(f"Supabase advisory_queries insert fallback to memory: {exc}")

        # In-memory fallback
        AdvisoryQueryRepository._id_counter += 1
        q_id = AdvisoryQueryRepository._id_counter
        payload["id"] = q_id
        payload["created_at"] = datetime.now(timezone.utc).isoformat()
        AdvisoryQueryRepository._memory_store[q_id] = payload
        return q_id

    def record_feedback(self, query_id: int, feedback: int) -> bool:
        """
        Records user feedback (1 = up, -1 = down).
        """
        if feedback not in (1, -1):
            raise ValueError("Feedback must be 1 (up) or -1 (down)")

        try:
            res = (
                self.client.table("advisory_queries")
                .update({"feedback": feedback})
                .eq("id", query_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                return True
        except Exception as exc:
            logger.debug(f"Supabase feedback update fallback to memory: {exc}")

        if query_id in AdvisoryQueryRepository._memory_store:
            AdvisoryQueryRepository._memory_store[query_id]["feedback"] = feedback
            return True

        return False

    def get_query(self, query_id: int) -> dict[str, Any] | None:
        """Retrieve query record by ID for auditing."""
        try:
            res = self.client.table("advisory_queries").select("*").eq("id", query_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as exc:
            logger.debug(f"Supabase get_query fallback to memory: {exc}")

        return AdvisoryQueryRepository._memory_store.get(query_id)

    def get_flagged_queries(self, limit: int = 50) -> list[dict[str, Any]]:
        """
        Retrieves advisory queries where feedback = -1 for manual agronomic audit.
        Architecture_Advisory.md §13, §19.
        """
        try:
            res = (
                self.client.table("advisory_queries")
                .select("*")
                .eq("feedback", -1)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            if res.data:
                return res.data
        except Exception as exc:
            logger.debug(f"Supabase get_flagged_queries fallback: {exc}")

        # In-memory fallback
        flagged = [
            q for q in AdvisoryQueryRepository._memory_store.values()
            if q.get("feedback") == -1
        ]
        flagged.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return flagged[:limit]

    def get_feedback_summary(self) -> dict[str, Any]:
        """
        Aggregates query volume and feedback statistics (upvotes, downvotes, satisfaction rate).
        """
        try:
            total_res = self.client.table("advisory_queries").select("id, feedback", count="exact").execute()
            if total_res.data is not None:
                total_count = total_res.count or len(total_res.data)
                upvotes = sum(1 for r in total_res.data if r.get("feedback") == 1)
                downvotes = sum(1 for r in total_res.data if r.get("feedback") == -1)
                unrated = total_count - upvotes - downvotes
                satisfaction = round((upvotes / (upvotes + downvotes) * 100), 1) if (upvotes + downvotes) > 0 else 100.0
                return {
                    "total_queries": total_count,
                    "upvotes": upvotes,
                    "downvotes": downvotes,
                    "unrated": unrated,
                    "satisfaction_rate_pct": satisfaction,
                }
        except Exception as exc:
            logger.debug(f"Supabase feedback summary fallback: {exc}")

        total_count = len(AdvisoryQueryRepository._memory_store)
        upvotes = sum(1 for q in AdvisoryQueryRepository._memory_store.values() if q.get("feedback") == 1)
        downvotes = sum(1 for q in AdvisoryQueryRepository._memory_store.values() if q.get("feedback") == -1)
        unrated = total_count - upvotes - downvotes
        satisfaction = round((upvotes / (upvotes + downvotes) * 100), 1) if (upvotes + downvotes) > 0 else 100.0
        return {
            "total_queries": total_count,
            "upvotes": upvotes,
            "downvotes": downvotes,
            "unrated": unrated,
            "satisfaction_rate_pct": satisfaction,
        }


_query_repo_instance: AdvisoryQueryRepository | None = None


def get_query_repo() -> AdvisoryQueryRepository:
    global _query_repo_instance
    if _query_repo_instance is None:
        _query_repo_instance = AdvisoryQueryRepository()
    return _query_repo_instance
