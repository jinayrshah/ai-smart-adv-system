"""
Repository for agronomic reference parameters (GDD norms, Kc coefficients, soil and climate norms).
Architecture_Advisory.md §7, §8, §9, §9b.
"""

import json
import logging
from pathlib import Path
from typing import Any

from app.data.mandi.repository import get_supabase_client
from app.schemas.advisory import (
    CropClimateSuitability,
    CropKcReference,
    CropSoilSuitability,
    CropStageNorm,
)

logger = logging.getLogger(__name__)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "crop_catalog.json"


class AgronomyReferenceRepository:
    """
    Loads and serves agronomic norms.
    Tries Supabase tables first; falls back seamlessly to offline verified fixtures.
    Rejects any record without a valid source.
    """

    def __init__(self):
        self._fixture_data: dict[str, Any] = {}
        self._load_fixtures()

    def _load_fixtures(self) -> None:
        if FIXTURE_PATH.exists():
            try:
                with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._fixture_data = data.get("crops", {})
            except Exception as exc:
                logger.error(f"Failed to load crop catalog fixture: {exc}")
                self._fixture_data = {}

    @property
    def client(self):
        return get_supabase_client()

    def get_supported_crops(self) -> list[str]:
        """Return list of supported deep-advisory crop names."""
        if self._fixture_data:
            return sorted(list(self._fixture_data.keys()))
        return ["Wheat", "Tomato", "Cotton", "Soybean", "Rice", "Maize"]

    def has_crop(self, crop: str) -> bool:
        crops = [c.lower() for c in self.get_supported_crops()]
        return crop.lower() in crops

    def _normalize_crop_name(self, crop: str) -> str:
        for c in self.get_supported_crops():
            if c.lower() == crop.strip().lower():
                return c
        return crop.strip()

    def get_stages(self, crop: str) -> list[CropStageNorm]:
        """
        Fetch stages ordered by stage_order.
        Raises ValueError if crop is unknown or has no stage norms.
        """
        norm_crop = self._normalize_crop_name(crop)
        
        # 1. Try Supabase
        try:
            res = (
                self.client.table("crop_stage_norms")
                .select("*")
                .ilike("crop", norm_crop)
                .order("stage_order")
                .execute()
            )
            if res.data:
                stages: list[CropStageNorm] = []
                # The DB table predates the upper cut-off column; use the catalog value then.
                fixture_upper = (self._fixture_data.get(norm_crop) or {}).get("gdd_upper_c")
                for row in res.data:
                    upper_val = row.get("gdd_upper_c", fixture_upper)
                    if not row.get("source"):
                        raise ValueError(f"Crop stage norm {row.get('stage_name')} missing source provenance.")
                    stages.append(CropStageNorm(
                        crop=row["crop"],
                        stage_order=row["stage_order"],
                        stage_name=row["stage_name"],
                        gdd_base_c=float(row["gdd_base_c"]),
                        gdd_cumulative_at_stage_end=float(row["gdd_cumulative_at_stage_end"]),
                        typical_days_fallback=row.get("typical_days_fallback"),
                        source=row["source"],
                        gdd_upper_c=float(upper_val) if upper_val is not None else None,
                    ))
                return stages
        except Exception as exc:
            logger.debug(f"Supabase crop_stage_norms lookup fallback: {exc}")

        # 2. Fallback to fixture
        crop_data = self._fixture_data.get(norm_crop)
        if not crop_data or "stages" not in crop_data:
            raise ValueError(f"Crop '{crop}' not found in agronomic stage norms database.")

        base_gdd = float(crop_data.get("gdd_base_c", 10.0))
        upper = crop_data.get("gdd_upper_c")
        stages = []
        for s in crop_data["stages"]:
            source = s.get("source") or crop_data.get("source")
            if not source:
                raise ValueError(f"Stage {s.get('stage_name')} missing required source.")
            stages.append(CropStageNorm(
                crop=norm_crop,
                stage_order=s["stage_order"],
                stage_name=s["stage_name"],
                gdd_base_c=base_gdd,
                gdd_cumulative_at_stage_end=float(s["gdd_cumulative_at_stage_end"]),
                typical_days_fallback=s.get("typical_days_fallback"),
                source=source,
                gdd_upper_c=float(upper) if upper is not None else None,
            ))
        return stages

    def get_water_params(self, crop: str) -> dict[str, Any] | None:
        """
        FAO-56 Table 22 root-zone parameters (Zr range, depletion fraction p) for the
        soil water balance. None for crops where the method does not apply (paddy).
        """
        norm_crop = self._normalize_crop_name(crop)
        crop_data = self._fixture_data.get(norm_crop) or {}
        params = crop_data.get("fao56_water")
        if not params or not params.get("source"):
            return None
        return params

    def get_kc(self, crop: str, stage_name: str) -> CropKcReference:
        """
        Fetch Kc crop coefficient for crop and growth stage.
        """
        norm_crop = self._normalize_crop_name(crop)

        # 1. Try Supabase
        try:
            res = (
                self.client.table("crop_kc_reference")
                .select("*")
                .ilike("crop", norm_crop)
                .ilike("stage_name", stage_name)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                if not row.get("source"):
                    raise ValueError(f"Kc reference for {crop} {stage_name} missing source.")
                return CropKcReference(
                    crop=row["crop"],
                    stage_name=row["stage_name"],
                    kc=float(row["kc"]),
                    source=row["source"],
                )
        except Exception as exc:
            logger.debug(f"Supabase crop_kc_reference lookup fallback: {exc}")

        # 2. Fallback to fixture
        crop_data = self._fixture_data.get(norm_crop)
        if crop_data and "stages" in crop_data:
            for s in crop_data["stages"]:
                if s["stage_name"].lower() == stage_name.lower():
                    return CropKcReference(
                        crop=norm_crop,
                        stage_name=s["stage_name"],
                        kc=float(s["kc"]),
                        source=s.get("source") or "FAO-56 Table 12",
                    )
            # Default midpoint if stage name matched partially
            for s in crop_data["stages"]:
                if any(w in s["stage_name"].lower() for w in stage_name.lower().split()):
                    return CropKcReference(
                        crop=norm_crop,
                        stage_name=s["stage_name"],
                        kc=float(s["kc"]),
                        source=s.get("source") or "FAO-56 Table 12",
                    )

        raise ValueError(f"Kc reference not found for crop '{crop}' at stage '{stage_name}'.")

    def get_soil_suitability(self, crop: str) -> CropSoilSuitability:
        norm_crop = self._normalize_crop_name(crop)

        # 1. Try Supabase
        try:
            res = (
                self.client.table("crop_soil_suitability")
                .select("*")
                .ilike("crop", norm_crop)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                if not row.get("source"):
                    raise ValueError(f"Soil suitability for {crop} missing source.")
                return CropSoilSuitability(
                    crop=row["crop"],
                    ideal_soil_types=row.get("ideal_soil_types") or [],
                    ideal_ph_min=float(row["ideal_ph_min"]),
                    ideal_ph_max=float(row["ideal_ph_max"]),
                    notes=row.get("notes"),
                    source=row["source"],
                )
        except Exception as exc:
            logger.debug(f"Supabase crop_soil_suitability lookup fallback: {exc}")

        # 2. Fallback to fixture
        crop_data = self._fixture_data.get(norm_crop)
        if crop_data and "soil" in crop_data:
            s = crop_data["soil"]
            return CropSoilSuitability(
                crop=norm_crop,
                ideal_soil_types=s["ideal_soil_types"],
                ideal_ph_min=float(s["ideal_ph_min"]),
                ideal_ph_max=float(s["ideal_ph_max"]),
                notes=s.get("notes"),
                source=s["source"],
            )

        raise ValueError(f"Soil suitability reference not found for crop '{crop}'.")

    def get_climate_suitability(self, crop: str, stage_name: str | None = None) -> CropClimateSuitability:
        norm_crop = self._normalize_crop_name(crop)

        # 1. Try Supabase
        try:
            query = self.client.table("crop_climate_suitability").select("*").ilike("crop", norm_crop)
            if stage_name:
                query = query.ilike("stage_name", stage_name)
            res = query.limit(1).execute()
            if res.data:
                row = res.data[0]
                if not row.get("source"):
                    raise ValueError(f"Climate suitability for {crop} missing source.")
                return CropClimateSuitability(
                    crop=row["crop"],
                    stage_name=row.get("stage_name"),
                    ideal_temp_min_c=float(row["ideal_temp_min_c"]),
                    ideal_temp_max_c=float(row["ideal_temp_max_c"]),
                    ideal_humidity_min_pct=float(row["ideal_humidity_min_pct"]) if row.get("ideal_humidity_min_pct") is not None else None,
                    ideal_humidity_max_pct=float(row["ideal_humidity_max_pct"]) if row.get("ideal_humidity_max_pct") is not None else None,
                    notes=row.get("notes"),
                    source=row["source"],
                )
        except Exception as exc:
            logger.debug(f"Supabase crop_climate_suitability lookup fallback: {exc}")

        # 2. Fallback to fixture
        crop_data = self._fixture_data.get(norm_crop)
        if crop_data and "climate" in crop_data:
            c = crop_data["climate"]
            return CropClimateSuitability(
                crop=norm_crop,
                stage_name=stage_name,
                ideal_temp_min_c=float(c["ideal_temp_min_c"]),
                ideal_temp_max_c=float(c["ideal_temp_max_c"]),
                ideal_humidity_min_pct=float(c["ideal_humidity_min_pct"]) if c.get("ideal_humidity_min_pct") is not None else None,
                ideal_humidity_max_pct=float(c["ideal_humidity_max_pct"]) if c.get("ideal_humidity_max_pct") is not None else None,
                notes=c.get("notes"),
                source=c["source"],
            )

        raise ValueError(f"Climate suitability reference not found for crop '{crop}'.")


# Singleton instance
_agronomy_repo: AgronomyReferenceRepository | None = None


def get_agronomy_repo() -> AgronomyReferenceRepository:
    global _agronomy_repo
    if _agronomy_repo is None:
        _agronomy_repo = AgronomyReferenceRepository()
    return _agronomy_repo
