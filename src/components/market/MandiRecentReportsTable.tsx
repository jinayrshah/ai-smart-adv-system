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
    <div className="bg-surface rounded-2xl p-6 text-ink">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 text-left group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-ground text-brand rounded-2xl transition-all">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-brand">
                Recent Mandi Price Reports & Quality Audit
              </h4>
              <span className="text-sm font-bold bg-tint text-good border border-line px-2.5 py-0.5 rounded-full">
                {records.length > 0 ? `${records.length} reports` : "Inspect"}
              </span>
            </div>
            <p className="text-sm text-ink-soft mt-0.5">
              Raw arrival observations from Agmarknet with statistical outlier quality flags
            </p>
          </div>
        </div>
        <div className="p-1 text-ink-soft group-hover:text-brand transition-colors">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-line space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-ink-soft flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand" />
              <span>Statistical IQR outlier detector active on all arrival records</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-ink">
              <input
                type="checkbox"
                checked={includeFlagged}
                onChange={(e) => setIncludeFlagged(e.target.checked)}
                className="rounded border-line bg-ground text-brand focus:ring-brand"
              />
              <span>Include flagged statistical outliers</span>
            </label>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-ink-soft">Loading reports...</div>
          ) : error ? (
            <div className="py-3 text-sm text-rose-600">{error}</div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-soft">
              No recent arrival records found for {commodity} at {market}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-ground text-ink-soft text-sm border-b border-line">
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
                <tbody className="divide-y divide-line font-medium">
                  {records.map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      className="hover:bg-ground/50 transition-colors text-ink"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.arrival_date}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-brand">{r.variety || "Other"}</span>
                        {r.grade && <span className="text-ink-muted ml-1">({r.grade})</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-soft">
                        {r.min_price !== null ? `₹${r.min_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-soft">
                        {r.max_price !== null ? `₹${r.max_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-brand">
                        {r.modal_price !== null ? `₹${r.modal_price}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink">
                        {r.modal_price !== null ? `₹${(r.modal_price / 100).toFixed(1)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.quality_flag === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-good text-sm font-bold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold bg-rose-50 text-rose-800 border border-rose-200">
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
