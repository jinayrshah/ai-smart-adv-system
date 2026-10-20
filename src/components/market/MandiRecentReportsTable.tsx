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
    <div className="bg-white border border-[#c3cda7] rounded-3xl p-6 text-[#212529]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 text-left group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#f1efdf] text-[#07503f] rounded-2xl transition-all">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold font-serif text-[#07503f]">
                Recent Mandi Price Reports & Quality Audit
              </h4>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7] px-2.5 py-0.5 rounded-full">
                {records.length > 0 ? `${records.length} reports` : "Inspect"}
              </span>
            </div>
            <p className="text-xs text-[#555e4a] font-mono mt-0.5">
              Raw arrival observations from Agmarknet with statistical outlier quality flags
            </p>
          </div>
        </div>
        <div className="p-1 text-[#555e4a] group-hover:text-[#07503f] transition-colors">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-[#e2e8ce] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="text-[#555e4a] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#07503f]" />
              <span>Statistical IQR outlier detector active on all arrival records</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#212529]">
              <input
                type="checkbox"
                checked={includeFlagged}
                onChange={(e) => setIncludeFlagged(e.target.checked)}
                className="rounded border-[#c3cda7] bg-[#f1efdf] text-[#07503f] focus:ring-[#07503f]"
              />
              <span>Include flagged statistical outliers</span>
            </label>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs font-mono text-[#555e4a]">Loading reports...</div>
          ) : error ? (
            <div className="py-3 text-xs font-mono text-rose-600">{error}</div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-[#555e4a]">
              No recent arrival records found for {commodity} at {market}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#f1efdf] text-[#555e4a] text-[10px] uppercase tracking-wider border-b border-[#c3cda7]">
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
                <tbody className="divide-y divide-[#e2e8ce] font-medium">
                  {records.map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      className="hover:bg-[#f1efdf]/50 transition-colors text-[#212529]"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.arrival_date}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[#07503f]">{r.variety || "Other"}</span>
                        {r.grade && <span className="text-[#788365] ml-1">({r.grade})</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#555e4a]">
                        {r.min_price !== null ? `₹${r.min_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#555e4a]">
                        {r.max_price !== null ? `₹${r.max_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#07503f]">
                        {r.modal_price !== null ? `₹${r.modal_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#212529]">
                        {r.modal_price !== null ? `₹${(r.modal_price / 100).toFixed(1)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.quality_flag === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-[#3b5921] text-[11px] font-bold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
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
