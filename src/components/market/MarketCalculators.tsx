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
    <div className="space-y-6 text-[#212529]">
      {/* Calculators Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e8ce] pb-4">
        <div>
          <h3 className="text-2xl font-bold font-serif text-[#07503f] flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            Decision Calculators & Mandi Logistics
          </h3>
          <p className="text-xs text-[#555e4a] font-mono mt-1">
            Estimates derived from official benchmark datasets (DES Cost of Cultivation & WDRA manuals).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07503f] text-[#e8fe85] px-3.5 py-1 rounded-full shadow-sm">
            Official DES & WDRA References
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Crop Margin Calculator */}
        <div className="bg-white border border-[#c3cda7] rounded-3xl p-6 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e2e8ce] pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#07503f] text-[#e8fe85] rounded-2xl">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-base font-bold font-serif text-[#07503f]">
                  Crop Margin Calculator
                </h4>
                <p className="text-[11px] text-[#555e4a] font-mono">
                  DES Cost of Cultivation benchmark vs current price
                </p>
              </div>
            </div>
            {marginData && (
              <span className="text-[10px] font-mono bg-[#f1efdf] border border-[#c3cda7] text-[#555e4a] px-2.5 py-1 rounded-full">
                Survey: {marginData.cost_year}
              </span>
            )}
          </div>

          {/* Form inputs */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest mb-1.5">
                Field Size (Acres)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={fieldSize}
                onChange={(e) => setFieldSize(parseFloat(e.target.value) || 1)}
                className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full px-4 py-2 text-xs font-mono text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#07503f]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest mb-1.5">
                Selling Price (₹/qtl)
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder={currentPrice ? `Market: ₹${currentPrice}` : "Enter price"}
                  value={marginPriceOverride}
                  onChange={(e) => setMarginPriceOverride(e.target.value)}
                  className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full px-4 py-2 text-xs font-mono text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#07503f]"
                />
              </div>
            </div>
          </div>

          <div className="h-4 text-[11px] font-mono text-[#555e4a] flex items-center gap-1.5" aria-live="polite">
            {marginLoading && (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-[#07503f]" /> Updating…
              </>
            )}
          </div>

          {/* Result calculation */}
          {marginData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#fceace]/60 p-3.5 rounded-2xl border border-[#f5d5b0] space-y-1">
                  <span className="text-[10px] font-mono text-[#8a4b12] block uppercase tracking-wider font-bold">Cost of Production (C2)</span>
                  <span className="text-base font-bold font-serif text-[#8a4b12]">
                    ₹{marginData.cost_c2_per_qtl} / qtl
                  </span>
                  <span className="text-[10px] font-mono text-[#8a4b12]/80 block">
                    ₹{(marginData.cost_c2_per_qtl / 100).toFixed(1)} / kg
                  </span>
                  <span className="text-[9px] text-[#555e4a] block">Includes land rent & interest</span>
                </div>
                <div className="bg-[#e6ecd5]/70 p-3.5 rounded-2xl border border-[#c3cda7] space-y-1">
                  <span className="text-[10px] font-mono text-[#3b5921] block uppercase tracking-wider font-bold">Net Margin / Quintal</span>
                  <span
                    className={`text-base font-bold font-serif ${
                      marginData.margin_per_qtl >= 0
                        ? "text-[#3b5921]"
                        : "text-rose-700"
                    }`}
                  >
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{marginData.margin_per_qtl} / qtl
                  </span>
                  <span className="text-[10px] font-mono text-[#555e4a] block">
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{(marginData.margin_per_qtl / 100).toFixed(1)} / kg
                  </span>
                  <span className="text-[9px] text-[#555e4a] block">Selling Price − C2 Cost</span>
                </div>
              </div>

              <div className="bg-[#07503f] text-[#f1efdf] p-4 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#f1efdf]/80 font-mono">
                    Est. Harvest ({fieldSize} ac @ {marginData.reference_yield_qtl_per_hectare} qtl/ha):
                  </span>
                  <span className="font-bold font-mono text-white">
                    {marginData.est_total_yield_qtl} qtl
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-white/20">
                  <span className="font-serif font-bold text-white">
                    Estimated Net Field Profit:
                  </span>
                  <span
                    className={`text-lg font-bold font-serif ${
                      marginData.est_total_margin >= 0
                        ? "text-[#e8fe85]"
                        : "text-rose-300"
                    }`}
                  >
                    ₹{marginData.est_total_margin.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#555e4a] leading-relaxed italic font-mono">
                {marginData.notice}
              </p>
              <p className="text-[10px] text-[#788365] leading-relaxed pt-1.5 border-t border-[#e2e8ce] font-mono">
                <strong>Assumptions:</strong> Transport, handling, quality grade, and storage fees not included unless entered.
              </p>
            </div>
          ) : marginSearched ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-amber-600" />
                No Cost Benchmark Available
              </div>
              <p className="text-[11px] leading-relaxed font-mono">
                No official DES survey record on file for <strong>{commodity}</strong> in <strong>{state}</strong>. Per project policy, estimates are never fabricated.
              </p>
            </div>
          ) : null}
        </div>

        {/* Card 2: Storage Estimator (Hold vs Sell) */}
        <div className="bg-white border border-[#c3cda7] rounded-3xl p-6 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e2e8ce] pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#b2cee7]/50 text-[#18486b] rounded-2xl">
                <Warehouse className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-base font-bold font-serif text-[#07503f]">
                  Storage Estimator (Hold vs Sell)
                </h4>
                <p className="text-[11px] text-[#555e4a] font-mono">
                  Breakeven math accounting for storage fees and shrinkage
                </p>
              </div>
            </div>
            {storageData && (
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                  storageData.storable
                    ? "bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {storageData.storable ? "Storable" : "Non-Storable"}
              </span>
            )}
          </div>

          {/* Form controls */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest mb-1.5">
                Holding Duration
              </label>
              <select
                value={storageMonths}
                onChange={(e) => setStorageMonths(parseInt(e.target.value) || 1)}
                className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full px-4 py-2 text-xs font-mono text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#07503f]"
              >
                <option value={1}>1 Month</option>
                <option value={2}>2 Months</option>
                <option value={3}>3 Months</option>
                <option value={4}>4 Months</option>
                <option value={6}>6 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest mb-1.5">
                Storage Fee (₹/qtl/mo)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={storageCostMonthly}
                onChange={(e) => setStorageCostMonthly(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full px-4 py-2 text-xs font-mono text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#07503f]"
              />
            </div>
          </div>

          <div className="h-4 text-[11px] font-mono text-[#555e4a] flex items-center gap-1.5" aria-live="polite">
            {storageLoading && (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-[#07503f]" /> Updating…
              </>
            )}
          </div>

          {/* Storage outcome */}
          {storageData && (
            <div className="space-y-3 pt-1">
              {!storageData.storable ? (
                /* Non-storable crop banner */
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-800 font-serif text-sm">
                    <Ban className="w-4 h-4 text-rose-600" />
                    Storage Not Recommended for {commodity}
                  </div>
                  <p className="text-[11px] text-[#212529] leading-relaxed font-sans">
                    {storageData.reason}
                  </p>
                  <span className="text-[10px] font-mono text-[#555e4a] block">
                    Source: {storageData.source}
                  </span>
                </div>
              ) : (
                /* Storable economics */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-[#b2cee7]/40 p-3.5 rounded-2xl border border-[#b2cee7] space-y-1">
                      <span className="text-[10px] font-mono text-[#18486b] block uppercase tracking-wider font-bold">Holding Fee ({storageMonths} mo)</span>
                      <span className="text-base font-bold font-serif text-[#18486b] block">
                        ₹{(storageCostMonthly * storageMonths).toFixed(2)} / qtl
                      </span>
                      <span className="text-[10px] font-mono text-[#18486b]/80 block">
                        ₹{((storageCostMonthly * storageMonths) / 100).toFixed(2)} / kg
                      </span>
                    </div>
                    <div className="bg-[#efefef] p-3.5 rounded-2xl border border-[#d8d8d8] space-y-1">
                      <span className="text-[10px] font-mono text-[#4a4f55] block uppercase tracking-wider font-bold">
                        Shrinkage ({storageData.typical_loss_pct_per_month}%/mo)
                      </span>
                      <span className="text-base font-bold font-serif text-[#212529] block">
                        {((storageData.typical_loss_pct_per_month || 0) * storageMonths).toFixed(1)}% loss
                      </span>
                      <span className="text-[9px] font-mono text-[#6c757d] block">estimated weight loss</span>
                    </div>
                  </div>

                  <div className="bg-[#07503f] text-[#f1efdf] p-4 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#f1efdf]/80 font-mono">Total Storage Burden:</span>
                      <span className="font-bold font-mono text-white">
                        +₹{storageData.net_cost_per_qtl} / qtl (+₹{(storageData.net_cost_per_qtl / 100).toFixed(2)} / kg)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-white/20">
                      <span className="font-serif font-bold text-white">
                        Required Breakeven Price:
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-bold font-serif text-[#e8fe85] block">
                          {storageData.breakeven_price_per_qtl
                            ? `₹${storageData.breakeven_price_per_qtl.toLocaleString("en-IN")} / qtl`
                            : "—"}
                        </span>
                        {storageData.breakeven_price_per_qtl && (
                          <span className="text-xs font-mono text-[#f1efdf]/80 block">
                            ₹{(storageData.breakeven_price_per_qtl / 100).toFixed(1)} / kg
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {storageData.historical_price_change_pct !== null && (
                    <div className="flex items-center gap-2 p-3 bg-[#e6ecd5]/50 border border-[#c3cda7] rounded-2xl text-[11px] text-[#212529] font-mono">
                      <TrendingUp className="w-4 h-4 text-[#07503f] shrink-0" />
                      <span>
                        Historical reference: prices for {commodity} in next {storageMonths} mo were typically{" "}
                        <strong className="text-[#07503f]">
                          +{storageData.historical_price_change_pct}%
                        </strong>.
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] text-[#555e4a] leading-relaxed italic font-mono">
                    {storageData.notice}
                  </p>
                  <p className="text-[10px] text-[#788365] leading-relaxed pt-1.5 border-t border-[#e2e8ce] font-mono">
                    <strong>Assumptions:</strong> Transport, commission, quality grade, and taxes are not included unless entered.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Market-level Weather Panel */}
      <div className="bg-white border border-[#c3cda7] rounded-3xl p-6 space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e8ce] pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#b2cee7]/50 text-[#18486b] rounded-2xl">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-base font-bold font-serif text-[#07503f] flex items-center gap-2">
                Mandi Logistics & Arrival Weather: {market} Mandi
              </h4>
              <p className="text-xs text-[#555e4a] font-mono">
                Weather conditions at this market hub — assessing rainfall disruption to arrivals, loading, and transit
              </p>
            </div>
          </div>
          {marketWeather?.location?.grid_key && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Grid: {marketWeather.location.grid_key}
            </span>
          )}
        </div>

        {weatherLoading ? (
          <div className="p-8 flex items-center justify-center space-x-2 text-[#555e4a] text-xs font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-[#07503f]" />
            <span>Loading weather conditions for {market} mandi...</span>
          </div>
        ) : marketWeather && marketWeather.location && Array.isArray(marketWeather.days) && marketWeather.metrics ? (
          <div className="space-y-5">
            {/* Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#f1efdf] border border-[#c3cda7] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-[#555e4a] block uppercase tracking-wider font-bold">Current Temp</span>
                <span className="text-lg font-bold font-serif text-[#07503f]">
                  {marketWeather.current?.temp_c != null ? `${marketWeather.current.temp_c}°C` : "—"}
                </span>
                <span className="text-[9px] font-mono text-[#788365] block">At market site</span>
              </div>
              <div className="bg-[#f1efdf] border border-[#c3cda7] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-[#555e4a] block uppercase tracking-wider font-bold">Relative Humidity</span>
                <span className="text-lg font-bold font-serif text-[#07503f]">
                  {marketWeather.current?.rh_pct != null ? `${marketWeather.current.rh_pct}%` : "—"}
                </span>
                <span className="text-[9px] font-mono text-[#788365] block">Storage moisture risk</span>
              </div>
              <div className="bg-[#f1efdf] border border-[#c3cda7] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-[#555e4a] block uppercase tracking-wider font-bold">Recent Rain (7d)</span>
                <span className="text-lg font-bold font-serif text-[#07503f]">
                  {marketWeather.metrics.rain_7d_mm} mm
                </span>
                <span className="text-[9px] font-mono text-[#788365] block">Mandi yard conditions</span>
              </div>
              <div className="bg-[#b2cee7]/40 border border-[#b2cee7] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-[#18486b] block uppercase tracking-wider font-bold">Upcoming Rain Forecast</span>
                <span className="text-lg font-bold font-serif text-[#18486b]">
                  {(marketWeather.days || [])
                    .filter((d) => d.phase === "future")
                    .slice(0, 3)
                    .reduce((sum, d) => sum + (d.precip_mm || 0), 0)
                    .toFixed(1)}{" "}
                  mm
                </span>
                <span className="text-[9px] font-mono text-[#18486b]/80 block">Next 3 days combined</span>
              </div>
            </div>

            {/* 7-Day Arrival Disruption Forecast Strip */}
            <div>
              <span className="text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest block mb-2.5">
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
                            ? "bg-amber-50 border-amber-300 text-amber-900"
                            : "bg-[#f1efdf] border-[#c3cda7] text-[#212529]"
                        }`}
                      >
                        <span className="block text-[10px] font-mono font-bold text-[#555e4a] mb-1">
                          {idx === 0 ? "Today" : dateFormatted}
                        </span>
                        <div className="flex justify-center my-1.5">
                          <CloudRain
                            className={`w-4 h-4 ${
                              hasRainRisk ? "text-amber-600" : "text-[#07503f]"
                            }`}
                          />
                        </div>
                        <span className="block font-bold font-mono text-xs">
                          {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                        </span>
                        <span className="block text-[9px] font-mono text-[#788365] mt-0.5">
                          {day.precip_prob_pct != null ? `${day.precip_prob_pct}%` : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Practical takeaway */}
            <div className="p-4 bg-[#e6ecd5]/50 rounded-2xl border border-[#c3cda7] text-xs text-[#212529] font-sans flex items-start gap-3">
              <Info className="w-4 h-4 text-[#07503f] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#07503f]">Mandi Logistics Insight:</strong> If heavy rainfall (&gt;10mm) is forecasted on your planned sale date, expect slower unloading and transit delays on approach roads to {market}. Consider tarpaulin covers for open trolley transport.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#f1efdf] rounded-2xl border border-[#c3cda7] text-xs font-mono text-[#555e4a]">
            Mandi-level weather observation is resolving for {market}, {state}.
          </div>
        )}
      </div>
    </div>
  );
};
