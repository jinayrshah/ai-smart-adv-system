import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Database, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { fetchLatestPrices, LatestPriceRecord } from "../../services/marketApi";

interface MandiRecentReportsTableProps {
  commodity: string;
  market: string;
  state: string;
}

export const MandiRecentReportsTable: React.FC<MandiRecentReportsTableProps> = ({
  commodity,
  market,
  state,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [records, setRecords] = useState<LatestPriceRecord[]>([]);
  const [includeFlagged, setIncludeFlagged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLatestPrices(commodity, state, undefined, market, 10, includeFlagged);
      setRecords(res.records);
    } catch (err: any) {
      setError(err.message || "Failed to load recent mandi reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReports();
    }
  }, [isOpen, commodity, market, state, includeFlagged]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 text-left group"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl group-hover:text-emerald-600 transition-colors">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Recent Mandi Price Reports & Quality Audit
              </h4>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {records.length > 0 ? `${records.length} reports` : "Inspect"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Raw arrival observations from Agmarknet with statistical outlier quality flags
            </p>
          </div>
        </div>
        <div className="p-1 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Statistical IQR outlier detector active on all arrival records</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={includeFlagged}
                onChange={(e) => setIncludeFlagged(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Include flagged statistical outliers</span>
            </label>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-zinc-400">Loading reports...</div>
          ) : error ? (
            <div className="py-3 text-xs text-rose-600">{error}</div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              No recent arrival records found for {commodity} at {market}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th className="py-2.5 px-3">Arrival Date</th>
                    <th className="py-2.5 px-3">Variety / Grade</th>
                    <th className="py-2.5 px-3 text-right">Min (₹/qtl)</th>
                    <th className="py-2.5 px-3 text-right">Max (₹/qtl)</th>
                    <th className="py-2.5 px-3 text-right">Modal (₹/qtl)</th>
                    <th className="py-2.5 px-3 text-right">Modal (₹/kg)</th>
                    <th className="py-2.5 px-3">Quality Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                  {records.map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors text-zinc-800 dark:text-zinc-200"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.arrival_date}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold">{r.variety || "Other"}</span>
                        {r.grade && <span className="text-zinc-400 ml-1">({r.grade})</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-500">
                        {r.min_price !== null ? `₹${r.min_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-500">
                        {r.max_price !== null ? `₹${r.max_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {r.modal_price !== null ? `₹${r.modal_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-300">
                        {r.modal_price !== null ? `₹${(r.modal_price / 100).toFixed(1)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.quality_flag === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{r.quality_flag}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
