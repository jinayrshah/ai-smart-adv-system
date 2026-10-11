import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendPoint } from "../../services/marketApi";

interface PriceTrendChartProps {
  points: TrendPoint[];
  unit: string;
  rangeDays: 7 | 30 | 90 | 180;
  onRangeChange: (days: 7 | 30 | 90 | 180) => void;
  isLoading?: boolean;
}

/** Revisions §2.7: below this many reports a line chart of isolated dots looks broken. */
export const THIN_DATA_MIN_REPORTS = 3;

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    const data: TrendPoint = payload[0].payload;
    if (data.modal === null || data.modal === undefined) {
      return (
        <div className="bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{label}</p>
          <p className="text-amber-600 dark:text-amber-400 font-medium">No mandi report filed on this date</p>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-zinc-800 p-3.5 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1.5 min-w-[160px]">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-700 pb-1">
          {label}
        </p>
        <div className="flex justify-between items-baseline gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
          <span>Modal:</span>
          <div className="text-right">
            <span>₹{data.modal.toLocaleString("en-IN")}/qtl</span>
            <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              ₹{(data.modal / 100).toFixed(1)}/kg
            </span>
          </div>
        </div>
        {data.min !== null && data.max !== null && (
          <div className="flex justify-between items-baseline gap-2 text-zinc-500 dark:text-zinc-400">
            <span>Band:</span>
            <div className="text-right">
              <span>₹{data.min} – ₹{data.max}/qtl</span>
              <span className="block text-[10px] text-zinc-400">
                ₹{(data.min / 100).toFixed(1)} – ₹{(data.max / 100).toFixed(1)}/kg
              </span>
            </div>
          </div>
        )}
        {data.n_varieties > 0 && (
          <div className="flex justify-between items-center text-zinc-400 text-[11px]">
            <span>Varieties:</span>
            <span>{data.n_varieties}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({
  points,
  unit,
  rangeDays,
  onRangeChange,
  isLoading,
}) => {
  const reports = points.filter((p) => p.modal !== null && p.modal !== undefined);
  const hasData = reports.length > 0;
  const isThin = hasData && reports.length < THIN_DATA_MIN_REPORTS;

  // Format data for chart display
  const chartData = points.map((p) => ({
    ...p,
    // Formatted label (e.g. "02 Oct")
    displayDate: new Date(p.date + "T00:00:00").toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
    rangeBand: p.min !== null && p.max !== null ? [p.min, p.max] : null,
  }));

  const ranges: (7 | 30 | 90 | 180)[] = [7, 30, 90, 180];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Price Trend & Fluctuation
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Modal price line with daily min/max arrival band. Gaps indicate days with no APMC report.
          </p>
        </div>

        <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                rangeDays === r
                  ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {!hasData && !isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            No price reports available for this commodity/market in this timeframe.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Try expanding the date range or selecting another priority mandi.
          </p>
        </div>
      ) : isThin && !isLoading ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3">
            Only {reports.length} report{reports.length === 1 ? "" : "s"} in the last {rangeDays} days — too few to draw a
            trend. The reports are listed below.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-1.5 pr-4 font-semibold">Date</th>
                  <th className="py-1.5 pr-4 font-semibold">Modal (₹/qtl)</th>
                  <th className="py-1.5 pr-4 font-semibold">₹/kg</th>
                  <th className="py-1.5 font-semibold">Min – Max (₹/qtl)</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800 dark:text-zinc-200">
                {reports
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.date} className="border-t border-amber-200/60 dark:border-amber-800/40">
                      <td className="py-1.5 pr-4">
                        {new Date(p.date + "T00:00:00").toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-1.5 pr-4 font-semibold">{(p.modal as number).toLocaleString("en-IN")}</td>
                      <td className="py-1.5 pr-4">{((p.modal as number) / 100).toFixed(2)}</td>
                      <td className="py-1.5">
                        {p.min !== null && p.max !== null
                          ? `${p.min.toLocaleString("en-IN")} – ${p.max.toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="priceBandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:stroke-zinc-800" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11 }}
                stroke="#a1a1aa"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#a1a1aa"
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip content={<CustomTooltip unit={unit} />} />
              {/* Min-Max Band */}
              <Area
                type="monotone"
                dataKey="max"
                stroke="transparent"
                fill="url(#priceBandGradient)"
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Modal Price Line - connectNulls=false to render gaps honestly */}
              <Line
                type="monotone"
                dataKey="modal"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#059669" }}
                activeDot={{ r: 6, fill: "#047857" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
