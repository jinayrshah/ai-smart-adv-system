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
  latestDate?: string | null;
  reportsInWindow?: number;
  mergedNames?: string[];
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

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
  latestDate,
  reportsInWindow,
  mergedNames,
}) => {
  const unitLabel = unit === "Rs/Quintal" ? "quintal" : unit;
  const coveragePct = Math.round((coverage.days_with_data / (coverage.expected_days || 1)) * 100);
  const isHealthyCoverage = coveragePct >= 60;
  /** §2.7: suppress % badges when fewer than 3 reports — they're built from the same 2 points */
  const isThinWindow = typeof reportsInWindow === "number" && reportsInWindow < 3;

  return (
    <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#e8fe85] font-mono mb-1.5">
            <span>{state}</span>
            <span>•</span>
            <span>{market} APMC</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white flex flex-wrap items-center gap-4">
            <span>{commodity}</span>
            {latestPrice !== null && (
              <span className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#e8fe85]">
                  ₹{latestPrice.toLocaleString("en-IN")}
                  <span className="text-sm font-sans font-normal text-stone-400 ml-1.5">/{unitLabel}</span>
                </span>
                <span className="text-xs font-bold font-mono text-[#e8fe85] bg-[#07503f] px-3 py-1 rounded-full border border-[#e8fe85]/30 shadow-sm">
                  ₹{(latestPrice / 100).toFixed(2)} / kg
                </span>
              </span>
            )}
          </h2>
          {latestDate && (
            <p className="text-xs text-stone-400 mt-1.5 font-mono">
              Latest report: {fmtDate(latestDate)}
              {reportsInWindow !== undefined && ` • ${reportsInWindow} report${reportsInWindow === 1 ? "" : "s"} in this period`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* §2.7 (Revisions_MarketWeather.md): only show % badges when there are 3+ reports;
               with ≤2 reports both 7d and 30d are computed from the same pair of points
               and showing "+7% / +7%" is actively misleading. */}
          {!isThinWindow && change7dPct !== undefined && change7dPct !== null && (
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                change7dPct >= 0
                  ? "bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30"
                  : "bg-rose-950/70 text-rose-300 border border-rose-500/30"
              }`}
            >
              {change7dPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change7dPct > 0 ? `+${change7dPct}%` : `${change7dPct}%`} vs ~1 wk ago</span>
            </div>
          )}

          {!isThinWindow && change30dPct !== undefined && change30dPct !== null && (
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                change30dPct >= 0
                  ? "bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30"
                  : "bg-rose-950/70 text-rose-300 border border-rose-500/30"
              }`}
            >
              {change30dPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change30dPct > 0 ? `+${change30dPct}%` : `${change30dPct}%`} vs ~1 mo ago</span>
            </div>
          )}

          {/* Show honest caveat in place of badges when data is thin */}
          {isThinWindow && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-950/60 border border-amber-500/30 text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Only {reportsInWindow} report{reportsInWindow === 1 ? "" : "s"} — % suppressed
              </span>
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              isHealthyCoverage
                ? "bg-stone-900 border-stone-700 text-stone-200"
                : "bg-amber-950/40 border-amber-500/30 text-amber-300"
            }`}
          >
            {isHealthyCoverage ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#e8fe85]" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {coverage.days_with_data}/{coverage.expected_days}d ({coveragePct}%)
            </span>
          </div>
        </div>
      </div>

      {(firstReportedDate || maxGapDays !== undefined || (varietiesIncluded && varietiesIncluded.length > 0)) && (
        <div className="mt-5 pt-3.5 border-t border-stone-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-stone-400 font-mono">
          {firstReportedDate && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-stone-300">First recorded:</span>
              <span>{fmtDate(firstReportedDate)}</span>
            </div>
          )}
          {maxGapDays !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-stone-300">Max gap:</span>
              <span>{maxGapDays === 0 ? "None" : `${maxGapDays} day${maxGapDays === 1 ? "" : "s"}`}</span>
            </div>
          )}
          {mergedNames && mergedNames.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-stone-300">Aliases:</span>
              <span>{mergedNames.join(", ")}</span>
            </div>
          )}
          {varietiesIncluded && varietiesIncluded.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-stone-300">Varieties:</span>
              <span className="bg-stone-800 px-2.5 py-0.5 rounded-full text-stone-200 border border-stone-700">
                {varietiesIncluded.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
