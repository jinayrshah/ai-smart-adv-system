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
    <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 space-y-3">
      {stale && (
        // Revisions §2.7: say when this market last reported, in plain words. (Whether our
        // own daily pipeline is late is a separate signal, not inferred from one market.)
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            {latestReportDate ? (
              <>
                Latest report from {marketName || "this market"}:{" "}
                <strong>
                  {new Date(latestReportDate.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </strong>{" "}
                ({daysAgo(latestReportDate)} days ago). Prices may have changed since.
              </>
            ) : (
              <>No recent price report from {marketName || "this market"} in this period.</>
            )}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Last fetched: {formattedAsOf} IST</span>
        </div>

        {sources && Object.keys(sources).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-zinc-400">
              <Database className="w-3.5 h-3.5" /> Sources:
            </span>
            {Object.entries(sources).map(([src, count]) => (
              <span
                key={src}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md font-mono text-[11px]"
              >
                {sourceLabels[src] || src}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        {sourceAttribution ||
          "Source: Agmarknet, Directorate of Marketing & Inspection, Government of India (agmarknet.gov.in), via data.gov.in. Prices are reported by APMC mandis and are indicative only. No warranty of accuracy is expressed or implied."}
      </p>
    </div>
  );
};
