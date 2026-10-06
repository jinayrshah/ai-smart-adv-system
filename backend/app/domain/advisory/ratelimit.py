"""
In-memory Sliding Window Rate Limiter for Advisory Queries.
Architecture_Advisory.md §18, Implementationplan_Advisory.md Phase 7.

Protects against runaway LLM / Gemini API usage with a per-farmer sliding window.
"""

from collections import deque
from datetime import datetime, timezone
import time
from typing import Deque


class SlidingWindowRateLimiter:
    """
    Sliding window in-memory rate limiter per key (farmer_id or client IP).
    Thread-safe enough for asyncio event loop with fast O(1) operations.
    """

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, Deque[float]] = {}

    def is_allowed(self, key: str) -> tuple[bool, int, float]:
        """
        Checks if request is within limits.
        Returns:
            (allowed: bool, remaining_requests: int, retry_after_seconds: float)
        """
        now = time.time()
        if key not in self._history:
            self._history[key] = deque()

        timestamps = self._history[key]

        # Purge timestamps outside sliding window
        while timestamps and timestamps[0] <= now - self.window_seconds:
            timestamps.popleft()

        if len(timestamps) < self.max_requests:
            timestamps.append(now)
            remaining = self.max_requests - len(timestamps)
            return True, remaining, 0.0

        # Rate limited
        oldest = timestamps[0]
        retry_after = max(1.0, (oldest + self.window_seconds) - now)
        return False, 0, round(retry_after, 1)

    def reset(self, key: str | None = None) -> None:
        """Reset limiter for testing."""
        if key:
            self._history.pop(key, None)
        else:
            self._history.clear()


# Default singleton instance: 20 advisory queries per minute per farmer
advisory_rate_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=60)
