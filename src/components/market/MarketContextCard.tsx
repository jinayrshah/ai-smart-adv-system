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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/30">
        <Info className="w-3 h-3" /> Factual Context
      </span>
    );
  };

  return (
    <div className="w-full bg-white border border-[#c3cda7] rounded-3xl p-6 space-y-5 text-[#212529]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e8ce] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-serif text-[#07503f] flex items-center gap-2">
              Context Layer: Market Arrivals & Local Weather
              {data.degraded && (
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-normal">
                  Degraded
                </span>
              )}
            </h3>
            <p className="text-xs text-[#555e4a] font-mono mt-0.5">
              Joint observations for {price.commodity} at {price.market} mandi ({weather.district || price.state}, Grid: {weather.grid_key})
            </p>
          </div>
        </div>

        {/* Confidence & Freshness badges */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
              weather.confidence === "high"
                ? "bg-[#e6ecd5] text-[#3b5921] border-[#c3cda7]"
                : weather.confidence === "medium"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {weather.confidence === "high" && <CheckCircle2 className="w-3.5 h-3.5" />}
            {weather.confidence === "medium" && <HelpCircle className="w-3.5 h-3.5" />}
            {weather.confidence === "low" && <ShieldAlert className="w-3.5 h-3.5" />}
            Weather: {weather.confidence} confidence
          </span>
        </div>
      </div>

      {/* Snapshot metrics grid - 4 Quilted Pastel Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-[#b2cee7]/40 border border-[#b2cee7] p-4 rounded-2xl space-y-1">
          <span className="text-[#18486b] block text-[10px] font-mono font-bold uppercase tracking-wider">Latest Modal Price</span>
          <span className="text-xl font-bold font-serif text-[#18486b] block">
            {price.latest_modal_price != null ? `₹${price.latest_modal_price}` : "—"}
          </span>
          <span className="text-[10px] font-mono text-[#18486b]/80">
            {price.change_7d_pct != null ? `${price.change_7d_pct > 0 ? "+" : ""}${price.change_7d_pct}% (7d)` : "7d trend N/A"}
          </span>
        </div>

        <div className="bg-[#fceace]/60 border border-[#f5d5b0] p-4 rounded-2xl space-y-1">
          <span className="text-[#8a4b12] block text-[10px] font-mono font-bold uppercase tracking-wider">Volatility (30d)</span>
          <span className="text-xl font-bold font-serif text-[#8a4b12] block">
            {price.volatility_pct != null ? `${price.volatility_pct}%` : "—"}
          </span>
          <span className="text-[10px] font-mono text-[#8a4b12]/80">
            Coverage: {Math.round(price.coverage_ratio * 100)}% of days
          </span>
        </div>

        <div className="bg-[#e6ecd5]/70 border border-[#c3cda7] p-4 rounded-2xl space-y-1">
          <span className="text-[#3b5921] block text-[10px] font-mono font-bold uppercase tracking-wider">Recent Rain (7d/30d)</span>
          <span className="text-xl font-bold font-serif text-[#3b5921] block">
            {weather.rain_7d_mm} mm / {weather.rain_30d_mm} mm
          </span>
          <span
            className={`text-[10px] font-mono ${
              weather.rain_30d_vs_normal_pct == null
                ? "text-[#555e4a]"
                : weather.rain_30d_vs_normal_pct >= 0
                ? "text-[#3b5921] font-bold"
                : "text-[#8a4b12] font-bold"
            }`}
          >
            {weather.rain_30d_vs_normal_pct != null
              ? `${weather.rain_30d_vs_normal_pct > 0 ? "+" : ""}${weather.rain_30d_vs_normal_pct}% vs normal`
              : "Baseline normal N/A"}
          </span>
        </div>

        <div className="bg-[#efefef] border border-[#d8d8d8] p-4 rounded-2xl space-y-1">
          <span className="text-[#4a4f55] block text-[10px] font-mono font-bold uppercase tracking-wider">Dry Spell / Heat</span>
          <span className="text-xl font-bold font-serif text-[#212529] block">
            {weather.dry_spell_days} dry days
          </span>
          <span className="text-[10px] font-mono text-[#6c757d]">
            {weather.tmax_7d_anomaly_c != null
              ? `${weather.tmax_7d_anomaly_c > 0 ? "+" : ""}${weather.tmax_7d_anomaly_c}°C anomaly`
              : "Temp: normal"}
          </span>
        </div>
      </div>

      {/* Descriptive Signals */}
      {signals && signals.length > 0 ? (
        <div className="space-y-2.5 pt-2">
          <span className="text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest block">
            Rule-Based Context Signals (Max 3)
          </span>
          <div className="space-y-2.5">
            {signals.map((sig, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#f1efdf] border border-[#c3cda7] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#07503f] flex items-center gap-2">
                    {renderStrengthBadge(sig.strength)}
                    {sig.name}
                  </span>
                  {sig.evidence && Object.keys(sig.evidence).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(sig.evidence).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10px] font-mono bg-white border border-[#c3cda7] text-[#555e4a] px-2 py-0.5 rounded-full"
                        >
                          {k}: {typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#212529] leading-relaxed">{sig.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-[#f1efdf] border border-[#c3cda7] text-xs text-[#555e4a]">
          No abnormal weather anomalies or extreme price volatility flags triggered for this market period.
        </div>
      )}

      {/* Non-predictive Disclaimer */}
      <div className="pt-2 border-t border-[#e2e8ce] text-[11px] text-[#555e4a] leading-relaxed">
        <span className="text-[#07503f] font-bold">Non-Predictive Notice:</span> Signals above are rule-based descriptive indicators cross-referencing local mandi records with ERA5-Land gridded agro-climatology. They describe observed physical conditions and logistics context, and do not constitute price predictions or financial forecasts.
      </div>
    </div>
  );
};
