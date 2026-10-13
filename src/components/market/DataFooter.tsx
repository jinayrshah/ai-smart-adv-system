import React from "react";
import { AlertTriangle, Clock, Database } from "lucide-react";

interface DataFooterProps {
  asOf: string;
  stale: boolean;
  sources: Record<string, number>;
  sourceAttribution?: string;
  /** date of the newest report for this market (YYYY-MM-DD) */
  latestReportDate?: string | null;
  marketName?: string;
}

const daysAgo = (iso: string): number => {
  const then = new Date(iso.slice(0, 10) + "T00:00:00").getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
};

export const DataFooter: React.FC<DataFooterProps> = ({
  asOf,
  stale,
  sources,
  sourceAttribution,
  latestReportDate,
  marketName,
}) => {
  const formattedAsOf = new Date(asOf).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const sourceLabels: Record<string, string> = {
    datagov_live: "data.gov.in (Daily Live)",
    agmarknet_pkg: "Agmarknet (Direct)",
    ceda: "CEDA Ashoka (Mirror)",
    kaggle_seed: "Kaggle (Historical Seed)",
  };

  return (
    <div className="mt-8 pt-5 border-t border-stone-800 text-xs text-stone-400 font-mono space-y-4">
      {stale && (
        <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            {latestReportDate ? (
              <>
                Latest report from {marketName || "this market"}:{" "}
                <strong className="text-amber-200">
                  {new Date(latestReportDate.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </strong>{" "}
                ({daysAgo(latestReportDate)} days ago).
              </>
            ) : (
              <>No recent price report from {marketName || "this market"} in this period.</>
            )}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-stone-400">
          <Clock className="w-3.5 h-3.5 text-[#e8fe85]" />
          <span>Last fetched: {formattedAsOf} IST</span>
        </div>

        {sources && Object.keys(sources).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-stone-400">
              <Database className="w-3.5 h-3.5 text-[#e8fe85]" /> Sources:
            </span>
            {Object.entries(sources).map(([src, count]) => (
              <span
                key={src}
                className="px-2.5 py-0.5 bg-stone-900 border border-stone-800 text-stone-300 rounded-full font-mono text-[10px]"
              >
                {sourceLabels[src] || src}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-stone-500 font-mono">
        {sourceAttribution ||
          "Source: Agmarknet, Directorate of Marketing & Inspection, Government of India (agmarknet.gov.in), via data.gov.in. Prices are reported by APMC mandis and are indicative only. Non-predictive."}
      </p>
    </div>
  );
};
