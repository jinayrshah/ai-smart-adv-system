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
        <div className="bg-white border border-[#c3cda7] p-3 rounded-2xl shadow-xl text-xs font-mono text-[#212529]">
          <p className="font-semibold text-[#07503f] mb-1">{label}</p>
          <p className="text-amber-700 font-medium">No mandi report filed on this date</p>
        </div>
      );
    }

    return (
      <div className="bg-white border border-[#c3cda7] p-4 rounded-2xl shadow-xl text-xs font-mono space-y-1.5 min-w-[170px] text-[#212529]">
        <p className="font-semibold text-[#07503f] border-b border-[#e2e8ce] pb-1.5">
          {label}
        </p>
        <div className="flex justify-between items-baseline gap-2 text-[#07503f] font-bold text-sm">
          <span>Modal:</span>
          <div className="text-right">
            <span>₹{data.modal.toLocaleString("en-IN")}/qtl</span>
            <span className="block text-[11px] font-medium text-[#555e4a]">
              ₹{(data.modal / 100).toFixed(1)}/kg
            </span>
          </div>
        </div>
        {data.min !== null && data.max !== null && (
          <div className="flex justify-between items-baseline gap-2 text-[#555e4a]">
            <span>Band:</span>
            <div className="text-right">
              <span>₹{data.min} – ₹{data.max}/qtl</span>
              <span className="block text-[10px] text-[#788365]">
                ₹{(data.min / 100).toFixed(1)} – ₹{(data.max / 100).toFixed(1)}/kg
              </span>
            </div>
          </div>
        )}
        {data.n_varieties > 0 && (
          <div className="flex justify-between items-center text-[#555e4a] text-[11px] pt-1 border-t border-[#e2e8ce]">
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
    <div className="bg-white border border-[#c3cda7] rounded-3xl p-6 text-[#212529]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold font-serif text-[#07503f]">
            Price Trend & Fluctuation
          </h3>
          <p className="text-xs text-[#555e4a] font-mono mt-0.5">
            Modal price line with daily min/max arrival band. Gaps indicate days with no APMC report.
          </p>
        </div>

        <div className="inline-flex p-1 bg-[#f1efdf] border border-[#c3cda7] rounded-full">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3.5 py-1 text-xs font-mono uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                rangeDays === r
                  ? "bg-[#07503f] text-[#e8fe85] font-bold shadow-sm"
                  : "text-[#555e4a] hover:text-[#07503f]"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {!hasData && !isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-[#f1efdf]/60 rounded-2xl border border-dashed border-[#c3cda7]">
          <p className="text-sm font-medium text-[#212529]">
            No price reports available for this commodity/market in this timeframe.
          </p>
          <p className="text-xs text-[#555e4a] mt-1 font-mono">
            Try expanding the date range or selecting another priority mandi.
          </p>
        </div>
      ) : isThin && !isLoading ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-3">
            Only {reports.length} report{reports.length === 1 ? "" : "s"} in the last {rangeDays} days — too few to draw a
            trend. The reports are listed below.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="text-[#555e4a]">
                <tr>
                  <th className="py-1.5 pr-4 font-semibold">Date</th>
                  <th className="py-1.5 pr-4 font-semibold">Modal (₹/qtl)</th>
                  <th className="py-1.5 pr-4 font-semibold">₹/kg</th>
                  <th className="py-1.5 font-semibold">Min – Max (₹/qtl)</th>
                </tr>
              </thead>
              <tbody className="text-[#212529]">
                {reports
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.date} className="border-t border-amber-200">
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
                  <stop offset="5%" stopColor="#07503f" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#07503f" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8ce" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: '#788365' }}
                stroke="#c3cda7"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#788365' }}
                stroke="#c3cda7"
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
                connectNulls={true}
              />
              {/* Modal Price Line */}
              <Line
                type="monotone"
                dataKey="modal"
                stroke="#07503f"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#07503f", stroke: "#e8fe85", strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: "#07503f", stroke: "#e8fe85", strokeWidth: 2 }}
                connectNulls={true}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
