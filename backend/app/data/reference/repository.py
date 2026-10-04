import logging
from pathlib import Path
from typing import Any
import yaml
from supabase import Client

from app.data.mandi.repository import get_supabase_client

logger = logging.getLogger(__name__)

REFERENCE_DIR = Path(__file__).resolve().parent
COST_FILE = REFERENCE_DIR / "crop_cost.yaml"
STORAGE_FILE = REFERENCE_DIR / "crop_storage.yaml"


def _load_yaml(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or []
    except Exception as exc:
        logger.error(f"Error loading yaml from {path}: {exc}")
        return []


class ReferenceRepository:
    def __init__(self, client: Client | None = None):
        self._client = client
        self._cost_data = _load_yaml(COST_FILE)
        self._storage_data = _load_yaml(STORAGE_FILE)

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    def get_cost_reference(self, crop: str, state: str) -> dict[str, Any] | None:
        """
        Get latest cost of cultivation record for crop × state.
        Tries Supabase first; falls back to curated DES dataset.
        """
        crop_clean = crop.strip().lower()
        state_clean = state.strip().lower()

        # 1. Try Supabase
        try:
            res = (
                self.client.table("crop_cost_reference")
                .select("*")
                .ilike("crop", crop.strip())
                .ilike("state", state.strip())
                .order("year", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as exc:
            logger.debug(f"Supabase crop_cost_reference query fallback to local: {exc}")

        # 2. Local curated DES dataset fallback
        matches = [
            r for r in self._cost_data
            if r.get("crop", "").lower() == crop_clean and r.get("state", "").lower() == state_clean
        ]
        if matches:
            # Sort by year descending if multiple
            matches.sort(key=lambda x: str(x.get("year", "")), reverse=True)
            return matches[0]

        return None

    def get_storage_reference(self, crop: str) -> dict[str, Any] | None:
        """
        Get storage reference record for crop.
        Tries Supabase first; falls back to curated storage dataset.
        """
        crop_clean = crop.strip().lower()

        # 1. Try Supabase
        try:
            res = (
                self.client.table("crop_storage_reference")
                .select("*")
                .ilike("crop", crop.strip())
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as exc:
            logger.debug(f"Supabase crop_storage_reference query fallback to local: {exc}")

        # 2. Local curated dataset fallback
        for r in self._storage_data:
            if r.get("crop", "").lower() == crop_clean:
                return r

        return None

    def seed_supabase(self) -> tuple[int, int]:
        """Upsert local reference data into Supabase tables if created."""
        cost_count = 0
        storage_count = 0

        # Cost reference
        try:
            for r in self._cost_data:
                self.client.table("crop_cost_reference").upsert(
                    r, on_conflict="crop,state,year"
                ).execute()
                cost_count += 1
        except Exception as exc:
            logger.warning(f"Could not seed crop_cost_reference in Supabase: {exc}")

        # Storage reference
        try:
            for r in self._storage_data:
                self.client.table("crop_storage_reference").upsert(
                    r, on_conflict="crop"
                ).execute()
                storage_count += 1
        except Exception as exc:
            logger.warning(f"Could not seed crop_storage_reference in Supabase: {exc}")

        return cost_count, storage_count
