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
    <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 shadow-xl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-stone-900 border border-stone-800 text-stone-300 rounded-2xl group-hover:text-[#e8fe85] group-hover:border-[#e8fe85]/30 transition-all">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold font-serif text-stone-100">
                Recent Mandi Price Reports & Quality Audit
              </h4>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 px-2.5 py-0.5 rounded-full">
                {records.length > 0 ? `${records.length} reports` : "Inspect"}
              </span>
            </div>
            <p className="text-xs text-stone-400 font-mono mt-0.5">
              Raw arrival observations from Agmarknet with statistical outlier quality flags
            </p>
          </div>
        </div>
        <div className="p-1 text-stone-400 group-hover:text-[#e8fe85] transition-colors">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-stone-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="text-stone-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#e8fe85]" />
              <span>Statistical IQR outlier detector active on all arrival records</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-300">
              <input
                type="checkbox"
                checked={includeFlagged}
                onChange={(e) => setIncludeFlagged(e.target.checked)}
                className="rounded border-stone-700 bg-stone-900 text-[#07503f] focus:ring-[#e8fe85]"
              />
              <span>Include flagged statistical outliers</span>
            </label>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs font-mono text-stone-400">Loading reports...</div>
          ) : error ? (
            <div className="py-3 text-xs font-mono text-rose-400">{error}</div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-stone-400">
              No recent arrival records found for {commodity} at {market}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-stone-900 text-stone-400 text-[10px] uppercase tracking-wider border-b border-stone-800">
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
                <tbody className="divide-y divide-stone-800/60 font-medium">
                  {records.map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      className="hover:bg-stone-900/60 transition-colors text-stone-200"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.arrival_date}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-stone-100">{r.variety || "Other"}</span>
                        {r.grade && <span className="text-stone-500 ml-1">({r.grade})</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-stone-400">
                        {r.min_price !== null ? `₹${r.min_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-stone-400">
                        {r.max_price !== null ? `₹${r.max_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#e8fe85]">
                        {r.modal_price !== null ? `₹${r.modal_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-stone-300">
                        {r.modal_price !== null ? `₹${(r.modal_price / 100).toFixed(1)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.quality_flag === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-[#e8fe85] text-[11px]">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800">
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
