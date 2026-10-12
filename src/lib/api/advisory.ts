/**
 * Frontend API client for Agronomy Computation Engines.
 * Connects to /api/advisory/* via the Express proxy to FastAPI.
 */

export interface CropStageNorm {
  crop: string;
  stage_order: number;
  stage_name: string;
  gdd_base_c: number;
  gdd_cumulative_at_stage_end: number;
  typical_days_fallback?: number;
  source: string;
  gdd_upper_c?: number | null;
}

export interface StageResult {
  crop: string;
  stage_name: string;
  stage_order: number;
  /** null under the calendar fallback — thermal time was not measured */
  cumulative_gdd: number | null;
  days_since_sowing: number;
  method: 'gdd' | 'calendar_fallback';
  source: string;
  next_stage_name?: string | null;
  gdd_remaining_in_stage?: number | null;
  weather_coverage_pct?: number | null;
  imputed_days?: number;
  stage_progress_pct?: number | null;
  gdd_upper_c?: number | null;
}

export interface IrrigationAdvice {
  crop: string;
  stage_name: string;
  kc: number;
  etc_today_mm: number;
  etc_7d_mm: number;
  rain_7d_mm: number;
  deficit_mm: number;
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  method?: 'fao56_water_balance' | '7day_deficit' | 'insufficient_data';
  data_available?: boolean;
  effective_rain_7d_mm?: number | null;
  root_zone_depletion_mm?: number | null;
  taw_mm?: number | null;
  raw_mm?: number | null;
  root_depth_m?: number | null;
  days_to_stress?: number | null;
  forecast_rain_3d_mm?: number | null;
  forecast_rain_prob_max_pct?: number | null;
  net_irrigation_mm?: number | null;
  gross_irrigation_mm?: number | null;
  action?: 'irrigate_now' | 'wait_for_rain' | 'no_irrigation_needed' | 'monitor' | 'unknown';
  assumptions?: string[];
}

export interface SoilFlag {
  flag_type:
    | 'soil_type_mismatch'
    | 'ph_out_of_range'
    | 'low_nitrogen'
    | 'low_phosphorus'
    | 'low_potassium'
    | 'high_nitrogen'
    | 'low_organic_carbon';
  actual_value: any;
  expected: any;
  notes?: string | null;
  source: string;
}

export interface ClimateVerdict {
  crop: string;
  stage_name?: string | null;
  verdict: 'suitable' | 'marginal' | 'unsuitable';
  observed_temp_c: number;
  observed_humidity_pct?: number | null;
  ideal_temp_range: [number, number];
  ideal_humidity_range?: [number, number] | null;
  margin_c: number;
  reading_source: 'weather_forecast' | 'iot_live' | 'manual_input';
  notes?: string | null;
  source: string;
}

export interface AgronomyDiagnosticResponse {
  crop: string;
  farm_id?: string | null;
  farm_name?: string | null;
  sowing_date: string;
  as_of: string;
  stage: StageResult;
  irrigation: IrrigationAdvice;
  soil_flags: SoilFlag[];
  /** null when no temperature reading exists for the farm's grid */
  climate: ClimateVerdict | null;
  irrigation_events_logged?: number;
}

