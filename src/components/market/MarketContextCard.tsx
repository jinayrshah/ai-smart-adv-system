import React, { useEffect, useState } from "react";
import {
  fetchMarketWeatherContext,
  ContextMarketWeatherResponse,
  SignalDetail,
} from "../../lib/api/context";
import {
  TrendingUp,
  CloudRain,
  AlertCircle,
  Info,
  Thermometer,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  Droplets,
  Layers,
  RefreshCw,
} from "lucide-react";

interface MarketContextCardProps {
  commodity: string;
  market: string;
  state?: string;
  days?: number;
}

export const MarketContextCard: React.FC<MarketContextCardProps> = ({
  commodity,
  market,
  state,
  days = 30,
}) => {
  const [data, setData] = useState<ContextMarketWeatherResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = async () => {
    if (!commodity || !market) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMarketWeatherContext({
        commodity,
        market,
        state,
        days,
      });
      setData(res);
    } catch (err: any) {
      console.warn("Failed to load market-weather context:", err);
      setError(err.message || "Failed to load context");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, [commodity, market, state, days]);

  if (loading && !data) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex items-center justify-center space-x-3 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
        <span className="text-sm">Synthesizing market arrivals and district weather context...</span>
      </div>
    );
  }

  if (error || !data) {
    return null; // Fail gracefully without breaking market view
  }

  const { price, weather, signals } = data;

  const renderStrengthBadge = (strength: "advisory" | "info") => {
    if (strength === "advisory") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-3 h-3" /> Advisory Signal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Info className="w-3 h-3" /> Factual Context
      </span>
    );
  };

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4 text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <Layers className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Context Layer: Market Arrivals & Local Weather
              {data.degraded && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-normal">
                  Degraded / Low Data
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-400">
              Joint observations for {price.commodity} at {price.market} mandi ({weather.district || price.state}, Grid: {weather.grid_key})
            </p>
          </div>
        </div>

        {/* Confidence & Freshness badges */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              weather.confidence === "high"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : weather.confidence === "medium"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            {weather.confidence === "high" && <CheckCircle2 className="w-3 h-3" />}
            {weather.confidence === "medium" && <HelpCircle className="w-3 h-3" />}
            {weather.confidence === "low" && <ShieldAlert className="w-3 h-3" />}
            Weather: {weather.confidence} confidence
          </span>
        </div>
      </div>

      {/* Snapshot metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-zinc-800/40 border border-zinc-700/60 p-3 rounded-xl space-y-1">
          <span className="text-zinc-400 block text-[11px]">Latest Modal Price</span>
          <span className="text-lg font-bold text-white block">
            {price.latest_modal_price != null ? `₹${price.latest_modal_price}` : "—"}
          </span>
          <span className="text-[10px] text-zinc-500">
            {price.change_7d_pct != null ? `${price.change_7d_pct > 0 ? "+" : ""}${price.change_7d_pct}% (7d)` : "7d trend N/A"}
          </span>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/60 p-3 rounded-xl space-y-1">
          <span className="text-zinc-400 block text-[11px]">Price Volatility (30d)</span>
          <span className="text-lg font-bold text-white block">
            {price.volatility_pct != null ? `${price.volatility_pct}%` : "—"}
          </span>
          <span className="text-[10px] text-zinc-500">
            Coverage: {Math.round(price.coverage_ratio * 100)}% of days
          </span>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/60 p-3 rounded-xl space-y-1">
          <span className="text-zinc-400 block text-[11px]">Recent Rainfall (7d / 30d)</span>
          <span className="text-lg font-bold text-white block">
            {weather.rain_7d_mm} mm / {weather.rain_30d_mm} mm
          </span>
          <span
            className={`text-[10px] ${
              weather.rain_30d_vs_normal_pct == null
                ? "text-zinc-500"
                : weather.rain_30d_vs_normal_pct >= 0
                ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            {weather.rain_30d_vs_normal_pct != null
              ? `${weather.rain_30d_vs_normal_pct > 0 ? "+" : ""}${weather.rain_30d_vs_normal_pct}% vs normal`
              : "Baseline normal N/A"}
          </span>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/60 p-3 rounded-xl space-y-1">
          <span className="text-zinc-400 block text-[11px]">Dry Spell / Heat</span>
          <span className="text-lg font-bold text-white block">
            {weather.dry_spell_days} dry days
          </span>
          <span className="text-[10px] text-zinc-500">
            {weather.tmax_7d_anomaly_c != null
              ? `${weather.tmax_7d_anomaly_c > 0 ? "+" : ""}${weather.tmax_7d_anomaly_c}°C temp anomaly`
              : "Temp anomaly: normal"}
          </span>
        </div>
      </div>

      {/* Descriptive Signals */}
      {signals && signals.length > 0 ? (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Rule-Based Context Signals (Max 3)
          </span>
          <div className="space-y-2">
            {signals.map((sig, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/70 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    {renderStrengthBadge(sig.strength)}
                    {sig.name}
                  </span>
                  {sig.evidence && Object.keys(sig.evidence).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(sig.evidence).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10px] font-mono bg-zinc-900 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {k}: {typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{sig.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/40 text-xs text-zinc-400">
          No significant weather anomalies or price volatility flags triggered for this market period.
        </div>
      )}

      {/* Non-predictive Disclaimer (Architecture §10.4) */}
      <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
        <span className="text-zinc-400 font-medium">Non-Predictive Notice:</span> Signals above are rule-based descriptive indicators cross-referencing local mandi records with ERA5-Land gridded agro-climatology. They describe observed physical conditions and logistics context, and do not constitute price predictions or financial forecasts.
      </div>
    </div>
  );
};
