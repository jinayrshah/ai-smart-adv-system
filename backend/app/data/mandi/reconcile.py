from collections import OrderedDict
from app.data.types import MandiRecord


def dedupe_by_key(
    records: list[MandiRecord],
    keep: str = "highest_priority_then_latest",
) -> list[MandiRecord]:
    """
    De-duplicate mandi records by unique key (state, district, market, commodity, variety, grade, arrival_date).
    This is required before calling Postgres upsert_mandi_prices RPC, as Postgres cannot update
    the same row twice in a single ON CONFLICT statement.

    Strategy:
    - highest_priority_then_latest: record with higher source_priority wins.
      If priority is tied, the latest record in the input list wins.
    """
    deduped: OrderedDict[tuple, MandiRecord] = OrderedDict()

    for r in records:
        key = r.unique_key()
        if key not in deduped:
            deduped[key] = r
        else:
            existing = deduped[key]
            if r.source_priority > existing.source_priority:
                deduped[key] = r
            elif r.source_priority == existing.source_priority:
                # If priority is tied, later in batch wins (latest update)
                deduped[key] = r

    return list(deduped.values())
