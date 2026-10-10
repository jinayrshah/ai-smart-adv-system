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
      setError(err.message || "Failed to generate market synthesis");
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" /> High Confidence
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5" /> Medium Confidence
          </span>
        );
      case "low":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
            <AlertCircle className="w-3.5 h-3.5" /> Indicative / Limited Data
          </span>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50/70 via-white to-zinc-50 dark:from-emerald-950/20 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Market Summary & Grounded Context
          </h3>
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
            Gemini 2.5 Flash
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data && confidenceBadge(data.confidence)}
          <button
            onClick={loadInsight}
            disabled={loading}
            title="Refresh synthesis"
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="space-y-2 py-2">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-4/6" />
        </div>
      )}

      {error && !data && (
        <p className="text-xs text-rose-600 dark:text-rose-400 py-1">
          {error}
        </p>
      )}

      {data && (
        <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
          {data.insight}
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>
          Strictly grounded on verified Agmarknet reports and DES reference benchmarks. Non-predictive.
        </span>
        {data && (
          <span>Reporting coverage: {data.coverage_pct}%</span>
        )}
      </div>
    </div>
  );
};
