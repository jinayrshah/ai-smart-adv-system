from datetime import date
from typing import Protocol
from app.data.types import MandiRecord, TrackedScope


class MandiSource(Protocol):
    name: str
    priority: int

    async def fetch(self, start: date, end: date, scope: TrackedScope) -> list[MandiRecord]:
        """Fetch mandi records for the specified date range and tracked scope."""
        ...
