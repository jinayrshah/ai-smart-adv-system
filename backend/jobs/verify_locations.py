import csv
import logging
from pathlib import Path
from app.data.locations.repository import LocationsRepository

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("verify_locations")


def run_verify_locations():
    """
    Apply verified review locations from docs/data-layer/locations_review.csv
    into the Supabase locations table.
    """
    root_dir = Path(__file__).resolve().parents[2]
    csv_path = root_dir / "docs" / "data-layer" / "locations_review.csv"

    if not csv_path.exists():
        logger.error(f"Review CSV not found at {csv_path}")
        return

    repo = LocationsRepository()
    updated_count = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["name"].strip()
            state = row["state"].strip()
            district = row["district"].strip()
            lat = float(row["lat"])
            lon = float(row["lon"])
            grid_key = row["grid_key"].strip()
            geocode_source = row.get("geocode_source", "open_meteo")
            verified = row["verified"].strip().lower() in ("true", "1", "yes")
            tracked = row["tracked"].strip().lower() in ("true", "1", "yes")

            # Check if this location exists in DB by name and state
            existing = repo.client.table("locations").select("*").ilike("name", name).ilike("state", state).execute()
            if existing.data and len(existing.data) > 0:
                loc_id = existing.data[0]["id"]
                # Update existing row
                repo.client.table("locations").update({
                    "district": district,
                    "lat": lat,
                    "lon": lon,
                    "grid_key": grid_key,
                    "geocode_source": geocode_source,
                    "verified": verified,
                    "tracked": tracked,
                }).eq("id", loc_id).execute()
                logger.info(f"Updated location {name}, {state} (id={loc_id}) -> verified={verified}, district={district}")
            else:
                # Insert
                repo.upsert_location(
                    kind=row.get("kind", "mandi"),
                    name=name,
                    state=state,
                    district=district,
                    lat=lat,
                    lon=lon,
                    grid_key=grid_key,
                    geocode_source=geocode_source,
                    verified=verified,
                    tracked=tracked,
                )
                logger.info(f"Inserted location {name}, {state} -> verified={verified}")
            updated_count += 1

    logger.info(f"Successfully processed and verified {updated_count} locations in Supabase DB.")


if __name__ == "__main__":
    run_verify_locations()
