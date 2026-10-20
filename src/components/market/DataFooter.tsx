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
    <div className="mt-8 pt-5 border-t border-[#c3cda7] text-xs text-[#555e4a] font-mono space-y-4">
      {stale && (
        <div className="flex items-center gap-2.5 p-3.5 bg-[#fceace] border border-[#f5cba7] rounded-2xl text-[#93521e]">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#93521e]" />
          <span>
            {latestReportDate ? (
              <>
                Latest report from {marketName || "this market"}:{" "}
                <strong className="font-bold text-[#6d370e]">
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
        <div className="flex items-center gap-2 text-[#555e4a]">
          <Clock className="w-3.5 h-3.5 text-[#07503f]" />
          <span>Last fetched: {formattedAsOf} IST</span>
        </div>

        {sources && Object.keys(sources).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[#555e4a]">
              <Database className="w-3.5 h-3.5 text-[#07503f]" /> Sources:
            </span>
            {Object.entries(sources).map(([src, count]) => (
              <span
                key={src}
                className="px-2.5 py-0.5 bg-[#f1efdf] border border-[#c3cda7] text-[#212529] rounded-full font-mono text-[10px]"
              >
                {sourceLabels[src] || src}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-[#555e4a] font-mono">
        {sourceAttribution ||
          "Source: Agmarknet, Directorate of Marketing & Inspection, Government of India (agmarknet.gov.in), via data.gov.in. Prices are reported by APMC mandis and are indicative only. Non-predictive."}
      </p>
    </div>
  );
};
