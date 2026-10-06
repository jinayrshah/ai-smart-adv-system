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
}

export interface StageResult {
  crop: string;
  stage_name: string;
  stage_order: number;
  cumulative_gdd: number;
  days_since_sowing: number;
  method: 'gdd' | 'calendar_fallback';
  source: string;
  next_stage_name?: string | null;
  gdd_remaining_in_stage?: number | null;
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
}

export interface SoilFlag {
  flag_type: 'soil_type_mismatch' | 'ph_out_of_range' | 'low_nitrogen' | 'low_phosphorus' | 'low_potassium' | 'high_nitrogen';
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
  climate: ClimateVerdict;
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
  if (!res.ok) throw new Error('Failed to generate farm agronomic diagnostic');
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
