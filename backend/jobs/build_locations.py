import csv
import logging
from pathlib import Path
from typing import Any
import httpx
import yaml

from app.core.config import get_settings
from app.data.locations.grid import snap_to_grid
from app.data.locations.repository import LocationsRepository

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("build_locations")

# Robust known coordinates fallback for the tracked priority markets
FALLBACK_COORDINATES: dict[tuple[str, str], tuple[float, float, str]] = {
    # (State, Market/City): (lat, lon, district)
    ("Maharashtra", "Lasalgaon"): (20.1478, 74.2254, "Nashik"),
    ("Maharashtra", "Pune"): (18.5204, 73.8567, "Pune"),
    ("Maharashtra", "Nashik"): (19.9975, 73.7898, "Nashik"),
    ("Maharashtra", "Nagpur"): (21.1458, 79.0882, "Nagpur"),
    ("Gujarat", "Rajkot"): (22.3039, 70.8022, "Rajkot"),
    ("Gujarat", "Surat"): (21.1702, 72.8311, "Surat"),
    ("Gujarat", "Ahmedabad"): (23.0225, 72.5714, "Ahmedabad"),
    ("Gujarat", "Gondal"): (21.9619, 70.7923, "Rajkot"),
    ("Punjab", "Khanna"): (30.7071, 76.2166, "Ludhiana"),
    ("Punjab", "Ludhiana"): (30.9010, 75.8573, "Ludhiana"),
    ("Punjab", "Amritsar"): (31.6340, 74.8723, "Amritsar"),
    ("Uttar Pradesh", "Agra"): (27.1767, 78.0081, "Agra"),
    ("Uttar Pradesh", "Kanpur"): (26.4499, 80.3319, "Kanpur Nagar"),
    ("Uttar Pradesh", "Varanasi"): (25.3176, 82.9739, "Varanasi"),
    ("Madhya Pradesh", "Indore"): (22.7196, 75.8577, "Indore"),
    ("Madhya Pradesh", "Bhopal"): (23.2599, 77.4126, "Bhopal"),
    ("Madhya Pradesh", "Ujjain"): (23.1765, 75.7885, "Ujjain"),
    ("Karnataka", "Bengaluru"): (12.9716, 77.5946, "Bengaluru Urban"),
    ("Karnataka", "Hubli"): (15.3647, 75.1240, "Dharwad"),
    ("Karnataka", "Belgaum"): (15.8497, 74.4977, "Belagavi"),
    ("Rajasthan", "Kota"): (25.2138, 75.8648, "Kota"),
    ("Rajasthan", "Jaipur"): (26.9124, 75.7873, "Jaipur"),
    ("Rajasthan", "Sri Ganganagar"): (29.9038, 73.8772, "Ganganagar"),
}


def geocode_open_meteo(name: str, state: str) -> tuple[float, float, str] | None:
    """Query Open-Meteo geocoding API to find coordinates and admin2 (district)."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": name,
        "count": 5,
        "language": "en",
        "format": "json",
    }
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                for item in results:
                    if item.get("country_code") == "IN":
                        admin1 = item.get("admin1", "")
                        if state.lower() in admin1.lower() or admin1.lower() in state.lower():
                            lat = float(item["latitude"])
                            lon = float(item["longitude"])
                            district = item.get("admin2", "")
                            return (lat, lon, district)
                # If no strict state match, take the first Indian result if any
                for item in results:
                    if item.get("country_code") == "IN":
                        return (float(item["latitude"]), float(item["longitude"]), item.get("admin2", ""))
    except Exception as exc:
        logger.warning(f"Open-Meteo geocoding request failed for {name}, {state}: {exc}")
    return None


def run_build_locations(dry_run: bool = False):
    root_dir = Path(__file__).resolve().parents[2]
    config_path = root_dir / "config" / "tracked_scope.yaml"
    out_csv = root_dir / "docs" / "data-layer" / "locations_review.csv"

    if not config_path.exists():
        logger.error(f"Config not found at {config_path}")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        scope = yaml.safe_load(f)

    priority_markets = scope.get("priority_markets", {})
    records: list[dict[str, Any]] = []

    for state, markets in priority_markets.items():
        for market in markets:
            geo = geocode_open_meteo(market, state)
            geocode_source = "open_meteo"
            if geo is None:
                geo = FALLBACK_COORDINATES.get((state, market))
                geocode_source = "fallback_curated"

            if geo is not None:
                lat, lon, district = geo
                gp = snap_to_grid(lat, lon)
                records.append({
                    "kind": "mandi",
                    "name": market,
                    "state": state,
                    "district": district or market,
                    "lat": lat,
                    "lon": lon,
                    "grid_key": gp.grid_key,
                    "geocode_source": geocode_source,
                    "verified": False,
                    "tracked": True,
                })
            else:
                logger.warning(f"Could not locate {market}, {state}")

    # Write review CSV
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["kind", "name", "state", "district", "lat", "lon", "grid_key", "geocode_source", "verified", "tracked"]
        )
        writer.writeheader()
        for r in records:
            writer.writerow(r)
    logger.info(f"Wrote {len(records)} locations to {out_csv}")

    # Upsert to DB if not dry run
    if not dry_run:
        settings = get_settings()
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            repo = LocationsRepository()
            upserted = 0
            for r in records:
                res = repo.upsert_location(
                    kind=r["kind"],
                    name=r["name"],
                    state=r["state"],
                    district=r["district"],
                    lat=r["lat"],
                    lon=r["lon"],
                    grid_key=r["grid_key"],
                    geocode_source=r["geocode_source"],
                    verified=r["verified"],
                    tracked=r["tracked"],
                )
                if res:
                    upserted += 1
            logger.info(f"Upserted {upserted} locations to Supabase")
        else:
            logger.info("Supabase not configured; skipped DB upsert.")


if __name__ == "__main__":
    run_build_locations()
