import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status

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


# --- Profile Endpoints ---
@router.post("/profile", response_model=FarmerProfileResponse, status_code=status.HTTP_201_CREATED)
def create_farmer_profile(
    profile: FarmerProfileCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Create or initialize farmer profile (Architecture §6).
    """
    return repo.create_profile(profile)


@router.get("/profile/{farmer_id}", response_model=FarmerProfileResponse)
def get_farmer_profile(
    farmer_id: UUID,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Fetch farmer profile by UUID.
    """
    profile = repo.get_profile(farmer_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
    return profile


@router.patch("/profile/{farmer_id}", response_model=FarmerProfileResponse)
def update_farmer_profile(
    farmer_id: UUID,
    updates: FarmerProfileUpdate,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Update farmer name, preferred language, or contact phone.
    """
    profile = repo.update_profile(farmer_id, updates)
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")
    return profile


# --- Farms Endpoints ---
@router.post("/farms", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(
    farm: FarmCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Register a new plot/farm location. Automatically computes grid_key.
    """
    return repo.create_farm(farm)


@router.get("/farms", response_model=list[FarmResponse])
def list_farms(
    farmer_id: UUID = Query(..., description="Farmer profile UUID"),
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    List all plots/farms owned by a farmer.
    """
    return repo.get_farms(farmer_id)


@router.get("/farms/{farm_id}", response_model=FarmResponse)
def get_farm(
    farm_id: int,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Get detailed plot/farm data by farm ID.
    """
    farm = repo.get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


# --- Crop Endpoints ---
@router.post("/farms/{farm_id}/crops", response_model=FarmCropResponse, status_code=status.HTTP_201_CREATED)
def add_farm_crop(
    farm_id: int,
    crop_data: FarmCropCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Associate a crop, variety, and sowing date with a farm plot.
    """
    if crop_data.farm_id != farm_id:
        crop_data.farm_id = farm_id
    return repo.add_crop(crop_data)


@router.get("/farms/{farm_id}/crops", response_model=list[FarmCropResponse])
def list_farm_crops(
    farm_id: int,
    status: str | None = Query(None, description="Crop status filter (active, harvested, failed)"),
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    List active or all crops on a farm.
    """
    return repo.get_crops(farm_id, status=status)


# --- Irrigation log (feeds the FAO-56 water balance, Architecture §8) ---
@router.post(
    "/farms/{farm_id}/irrigation",
    response_model=IrrigationEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def log_irrigation(
    farm_id: int,
    event: IrrigationEventCreate,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """Record water applied to a farm so the irrigation advice accounts for it."""
    if repo.get_farm(farm_id) is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    from app.core.timeutil import today_ist

    if event.irrigated_on > today_ist():
        raise HTTPException(status_code=422, detail="Irrigation date cannot be in the future")
    return repo.log_irrigation(farm_id, event)


@router.get("/farms/{farm_id}/irrigation", response_model=list[IrrigationEventResponse])
def list_irrigation(
    farm_id: int,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    return repo.get_irrigation_events(farm_id)


# --- Multi-Step Onboarding Endpoint ---
@router.post("/onboard", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
def onboard_farmer(
    onboarding: OnboardingRequest,
    repo: FarmerRepository = Depends(get_farmer_repo),
):
    """
    Multi-step single transaction onboarding endpoint (Architecture §6):
    Creates farmer profile -> creates primary farm with grid_key -> registers initial crops.
    """
    return repo.onboard(onboarding)