export interface IrrigationEvent {
  id: number;
  farm_id: number;
  farm_crop_id?: number | null;
  irrigated_on: string;
  amount_mm: number;
  method?: string | null;
  note?: string | null;
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

export async function logIrrigation(
  farmId: string | number,
  event: { irrigated_on: string; amount_mm: number; farm_crop_id?: number | null; note?: string },
): Promise<IrrigationEvent> {
  const res = await fetch(`/api/farmer/farms/${farmId}/irrigation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Could not save the irrigation entry');
  }
  return res.json();
}

export async function fetchIrrigationLog(farmId: string | number): Promise<IrrigationEvent[]> {
  const res = await fetch(`/api/farmer/farms/${farmId}/irrigation`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Could not load the irrigation log');
  return res.json();
}

export async function fetchCrops(): Promise<string[]> {
  const res = await fetch('/api/advisory/crops');
  if (!res.ok) throw new Error('Failed to fetch crops list');
  return res.json();
}

export async function fetchCropStages(crop: string): Promise<CropStageNorm[]> {
  const res = await fetch(`/api/advisory/crops/${encodeURIComponent(crop)}/stages`);
  if (!res.ok) throw new Error(`Failed to fetch stages for ${crop}`);
  return res.json();
}

export async function computeGrowthStage(params: {
  crop: string;
  sowingDate: string;
  lat?: number;
  lon?: number;
  asOf?: string;
}): Promise<StageResult> {
  const query = new URLSearchParams({
    crop: params.crop,
    sowing_date: params.sowingDate,
    ...(params.lat !== undefined ? { lat: params.lat.toString() } : {}),
    ...(params.lon !== undefined ? { lon: params.lon.toString() } : {}),
    ...(params.asOf ? { as_of: params.asOf } : {}),
  });

  const res = await fetch(`/api/advisory/stage?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to compute crop growth stage');
  return res.json();
}

export async function computeIrrigation(params: {
  crop: string;
  stageName: string;
  lat?: number;
  lon?: number;
}): Promise<IrrigationAdvice> {
  const query = new URLSearchParams({
    crop: params.crop,
    stage_name: params.stageName,
    ...(params.lat !== undefined ? { lat: params.lat.toString() } : {}),
    ...(params.lon !== undefined ? { lon: params.lon.toString() } : {}),
  });

  const res = await fetch(`/api/advisory/water?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to compute water requirement');
  return res.json();
}

export async function checkSoilSuitability(payload: {
  crop: string;
  soil_type?: string;
  shc_n?: number;
  shc_p?: number;
  shc_k?: number;
  shc_ph?: number;
}): Promise<SoilFlag[]> {
  const res = await fetch('/api/advisory/soil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to check soil suitability');
  return res.json();
}

export async function checkClimateSuitability(params: {
  crop: string;
  stageName?: string;
  tempC?: number;
  humidityPct?: number;
  lat?: number;
  lon?: number;
}): Promise<ClimateVerdict> {
  const query = new URLSearchParams({
    crop: params.crop,
    ...(params.stageName ? { stage_name: params.stageName } : {}),
    ...(params.tempC !== undefined ? { temp_c: params.tempC.toString() } : {}),
    ...(params.humidityPct !== undefined ? { humidity_pct: params.humidityPct.toString() } : {}),
    ...(params.lat !== undefined ? { lat: params.lat.toString() } : {}),
    ...(params.lon !== undefined ? { lon: params.lon.toString() } : {}),
  });

  const res = await fetch(`/api/advisory/climate?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to check climate suitability');
  return res.json();
}

export async function fetchFarmDiagnostic(
  farmId: string,
  cropId?: string
): Promise<AgronomyDiagnosticResponse> {
  const query = new URLSearchParams({
    farm_id: farmId,
    ...(cropId ? { crop_id: cropId } : {}),
  });

  const res = await fetch(`/api/advisory/diagnostic?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Failed to generate farm agronomic diagnostic');
  }
  return res.json();
}

export interface AdvisorySource {
  title: string;
  page?: number | null;
  url?: string | null;
}

export interface AdvisoryComputedContext {
  growth_stage?: StageResult | null;
  irrigation?: IrrigationAdvice | null;
  soil_flags?: SoilFlag[];
  climate?: ClimateVerdict | null;
  /** inputs that were defaulted because the farmer has not provided them */
  assumptions?: string[];
}

export interface AdvisoryAskRequest {
  farm_id?: number | null;
  crop?: string | null;
  query: string;
  farmer_id?: string | null;
  language?: string;
  sowing_date?: string | null;
  soil_type?: string | null;
  lat?: number | null;
  lon?: number | null;
  disease_label?: string | null;
}

export interface AdvisoryAskResponse {
  id: number;
  response: string;
  confidence: 'grounded' | 'partial' | 'insufficient';
  sources: AdvisorySource[];
  computed: AdvisoryComputedContext;
  retrieved_chunk_ids: number[];
  ungrounded_numbers?: string[];
  generated_by?: string;
}

export interface AdvisoryFeedbackResponse {
  id: number;
  feedback: number;
  status: string;
}

export async function askAdvisory(payload: AdvisoryAskRequest): Promise<AdvisoryAskResponse> {
  const res = await fetch('/api/advisory/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to get advisory response');
  }
  return res.json();
}

export async function sendAdvisoryFeedback(
  queryId: number,
  feedback: 1 | -1
): Promise<AdvisoryFeedbackResponse> {
  const res = await fetch(`/api/advisory/queries/${queryId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) {
    throw new Error('Failed to submit advisory feedback');
  }
  return res.json();
}

export interface DiseaseTreatmentExtract {
  source_title: string;
  page_number?: number | null;
  treatment_text: string;
  similarity: number;
}

export interface DiseaseCheckResponse {
  crop: string;
  label: string;
  scientific_name?: string | null;
  confidence: number;
  confidence_status: 'high' | 'moderate' | 'low';
  advisory_note: string;
  treatments: DiseaseTreatmentExtract[];
  /** 'unavailable' = no trained model installed (no diagnosis given); 'rejected' = photo unusable */
  status?: 'model' | 'unavailable' | 'rejected';
  model_version?: string | null;
  top_k?: Array<{ label: string; confidence: number; display_name?: string }>;
}

export async function checkCropDisease(
  file: File,
  crop?: string,
  farmId?: number
): Promise<DiseaseCheckResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (crop) formData.append('crop', crop);
  if (farmId !== undefined && farmId !== null) formData.append('farm_id', farmId.toString());

  const res = await fetch('/api/advisory/disease-check', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to analyze crop leaf photo');
  }
  return res.json();
}

export interface GovernmentScheme {
  code: string;
  name: string;
  category:
    | 'income_support'
    | 'crop_insurance'
    | 'credit_finance'
    | 'soil_health'
    | 'infrastructure'
    | 'organic_farming';
  benefit_summary: string;
  eligibility: string;
  application_process: string;
  official_portal: string;
}

export interface SchemeAskRequest {
  query: string;
  scheme_code?: string | null;
  language?: string;
}

export interface SchemeAskResponse {
  query: string;
  answer: string;
  confidence: 'grounded' | 'partial' | 'insufficient';
  schemes: GovernmentScheme[];
  sources: AdvisorySource[];
}

export async function fetchGovernmentSchemes(params?: {
  query?: string;
  category?: string;
}): Promise<GovernmentScheme[]> {
  const query = new URLSearchParams({
    ...(params?.query ? { query: params.query } : {}),
    ...(params?.category ? { category: params.category } : {}),
  });
  const res = await fetch(`/api/advisory/schemes/catalog?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch government schemes catalog');
  return res.json();
}

export async function askSchemeAdvisory(payload: SchemeAskRequest): Promise<SchemeAskResponse> {
  const res = await fetch('/api/advisory/schemes/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to get government scheme advice');
  }
  return res.json();
}
