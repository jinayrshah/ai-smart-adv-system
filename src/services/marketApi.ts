/**
 * Typed client for Market Price and Trend API endpoints.
 * Mirrors the Pydantic schemas in backend/app/schemas/market.py.
 */

export interface DateRange {
  from: string;
  to: string;
}

export interface CoverageStats {
  expected_days: number;
  days_with_data: number;
  gaps: string[];
}

export interface TrendPoint {
  date: string;
  modal: number | null;
  min: number | null;
  max: number | null;
  n_varieties: number;
}

export interface MarketTrendResponse {
  commodity: string;
  market: string;
  state: string;
  unit: string;
  range: DateRange;
  coverage: CoverageStats;
  sources: Record<string, number>;
  as_of: string;
  stale: boolean;
  points: TrendPoint[];
  first_reported_date?: string | null;
  max_gap_days?: number;
  varieties_included?: string[];
  /** market-days with a report in the window */
  reports_in_window?: number;
  /** fewer than 3 reports: no line chart and no % change (Revisions §2.7) */
  thin_data?: boolean;
  latest_date?: string | null;
  latest_modal?: number | null;
  /** % change vs a real report ~7 / ~30 days before the latest one (null when none exists) */
  change_7d_pct?: number | null;
  change_7d_base_date?: string | null;
  change_30d_pct?: number | null;
  change_30d_base_date?: string | null;
  market_names_merged?: string[];
}

export interface MarketInsightResponse {
  status: string;
  commodity: string;
  market: string;
  state: string;
  insight: string;
  confidence: "high" | "medium" | "low";
  coverage_pct: number;
  as_of: string;
  generated_by?: string;
  reports_in_window?: number | null;
}


export interface LatestPriceRecord {
  id?: number;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
  unit: string;
  source: string;
  quality_flag: string;
}

export interface LatestPricesResponse {
  status: string;
  count: number;
  records: LatestPriceRecord[];
  as_of: string;
  stale: boolean;
}

const API_BASE = (typeof window !== "undefined" && (window as any).__API_BASE__) || "";

// Client-side cache to eliminate redundant network roundtrips and avoid 429 rate limits
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const apiCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

async function safeFetchJson<T>(url: string, ttl: number = CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && now - cached.timestamp < ttl) {
    return cached.data as T;
  }

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err: any) {
    if (cached) return cached.data as T;
    throw new Error("Unable to connect to market service. Please check your network.");
  }

  // Handle 429 Rate Limit with backoff retry
  if (res.status === 429) {
    if (cached) return cached.data as T;
    await new Promise((r) => setTimeout(r, 600));
    try {
      res = await fetch(url);
    } catch {
      if (cached) return cached.data as T;
      throw new Error("Market data service is busy. Please try again in a moment.");
    }
  }

  if (!res.ok) {
    if (cached) return cached.data as T;
    throw new Error(`Market service responded with status ${res.status}`);
  }

  const data = await res.json();
  apiCache.set(url, { data, timestamp: now });
  return data;
}

export async function fetchMarketTrend(
  commodity: string,
  market: string,
  state: string,
  days: 7 | 30 | 90 | 180 = 30
): Promise<MarketTrendResponse> {
  const params = new URLSearchParams({
    commodity,
    market,
    state,
    days: days.toString(),
  });
  return safeFetchJson<MarketTrendResponse>(`${API_BASE}/api/market/trend?${params.toString()}`);
}

export async function fetchMarketInsight(
  commodity: string,
  market: string,
  state: string,
  days: number = 30
): Promise<MarketInsightResponse> {
  const params = new URLSearchParams({
    commodity,
    market,
    state,
    days: days.toString(),
  });
  return safeFetchJson<MarketInsightResponse>(`${API_BASE}/api/market/insight?${params.toString()}`);
}

export async function fetchLatestPrices(
  commodity?: string,
  state?: string,
  district?: string,
  market?: string,
  limit: number = 50,
  includeFlagged: boolean = false
): Promise<LatestPricesResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    include_flagged: includeFlagged ? "true" : "false",
  });
  if (commodity) params.set("commodity", commodity);
  if (state) params.set("state", state);
  if (district) params.set("district", district);
  if (market) params.set("market", market);

  const res = await fetch(`${API_BASE}/api/market/prices/latest?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch latest prices: HTTP ${res.status}`);
  }
  return res.json();
}

// ===== Phase 2B: Mandi Explore =====

export interface MarketSearchResult {
  market: string;
  district: string;
  state: string;
  latest_date: string | null;
  latest_modal: number | null;
  latest_min: number | null;
  latest_max: number | null;
  variety: string;
  source: string;
  records_available: number;
}

export interface MarketSearchResponse {
  status: string;
  commodity: string;
  state: string;
  market_filter: string;
  tier: "advisory" | "explore";
  history_available: boolean;
  markets: MarketSearchResult[];
  total_records: number;
  as_of: string;
}

export async function fetchMarketSearch(
  commodity: string,
  state: string,
  market?: string,
  district?: string
): Promise<MarketSearchResponse> {
  const params = new URLSearchParams({ commodity, state });
  if (market) params.set("market", market);
  if (district) params.set("district", district);

  const res = await fetch(`${API_BASE}/api/market/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to search market: HTTP ${res.status}`);
  }
  return res.json();
}

// ===== Dynamic market list for autocomplete =====

export interface MarketListItem {
  market: string;
  district: string;
  records: number;
}

export interface MarketListResponse {
  status: string;
  state: string;
  commodity: string;
  markets: MarketListItem[];
  total: number;
  as_of: string;
}

export async function fetchMarketList(
  state: string,
  commodity?: string
): Promise<MarketListResponse> {
  const params = new URLSearchParams({ state });
  if (commodity) params.set("commodity", commodity);
  return safeFetchJson<MarketListResponse>(
    `${API_BASE}/api/market/list-markets?${params.toString()}`,
    5 * 60 * 1000 // 5 minutes cache for market dropdowns
  );
}
