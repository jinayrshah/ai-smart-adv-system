import React, { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { fetchMarketInsight, MarketInsightResponse } from "../../services/marketApi";

interface MarketInsightCardProps {
  commodity: string;
  market: string;
  state: string;
  days: number;
}

export const MarketInsightCard: React.FC<MarketInsightCardProps> = ({
  commodity,
  market,
  state,
  days,
}) => {
  const [data, setData] = useState<MarketInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMarketInsight(commodity, market, state, days);
      setData(res);
    } catch (err: any) {
      setError("The market summary is unavailable right now. The prices below are unaffected.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsight();
  }, [commodity, market, state, days]);

  const confidenceBadge = (confidence: "high" | "medium" | "low") => {
    switch (confidence) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-brand text-accent border border-accent/30">
            <ShieldCheck className="w-3.5 h-3.5" /> High Confidence
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> Medium Confidence
          </span>
        );
      case "low":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-stone-800 text-stone-400 border border-stone-700">
            <AlertCircle className="w-3.5 h-3.5" /> Indicative Data
          </span>
        );
    }
  };

  return (
    <div className="bg-surface rounded-2xl p-6 relative overflow-hidden text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand text-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-bold text-brand tracking-tight">
            Market Summary & Grounded Context
          </h3>
          <span className="text-sm font-semibold text-brand bg-tint px-2.5 py-0.5 rounded-full">
            Grounded AI Synthesis
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data && confidenceBadge(data.confidence)}
          <button
            onClick={loadInsight}
            disabled={loading}
            title="Refresh synthesis"
            className="p-1.5 text-ink-soft hover:text-brand transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="space-y-2 py-3">
          <div className="h-4 bg-ground rounded-full animate-pulse w-5/6" />
          <div className="h-4 bg-ground rounded-full animate-pulse w-4/6" />
        </div>
      )}

      {error && !data && (
        <p className="text-sm text-rose-600 py-1">
          {error}
        </p>
      )}

      {data && (
        <p className="text-sm text-ink leading-relaxed font-sans">
          {data.insight}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
        <span>
          Strictly grounded on verified Agmarknet mandi returns and official reference benchmarks. Non-speculative.
        </span>
        {data && (
          <span className="text-brand font-bold">Reporting coverage: {data.coverage_pct}%</span>
        )}
      </div>
    </div>
  );
};
