import React from "react";
import { TrendingUp, TrendingDown, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

interface PriceContextHeaderProps {
  commodity: string;
  market: string;
  state: string;
  unit: string;
  latestPrice: number | null;
  change7dPct?: number | null;
  change30dPct?: number | null;
  coverage: {
    expected_days: number;
    days_with_data: number;
  };
  firstReportedDate?: string | null;
  maxGapDays?: number;
  varietiesIncluded?: string[];
}

export const PriceContextHeader: React.FC<PriceContextHeaderProps> = ({
  commodity,
  market,
  state,
  unit,
  latestPrice,
  change7dPct,
  change30dPct,
  coverage,
  firstReportedDate,
  maxGapDays,
  varietiesIncluded,
}) => {
  const coveragePct = Math.round((coverage.days_with_data / (coverage.expected_days || 1)) * 100);
  const isHealthyCoverage = coveragePct >= 60;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
            <span>{state}</span>
            <span>•</span>
            <span>{market}</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex flex-wrap items-center gap-3">
            <span>{commodity}</span>
            {latestPrice !== null && (
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  ₹{latestPrice.toLocaleString("en-IN")}
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 ml-1">/{unit}</span>
                </span>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                  ₹{(latestPrice / 100).toFixed(1)} / kg
                </span>
              </span>
            )}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {change7dPct !== undefined && change7dPct !== null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                change7dPct >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              }`}
            >
              {change7dPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{change7dPct > 0 ? `+${change7dPct}%` : `${change7dPct}%`} (7d)</span>
            </div>
          )}

          {change30dPct !== undefined && change30dPct !== null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                change30dPct >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              }`}
            >
              {change30dPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{change30dPct > 0 ? `+${change30dPct}%` : `${change30dPct}%`} (30d)</span>
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              isHealthyCoverage
                ? "bg-zinc-50 border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
            }`}
          >
            {isHealthyCoverage ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
            <span>
              {coverage.days_with_data} of {coverage.expected_days} days reported ({coveragePct}%)
            </span>
          </div>
        </div>
      </div>

      {(firstReportedDate || maxGapDays !== undefined || (varietiesIncluded && varietiesIncluded.length > 0)) && (
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
          {firstReportedDate && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">First recorded:</span>
              <span>{firstReportedDate}</span>
            </div>
          )}
          {maxGapDays !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Max reporting gap:</span>
              <span>{maxGapDays === 0 ? "Continuous" : `${maxGapDays} consecutive days`}</span>
            </div>
          )}
          {varietiesIncluded && varietiesIncluded.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Varieties:</span>
              <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                {varietiesIncluded.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
