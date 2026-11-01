import React, { useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TrendPoint } from "../../services/marketApi";

interface PriceTrendChartProps {
  points: TrendPoint[];
  unit: string;
  rangeDays: 7 | 30 | 90 | 180;
  onRangeChange: (days: 7 | 30 | 90 | 180) => void;
  isLoading?: boolean;
}

/** Revisions §2.7: below this many reports a line chart of isolated dots looks broken. */
export const THIN_DATA_MIN_REPORTS = 3;

const BRAND = "var(--color-brand)";
const RANGES: { d: 7 | 30 | 90 | 180; l: string }[] = [
  { d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 90, l: "3 months" }, { d: 180, l: "6 months" },
];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (iso: string, year = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: TrendPoint = payload[0].payload;
  return (
    <div className="bg-surface border border-line rounded-xl px-3 py-2 shadow-lg text-sm num">
      <p className="text-ink-soft">{day(p.date, true)}</p>
      {p.modal == null ? (
        <p className="text-ink">No mandi report this day</p>
      ) : (
        <>
          <p className="text-ink font-semibold">{inr(p.modal)} per quintal <span className="font-normal text-ink-soft">({inr(p.modal / 100)}/kg)</span></p>
          {p.min != null && p.max != null && <p className="text-ink-soft">Lowest {inr(p.min)}, highest {inr(p.max)}</p>}
        </>
      )}
    </div>
  );
}

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ points, rangeDays, onRangeChange, isLoading }) => {
  const [asTable, setAsTable] = useState(false);
  const reports = points.filter((p) => p.modal != null);
  const hasData = reports.length > 0;
  const isThin = hasData && reports.length < THIN_DATA_MIN_REPORTS;

  const data = useMemo(
    () => points.map((p) => ({ ...p, band: p.min != null && p.max != null ? [p.min, p.max] : null })),
    [points],
  );
  const first = reports[0];
  const last = reports[reports.length - 1];
  const avg = hasData ? reports.reduce((s, p) => s + (p.modal as number), 0) / reports.length : 0;
  const change = first && last && first !== last ? (last.modal as number) - (first.modal as number) : null;
  const changePct = change != null ? (change / (first.modal as number)) * 100 : null;

  return (
    <section className="bg-surface rounded-2xl p-5 sm:p-6 text-ink">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Price trend</h2>
          {change != null && (
            <p className={`mt-1 num ${change > 0 ? "text-good" : change < 0 ? "text-bad" : "text-ink-soft"}`}>
              {change === 0 ? "Unchanged" : `${change > 0 ? "Up" : "Down"} ${inr(Math.abs(change))} (${Math.abs(changePct!).toFixed(1)}%)`}
              <span className="text-ink-soft"> since {day(first.date)}</span>
            </p>
          )}
        </div>
        <div role="tablist" aria-label="Time range" className="inline-flex self-start rounded-full bg-ash p-1">
          {RANGES.map((r) => (
            <button key={r.d} role="tab" aria-selected={rangeDays === r.d} onClick={() => onRangeChange(r.d)}
              className={`h-9 px-3 rounded-full text-sm ${rangeDays === r.d ? "bg-surface text-ink font-semibold" : "text-ink-soft hover:text-ink"}`}>
              {r.l}
            </button>
          ))}
        </div>
      </div>

      {!hasData && !isLoading ? (
        <p className="mt-6 rounded-xl bg-ground px-4 py-6 text-ink-soft">
          No price reports for this market in the last {rangeDays} days. Try a longer range or another market.
        </p>
      ) : isThin || asTable ? (
        <div className="mt-6 overflow-x-auto">
          {isThin && <p className="mb-3 text-ink-soft">Only {reports.length} report{reports.length === 1 ? "" : "s"} in this period, too few for a trend line.</p>}
          <table className="w-full text-left num">
            <thead className="text-sm text-ink-soft">
              <tr><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium text-right">Modal ₹/qtl</th><th className="py-2 pr-4 font-medium text-right">₹/kg</th><th className="py-2 font-medium text-right">Low – high ₹/qtl</th></tr>
            </thead>
            <tbody>
              {reports.slice().reverse().map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="py-2 pr-4">{day(p.date, true)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{(p.modal as number).toLocaleString("en-IN")}</td>
                  <td className="py-2 pr-4 text-right">{((p.modal as number) / 100).toFixed(2)}</td>
                  <td className="py-2 text-right">{p.min != null && p.max != null ? `${p.min.toLocaleString("en-IN")} – ${p.max.toLocaleString("en-IN")}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 h-72" role="img" aria-label={`Modal price over the last ${rangeDays} days, latest ${last ? inr(last.modal as number) : ""} per quintal`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" strokeOpacity={0.6} />
              <XAxis dataKey="date" tickFormatter={(d) => day(d)} minTickGap={40} tickLine={false} axisLine={false}
                tick={{ fontSize: 13, fill: "var(--color-ink-soft)" }} />
              <YAxis width={64} tickCount={4} domain={["auto", "auto"]} tickFormatter={inr} tickLine={false} axisLine={false}
                tick={{ fontSize: 13, fill: "var(--color-ink-soft)" }} />
              <Tooltip content={<Tip />} cursor={{ stroke: "var(--color-ink-muted)", strokeWidth: 1 }} />
              <Area dataKey="band" stroke="none" fill={BRAND} fillOpacity={0.1} isAnimationActive={false} connectNulls={false} activeDot={false} />
              <ReferenceLine y={avg} stroke="var(--color-ink-muted)" strokeDasharray="4 4"
                label={{ value: `Average ${inr(avg)}`, position: "insideTopLeft", fill: "var(--color-ink-soft)", fontSize: 13 }} />
              <Line dataKey="modal" stroke={BRAND} strokeWidth={2} isAnimationActive={false} connectNulls={false}
                dot={reports.length <= 20 ? { r: 4, fill: BRAND, stroke: "var(--color-surface)", strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: BRAND, stroke: "var(--color-surface)", strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasData && !isThin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <p>
            Line: the most common (modal) price each day. Shaded: lowest to highest price that day.
            Breaks in the line are days with no report.
          </p>
          <button onClick={() => setAsTable(!asTable)} className="text-brand font-medium underline underline-offset-4">
            {asTable ? "Show chart" : "Show as table"}
          </button>
        </div>
      )}
    </section>
  );
};
