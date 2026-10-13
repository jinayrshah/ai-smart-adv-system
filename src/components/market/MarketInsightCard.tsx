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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30">
            <ShieldCheck className="w-3.5 h-3.5" /> High Confidence
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> Medium Confidence
          </span>
        );
      case "low":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-stone-800 text-stone-400 border border-stone-700">
            <AlertCircle className="w-3.5 h-3.5" /> Indicative Data
          </span>
        );
    }
  };

  return (
    <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#07503f] text-[#e8fe85] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="font-serif text-lg font-bold text-stone-100 tracking-tight">
            Market Summary & Grounded Context
          </h3>
          <span className="text-[10px] font-mono font-semibold text-[#e8fe85] bg-[#07503f]/50 px-2.5 py-0.5 rounded-full border border-[#e8fe85]/30">
            Gemini 2.5 Flash
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data && confidenceBadge(data.confidence)}
          <button
            onClick={loadInsight}
            disabled={loading}
            title="Refresh synthesis"
            className="p-1.5 text-stone-400 hover:text-[#e8fe85] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="space-y-2 py-3">
          <div className="h-4 bg-stone-800 rounded-full animate-pulse w-5/6" />
          <div className="h-4 bg-stone-800 rounded-full animate-pulse w-4/6" />
        </div>
      )}

      {error && !data && (
        <p className="text-xs text-rose-400 py-1 font-mono">
          {error}
        </p>
      )}

      {data && (
        <p className="text-sm text-stone-200 leading-relaxed font-sans">
          {data.insight}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-stone-400">
        <span>
          Strictly grounded on verified Agmarknet reports and DES reference benchmarks. Non-predictive.
        </span>
        {data && (
          <span className="text-[#e8fe85]">Reporting coverage: {data.coverage_pct}%</span>
        )}
      </div>
    </div>
  );
};
