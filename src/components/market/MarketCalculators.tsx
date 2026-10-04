import React, { useEffect, useState } from "react";
import {
  Calculator,
  Warehouse,
  Coins,
  AlertCircle,
  Info,
  CloudRain,
  Truck,
  TrendingUp,
  Droplets,
  Wind,
  CheckCircle2,
  Calendar,
  Layers,
  RefreshCw,
  Ban,
} from "lucide-react";
import {
  fetchCropMargin,
  fetchStorageEstimate,
  MarginEstimateResponse,
  StorageEstimateResponse,
} from "../../lib/api/calculators";
import { fetchWeatherSummary, WeatherSummaryResponse } from "../../lib/api/weather";

interface MarketCalculatorsProps {
  commodity: string;
  market: string;
  state: string;
  currentPrice: number | null;
}

export const MarketCalculators: React.FC<MarketCalculatorsProps> = ({
  commodity,
  market,
  state,
  currentPrice,
}) => {
  // Margin Calculator state
  const [fieldSize, setFieldSize] = useState<number>(2.0);
  const [marginPriceOverride, setMarginPriceOverride] = useState<string>("");
  const [marginData, setMarginData] = useState<MarginEstimateResponse | null>(null);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginSearched, setMarginSearched] = useState(false);

  // Storage Estimator state
  const [storageMonths, setStorageMonths] = useState<number>(2);
  const [storageCostMonthly, setStorageCostMonthly] = useState<number>(25);
  const [storageData, setStorageData] = useState<StorageEstimateResponse | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  // Market-level Weather state (Architecture §9b.3)
  const [marketWeather, setMarketWeather] = useState<WeatherSummaryResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Load Margin
  const loadMargin = async () => {
    setMarginLoading(true);
    try {
      const priceToUse = marginPriceOverride ? parseFloat(marginPriceOverride) : (currentPrice ?? undefined);
      const res = await fetchCropMargin({
        crop: commodity,
        state: state,
        field_size_acres: fieldSize,
        market: market,
        price_per_qtl: priceToUse,
      });
      setMarginData(res);
      setMarginSearched(true);
    } catch (err) {
      console.warn("Error loading crop margin:", err);
      setMarginData(null);
      setMarginSearched(true);
    } finally {
      setMarginLoading(false);
    }
  };

  // Load Storage
  const loadStorage = async () => {
    setStorageLoading(true);
    try {
      const res = await fetchStorageEstimate({
        crop: commodity,
        market: market,
        state: state,
        storage_cost_per_qtl_per_month: storageCostMonthly,
        months: storageMonths,
        current_price: currentPrice ?? undefined,
      });
      setStorageData(res);
    } catch (err) {
      console.warn("Error loading storage estimate:", err);
      setStorageData(null);
    } finally {
      setStorageLoading(false);
    }
  };

  // Load Market Weather
  const loadMarketWeather = async () => {
    setWeatherLoading(true);
    try {
      const res = await fetchWeatherSummary({
        mandi: market,
        state: state,
      });
      setMarketWeather(res);
    } catch (err) {
      console.warn("Error loading mandi-level weather:", err);
      setMarketWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    loadMargin();
    loadStorage();
    loadMarketWeather();
  }, [commodity, market, state, currentPrice]);

  return (
    <div className="space-y-6">
      {/* Calculators Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Decision Calculators & Mandi Logistics
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Estimates derived from official benchmark datasets (DES Cost of Cultivation & WDRA manuals). Not farmer's actual costs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
            Official DES & WDRA References
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Crop Margin Calculator */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Crop Margin Calculator
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  DES Cost of Cultivation benchmark vs current price
                </p>
              </div>
            </div>
            {marginData && (
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded font-medium">
                Survey: {marginData.cost_year}
              </span>
            )}
          </div>

          {/* Form inputs */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Field Size (Acres)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={fieldSize}
                onChange={(e) => setFieldSize(parseFloat(e.target.value) || 1)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Selling Price (₹/qtl)
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder={currentPrice ? `Market: ₹${currentPrice}` : "Enter price"}
                  value={marginPriceOverride}
                  onChange={(e) => setMarginPriceOverride(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={loadMargin}
            disabled={marginLoading}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${marginLoading ? "animate-spin" : ""}`} />
            Recalculate Margin
          </button>

          {/* Result calculation */}
          {marginData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Comprehensive Cost (C2)</span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    ₹{marginData.cost_c2_per_qtl} / qtl
                  </span>
                  <span className="text-[9px] text-zinc-400 block">Includes land rent & interest</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Net Margin / Quintal</span>
                  <span
                    className={`text-sm font-bold ${
                      marginData.margin_per_qtl >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{marginData.margin_per_qtl}
                  </span>
                  <span className="text-[9px] text-zinc-400 block">Price − C2 Cost</span>
                </div>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-600 dark:text-zinc-300">
                    Est. Field Harvest ({fieldSize} acres @ {marginData.reference_yield_qtl_per_hectare} qtl/ha):
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100">
                    {marginData.est_total_yield_qtl} quintals
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Estimated Net Field Profit:
                  </span>
                  <span
                    className={`text-base font-extrabold ${
                      marginData.est_total_margin >= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    ₹{marginData.est_total_margin.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed italic">
                {marginData.notice}
              </p>
            </div>
          ) : marginSearched ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                No Cost Benchmark Available
              </div>
              <p className="text-[11px] leading-relaxed">
                No official DES Cost of Cultivation survey record on file for <strong>{commodity}</strong> in <strong>{state}</strong>. Per project policy, we do not guess or fabricate financial estimates.
              </p>
            </div>
          ) : null}
        </div>

        {/* Card 2: Storage Estimator (Hold vs Sell) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                <Warehouse className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Storage Estimator (Hold vs Sell)
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Breakeven math accounting for storage fees and shrinkage
                </p>
              </div>
            </div>
            {storageData && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  storageData.storable
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                }`}
              >
                {storageData.storable ? "Storable" : "Non-Storable"}
              </span>
            )}
          </div>

          {/* Form controls */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Holding Duration
              </label>
              <select
                value={storageMonths}
                onChange={(e) => setStorageMonths(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 Month</option>
                <option value={2}>2 Months</option>
                <option value={3}>3 Months</option>
                <option value={4}>4 Months</option>
                <option value={6}>6 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Storage Fee (₹/qtl/mo)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={storageCostMonthly}
                onChange={(e) => setStorageCostMonthly(parseFloat(e.target.value) || 0)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={loadStorage}
            disabled={storageLoading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${storageLoading ? "animate-spin" : ""}`} />
            Recalculate Storage Math
          </button>

          {/* Storage outcome */}
          {storageData && (
            <div className="space-y-3 pt-1">
              {!storageData.storable ? (
                /* Non-storable crop banner */
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                    <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Storage Not Recommended for {commodity}
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {storageData.reason}
                  </p>
                  <span className="text-[10px] text-zinc-400 block">
                    Source: {storageData.source}
                  </span>
                </div>
              ) : (
                /* Storable economics */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Holding Fee ({storageMonths} mo)</span>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        ₹{(storageCostMonthly * storageMonths).toFixed(2)} / qtl
                      </span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">
                        Shrinkage Loss ({storageData.typical_loss_pct_per_month}%/mo)
                      </span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        {((storageData.typical_loss_pct_per_month || 0) * storageMonths).toFixed(1)}% wt loss
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-600 dark:text-zinc-300">Total Storage Cost Burden:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">
                        +₹{storageData.net_cost_per_qtl} / qtl
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                      <span className="font-semibold text-blue-900 dark:text-blue-200">
                        Required Breakeven Price:
                      </span>
                      <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">
                        {storageData.breakeven_price_per_qtl
                          ? `₹${storageData.breakeven_price_per_qtl.toLocaleString("en-IN")} / qtl`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {storageData.historical_price_change_pct !== null && (
                    <div className="flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl text-[11px] text-zinc-600 dark:text-zinc-400">
                      <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>
                        In past years, prices for {commodity} in the following {storageMonths} month(s) were typically{" "}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          +{storageData.historical_price_change_pct}%
                        </strong>{" "}
                        at this time. (Historical reference, not a forecast).
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed italic">
                    {storageData.notice}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Market-level Weather Panel (Architecture §9b.3) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Mandi Logistics & Arrival Weather: {market} Mandi
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Weather conditions specifically at this market hub — assessing rainfall disruption to arrivals, loading, and transit
              </p>
            </div>
          </div>
          {marketWeather && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Grid: {marketWeather.location.grid_key}
            </span>
          )}
        </div>

        {weatherLoading ? (
          <div className="p-6 flex items-center justify-center space-x-2 text-zinc-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
            <span>Loading weather conditions for {market} mandi...</span>
          </div>
        ) : marketWeather ? (
          <div className="space-y-4">
            {/* Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Current Temp</span>
                <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {marketWeather.current?.temp_c != null ? `${marketWeather.current.temp_c}°C` : "—"}
                </span>
                <span className="text-[9px] text-zinc-400 block">At market site</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Relative Humidity</span>
                <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {marketWeather.current?.rh_pct != null ? `${marketWeather.current.rh_pct}%` : "—"}
                </span>
                <span className="text-[9px] text-zinc-400 block">Storage moisture risk</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Recent Rain (7d)</span>
                <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {marketWeather.metrics.rain_7d_mm} mm
                </span>
                <span className="text-[9px] text-zinc-400 block">Local mandi yard ground</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">Upcoming Rain Forecast</span>
                <span className="text-base font-bold text-sky-600 dark:text-sky-400">
                  {marketWeather.days
                    .filter((d) => d.phase === "future")
                    .slice(0, 3)
                    .reduce((sum, d) => sum + (d.precip_mm || 0), 0)
                    .toFixed(1)}{" "}
                  mm
                </span>
                <span className="text-[9px] text-zinc-400 block">Next 3 days combined</span>
              </div>
            </div>

            {/* 7-Day Arrival Disruption Forecast Strip */}
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
                7-Day Arrival Weather Forecast (Rain & Transit Window)
              </span>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs">
                {marketWeather.days
                  .filter((d) => d.phase === "today" || d.phase === "future")
                  .slice(0, 7)
                  .map((day, idx) => {
                    const hasRainRisk = (day.precip_mm || 0) > 5;
                    const dateFormatted = day.date.slice(5); // MM-DD
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border ${
                          hasRainRisk
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                            : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <span className="block text-[10px] font-medium text-zinc-400 mb-0.5">
                          {idx === 0 ? "Today" : dateFormatted}
                        </span>
                        <div className="flex justify-center my-1">
                          <CloudRain
                            className={`w-4 h-4 ${
                              hasRainRisk ? "text-amber-500" : "text-zinc-400"
                            }`}
                          />
                        </div>
                        <span className="block font-bold text-[11px]">
                          {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                        </span>
                        <span className="block text-[9px] text-zinc-400">
                          {day.precip_prob_pct != null ? `${day.precip_prob_pct}%` : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Practical takeaway */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <span>
                <strong>Mandi Logistics Insight:</strong> If heavy rainfall (&gt;10mm) is forecasted on your planned sale date, expect slower unloading and transit delays on approach roads to {market}. Consider tarpaulin covers for open trolley transport.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
            Mandi-level weather observation is resolving for {market}, {state}.
          </div>
        )}
      </div>
    </div>
  );
};
