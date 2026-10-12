import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import require_self_or_dev
from app.data.farmer.repository import FarmerRepository
from app.schemas.farmer import (
    FarmerProfileCreate,
    FarmerProfileUpdate,
    FarmerProfileResponse,
    FarmCreate,
    FarmUpdate,
    FarmResponse,
    FarmCropCreate,
    FarmCropResponse,
    IrrigationEventCreate,
    IrrigationEventResponse,
    OnboardingRequest,
    OnboardingResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/farmer", tags=["Farmer & Onboarding"])

_farmer_repo: FarmerRepository | None = None


def get_farmer_repo() -> FarmerRepository:
    global _farmer_repo
    if _farmer_repo is None:
        _farmer_repo = FarmerRepository()
    return _farmer_repo


def _assert_owns_farmer(caller: UUID | None, farmer_id: UUID) -> None:
    """Raise 403 when auth is active and the caller is not the profile owner."""
    if caller is not None and caller != farmer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you can only access your own profile.",
        )


# ---------------------------------------------------------------------------
# Profile Endpoints
# ---------------------------------------------------------------------------

@router.post("/profile", response_model=FarmerProfileResponse, status_code=status.HTTP_201_CREATED)
def create_farmer_profile(
    profile: FarmerProfileCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Create or initialize farmer profile (Architecture §6).
    When auth is active the caller can only create a profile for themselves
    (profile.farmer_id must match the JWT sub).
    """
    if caller is not None and profile.id and profile.id != caller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create a profile for your own account.",
        )
    return repo.create_profile(profile)


@router.get("/profile/{farmer_id}", response_model=FarmerProfileResponse)
def get_farmer_profile(
    farmer_id: UUID,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Fetch farmer profile by UUID.
    Ownership enforced when SUPABASE_JWT_SECRET is set.
    """
    _assert_owns_farmer(caller, farmer_id)
    profile = repo.get_profile(farmer_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
    return profile


@router.patch("/profile/{farmer_id}", response_model=FarmerProfileResponse)
def update_farmer_profile(
    farmer_id: UUID,
    updates: FarmerProfileUpdate,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Update farmer name, preferred language, or contact phone.
    Ownership enforced when SUPABASE_JWT_SECRET is set.
    """
    _assert_owns_farmer(caller, farmer_id)
    profile = repo.update_profile(farmer_id, updates)
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
    return profile


# ---------------------------------------------------------------------------
# Farms Endpoints
# ---------------------------------------------------------------------------

@router.post("/farms", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(
    farm: FarmCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Register a new plot/farm location. Automatically computes grid_key.
    """
    # A farm must belong to the caller's farmer profile
    if caller is not None and hasattr(farm, "farmer_id") and farm.farmer_id and farm.farmer_id != caller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create farms under your own profile.",
        )
    return repo.create_farm(farm)


@router.get("/farms", response_model=list[FarmResponse])
def list_farms(
    farmer_id: UUID = Query(..., description="Farmer profile UUID"),
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    List all plots/farms owned by a farmer.
    Ownership enforced when SUPABASE_JWT_SECRET is set.
    """
    _assert_owns_farmer(caller, farmer_id)
    return repo.get_farms(farmer_id)


@router.get("/farms/{farm_id}", response_model=FarmResponse)
def get_farm(
    farm_id: int,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Get detailed plot/farm data by farm ID.
    When auth is active we verify the farm belongs to the caller.
    """
    farm = repo.get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    # Verify ownership through the farmer_id on the returned farm record
    if caller is not None:
        owner_id = getattr(farm, "farmer_id", None)
        if owner_id and UUID(str(owner_id)) != caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: this farm does not belong to you.",
            )
    return farm


# ---------------------------------------------------------------------------
# Crop Endpoints
# ---------------------------------------------------------------------------

@router.post("/farms/{farm_id}/crops", response_model=FarmCropResponse, status_code=status.HTTP_201_CREATED)
def add_farm_crop(
    farm_id: int,
    crop_data: FarmCropCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Associate a crop, variety, and sowing date with a farm plot.
    """
    if caller is not None:
        farm = repo.get_farm(farm_id)
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")
        owner_id = getattr(farm, "farmer_id", None)
        if owner_id and UUID(str(owner_id)) != caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: this farm does not belong to you.",
            )
    if crop_data.farm_id != farm_id:
        crop_data.farm_id = farm_id
    return repo.add_crop(crop_data)


@router.get("/farms/{farm_id}/crops", response_model=list[FarmCropResponse])
def list_farm_crops(
    farm_id: int,
    status: str | None = Query(None, description="Crop status filter (active, harvested, failed)"),
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    List active or all crops on a farm.
    """
    if caller is not None:
        farm = repo.get_farm(farm_id)
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")
        owner_id = getattr(farm, "farmer_id", None)
        if owner_id and UUID(str(owner_id)) != caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: this farm does not belong to you.",
            )
    return repo.get_crops(farm_id, status=status)


# ---------------------------------------------------------------------------
# Irrigation log (feeds the FAO-56 water balance, Architecture §8)
# ---------------------------------------------------------------------------

@router.post(
    "/farms/{farm_id}/irrigation",
    response_model=IrrigationEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def log_irrigation(
    farm_id: int,
    event: IrrigationEventCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """Record water applied to a farm so the irrigation advice accounts for it."""
    farm = repo.get_farm(farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller is not None:
        owner_id = getattr(farm, "farmer_id", None)
        if owner_id and UUID(str(owner_id)) != caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: this farm does not belong to you.",
            )
    from app.core.timeutil import today_ist
    if event.irrigated_on > today_ist():
        raise HTTPException(status_code=422, detail="Irrigation date cannot be in the future")
    return repo.log_irrigation(farm_id, event)


@router.get("/farms/{farm_id}/irrigation", response_model=list[IrrigationEventResponse])
def list_irrigation(
    farm_id: int,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    farm = repo.get_farm(farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if caller is not None:
        owner_id = getattr(farm, "farmer_id", None)
        if owner_id and UUID(str(owner_id)) != caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: this farm does not belong to you.",
            )
    return repo.get_irrigation_events(farm_id)


# ---------------------------------------------------------------------------
# Multi-Step Onboarding Endpoint
# ---------------------------------------------------------------------------

@router.post("/onboard", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
def onboard_farmer(
    onboarding: OnboardingRequest,
    repo: FarmerRepository = Depends(get_farmer_repo),
    caller: UUID | None = Depends(require_self_or_dev),
):
    """
    Multi-step single transaction onboarding endpoint (Architecture §6):
    Creates farmer profile -> creates primary farm with grid_key -> registers initial crops.
    When auth is active the onboarding request must be for the caller's own UUID.
    """
    if caller is not None and hasattr(onboarding, "farmer_id") and onboarding.farmer_id:
        if onboarding.farmer_id != caller:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only onboard your own account.",
            )
    return repo.onboard(onboarding)
