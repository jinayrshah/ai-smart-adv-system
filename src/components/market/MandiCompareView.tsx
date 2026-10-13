import React, { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchMarketTrend, MarketTrendResponse, TrendPoint } from "../../services/marketApi";
import { X, Plus, TrendingUp, TrendingDown, Minus, Loader2, GitCompare } from "lucide-react";
import { MandiAutocomplete } from "./MandiAutocomplete";

export interface CompareSlot {
  state: string;
  market: string;
}

interface MandiCompareViewProps {
  commodity: string;
  rangeDays: 7 | 30 | 90 | 180;
  /** Slots pre-populated externally (e.g. from MandiExplore "Compare" button) */
  externalSlots?: CompareSlot[];
}

const SERIES_COLORS = ["#e8fe85", "#60a5fa", "#f97316"];
const SERIES_LABELS = ["Market A", "Market B", "Market C"];
const MAX_SLOTS = 3;

interface SlotData {
  slot: CompareSlot;
  data: MarketTrendResponse | null;
  loading: boolean;
  error: string | null;
}

/** Merge multiple point series into a unified date-keyed array for Recharts */
function mergePoints(slots: SlotData[]): Record<string, any>[] {
  const dateMap: Record<string, Record<string, any>> = {};
  slots.forEach((s, idx) => {
    if (!s.data) return;
    s.data.points.forEach((p: TrendPoint) => {
      if (!dateMap[p.date]) dateMap[p.date] = { date: p.date };
      dateMap[p.date][`modal_${idx}`] = p.modal;
    });
  });
  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
}

const pctBadge = (val: number | null | undefined) => {
  if (val == null) return <span className="text-stone-500 text-xs">—</span>;
  const pos = val >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold ${
        pos ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{val.toFixed(1)}%
    </span>
  );
};

