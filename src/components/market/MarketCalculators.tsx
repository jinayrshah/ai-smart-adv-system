import React, { useEffect, useRef, useState } from "react";
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
  /** saved farm size for a logged-in farmer (Revisions §2.7: prefill, always overridable) */
  defaultFieldSizeAcres?: number | null;
}

const DEBOUNCE_MS = 450;

export const MarketCalculators: React.FC<MarketCalculatorsProps> = ({
  commodity,
  market,
  state,
  currentPrice,
  defaultFieldSizeAcres,
}) => {
  // Margin Calculator state
  const [fieldSize, setFieldSize] = useState<number>(defaultFieldSizeAcres && defaultFieldSizeAcres > 0 ? defaultFieldSizeAcres : 2.0);
  const marginReq = useRef(0);
  const storageReq = useRef(0);
  const firstRender = useRef(true);

  useEffect(() => {
    if (defaultFieldSizeAcres && defaultFieldSizeAcres > 0) setFieldSize(defaultFieldSizeAcres);
  }, [defaultFieldSizeAcres]);
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
    const reqId = ++marginReq.current;
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
      if (reqId !== marginReq.current) return; // a newer request superseded this one
      setMarginData(res);
      setMarginSearched(true);
    } catch (err) {
      if (reqId !== marginReq.current) return;
      console.warn("Error loading crop margin:", err);
      setMarginData(null);
      setMarginSearched(true);
    } finally {
      if (reqId === marginReq.current) setMarginLoading(false);
    }
  };

  // Load Storage
  const loadStorage = async () => {
    const reqId = ++storageReq.current;
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
      if (reqId !== storageReq.current) return;
      setStorageData(res);
    } catch (err) {
      if (reqId !== storageReq.current) return;
      console.warn("Error loading storage estimate:", err);
      setStorageData(null);
    } finally {
      if (reqId === storageReq.current) setStorageLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commodity, market, state, currentPrice]);

  // Live recalculation as the farmer edits inputs (replaces the "Recalculate" buttons).
  useEffect(() => {
    if (firstRender.current) return;
    const t = setTimeout(loadMargin, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldSize, marginPriceOverride]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(loadStorage, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMonths, storageCostMonthly]);

  return (
    <div className="space-y-6">
      {/* Calculators Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
        <div>
          <h3 className="text-2xl font-bold font-serif text-stone-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            Decision Calculators & Mandi Logistics
          </h3>
          <p className="text-xs text-stone-400 font-mono mt-1">
            Estimates derived from official benchmark datasets (DES Cost of Cultivation & WDRA manuals).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 px-3.5 py-1 rounded-full shadow-sm">
            Official DES & WDRA References
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Crop Margin Calculator */}
        <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#07503f] text-[#e8fe85] rounded-2xl shadow-sm">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-base font-bold font-serif text-stone-100">
                  Crop Margin Calculator
                </h4>
                <p className="text-[11px] text-stone-400 font-mono">
                  DES Cost of Cultivation benchmark vs current price
                </p>
              </div>
            </div>
            {marginData && (
              <span className="text-[10px] font-mono bg-stone-900 border border-stone-800 text-stone-300 px-2.5 py-1 rounded-full">
                Survey: {marginData.cost_year}
              </span>
            )}
          </div>

          {/* Form inputs */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Field Size (Acres)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={fieldSize}
                onChange={(e) => setFieldSize(parseFloat(e.target.value) || 1)}
                className="w-full bg-stone-900 border border-stone-800 rounded-full px-4 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#e8fe85] shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Selling Price (₹/qtl)
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder={currentPrice ? `Market: ₹${currentPrice}` : "Enter price"}
                  value={marginPriceOverride}
                  onChange={(e) => setMarginPriceOverride(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-full px-4 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#e8fe85] shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="h-4 text-[11px] font-mono text-stone-400 flex items-center gap-1.5" aria-live="polite">
            {marginLoading && (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-[#e8fe85]" /> Updating…
              </>
            )}
          </div>

          {/* Result calculation */}
          {marginData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-stone-900 p-3.5 rounded-2xl border border-stone-800 space-y-1">
                  <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Comprehensive Cost (C2)</span>
                  <span className="text-base font-bold font-serif text-stone-100">
                    ₹{marginData.cost_c2_per_qtl} / qtl
                  </span>
                  <span className="text-[10px] font-mono text-[#e8fe85] block">
                    ₹{(marginData.cost_c2_per_qtl / 100).toFixed(1)} / kg
                  </span>
                  <span className="text-[9px] text-stone-500 block">Includes land rent & interest</span>
                </div>
                <div className="bg-stone-900 p-3.5 rounded-2xl border border-stone-800 space-y-1">
                  <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Net Margin / Quintal</span>
                  <span
                    className={`text-base font-bold font-serif ${
                      marginData.margin_per_qtl >= 0
                        ? "text-[#e8fe85]"
                        : "text-rose-400"
                    }`}
                  >
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{marginData.margin_per_qtl} / qtl
                  </span>
                  <span className="text-[10px] font-mono text-stone-300 block">
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{(marginData.margin_per_qtl / 100).toFixed(1)} / kg
                  </span>
                  <span className="text-[9px] text-stone-500 block">Price − C2 Cost</span>
                </div>
              </div>

              <div className="bg-[#07503f]/25 border border-[#07503f]/50 p-4 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-300 font-mono">
                    Est. Harvest ({fieldSize} ac @ {marginData.reference_yield_qtl_per_hectare} qtl/ha):
                  </span>
                  <span className="font-bold font-mono text-stone-100">
                    {marginData.est_total_yield_qtl} qtl
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-[#07503f]/40">
                  <span className="font-serif font-bold text-stone-200">
                    Estimated Net Field Profit:
                  </span>
                  <span
                    className={`text-lg font-bold font-serif ${
                      marginData.est_total_margin >= 0
                        ? "text-[#e8fe85]"
                        : "text-rose-400"
                    }`}
                  >
                    ₹{marginData.est_total_margin.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-stone-400 leading-relaxed italic font-mono">
                {marginData.notice}
              </p>
              <p className="text-[10px] text-stone-500 leading-relaxed pt-1.5 border-t border-stone-800 font-mono">
                <strong>Assumptions:</strong> Transport, handling, quality grade, and storage fees not included unless entered.
              </p>
            </div>
          ) : marginSearched ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="w-4 h-4 text-amber-400" />
                No Cost Benchmark Available
              </div>
              <p className="text-[11px] leading-relaxed font-mono">
                No official DES survey record on file for <strong>{commodity}</strong> in <strong>{state}</strong>. Per project policy, estimates are never fabricated.
              </p>
            </div>
          ) : null}
        </div>

        {/* Card 2: Storage Estimator (Hold vs Sell) */}
        <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-950/60 border border-blue-800/40 text-blue-300 rounded-2xl shadow-sm">
                <Warehouse className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-base font-bold font-serif text-stone-100">
                  Storage Estimator (Hold vs Sell)
                </h4>
                <p className="text-[11px] text-stone-400 font-mono">
                  Breakeven math accounting for storage fees and shrinkage
                </p>
              </div>
            </div>
            {storageData && (
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                  storageData.storable
                    ? "bg-[#07503f] text-[#e8fe85] border-[#e8fe85]/30"
                    : "bg-rose-950/60 text-rose-300 border-rose-800/50"
                }`}
              >
                {storageData.storable ? "Storable" : "Non-Storable"}
              </span>
            )}
          </div>

          {/* Form controls */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Holding Duration
              </label>
              <select
                value={storageMonths}
                onChange={(e) => setStorageMonths(parseInt(e.target.value) || 1)}
                className="w-full bg-stone-900 border border-stone-800 rounded-full px-4 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#e8fe85] shadow-inner"
              >
                <option value={1}>1 Month</option>
                <option value={2}>2 Months</option>
                <option value={3}>3 Months</option>
                <option value={4}>4 Months</option>
                <option value={6}>6 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Storage Fee (₹/qtl/mo)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={storageCostMonthly}
                onChange={(e) => setStorageCostMonthly(parseFloat(e.target.value) || 0)}
                className="w-full bg-stone-900 border border-stone-800 rounded-full px-4 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#e8fe85] shadow-inner"
              />
            </div>
          </div>

          <div className="h-4 text-[11px] font-mono text-stone-400 flex items-center gap-1.5" aria-live="polite">
            {storageLoading && (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-[#e8fe85]" /> Updating…
              </>
            )}
          </div>

          {/* Storage outcome */}
          {storageData && (
            <div className="space-y-3 pt-1">
              {!storageData.storable ? (
                /* Non-storable crop banner */
                <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300 font-serif text-sm">
                    <Ban className="w-4 h-4 text-rose-400" />
                    Storage Not Recommended for {commodity}
                  </div>
                  <p className="text-[11px] text-stone-300 leading-relaxed font-sans">
                    {storageData.reason}
                  </p>
                  <span className="text-[10px] font-mono text-stone-400 block">
                    Source: {storageData.source}
                  </span>
                </div>
              ) : (
                /* Storable economics */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-stone-900 p-3.5 rounded-2xl border border-stone-800 space-y-1">
                      <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Holding Fee ({storageMonths} mo)</span>
                      <span className="text-base font-bold font-serif text-stone-100 block">
                        ₹{(storageCostMonthly * storageMonths).toFixed(2)} / qtl
                      </span>
                      <span className="text-[10px] font-mono text-sky-400 block">
                        ₹{((storageCostMonthly * storageMonths) / 100).toFixed(2)} / kg
                      </span>
                    </div>
                    <div className="bg-stone-900 p-3.5 rounded-2xl border border-stone-800 space-y-1">
                      <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">
                        Shrinkage Loss ({storageData.typical_loss_pct_per_month}%/mo)
                      </span>
                      <span className="text-base font-bold font-serif text-amber-400 block">
                        {((storageData.typical_loss_pct_per_month || 0) * storageMonths).toFixed(1)}% loss
                      </span>
                      <span className="text-[9px] font-mono text-stone-500 block">weight loss</span>
                    </div>
                  </div>

                  <div className="bg-blue-950/25 border border-blue-800/50 p-4 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-300 font-mono">Total Storage Burden:</span>
                      <span className="font-bold font-mono text-stone-100">
                        +₹{storageData.net_cost_per_qtl} / qtl (+₹{(storageData.net_cost_per_qtl / 100).toFixed(2)} / kg)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-blue-800/40">
                      <span className="font-serif font-bold text-stone-200">
                        Required Breakeven Price:
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-bold font-serif text-[#e8fe85] block">
                          {storageData.breakeven_price_per_qtl
                            ? `₹${storageData.breakeven_price_per_qtl.toLocaleString("en-IN")} / qtl`
                            : "—"}
                        </span>
                        {storageData.breakeven_price_per_qtl && (
                          <span className="text-xs font-mono text-stone-400 block">
                            ₹{(storageData.breakeven_price_per_qtl / 100).toFixed(1)} / kg
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {storageData.historical_price_change_pct !== null && (
                    <div className="flex items-center gap-2 p-3 bg-stone-900 border border-stone-800 rounded-2xl text-[11px] text-stone-300 font-mono">
                      <TrendingUp className="w-4 h-4 text-[#e8fe85] shrink-0" />
                      <span>
                        Historical reference: prices for {commodity} in next {storageMonths} mo were typically{" "}
                        <strong className="text-[#e8fe85]">
                          +{storageData.historical_price_change_pct}%
                        </strong>.
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] text-stone-400 leading-relaxed italic font-mono">
                    {storageData.notice}
                  </p>
                  <p className="text-[10px] text-stone-500 leading-relaxed pt-1.5 border-t border-stone-800 font-mono">
                    <strong>Assumptions:</strong> Transport, commission, quality grade, and taxes are not included unless entered.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Market-level Weather Panel (Architecture §9b.3) */}
      <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-sky-950/60 border border-sky-800/40 text-sky-300 rounded-2xl shadow-sm">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-base font-bold font-serif text-stone-100 flex items-center gap-2">
                Mandi Logistics & Arrival Weather: {market} Mandi
              </h4>
              <p className="text-xs text-stone-400 font-mono">
                Weather conditions at this market hub — assessing rainfall disruption to arrivals, loading, and transit
              </p>
            </div>
          </div>
          {marketWeather?.location?.grid_key && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Grid: {marketWeather.location.grid_key}
            </span>
          )}
        </div>

        {weatherLoading ? (
          <div className="p-8 flex items-center justify-center space-x-2 text-stone-400 text-xs font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-[#e8fe85]" />
            <span>Loading weather conditions for {market} mandi...</span>
          </div>
        ) : marketWeather && marketWeather.location && Array.isArray(marketWeather.days) && marketWeather.metrics ? (
          <div className="space-y-5">
            {/* Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Current Temp</span>
                <span className="text-lg font-bold font-serif text-stone-100">
                  {marketWeather.current?.temp_c != null ? `${marketWeather.current.temp_c}°C` : "—"}
                </span>
                <span className="text-[9px] font-mono text-stone-500 block">At market site</span>
              </div>
              <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Relative Humidity</span>
                <span className="text-lg font-bold font-serif text-stone-100">
                  {marketWeather.current?.rh_pct != null ? `${marketWeather.current.rh_pct}%` : "—"}
                </span>
                <span className="text-[9px] font-mono text-stone-500 block">Storage moisture risk</span>
              </div>
              <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Recent Rain (7d)</span>
                <span className="text-lg font-bold font-serif text-stone-100">
                  {marketWeather.metrics.rain_7d_mm} mm
                </span>
                <span className="text-[9px] font-mono text-stone-500 block">Local mandi yard ground</span>
              </div>
              <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-stone-400 block uppercase tracking-wider">Upcoming Rain Forecast</span>
                <span className="text-lg font-bold font-serif text-sky-400">
                  {(marketWeather.days || [])
                    .filter((d) => d.phase === "future")
                    .slice(0, 3)
                    .reduce((sum, d) => sum + (d.precip_mm || 0), 0)
                    .toFixed(1)}{" "}
                  mm
                </span>
                <span className="text-[9px] font-mono text-stone-500 block">Next 3 days combined</span>
              </div>
            </div>

            {/* 7-Day Arrival Disruption Forecast Strip */}
            <div>
              <span className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest block mb-2.5">
                7-Day Arrival Weather Forecast (Rain & Transit Window)
              </span>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {(marketWeather.days || [])
                  .filter((d) => d.phase === "today" || d.phase === "future")
                  .slice(0, 7)
                  .map((day, idx) => {
                    const hasRainRisk = (day.precip_mm || 0) > 5;
                    const dateFormatted = day.date.slice(5); // MM-DD
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border transition-all ${
                          hasRainRisk
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                            : "bg-stone-900 border-stone-800 text-stone-200 hover:border-stone-700"
                        }`}
                      >
                        <span className="block text-[10px] font-mono font-medium text-stone-400 mb-1">
                          {idx === 0 ? "Today" : dateFormatted}
                        </span>
                        <div className="flex justify-center my-1.5">
                          <CloudRain
                            className={`w-4 h-4 ${
                              hasRainRisk ? "text-amber-400" : "text-stone-400"
                            }`}
                          />
                        </div>
                        <span className="block font-bold font-mono text-xs">
                          {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                        </span>
                        <span className="block text-[9px] font-mono text-stone-500 mt-0.5">
                          {day.precip_prob_pct != null ? `${day.precip_prob_pct}%` : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Practical takeaway */}
            <div className="p-4 bg-stone-900 rounded-2xl border border-stone-800 text-xs text-stone-300 font-sans flex items-start gap-3">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-stone-100">Mandi Logistics Insight:</strong> If heavy rainfall (&gt;10mm) is forecasted on your planned sale date, expect slower unloading and transit delays on approach roads to {market}. Consider tarpaulin covers for open trolley transport.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-stone-900 rounded-2xl border border-stone-800 text-xs font-mono text-stone-400">
            Mandi-level weather observation is resolving for {market}, {state}.
          </div>
        )}
      </div>
    </div>
  );
};
