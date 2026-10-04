export interface MarginEstimateResponse {
  crop: string;
  state: string;
  market?: string | null;
  field_size_acres: number;
  price_per_qtl: number;
  cost_c2_per_qtl: number;
  cost_a2fl_per_qtl?: number | null;
  margin_per_qtl: number;
  reference_yield_qtl_per_hectare: number;
  est_total_yield_qtl: number;
  est_total_margin: number;
  cost_year: string;
  source: string;
  notice: string;
}

export interface StorageEstimateResponse {
  crop: string;
  market: string;
  state: string;
  storable: boolean;
  current_price_per_qtl?: number | null;
  storage_cost_per_qtl_month: number;
  storage_months: number;
  typical_loss_pct_per_month?: number | null;
  net_cost_per_qtl?: number | null;
  breakeven_price_per_qtl?: number | null;
  historical_price_change_pct?: number | null;
  reason?: string | null;
  source: string;
  notice: string;
}

export async function fetchCropMargin(params: {
  crop: string;
  state: string;
  field_size_acres?: number;
  market?: string;
  price_per_qtl?: number;
}): Promise<MarginEstimateResponse | null> {
  const query = new URLSearchParams();
  query.set('crop', params.crop);
  query.set('state', params.state);
  if (params.field_size_acres !== undefined) {
    query.set('field_size_acres', params.field_size_acres.toString());
  }
  if (params.market) {
    query.set('market', params.market);
  }
  if (params.price_per_qtl !== undefined) {
    query.set('price_per_qtl', params.price_per_qtl.toString());
  }

  const res = await fetch(`/api/market/margin?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to calculate crop margin: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStorageEstimate(params: {
  crop: string;
  market: string;
  state?: string;
  storage_cost_per_qtl_per_month?: number;
  months?: number;
  current_price?: number;
}): Promise<StorageEstimateResponse> {
  const query = new URLSearchParams();
  query.set('crop', params.crop);
  query.set('market', params.market);
  if (params.state) {
    query.set('state', params.state);
  }
  if (params.storage_cost_per_qtl_per_month !== undefined) {
    query.set('storage_cost_per_qtl_per_month', params.storage_cost_per_qtl_per_month.toString());
  }
  if (params.months !== undefined) {
    query.set('months', params.months.toString());
  }
  if (params.current_price !== undefined) {
    query.set('current_price', params.current_price.toString());
  }

  const res = await fetch(`/api/market/storage-estimate?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to calculate storage estimate: ${res.statusText}`);
  }
  return res.json();
}