export const MandiCompareView: React.FC<MandiCompareViewProps> = ({
  commodity,
  rangeDays,
  externalSlots,
}) => {
  const [slots, setSlots] = useState<SlotData[]>([]);
  // For the "add market" form
  const [addState, setAddState] = useState("");
  const [addMarket, setAddMarket] = useState("");
  const prevExternal = useRef<string>("");

  // Accept externally pushed slots (from MandiExplore Compare button)
  useEffect(() => {
    if (!externalSlots || externalSlots.length === 0) return;
    const sig = JSON.stringify(externalSlots);
    if (sig === prevExternal.current) return;
    prevExternal.current = sig;
    externalSlots.forEach((s) => addSlot(s.state, s.market));
  }, [externalSlots]);

  // Re-fetch all when commodity or rangeDays change
  useEffect(() => {
    setSlots((prev) =>
      prev.map((s) => ({ ...s, data: null, loading: true, error: null }))
    );
    slots.forEach((s, idx) => {
      if (!commodity || !s.slot.market) return;
      fetchMarketTrend(commodity, s.slot.market, s.slot.state, rangeDays)
        .then((data) =>
          setSlots((prev) =>
            prev.map((x, i) => (i === idx ? { ...x, data, loading: false } : x))
          )
        )
        .catch((err) =>
          setSlots((prev) =>
            prev.map((x, i) =>
              i === idx ? { ...x, error: err.message, loading: false } : x
            )
          )
        );
    });
  }, [commodity, rangeDays]);

  const addSlot = (state: string, market: string) => {
    if (!state || !market) return;
    // Prevent duplicates
    if (slots.some((s) => s.slot.state === state && s.slot.market === market)) return;
    if (slots.length >= MAX_SLOTS) return;

    const newSlot: SlotData = {
      slot: { state, market },
      data: null,
      loading: true,
      error: null,
    };
    setSlots((prev) => [...prev, newSlot]);

    fetchMarketTrend(commodity, market, state, rangeDays)
      .then((data) =>
        setSlots((prev) =>
          prev.map((s) =>
            s.slot.state === state && s.slot.market === market
              ? { ...s, data, loading: false }
              : s
          )
        )
      )
      .catch((err) =>
        setSlots((prev) =>
          prev.map((s) =>
            s.slot.state === state && s.slot.market === market
              ? { ...s, error: err.message, loading: false }
              : s
          )
        )
      );

    setAddState("");
    setAddMarket("");
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const mergedPoints = mergePoints(slots);
  const hasData = slots.some((s) => s.data && s.data.points.length > 0);

  return (
    <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center shrink-0">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-white text-lg leading-tight">
              Multi-Mandi Price Comparison
            </h3>
            <p className="text-xs text-stone-400 font-mono">
              Compare up to 3 markets for <span className="text-[#e8fe85]">{commodity || "—"}</span> · {rangeDays}-day window
            </p>
          </div>
        </div>
        {slots.length > 0 && (
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
            {slots.length}/{MAX_SLOTS} markets added
          </span>
        )}
      </div>

      {/* No commodity selected guard */}
      {!commodity && (
        <div className="text-center py-8 text-stone-500 text-sm">
          Select a crop above to enable market comparison.
        </div>
      )}

      {commodity && (
        <>
          {/* Add Market Form */}
          {slots.length < MAX_SLOTS && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-stone-900/60 border border-stone-800 rounded-2xl">
              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                  State
                </label>
                <select
                  value={addState}
                  onChange={(e) => { setAddState(e.target.value); setAddMarket(""); }}
                  className="bg-stone-900 border border-stone-700 rounded-full px-4 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#e8fe85]"
                >
                  <option value="">— Select state —</option>
                  {[
                    "Andhra Pradesh","Bihar","Chhattisgarh","Gujarat","Haryana",
                    "Karnataka","Madhya Pradesh","Maharashtra","Odisha","Punjab",
                    "Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal",
                  ].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <MandiAutocomplete
                state={addState}
                commodity={commodity}
                value={addMarket}
                onChange={setAddMarket}
              />

              <button
                onClick={() => addSlot(addState, addMarket)}
                disabled={!addState || !addMarket}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#07503f] hover:bg-[#0c6b54] disabled:opacity-40 disabled:cursor-not-allowed text-[#e8fe85] border border-[#e8fe85]/30 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Market
              </button>
            </div>
          )}

          {/* Slot Tags */}
          {slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.map((s, idx) => (
                <div
                  key={`${s.slot.state}-${s.slot.market}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono"
                  style={{ borderColor: SERIES_COLORS[idx] + "60", background: SERIES_COLORS[idx] + "12" }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: SERIES_COLORS[idx] }}
                  />
                  <span className="text-stone-200">
                    {s.slot.market}, {s.slot.state}
                  </span>
                  {s.loading && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
                  {s.error && <span className="text-rose-400">Error</span>}
                  <button
                    onClick={() => removeSlot(idx)}
                    className="text-stone-500 hover:text-stone-200 transition ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {slots.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <div className="text-3xl">📊</div>
              <p className="text-stone-400 text-sm">
                Add two or more markets above to compare price trends side by side.
              </p>
              <p className="text-stone-600 text-xs font-mono">
                Or click <b className="text-stone-500">Compare</b> on any card in the Mandi Explorer below.
              </p>
            </div>
          )}

          {/* Overlay Chart */}
          {hasData && (
            <div className="space-y-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedPoints} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => v.slice(5)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: "12px",
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                      labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
                      formatter={(value: any, name: string) => {
                        const idx = parseInt(name.replace("modal_", ""));
                        const slot = slots[idx];
                        const label = slot ? `${slot.slot.market} (${slot.slot.state})` : name;
                        return [`₹${Number(value).toLocaleString("en-IN")}/qtl`, label];
                      }}
                    />
                    <Legend
                      formatter={(value) => {
                        const idx = parseInt(value.replace("modal_", ""));
                        const slot = slots[idx];
                        return slot ? `${slot.slot.market}, ${slot.slot.state}` : value;
                      }}
                      wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}
                    />
                    {slots.map((s, idx) =>
                      s.data ? (
                        <Line
                          key={idx}
                          type="monotone"
                          dataKey={`modal_${idx}`}
                          stroke={SERIES_COLORS[idx]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: SERIES_COLORS[idx] }}
                          connectNulls={false}
                        />
                      ) : null
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-stone-800">
                      <th className="text-left py-2 px-3 text-stone-500 font-semibold uppercase tracking-wider">Market</th>
                      <th className="text-right py-2 px-3 text-stone-500 font-semibold uppercase tracking-wider">Latest Price</th>
                      <th className="text-right py-2 px-3 text-stone-500 font-semibold uppercase tracking-wider">7-Day Δ</th>
                      <th className="text-right py-2 px-3 text-stone-500 font-semibold uppercase tracking-wider">30-Day Δ</th>
                      <th className="text-right py-2 px-3 text-stone-500 font-semibold uppercase tracking-wider">Reports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s, idx) => {
                      const d = s.data;
                      const latestModal = d?.latest_modal ?? null;
                      const isBest =
                        latestModal != null &&
                        slots.every(
                          (other) =>
                            other.data?.latest_modal == null ||
                            latestModal >= other.data.latest_modal
                        );
                      return (
                        <tr
                          key={idx}
                          className={`border-b border-stone-900 ${isBest ? "bg-[#07503f]/10" : ""}`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: SERIES_COLORS[idx] }}
                              />
                              <div>
                                <span className="text-stone-100 font-semibold">{s.slot.market}</span>
                                <span className="text-stone-500 block text-[10px]">{s.slot.state}</span>
                              </div>
                              {isBest && (
                                <span className="ml-1 text-[10px] bg-[#07503f] text-[#e8fe85] px-2 py-0.5 rounded-full border border-[#e8fe85]/30 font-bold">
                                  Best Price
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {s.loading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500 ml-auto" />
                            ) : s.error ? (
                              <span className="text-rose-400 text-[10px]">Error</span>
                            ) : latestModal != null ? (
                              <div>
                                <span className="text-white font-bold">
                                  ₹{latestModal.toLocaleString("en-IN")}/qtl
                                </span>
                                <span className="text-stone-500 block text-[10px]">
                                  ₹{(latestModal / 100).toFixed(1)}/kg
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-600">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {pctBadge(d?.thin_data ? null : d?.change_7d_pct)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {pctBadge(d?.thin_data ? null : d?.change_30d_pct)}
                          </td>
                          <td className="py-3 px-3 text-right text-stone-400">
                            {d?.reports_in_window ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
