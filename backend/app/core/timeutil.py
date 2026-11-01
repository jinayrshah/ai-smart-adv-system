from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")


def now_ist() -> datetime:
    """Return the current datetime in IST (Asia/Kolkata)."""
    return datetime.now(IST)


def today_ist() -> date:
    """Return the current calendar date in IST (Asia/Kolkata)."""
    return now_ist().date()


def now_utc_iso() -> str:
    """Return current UTC time formatted as ISO string ending in 'Z'."""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_date_ist(date_str: str) -> date:
    """
    Parse a date string into a date object.
    Supports DD/MM/YYYY (common in Agmarknet / data.gov.in) and YYYY-MM-DD.
    """
    date_str = date_str.strip()
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            # DD/MM/YYYY
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            return date(year, month, day)
    try:
        return date.fromisoformat(date_str[:10])
    except ValueError:
        pass
    # Agmarknet / CEDA exports: "15 Oct 2026", "15-Oct-2026", "15-10-2026"
    for fmt in ("%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date format: {date_str}")
