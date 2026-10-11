export interface WeatherLocationInfo {
  id: number | null;
  name: string;
  state: string;
  district: string;
  grid_key: string;
  lat?: number | null;
  lon?: number | null;
}

export interface CurrentWeatherDetail {
  observed_at: string;
  temp_c: number | null;
  rh_pct: number | null;
  wind_kmh: number | null;
  precip_mm_1h: number | null;
  weather_code: number | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  cross_check?: Record<string, any>;
}

export interface FusedDayDetail {
  date: string;
  phase: 'past' | 'today' | 'future';
  tmax_c: number | null;
  tmin_c: number | null;
  precip_mm: number | null;
  precip_prob_pct: number | null;
  rh_mean_pct: number | null;
  radiation_mj_m2?: number | null;
  et0_mm?: number | null;
  primary_source: string;
  validators: string[];
  confidence: 'high' | 'medium' | 'low';
  degraded: boolean;
  disagreement: Record<string, any> | null;
}

export interface AgroMetricsDetail {
  rain_7d_mm: number;
  rain_30d_mm: number;
  rain_30d_vs_normal_pct: number | null;
  dry_spell_days: number;
  tmax_7d_anomaly_c: number | null;
  et0_7d_mm: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** days of each window actually on file (backend reports coverage honestly) */
  days_in_7d_window?: number | null;
  days_in_30d_window?: number | null;
}

export interface WeatherSummaryResponse {
  location: WeatherLocationInfo;
  as_of: string;
  stale: boolean;
  degraded: boolean;
  current: CurrentWeatherDetail | null;
  days: FusedDayDetail[];
  metrics: AgroMetricsDetail;
}

export async function fetchWeatherSummary(params: {
  locationId?: number;
  lat?: number;
  lon?: number;
  mandi?: string;
  state?: string;
}): Promise<WeatherSummaryResponse> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('location_id', params.locationId.toString());
  if (params.lat !== undefined) query.set('lat', params.lat.toString());
  if (params.lon !== undefined) query.set('lon', params.lon.toString());
  if (params.mandi) query.set('mandi', params.mandi);
  if (params.state) query.set('state', params.state);

  const res = await fetch(`/api/weather/summary?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch weather summary: ${res.statusText}`);
  }
  const data = await res.json();
  if (!data || !data.location || !Array.isArray(data.days) || !data.metrics) {
    throw new Error("Invalid weather summary payload structure received");
  }
  return data;
}

export async function fetchWeatherCurrent(params: {
  locationId?: number;
  lat?: number;
  lon?: number;
}): Promise<{
  location: WeatherLocationInfo;
  as_of: string;
  stale: boolean;
  degraded: boolean;
  current: CurrentWeatherDetail;
}> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('location_id', params.locationId.toString());
  if (params.lat !== undefined) query.set('lat', params.lat.toString());
  if (params.lon !== undefined) query.set('lon', params.lon.toString());

  const res = await fetch(`/api/weather/current?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch current weather: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchWeatherForecast(params: {
  locationId?: number;
  lat?: number;
  lon?: number;
  days?: number;
}): Promise<{
  location: WeatherLocationInfo;
  as_of: string;
  stale: boolean;
  degraded: boolean;
  days: FusedDayDetail[];
}> {
  const query = new URLSearchParams();
  if (params.locationId) query.set('location_id', params.locationId.toString());
  if (params.lat !== undefined) query.set('lat', params.lat.toString());
  if (params.lon !== undefined) query.set('lon', params.lon.toString());
  if (params.days !== undefined) query.set('days', params.days.toString());

  const res = await fetch(`/api/weather/forecast?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch weather forecast: ${res.statusText}`);
  }
  return res.json();
}

export interface LocationSearchResult {
  name: string;
  state: string;
  district: string;
  lat: number;
  lon: number;
}

export async function searchWeatherLocations(query: string): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`/api/weather/search?query=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.warn('Weather location search failed:', err);
    return [];
  }
}

