import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4
from supabase import Client

from app.data.mandi.repository import get_supabase_client
from app.data.locations.grid import snap_to_grid
from app.schemas.farmer import (
    FarmerProfileCreate,
    FarmerProfileUpdate,
    FarmerProfileResponse,
    FarmCreate,
    FarmUpdate,
    FarmResponse,
    FarmCropCreate,
    FarmCropUpdate,
    FarmCropResponse,
    OnboardingRequest,
    OnboardingResponse,
)

logger = logging.getLogger(__name__)


class FarmerRepository:
    # Shared local fallback store for offline/test environments
    _shared_profiles: dict[UUID, dict[str, Any]] = {}
    _shared_farms: dict[int, dict[str, Any]] = {}
    _shared_crops: dict[int, dict[str, Any]] = {}
    _shared_farm_id_counter: int = 100
    _shared_crop_id_counter: int = 1000

    def __init__(self, client: Client | None = None):
        try:
            self._client = client or get_supabase_client()
        except Exception as e:
            logger.warning(f"Could not initialize Supabase client for FarmerRepository: {e}")
            self._client = None
        self._profiles = FarmerRepository._shared_profiles
        self._farms = FarmerRepository._shared_farms
        self._crops = FarmerRepository._shared_crops

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    # --- Profile Operations ---
    def create_profile(self, data: FarmerProfileCreate) -> FarmerProfileResponse:
        farmer_id = data.id or uuid4()
        now = datetime.now(timezone.utc)
        payload = {
            "id": str(farmer_id),
            "full_name": data.full_name,
            "preferred_language": data.preferred_language or "en",
            "phone": data.phone,
            "created_at": now.isoformat(),
        }
        try:
            res = self.client.table("farmer_profile").insert(payload).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return FarmerProfileResponse(
                    id=UUID(row["id"]),
                    full_name=row.get("full_name"),
                    preferred_language=row.get("preferred_language", "en"),
                    phone=row.get("phone"),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
        except Exception as exc:
            logger.warning(f"Supabase profile insert fallback to memory: {exc}")

        # In-memory store
        self._profiles[farmer_id] = payload
        return FarmerProfileResponse(
            id=farmer_id,
            full_name=data.full_name,
            preferred_language=data.preferred_language or "en",
            phone=data.phone,
            created_at=now,
        )

    def get_profile(self, farmer_id: UUID) -> FarmerProfileResponse | None:
        try:
            res = self.client.table("farmer_profile").select("*").eq("id", str(farmer_id)).limit(1).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return FarmerProfileResponse(
                    id=UUID(row["id"]),
                    full_name=row.get("full_name"),
                    preferred_language=row.get("preferred_language", "en"),
                    phone=row.get("phone"),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
        except Exception as exc:
            logger.warning(f"Supabase get_profile failed, checking memory: {exc}")

        if farmer_id in self._profiles:
            row = self._profiles[farmer_id]
            return FarmerProfileResponse(
                id=farmer_id,
                full_name=row.get("full_name"),
                preferred_language=row.get("preferred_language", "en"),
                phone=row.get("phone"),
                created_at=datetime.fromisoformat(row["created_at"]),
            )
        return None

    def update_profile(self, farmer_id: UUID, updates: FarmerProfileUpdate) -> FarmerProfileResponse | None:
        update_data: dict[str, Any] = {}
        if updates.full_name is not None:
            update_data["full_name"] = updates.full_name
        if updates.preferred_language is not None:
            update_data["preferred_language"] = updates.preferred_language
        if updates.phone is not None:
            update_data["phone"] = updates.phone

        if not update_data:
            return self.get_profile(farmer_id)

        try:
            res = self.client.table("farmer_profile").update(update_data).eq("id", str(farmer_id)).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return FarmerProfileResponse(
                    id=UUID(row["id"]),
                    full_name=row.get("full_name"),
                    preferred_language=row.get("preferred_language", "en"),
                    phone=row.get("phone"),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
        except Exception as exc:
            logger.warning(f"Supabase update_profile fallback to memory: {exc}")

        if farmer_id in self._profiles:
            self._profiles[farmer_id].update(update_data)
            row = self._profiles[farmer_id]
            return FarmerProfileResponse(
                id=farmer_id,
                full_name=row.get("full_name"),
                preferred_language=row.get("preferred_language", "en"),
                phone=row.get("phone"),
                created_at=datetime.fromisoformat(row["created_at"]),
            )
        return None

    # --- Farm Operations ---
    def create_farm(self, data: FarmCreate) -> FarmResponse:
        grid = snap_to_grid(data.lat, data.lon)
        now = datetime.now(timezone.utc)
        payload: dict[str, Any] = {
            "farmer_id": str(data.farmer_id),
            "name": data.name,
            "lat": float(data.lat),
            "lon": float(data.lon),
            "grid_key": grid.grid_key,
            "state": data.state,
            "district": data.district,
            "soil_type": data.soil_type,
            "soil_source": data.soil_source,
            "soil_npk": data.soil_npk.model_dump() if hasattr(data.soil_npk, "model_dump") else data.soil_npk,
            "irrigation_type": data.irrigation_type,
            "field_size_acres": float(data.field_size_acres) if data.field_size_acres is not None else None,
            "created_at": now.isoformat(),
        }

        try:
            res = self.client.table("farms").insert(payload).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return FarmResponse(
                    id=row["id"],
                    farmer_id=UUID(row["farmer_id"]),
                    name=row["name"],
                    lat=row["lat"],
                    lon=row["lon"],
                    grid_key=row["grid_key"],
                    state=row["state"],
                    district=row["district"],
                    soil_type=row.get("soil_type"),
                    soil_source=row.get("soil_source", "farmer_input"),
                    soil_npk=row.get("soil_npk"),
                    irrigation_type=row.get("irrigation_type"),
                    field_size_acres=row.get("field_size_acres"),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
        except Exception as exc:
            logger.warning(f"Supabase create_farm fallback to memory: {exc}")

        FarmerRepository._shared_farm_id_counter += 1
        farm_id = FarmerRepository._shared_farm_id_counter
        payload["id"] = farm_id
        self._farms[farm_id] = payload
        return FarmResponse(
            id=farm_id,
            farmer_id=data.farmer_id,
            name=data.name,
            lat=data.lat,
            lon=data.lon,
            grid_key=grid.grid_key,
            state=data.state,
            district=data.district,
            soil_type=data.soil_type,
            soil_source=data.soil_source,
            soil_npk=payload["soil_npk"],
            irrigation_type=data.irrigation_type,
            field_size_acres=data.field_size_acres,
            created_at=now,
        )

    def get_farms(self, farmer_id: UUID) -> list[FarmResponse]:
        try:
            res = self.client.table("farms").select("*").eq("farmer_id", str(farmer_id)).execute()
            if res.data:
                return [
                    FarmResponse(
                        id=row["id"],
                        farmer_id=UUID(row["farmer_id"]),
                        name=row["name"],
                        lat=row["lat"],
                        lon=row["lon"],
                        grid_key=row["grid_key"],
                        state=row["state"],
                        district=row["district"],
                        soil_type=row.get("soil_type"),
                        soil_source=row.get("soil_source", "farmer_input"),
                        soil_npk=row.get("soil_npk"),
                        irrigation_type=row.get("irrigation_type"),
                        field_size_acres=row.get("field_size_acres"),
                        created_at=datetime.fromisoformat(row["created_at"]),
                    )
                    for row in res.data
                ]
        except Exception as exc:
            logger.warning(f"Supabase get_farms fallback: {exc}")

        results: list[FarmResponse] = []
        for row in self._farms.values():
            if str(row["farmer_id"]) == str(farmer_id):
                results.append(
                    FarmResponse(
                        id=row["id"],
                        farmer_id=UUID(str(row["farmer_id"])),
                        name=row["name"],
                        lat=row["lat"],
                        lon=row["lon"],
                        grid_key=row["grid_key"],
                        state=row["state"],
                        district=row["district"],
                        soil_type=row.get("soil_type"),
                        soil_source=row.get("soil_source", "farmer_input"),
                        soil_npk=row.get("soil_npk"),
                        irrigation_type=row.get("irrigation_type"),
                        field_size_acres=row.get("field_size_acres"),
                        created_at=datetime.fromisoformat(row["created_at"]),
                    )
                )
        return results

    def get_farm(self, farm_id: int) -> FarmResponse | None:
        try:
            res = self.client.table("farms").select("*").eq("id", farm_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return FarmResponse(
                    id=row["id"],
                    farmer_id=UUID(row["farmer_id"]),
                    name=row["name"],
                    lat=row["lat"],
                    lon=row["lon"],
                    grid_key=row["grid_key"],
                    state=row["state"],
                    district=row["district"],
                    soil_type=row.get("soil_type"),
                    soil_source=row.get("soil_source", "farmer_input"),
                    soil_npk=row.get("soil_npk"),
                    irrigation_type=row.get("irrigation_type"),
                    field_size_acres=row.get("field_size_acres"),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
        except Exception as exc:
            logger.warning(f"Supabase get_farm fallback: {exc}")

        if farm_id in self._farms:
            row = self._farms[farm_id]
            return FarmResponse(
                id=row["id"],
                farmer_id=UUID(str(row["farmer_id"])),
                name=row["name"],
                lat=row["lat"],
                lon=row["lon"],
                grid_key=row["grid_key"],
                state=row["state"],
                district=row["district"],
                soil_type=row.get("soil_type"),
                soil_source=row.get("soil_source", "farmer_input"),
                soil_npk=row.get("soil_npk"),
                irrigation_type=row.get("irrigation_type"),
                field_size_acres=row.get("field_size_acres"),
                created_at=datetime.fromisoformat(row["created_at"]),
            )
        return None

    # --- Farm Crop Operations ---
    def add_crop(self, data: FarmCropCreate) -> FarmCropResponse:
        payload = {
            "farm_id": data.farm_id,
            "crop": data.crop,
            "variety": data.variety,
            "sowing_date": data.sowing_date.isoformat(),
            "season": data.season,
            "status": data.status or "active",
        }
        try:
            res = self.client.table("farm_crops").insert(payload).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return FarmCropResponse(
                    id=row["id"],
                    farm_id=row["farm_id"],
                    crop=row["crop"],
                    variety=row.get("variety"),
                    sowing_date=datetime.fromisoformat(row["sowing_date"]).date(),
                    season=row.get("season"),
                    status=row.get("status", "active"),
                )
        except Exception as exc:
            logger.warning(f"Supabase add_crop fallback to memory: {exc}")

        FarmerRepository._shared_crop_id_counter += 1
        crop_id = FarmerRepository._shared_crop_id_counter
        payload["id"] = crop_id
        self._crops[crop_id] = payload
        return FarmCropResponse(
            id=crop_id,
            farm_id=data.farm_id,
            crop=data.crop,
            variety=data.variety,
            sowing_date=data.sowing_date,
            season=data.season,
            status=data.status or "active",
        )

    def get_crops(self, farm_id: int, status: str | None = None) -> list[FarmCropResponse]:
        try:
            q = self.client.table("farm_crops").select("*").eq("farm_id", farm_id)
            if status:
                q = q.eq("status", status)
            res = q.execute()
            if res.data:
                return [
                    FarmCropResponse(
                        id=row["id"],
                        farm_id=row["farm_id"],
                        crop=row["crop"],
                        variety=row.get("variety"),
                        sowing_date=datetime.fromisoformat(row["sowing_date"]).date(),
                        season=row.get("season"),
                        status=row.get("status", "active"),
                    )
                    for row in res.data
                ]
        except Exception as exc:
            logger.warning(f"Supabase get_crops fallback: {exc}")

        results: list[FarmCropResponse] = []
        for row in self._crops.values():
            if row["farm_id"] == farm_id and (status is None or row.get("status") == status):
                sowing_val = row["sowing_date"]
                s_date = sowing_val if isinstance(sowing_val, type(datetime.now().date())) else datetime.fromisoformat(sowing_val).date()
                results.append(
                    FarmCropResponse(
                        id=row["id"],
                        farm_id=row["farm_id"],
                        crop=row["crop"],
                        variety=row.get("variety"),
                        sowing_date=s_date,
                        season=row.get("season"),
                        status=row.get("status", "active"),
                    )
                )
        return results

    # --- Unified Multi-Step Onboarding ---
    def onboard(self, req: OnboardingRequest) -> OnboardingResponse:
        farmer_id = req.farmer_id or uuid4()
        profile_req = FarmerProfileCreate(
            id=farmer_id,
            full_name=req.full_name,
            preferred_language=req.preferred_language,
            phone=req.phone,
        )
        profile = self.create_profile(profile_req)

        farm_req = FarmCreate(
            farmer_id=profile.id,
            name=req.farm_name,
            lat=req.lat,
            lon=req.lon,
            state=req.state,
            district=req.district,
            soil_type=req.soil_type,
            soil_npk=req.soil_npk,
            irrigation_type=req.irrigation_type,
            field_size_acres=req.field_size_acres,
        )
        farm = self.create_farm(farm_req)

        crops: list[FarmCropResponse] = []
        for crop_input in req.crops:
            crop_req = FarmCropCreate(
                farm_id=farm.id,
                crop=crop_input.crop,
                variety=crop_input.variety,
                sowing_date=crop_input.sowing_date,
                season=crop_input.season,
            )
            crops.append(self.add_crop(crop_req))

        return OnboardingResponse(profile=profile, farm=farm, crops=crops)
