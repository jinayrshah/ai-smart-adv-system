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
    <div className="bg-white border border-[#c3cda7] rounded-3xl p-6 sm:p-8 mb-6 text-[#212529]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#07503f] font-mono mb-1.5">
            <span>{state}</span>
            <span>•</span>
            <span>{market} APMC</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#07503f] flex flex-wrap items-center gap-4">
            <span>{commodity}</span>
            {latestPrice !== null && (
              <span className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#07503f]">
                  ₹{latestPrice.toLocaleString("en-IN")}
                  <span className="text-sm font-sans font-normal text-[#555e4a] ml-1.5">/{unitLabel}</span>
                </span>
                <span className="text-xs font-bold font-mono text-[#e8fe85] bg-[#07503f] px-3 py-1 rounded-full">
                  ₹{(latestPrice / 100).toFixed(2)} / kg
                </span>
              </span>
            )}
          </h2>
          {latestDate && (
            <p className="text-xs text-[#555e4a] mt-1.5 font-mono">
              Latest arrival: {fmtDate(latestDate)}
              {reportsInWindow !== undefined && ` • ${reportsInWindow} report${reportsInWindow === 1 ? "" : "s"} in this period`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isThinWindow && change7dPct !== undefined && change7dPct !== null && (
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                change7dPct >= 0
                  ? "bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {change7dPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change7dPct > 0 ? `+${change7dPct}%` : `${change7dPct}%`} vs ~1 wk ago</span>
            </div>
          )}

          {!isThinWindow && change30dPct !== undefined && change30dPct !== null && (
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                change30dPct >= 0
                  ? "bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {change30dPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change30dPct > 0 ? `+${change30dPct}%` : `${change30dPct}%`} vs ~1 mo ago</span>
            </div>
          )}

          {isThinWindow && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
              <span>
                Only {reportsInWindow} report{reportsInWindow === 1 ? "" : "s"} — % suppressed
              </span>
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              isHealthyCoverage
                ? "bg-[#f1efdf] border-[#c3cda7] text-[#212529]"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {isHealthyCoverage ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#07503f]" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>
              {coverage.days_with_data}/{coverage.expected_days}d ({coveragePct}%)
            </span>
          </div>
        </div>
      </div>

      {(firstReportedDate || maxGapDays !== undefined || (varietiesIncluded && varietiesIncluded.length > 0)) && (
        <div className="mt-5 pt-3.5 border-t border-[#e2e8ce] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#555e4a] font-mono">
          {firstReportedDate && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#212529]">First recorded:</span>
              <span>{fmtDate(firstReportedDate)}</span>
            </div>
          )}
          {maxGapDays !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#212529]">Max gap:</span>
              <span>{maxGapDays === 0 ? "None" : `${maxGapDays} day${maxGapDays === 1 ? "" : "s"}`}</span>
            </div>
          )}
          {mergedNames && mergedNames.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#212529]">Aliases:</span>
              <span>{mergedNames.join(", ")}</span>
            </div>
          )}
          {varietiesIncluded && varietiesIncluded.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#212529]">Varieties:</span>
              <span className="bg-[#f1efdf] px-2.5 py-0.5 rounded-full text-[#212529] border border-[#c3cda7]">
                {varietiesIncluded.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
