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
import { fetchMarketTrend, MarketTrendResponse } from "../../services/marketApi";
import { RefreshCw, Download, Share2, Check } from "lucide-react";

interface MarketDataViewProps {
  initialCommodity?: string;
  initialState?: string;
  initialMarket?: string;
}

export const MarketDataView: React.FC<MarketDataViewProps> = ({
  initialCommodity = "Wheat",
  initialState = "Maharashtra",
  initialMarket = "Malegaon",
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

  useEffect(() => {
    loadTrend();
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

  // Derive latest modal price and change metrics
  const availablePoints = (trendData?.points || []).filter((p) => p.modal !== null);
  const latestPrice = availablePoints.length > 0 ? availablePoints[availablePoints.length - 1].modal : null;

  let change7d: number | null = null;
  let change30d: number | null = null;

  if (availablePoints.length >= 2 && latestPrice) {
    const oldestPrice = availablePoints[0].modal;
    if (oldestPrice) {
      change30d = Math.round(((latestPrice - oldestPrice) / oldestPrice) * 100);
    }
    const midPoint = availablePoints[Math.max(0, availablePoints.length - 4)].modal;
    if (midPoint) {
      change7d = Math.round(((latestPrice - midPoint) / midPoint) * 100);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Crop
            </label>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Wheat">Wheat</option>
              <option value="Rice">Rice</option>
              <option value="Maize">Maize</option>
              <option value="Sugarcane">Sugarcane</option>
              <option value="Potato">Potato</option>
              <option value="Cotton">Cotton</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              State
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Maharashtra">Maharashtra</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Punjab">Punjab</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Rajasthan">Rajasthan</option>
            </select>
          </div>

          <MandiAutocomplete
            state={state}
            commodity={commodity}
            value={market}
            onChange={setMarket}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trendData && trendData.points.length > 0 && (
            <button
              onClick={downloadCsv}
              title="Export trend series to CSV"
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={copyShareLink}
            title="Share view URL"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share View</span>
              </>
            )}
          </button>

          <button
            onClick={loadTrend}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
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
          />
        </>
      )}
    </div>
  );
};
