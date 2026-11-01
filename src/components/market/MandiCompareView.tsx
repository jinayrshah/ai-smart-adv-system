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

const SERIES_COLORS = ["#07503f", "#2563eb", "#d97706"];
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
  if (val == null) return <span className="text-ink-soft text-sm">—</span>;
  const pos = val >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm font-bold ${
        pos ? "text-brand" : "text-rose-600"
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
    <div className="bg-surface rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand text-accent flex items-center justify-center shrink-0">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-brand text-xl sm:text-2xl leading-tight">
              Multi-Mandi Price Comparison
            </h3>
            <p className="text-sm text-ink-soft mt-0.5">
              Compare up to 3 markets for <span className="font-bold text-brand">{commodity || "—"}</span> · {rangeDays}-day window
            </p>
          </div>
        </div>
        {slots.length > 0 && (
          <span className="text-sm text-ink-soft bg-ground px-3 py-1 rounded-full border border-line font-semibold">
            {slots.length}/{MAX_SLOTS} markets added
          </span>
        )}
      </div>

      {/* No commodity selected guard */}
      {!commodity && (
        <div className="text-center py-8 text-ink-soft text-sm font-medium">
          Select a crop above to enable market comparison.
        </div>
      )}

      {commodity && (
        <>
          {/* Add Market Form */}
          {slots.length < MAX_SLOTS && (
            <div className="flex flex-wrap items-end gap-3 p-4 bg-ground border border-line rounded-2xl">
              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-1.5">
                  State
                </label>
                <select
                  value={addState}
                  onChange={(e) => { setAddState(e.target.value); setAddMarket(""); }}
                  className="bg-white border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:border-brand"
                >
                  <option value="">— Select state —</option>
                  {[
                    "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana",
                    "Karnataka", "Keralam", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab",
                    "Rajasthan", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s === "Keralam" ? "Kerala (Keralam)" : s}
                    </option>
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
                className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-accent rounded-full text-sm font-bold transition-all"
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-white"
                  style={{ borderColor: SERIES_COLORS[idx] + "60" }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: SERIES_COLORS[idx] }}
                  />
                  <span className="text-ink font-medium">
                    {s.slot.market}, {s.slot.state}
                  </span>
                  {s.loading && <Loader2 className="w-3 h-3 animate-spin text-ink-soft" />}
                  {s.error && <span className="text-rose-600 font-semibold">Error</span>}
                  <button
                    onClick={() => removeSlot(idx)}
                    className="text-ink-soft hover:text-ink transition ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {slots.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <p className="text-ink text-lg font-bold">
                Add two or more markets above to compare price trends side by side.
              </p>
              <p className="text-ink-soft text-sm">
                Or click <b className="text-brand">Compare</b> on any card in the Mandi Explorer below.
              </p>
            </div>
          )}

          {/* Overlay Chart */}
          {hasData && (
            <div className="space-y-6">
              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedPoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ecd5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#555e4a", fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => v.slice(5)}
                      stroke="#c3cda7"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#555e4a", fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
                      stroke="#c3cda7"
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #c3cda7",
                        borderRadius: "16px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "#212529",
                      }}
                      labelStyle={{ color: "#07503f", fontWeight: "bold", marginBottom: 4 }}
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
                      wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#555e4a" }}
                    />
                    {slots.map((s, idx) =>
                      s.data ? (
                        <Line
                          key={idx}
                          type="monotone"
                          dataKey={`modal_${idx}`}
                          stroke={SERIES_COLORS[idx]}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: SERIES_COLORS[idx] }}
                          activeDot={{ r: 5, fill: SERIES_COLORS[idx], stroke: "#ffffff", strokeWidth: 2 }}
                          connectNulls={true}
                        />
                      ) : null
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Comparison Table */}
              <div className="overflow-x-auto border border-line rounded-2xl">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-ground border-b border-line">
                      <th className="text-left py-3 px-4 text-ink-soft font-semibold">Market</th>
                      <th className="text-right py-3 px-4 text-ink-soft font-semibold">Latest Price</th>
                      <th className="text-right py-3 px-4 text-ink-soft font-semibold">7-Day Δ</th>
                      <th className="text-right py-3 px-4 text-ink-soft font-semibold">30-Day Δ</th>
                      <th className="text-right py-3 px-4 text-ink-soft font-semibold">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tint">
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
                          className={`hover:bg-[#f9f8f3] transition-colors ${isBest ? "bg-tint/30" : "bg-white"}`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: SERIES_COLORS[idx] }}
                              />
                              <div>
                                <span className="text-ink font-bold">{s.slot.market}</span>
                                <span className="text-ink-soft block text-sm">{s.slot.state}</span>
                              </div>
                              {isBest && (
                                <span className="ml-1 text-sm bg-brand text-accent px-2.5 py-0.5 rounded-full font-bold">
                                  Best Price
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {s.loading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-soft ml-auto" />
                            ) : s.error ? (
                              <span className="text-rose-600 text-sm font-bold">Error</span>
                            ) : latestModal != null ? (
                              <div>
                                <span className="text-ink font-bold">
                                  ₹{latestModal.toLocaleString("en-IN")}/qtl
                                </span>
                                <span className="text-ink-soft block text-sm">
                                  ₹{(latestModal / 100).toFixed(1)}/kg
                                </span>
                              </div>
                            ) : (
                              <span className="text-ink-soft">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pctBadge(d?.thin_data ? null : d?.change_7d_pct)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pctBadge(d?.thin_data ? null : d?.change_30d_pct)}
                          </td>
                          <td className="py-3 px-4 text-right text-ink-soft font-medium">
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
