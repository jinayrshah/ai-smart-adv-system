from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field


SoilSource = Literal["farmer_input", "soil_health_card", "district_default", "soilgrids"]
IrrigationType = Literal["borewell", "canal", "rainfed", "drip", "sprinkler", "other"]
CropStatus = Literal["active", "harvested", "failed"]


class SoilNpk(BaseModel):
    n: float | None = Field(None, description="Nitrogen kg/ha or rating")
    p: float | None = Field(None, description="Phosphorus kg/ha or rating")
    k: float | None = Field(None, description="Potassium kg/ha or rating")
    ph: float | None = Field(None, description="Soil pH value")


# --- Farmer Profile Schemas ---
class FarmerProfileCreate(BaseModel):
    id: UUID | None = Field(None, description="Supabase auth UUID or generated ID")
    full_name: str | None = Field(None, description="Farmer full name")
    preferred_language: str = Field("en", description="BCP-47 or Indic code (e.g., en, hi, mr, gu)")
    phone: str | None = Field(None, description="Primary contact phone number")


class FarmerProfileUpdate(BaseModel):
    full_name: str | None = None
    preferred_language: str | None = None
    phone: str | None = None


class FarmerProfileResponse(BaseModel):
    id: UUID
    full_name: str | None = None
    preferred_language: str = "en"
    phone: str | None = None
    created_at: datetime


# --- Farm Schemas ---
class FarmCreate(BaseModel):
    farmer_id: UUID
    name: str = "My farm"
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    state: str = ""   # empty = not specified
    district: str = ""  # empty = not specified
    soil_type: str | None = Field(None, description="e.g. loamy, sandy, clay, black cotton")
    soil_source: SoilSource = "farmer_input"
    soil_npk: SoilNpk | dict[str, Any] | None = None
    irrigation_type: IrrigationType | None = None
    field_size_acres: float | None = Field(None, ge=0.0)


class FarmUpdate(BaseModel):
    name: str | None = None
    lat: float | None = Field(None, ge=-90.0, le=90.0)
    lon: float | None = Field(None, ge=-180.0, le=180.0)
    state: str | None = None
    district: str | None = None
    soil_type: str | None = None
    soil_source: SoilSource | None = None
    soil_npk: SoilNpk | dict[str, Any] | None = None
    irrigation_type: IrrigationType | None = None
    field_size_acres: float | None = Field(None, ge=0.0)


class FarmResponse(BaseModel):
    id: int
    farmer_id: UUID
    name: str
    lat: float
    lon: float
    grid_key: str
    state: str | None = None
    district: str | None = None
    soil_type: str | None = None
    soil_source: SoilSource = "farmer_input"
    soil_npk: dict[str, Any] | None = None
    irrigation_type: IrrigationType | None = None
    field_size_acres: float | None = None
    created_at: datetime


# --- Farm Crop Schemas ---
class FarmCropCreate(BaseModel):
    farm_id: int
    crop: str
    variety: str | None = None
    sowing_date: date | None = None  # None = planning stage, not yet sown
    season: str | None = Field(None, description="kharif, rabi, zaid")
    status: CropStatus = "active"


class FarmCropUpdate(BaseModel):
    crop: str | None = None
    variety: str | None = None
    sowing_date: date | None = None
    season: str | None = None
    status: CropStatus | None = None


class FarmCropResponse(BaseModel):
    id: int
    farm_id: int
    crop: str
    variety: str | None = None
    sowing_date: date | None = None
    season: str | None = None
    status: CropStatus = "active"


# --- Combined Multi-Step Onboarding Schema ---
class OnboardingCropInput(BaseModel):
    crop: str
    variety: str | None = None
    # None means the farmer is in a planning stage and hasn't sown yet
    sowing_date: date | None = None
    season: str | None = None


class OnboardingRequest(BaseModel):
    farmer_id: UUID | None = None
    full_name: str | None = None
    preferred_language: str = "en"
    phone: str | None = None
    farm_name: str = "My farm"
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    state: str | None = None
    district: str | None = None
    soil_type: str | None = None
    soil_npk: SoilNpk | dict[str, Any] | None = None
    irrigation_type: IrrigationType | None = None
    field_size_acres: float | None = None
    crops: list[OnboardingCropInput] = Field(default_factory=list)


class OnboardingResponse(BaseModel):
    profile: FarmerProfileResponse
    farm: FarmResponse
    crops: list[FarmCropResponse]


# --- Irrigation log (feeds the FAO-56 water balance) ---
class IrrigationEventCreate(BaseModel):
    irrigated_on: date
    amount_mm: float = Field(..., gt=0.0, le=300.0, description="Depth of water applied, mm")
    farm_crop_id: int | None = None
    method: IrrigationType | None = None
    note: str | None = Field(None, max_length=300)


class IrrigationEventResponse(IrrigationEventCreate):
    id: int
    farm_id: int
