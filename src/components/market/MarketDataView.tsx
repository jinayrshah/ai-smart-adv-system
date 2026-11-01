import React, { useEffect, useState } from "react";
import { PriceContextHeader } from "./PriceContextHeader";
import { PriceTrendChart } from "./PriceTrendChart";
import { MarketContextCard } from "./MarketContextCard";
import { MarketCalculators } from "./MarketCalculators";
import { MarketInsightCard } from "./MarketInsightCard";
import { MandiRecentReportsTable } from "./MandiRecentReportsTable";
import { MandiAutocomplete } from "./MandiAutocomplete";
import { DataFooter } from "./DataFooter";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { MandiCompareView, CompareSlot } from "./MandiCompareView";
import { fetchMarketTrend, MarketTrendResponse } from "../../services/marketApi";
import { RefreshCw, Download, Share2, Check } from "lucide-react";

export interface MarketSelection {
  commodity: string;
  state: string;
  market: string;
  /** bump to re-apply the same selection */
  nonce: number;
}

interface MarketDataViewProps {
  initialCommodity?: string;
  initialState?: string;
  initialMarket?: string;
  /** set by the Mandi Explorer: clicking a card loads it here (Revisions §2.7, one selection model) */
  selection?: MarketSelection | null;
  /** saved farm size, used to prefill the margin calculator */
  farmFieldSizeAcres?: number | null;
  /** slots pushed from MandiExplore Compare buttons (lifted from App.tsx) */
  externalCompareSlots?: { state: string; market: string }[];
}

