export interface FarmerProfile {
  id: string;
  full_name: string | null;
  preferred_language: string;
  phone: string | null;
  created_at?: string;
}

export interface Farm {
  id: number;
  farmer_id: string;
  name: string;
  lat: number;
  lon: number;
  grid_key: string;
  state: string;
  district: string;
  soil_type?: string | null;
  soil_source: 'farmer_input' | 'soil_health_card' | 'district_default' | 'soilgrids';
  soil_npk?: {
    n?: number | null;
    p?: number | null;
    k?: number | null;
    ph?: number | null;
  } | null;
  irrigation_type?: 'borewell' | 'canal' | 'rainfed' | 'drip' | 'sprinkler' | 'other' | null;
  field_size_acres?: number | null;
  created_at?: string;
}

export interface FarmCrop {
  id: number;
  farm_id: number;
  crop: string;
  variety?: string | null;
  sowing_date: string;
  season?: string | null;
  status: 'active' | 'harvested' | 'failed';
}

export interface OnboardingPayload {
  farmer_id?: string;
  full_name?: string;
  preferred_language?: string;
  phone?: string;
  farm_name?: string;
  lat: number;
  lon: number;
  state: string;
  district: string;
  soil_type?: string;
  soil_npk?: {
    n?: number;
    p?: number;
    k?: number;
    ph?: number;
  };
  irrigation_type?: string;
  field_size_acres?: number;
  crops: Array<{
    crop: string;
    variety?: string;
    sowing_date: string;
    season?: string;
  }>;
}

export interface OnboardingResult {
  profile: FarmerProfile;
  farm: Farm;
  crops: FarmCrop[];
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('agri_auth_token');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

export async function submitOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  const res = await fetch('/api/farmer/onboard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit farmer onboarding');
  }
  return res.json();
}

export async function fetchFarmerProfile(farmerId: string): Promise<FarmerProfile> {
  const res = await fetch(`/api/farmer/profile/${farmerId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch farmer profile');
  }
  return res.json();
}

export async function fetchFarmerFarms(farmerId: string): Promise<Farm[]> {
  const res = await fetch(`/api/farmer/farms?farmer_id=${encodeURIComponent(farmerId)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch farmer farms');
  }
  return res.json();
}

export async function fetchFarmCrops(farmId: number): Promise<FarmCrop[]> {
  const res = await fetch(`/api/farmer/farms/${farmId}/crops?status=active`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch farm crops');
  }
  return res.json();
}
