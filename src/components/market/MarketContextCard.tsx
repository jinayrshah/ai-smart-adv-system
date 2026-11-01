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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-3 h-3" /> Advisory Signal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30">
        <Info className="w-3 h-3" /> Factual Context
      </span>
    );
  };

  return (
    <div className="w-full bg-surface rounded-2xl p-6 space-y-5 text-ink">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand text-accent flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-brand flex items-center gap-2">
              Context Layer: Market Arrivals & Local Weather
              {data.degraded && (
                <span className="text-sm bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-normal">
                  Degraded
                </span>
              )}
            </h3>
            <p className="text-sm text-ink-soft mt-0.5">
              Joint observations for {price.commodity} at {price.market} mandi ({weather.district || price.state}, Grid: {weather.grid_key})
            </p>
          </div>
        </div>

        {/* Confidence & Freshness badges */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
              weather.confidence === "high"
                ? "bg-tint text-good border-line"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="bg-sky/40 border border-sky p-4 rounded-2xl space-y-1">
          <span className="text-sky-ink block text-sm font-bold">Latest Modal Price</span>
          <span className="text-xl font-bold text-sky-ink block">
            {price.latest_modal_price != null ? `₹${price.latest_modal_price}` : "—"}
          </span>
          <span className="text-sm text-sky-ink/80">
            {price.change_7d_pct != null ? `${price.change_7d_pct > 0 ? "+" : ""}${price.change_7d_pct}% (7d)` : "7d trend N/A"}
          </span>
        </div>

        <div className="bg-warn-bg/60 border border-warn-bg p-4 rounded-2xl space-y-1">
          <span className="text-warn block text-sm font-bold">Volatility (30d)</span>
          <span className="text-xl font-bold text-warn block">
            {price.volatility_pct != null ? `${price.volatility_pct}%` : "—"}
          </span>
          <span className="text-sm text-warn/80">
            Coverage: {Math.round(price.coverage_ratio * 100)}% of days
          </span>
        </div>

        <div className="bg-tint/70 border border-line p-4 rounded-2xl space-y-1">
          <span className="text-good block text-sm font-bold">Recent Rain (7d/30d)</span>
          <span className="text-xl font-bold text-good block">
            {weather.rain_7d_mm} mm / {weather.rain_30d_mm} mm
          </span>
          <span
            className={`text-sm ${
              weather.rain_30d_vs_normal_pct == null
                ? "text-ink-soft"
                : weather.rain_30d_vs_normal_pct >= 0
                ? "text-good font-bold"
                : "text-warn font-bold"
            }`}
          >
            {weather.rain_30d_vs_normal_pct != null
              ? `${weather.rain_30d_vs_normal_pct > 0 ? "+" : ""}${weather.rain_30d_vs_normal_pct}% vs normal`
              : "Baseline normal N/A"}
          </span>
        </div>

        <div className="bg-ash border border-line p-4 rounded-2xl space-y-1">
          <span className="text-ink-soft block text-sm font-bold">Dry Spell / Heat</span>
          <span className="text-xl font-bold text-ink block">
            {weather.dry_spell_days} dry days
          </span>
          <span className="text-sm text-ink-soft">
            {weather.tmax_7d_anomaly_c != null
              ? `${weather.tmax_7d_anomaly_c > 0 ? "+" : ""}${weather.tmax_7d_anomaly_c}°C anomaly`
              : "Temp: normal"}
          </span>
        </div>
      </div>

      {/* Descriptive Signals */}
      {signals && signals.length > 0 ? (
        <div className="space-y-2.5 pt-2">
          <span className="text-sm font-bold text-ink-soft block">
            Rule-Based Context Signals (Max 3)
          </span>
          <div className="space-y-2.5">
            {signals.map((sig, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-ground border border-line space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand flex items-center gap-2">
                    {renderStrengthBadge(sig.strength)}
                    {sig.name}
                  </span>
                  {sig.evidence && Object.keys(sig.evidence).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(sig.evidence).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-sm bg-white border border-line text-ink-soft px-2 py-0.5 rounded-full"
                        >
                          {k}: {typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-ink leading-relaxed">{sig.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-ground border border-line text-sm text-ink-soft">
          No abnormal weather anomalies or extreme price volatility flags triggered for this market period.
        </div>
      )}

      {/* Non-predictive Disclaimer */}
      <div className="pt-2 border-t border-line text-sm text-ink-soft leading-relaxed">
        <span className="text-brand font-bold">Non-Predictive Notice:</span> Signals above are rule-based descriptive indicators cross-referencing local mandi records with ERA5-Land gridded agro-climatology. They describe observed physical conditions and logistics context, and do not constitute price predictions or financial forecasts.
      </div>
    </div>
  );
};
