export interface PriceContextBlock {
  commodity: string;
  market: string;
  state: string;
  latest_modal_price: number | null;
  change_7d_pct: number | null;
  change_30d_pct: number | null;
  volatility_pct: number | null;
  coverage_ratio: number;
  days_requested: number;
  stale: boolean;
}

export interface WeatherContextBlock {
  grid_key: string;
  district: string;
  state: string;
  rain_7d_mm: number;
  rain_30d_mm: number;
  rain_30d_vs_normal_pct: number | null;
  dry_spell_days: number;
  tmax_7d_anomaly_c: number | null;
  et0_7d_mm: number | null;
  confidence: 'high' | 'medium' | 'low';
  stale: boolean;
}

export interface SignalDetail {
  rule: string;
  name: string;
  strength: 'advisory' | 'info';
  text: string;
  evidence: Record<string, any>;
}

export interface ContextMarketWeatherResponse {
  as_of: string;
  stale: boolean;
  degraded: boolean;
  price: PriceContextBlock;
  weather: WeatherContextBlock;
  signals: SignalDetail[];
}

export async function fetchMarketWeatherContext(params: {
  commodity: string;
  market: string;
  state?: string;
  days?: number;
}): Promise<ContextMarketWeatherResponse> {
  const query = new URLSearchParams();
  query.set('commodity', params.commodity);
  query.set('market', params.market);
  if (params.state) query.set('state', params.state);
  if (params.days) query.set('days', params.days.toString());

  const res = await fetch(`/api/context/market-weather?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch market-weather context: ${res.statusText}`);
  }
  return res.json();
}