export const MarketDataView: React.FC<MarketDataViewProps> = ({
  initialCommodity = "",
  initialState = "",
  initialMarket = "",
  selection,
  farmFieldSizeAcres,
  externalCompareSlots = [],
}) => {
  // Read initial query params from URL if present
  const getInitialParam = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(key) || fallback;
  };

  const getInitialDays = (): 7 | 30 | 90 | 180 => {
    if (typeof window === "undefined") return 30;
    const urlParams = new URLSearchParams(window.location.search);
    const d = Number(urlParams.get("days"));
    if ([7, 30, 90, 180].includes(d)) return d as 7 | 30 | 90 | 180;
    return 30;
  };

  const [commodity, setCommodity] = useState(() => getInitialParam("commodity", initialCommodity));
  const [state, setState] = useState(() => getInitialParam("state", initialState));
  const [market, setMarket] = useState(() => getInitialParam("market", initialMarket));
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 180>(getInitialDays);
  const [trendData, setTrendData] = useState<MarketTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // When state changes, reset the market so users don't get a stale/mismatched market
  const prevState = React.useRef(state);
  useEffect(() => {
    if (prevState.current !== state) {
      setMarket("");
      setTrendData(null);
      prevState.current = state;
    }
  }, [state]);

  useEffect(() => {
    if (!selection) return;
    setCommodity(selection.commodity);
    setState(selection.state);
    setMarket(selection.market);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selection?.nonce]);

  // Sync URL query params on selection changes without reloading
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("commodity", commodity);
    params.set("state", state);
    params.set("market", market);
    params.set("days", rangeDays.toString());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [commodity, state, market, rangeDays]);

  const loadTrend = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketTrend(commodity, market, state, rangeDays);
      setTrendData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load market trend");
    } finally {
      setLoading(false);
    }
  };

  // Only auto-load when both commodity and market are selected
  useEffect(() => {
    if (commodity && market && state) {
      loadTrend();
    }
  }, [commodity, market, state, rangeDays]);


  // Export current series to CSV
  const downloadCsv = () => {
    if (!trendData || !trendData.points || trendData.points.length === 0) return;
    const headers = [
      "Date",
      "Commodity",
      "Market",
      "State",
      "Modal_Price_Rs_Qtl",
      "Modal_Price_Rs_Kg",
      "Min_Price_Rs_Qtl",
      "Max_Price_Rs_Qtl",
      "Varieties_Reported",
    ];
    const rows = trendData.points.map((p) => [
      p.date,
      commodity,
      market,
      state,
      p.modal !== null ? p.modal : "",
      p.modal !== null ? (p.modal / 100).toFixed(2) : "",
      p.min !== null ? p.min : "",
      p.max !== null ? p.max : "",
      p.n_varieties,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `mandi_${commodity}_${market}_${trendData.range.from}_to_${trendData.range.to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyShareLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Latest price and changes come from the API, which compares against a real report
  // ~7 / ~30 days before the latest one and suppresses them under 3 reports. The old
  // client-side math compared against the 4th-last and the first report, which printed
  // the same "+7%" for both windows from just two reports (cleanup doc P3).
  const availablePoints = (trendData?.points || []).filter((p) => p.modal !== null);
  const latestPrice =
    trendData?.latest_modal ?? (availablePoints.length > 0 ? availablePoints[availablePoints.length - 1].modal : null);
  const change7d: number | null = trendData?.thin_data ? null : trendData?.change_7d_pct ?? null;
  const change30d: number | null = trendData?.thin_data ? null : trendData?.change_30d_pct ?? null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Arva Controls Bar */}
      <div className="bg-surface rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-sm font-bold text-ink-soft mb-1.5">
              Crop
            </label>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">— Select crop —</option>
              <option value="Arecanut">Arecanut</option>
              <option value="Bajra">Bajra (Pearl Millet)</option>
              <option value="Banana">Banana</option>
              <option value="Brinjal">Brinjal</option>
              <option value="Chilli">Chilli / Green Chilli</option>
              <option value="Coconut">Coconut</option>
              <option value="Cotton">Cotton</option>
              <option value="Groundnut">Groundnut</option>
              <option value="Jowar">Jowar (Sorghum)</option>
              <option value="Maize">Maize</option>
              <option value="Onion">Onion</option>
              <option value="Potato">Potato</option>
              <option value="Ragi">Ragi (Finger Millet)</option>
              <option value="Rice">Rice / Paddy</option>
              <option value="Soyabean">Soyabean</option>
              <option value="Sugarcane">Sugarcane</option>
              <option value="Tomato">Tomato</option>
              <option value="Turmeric">Turmeric</option>
              <option value="Wheat">Wheat</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink-soft mb-1.5">
              State
            </label>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setMarket("");
              }}
              className="bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">— Select state —</option>
              <option value="Andhra Pradesh">Andhra Pradesh</option>
              <option value="Assam">Assam</option>
              <option value="Bihar">Bihar</option>
              <option value="Chhattisgarh">Chhattisgarh</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Haryana">Haryana</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Keralam">Kerala (Keralam)</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Odisha">Odisha</option>
              <option value="Punjab">Punjab</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Telangana">Telangana</option>
              <option value="Tripura">Tripura</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Uttarakhand">Uttarakhand</option>
              <option value="West Bengal">West Bengal</option>
            </select>
          </div>

          <MandiAutocomplete
            state={state}
            commodity={commodity}
            value={market}
            onChange={setMarket}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {trendData && trendData.points.length > 0 && (
            <button
              onClick={downloadCsv}
              title="Export trend series to CSV"
              className="flex items-center gap-1.5 px-4 py-2 bg-ground hover:bg-tint text-ink border border-line rounded-full text-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-brand" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={copyShareLink}
            title="Share view URL"
            className="flex items-center gap-1.5 px-4 py-2 bg-ground hover:bg-tint text-ink border border-line rounded-full text-sm transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-brand" />
                <span className="text-brand font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-brand" />
                <span>Share View</span>
              </>
            )}
          </button>

          <button
            onClick={loadTrend}
            disabled={loading || !commodity || !market}
            title={!commodity || !market ? "Select a crop and market first" : "Refresh data"}
            className="flex items-center gap-2 px-5 py-2 bg-brand hover:bg-brand-dark text-accent rounded-full text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-bad-bg rounded-2xl text-bad">
          {error}
          {error.toLowerCase().includes('0 report') || error.toLowerCase().includes('no data') || error.toLowerCase().includes('not found') ? (
            <p className="mt-1 text-sm text-rose-600">Try a different market in the same state, or switch to a nearby state where this crop is commonly traded.</p>
          ) : null}
        </div>
      )}

      {!trendData && !loading && !error && (
        <p className="bg-surface rounded-2xl px-5 py-6 text-ink-soft">
          {!commodity ? "Choose a crop to see prices." : !state ? "Choose your state." : "Choose a mandi to see its price trend, calculators and recent reports."}
        </p>
      )}

      {trendData && (
        <>
          <PriceContextHeader
            commodity={trendData.commodity}
            market={trendData.market}
            state={trendData.state}
            unit={trendData.unit}
            latestPrice={latestPrice}
            change7dPct={change7d}
            change30dPct={change30d}
            coverage={trendData.coverage}
            firstReportedDate={trendData.first_reported_date}
            maxGapDays={trendData.max_gap_days}
            varietiesIncluded={trendData.varieties_included}
            latestDate={trendData.latest_date}
            reportsInWindow={trendData.reports_in_window}
            mergedNames={trendData.market_names_merged}
          />

          <ErrorBoundary fallbackTitle="Unable to load grounded market insight">
            <MarketInsightCard
              commodity={commodity}
              market={market}
              state={state}
              days={rangeDays}
            />
          </ErrorBoundary>

          <PriceTrendChart
            points={trendData.points}
            unit={trendData.unit}
            rangeDays={rangeDays}
            onRangeChange={setRangeDays}
            isLoading={loading}
          />

          <ErrorBoundary fallbackTitle="Unable to load market-weather context">
            <MarketContextCard
              commodity={commodity}
              market={market}
              state={state}
              days={rangeDays}
            />
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Unable to load decision calculators">
            <MarketCalculators
              commodity={commodity}
              market={market}
              state={state}
              currentPrice={latestPrice}
              defaultFieldSizeAcres={farmFieldSizeAcres}
            />
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Unable to load raw arrival reports">
            <MandiRecentReportsTable
              commodity={commodity}
              market={market}
              state={state}
            />
          </ErrorBoundary>

          <DataFooter
            asOf={trendData.as_of}
            stale={trendData.stale}
            sources={trendData.sources}
            latestReportDate={trendData.latest_date}
            marketName={trendData.market}
          />
        </>
      )}

      {/* Multi-Mandi Compare — always visible once a crop is selected */}
      {commodity && (
        <ErrorBoundary fallbackTitle="Unable to load comparison view">
          <MandiCompareView
            commodity={commodity}
            rangeDays={rangeDays}
            externalSlots={externalCompareSlots}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};
