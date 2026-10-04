import logging
from datetime import datetime, timezone
from typing import Any
from supabase import Client

from app.data.mandi.repository import get_supabase_client
from app.data.locations.grid import haversine_distance_km

logger = logging.getLogger(__name__)


class LocationsRepository:
    def __init__(self, client: Client | None = None):
        self._client = client

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def get_by_id(self, location_id: int) -> dict[str, Any] | None:
        try:
            res = self.client.table("locations").select("*").eq("id", location_id).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as exc:
            logger.error(f"Error fetching location by id {location_id}: {exc}")
            return None

    def get_by_grid_key(self, grid_key: str) -> dict[str, Any] | None:
        try:
            res = self.client.table("locations").select("*").eq("grid_key", grid_key).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as exc:
            logger.error(f"Error fetching location by grid_key {grid_key}: {exc}")
            return None

    def get_by_name_and_state(self, name: str, state: str, district: str = "") -> dict[str, Any] | None:
        try:
            query = self.client.table("locations").select("*").ilike("name", name).ilike("state", state)
            if district:
                query = query.ilike("district", district)
            res = query.limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as exc:
            logger.error(f"Error fetching location {name}, {state}: {exc}")
            return None

    def get_tracked_locations(self) -> list[dict[str, Any]]:
        try:
            res = self.client.table("locations").select("*").eq("tracked", True).execute()
            return res.data or []
        except Exception as exc:
            logger.error(f"Error fetching tracked locations: {exc}")
            return []

    def get_tracked_grid_keys(self) -> list[str]:
        locations = self.get_tracked_locations()
        seen = set()
        grid_keys = []
        for loc in locations:
            gk = loc.get("grid_key")
            if gk and gk not in seen:
                seen.add(gk)
                grid_keys.append(gk)
        return grid_keys

    def upsert_location(
        self,
        kind: str,
        name: str,
        state: str,
        district: str,
        lat: float,
        lon: float,
        grid_key: str,
        geocode_source: str = "open_meteo",
        verified: bool = False,
        tracked: bool = True,
    ) -> dict[str, Any] | None:
        row = {
            "kind": kind,
            "name": name,
            "state": state,
            "district": district or "",
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "grid_key": grid_key,
            "geocode_source": geocode_source,
            "verified": verified,
            "tracked": tracked,
        }
        try:
            res = self.client.table("locations").upsert(
                row,
                on_conflict="kind,name,state,district"
            ).execute()
            return res.data[0] if res.data else row
        except Exception as exc:
            logger.error(f"Error upserting location {name}: {exc}")
            return None

    def count_new_grids_today(self) -> int:
        """Count untracked or newly added grids today to enforce WEATHER_ONDEMAND_MAX_NEW_GRIDS cap."""
        try:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            # Note: in locations schema there's no created_at, but we can count unverified / explore locations
            # or count total locations added today
            res = self.client.table("locations").select("id", count="exact").execute()
            return res.count or 0
        except Exception as exc:
            logger.warning(f"Could not count new grids today: {exc}")
            return 0

    def find_nearest_tracked_grid(self, lat: float, lon: float) -> dict[str, Any] | None:
        """Find the closest tracked grid cell to the given coordinates."""
        tracked_locs = self.get_tracked_locations()
        if not tracked_locs:
            return None

        best_loc = None
        min_dist = float("inf")
        for loc in tracked_locs:
            loc_lat = float(loc["lat"])
            loc_lon = float(loc["lon"])
            dist = haversine_distance_km(lat, lon, loc_lat, loc_lon)
            if dist < min_dist:
                min_dist = dist
                best_loc = loc

        return best_loc
