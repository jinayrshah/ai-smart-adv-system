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
    <div className="space-y-6 text-ink">
      {/* Calculators Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h3 className="text-2xl font-bold text-brand flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-brand text-accent flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            Decision Calculators & Mandi Logistics
          </h3>
          <p className="text-sm text-ink-soft mt-1">
            Estimates derived from official benchmark datasets (DES Cost of Cultivation & WDRA manuals).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold bg-brand text-accent px-3.5 py-1 rounded-full">
            Official DES & WDRA References
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Crop Margin Calculator */}
        <div className="bg-surface rounded-2xl p-6 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-brand text-accent rounded-2xl">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-base font-bold text-brand">
                  Crop Margin Calculator
                </h4>
                <p className="text-sm text-ink-soft">
                  DES Cost of Cultivation benchmark vs current price
                </p>
              </div>
            </div>
            {marginData && (
              <span className="text-sm bg-ground border border-line text-ink-soft px-2.5 py-1 rounded-full">
                Survey: {marginData.cost_year}
              </span>
            )}
          </div>

          {/* Form inputs */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1.5">
                Field Size (Acres)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={fieldSize}
                onChange={(e) => setFieldSize(parseFloat(e.target.value) || 1)}
                className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1.5">
                Selling Price (₹/qtl)
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder={currentPrice ? `Market: ₹${currentPrice}` : "Enter price"}
                  value={marginPriceOverride}
                  onChange={(e) => setMarginPriceOverride(e.target.value)}
                  className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          <div className="h-4 text-sm text-ink-soft flex items-center gap-1.5" aria-live="polite">
            {marginLoading && (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-brand" /> Updating…
              </>
            )}
          </div>

          {/* Result calculation */}
          {marginData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="bg-warn-bg/60 p-3.5 rounded-2xl border border-warn-bg space-y-1">
                  <span className="text-sm text-warn block font-bold">Cost of Production (C2)</span>
                  <span className="text-base font-bold text-warn">
                    ₹{marginData.cost_c2_per_qtl} / qtl
                  </span>
                  <span className="text-sm text-warn/80 block">
                    ₹{(marginData.cost_c2_per_qtl / 100).toFixed(1)} / kg
                  </span>
                  <span className="text-sm text-ink-soft block">Includes land rent & interest</span>
                </div>
                <div className="bg-tint/70 p-3.5 rounded-2xl border border-line space-y-1">
                  <span className="text-sm text-good block font-bold">Net Margin / Quintal</span>
                  <span
                    className={`text-base font-bold ${
                      marginData.margin_per_qtl >= 0
                        ? "text-good"
                        : "text-rose-700"
                    }`}
                  >
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{marginData.margin_per_qtl} / qtl
                  </span>
                  <span className="text-sm text-ink-soft block">
                    {marginData.margin_per_qtl >= 0 ? "+" : ""}₹{(marginData.margin_per_qtl / 100).toFixed(1)} / kg
                  </span>
                  <span className="text-sm text-ink-soft block">Selling Price − C2 Cost</span>
                </div>
              </div>

              <div className="bg-brand text-ground p-4 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ground/80">
                    Est. Harvest ({fieldSize} ac @ {marginData.reference_yield_qtl_per_hectare} qtl/ha):
                  </span>
                  <span className="font-bold text-white">
                    {marginData.est_total_yield_qtl} qtl
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-white/20">
                  <span className="font-bold text-white">
                    Estimated Net Field Profit:
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      marginData.est_total_margin >= 0
                        ? "text-accent"
                        : "text-rose-300"
                    }`}
                  >
                    ₹{marginData.est_total_margin.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <p className="text-sm text-ink-soft leading-relaxed italic">
                {marginData.notice}
              </p>
              <p className="text-sm text-ink-muted leading-relaxed pt-1.5 border-t border-line">
                <strong>Assumptions:</strong> Transport, handling, quality grade, and storage fees not included unless entered.
              </p>
            </div>
          ) : marginSearched ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-amber-600" />
                No Cost Benchmark Available
              </div>
              <p className="text-sm leading-relaxed">
                No official DES survey record on file for <strong>{commodity}</strong> in <strong>{state}</strong>. Per project policy, estimates are never fabricated.
              </p>
            </div>
          ) : null}
        </div>

        {/* Card 2: Storage Estimator (Hold vs Sell) */}
        <div className="bg-surface rounded-2xl p-6 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-sky/50 text-sky-ink rounded-2xl">
                <Warehouse className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-base font-bold text-brand">
                  Storage Estimator (Hold vs Sell)
                </h4>
                <p className="text-sm text-ink-soft">
                  Breakeven math accounting for storage fees and shrinkage
                </p>
              </div>
            </div>
            {storageData && (
              <span
                className={`text-sm font-bold px-3 py-1 rounded-full ${
                  storageData.storable
                    ? "bg-tint text-good border border-line"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {storageData.storable ? "Storable" : "Non-Storable"}
              </span>
            )}
          </div>

          {/* Form controls */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1.5">
                Holding Duration
              </label>
              <select
                value={storageMonths}
                onChange={(e) => setStorageMonths(parseInt(e.target.value) || 1)}
                className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value={1}>1 Month</option>
                <option value={2}>2 Months</option>
                <option value={3}>3 Months</option>
                <option value={4}>4 Months</option>
                <option value={6}>6 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1.5">
                Storage Fee (₹/qtl/mo)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={storageCostMonthly}
                onChange={(e) => setStorageCostMonthly(parseFloat(e.target.value) || 0)}
                className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="h-4 text-sm text-ink-soft flex items-center gap-1.5" aria-live="polite">
            {storageLoading && (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-brand" /> Updating…
              </>
            )}
          </div>

          {/* Storage outcome */}
          {storageData && (
            <div className="space-y-3 pt-1">
              {!storageData.storable ? (
                /* Non-storable crop banner */
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                    <Ban className="w-4 h-4 text-rose-600" />
                    Storage Not Recommended for {commodity}
                  </div>
                  <p className="text-sm text-ink leading-relaxed font-sans">
                    {storageData.reason}
                  </p>
                  <span className="text-sm text-ink-soft block">
                    Source: {storageData.source}
                  </span>
                </div>
              ) : (
                /* Storable economics */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    <div className="bg-sky/40 p-3.5 rounded-2xl border border-sky space-y-1">
                      <span className="text-sm text-sky-ink block font-bold">Holding Fee ({storageMonths} mo)</span>
                      <span className="text-base font-bold text-sky-ink block">
                        ₹{(storageCostMonthly * storageMonths).toFixed(2)} / qtl
                      </span>
                      <span className="text-sm text-sky-ink/80 block">
                        ₹{((storageCostMonthly * storageMonths) / 100).toFixed(2)} / kg
                      </span>
                    </div>
                    <div className="bg-ash p-3.5 rounded-2xl border border-line space-y-1">
                      <span className="text-sm text-ink-soft block font-bold">
                        Shrinkage ({storageData.typical_loss_pct_per_month}%/mo)
                      </span>
                      <span className="text-base font-bold text-ink block">
                        {((storageData.typical_loss_pct_per_month || 0) * storageMonths).toFixed(1)}% loss
                      </span>
                      <span className="text-sm text-ink-soft block">estimated weight loss</span>
                    </div>
                  </div>

                  <div className="bg-brand text-ground p-4 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ground/80">Total Storage Burden:</span>
                      <span className="font-bold text-white">
                        +₹{storageData.net_cost_per_qtl} / qtl (+₹{(storageData.net_cost_per_qtl / 100).toFixed(2)} / kg)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-white/20">
                      <span className="font-bold text-white">
                        Required Breakeven Price:
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-accent block">
                          {storageData.breakeven_price_per_qtl
                            ? `₹${storageData.breakeven_price_per_qtl.toLocaleString("en-IN")} / qtl`
                            : "—"}
                        </span>
                        {storageData.breakeven_price_per_qtl && (
                          <span className="text-sm text-ground/80 block">
                            ₹{(storageData.breakeven_price_per_qtl / 100).toFixed(1)} / kg
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {storageData.historical_price_change_pct !== null && (
                    <div className="flex items-center gap-2 p-3 bg-tint/50 border border-line rounded-2xl text-sm text-ink">
                      <TrendingUp className="w-4 h-4 text-brand shrink-0" />
                      <span>
                        Historical reference: prices for {commodity} in next {storageMonths} mo were typically{" "}
                        <strong className="text-brand">
                          +{storageData.historical_price_change_pct}%
                        </strong>.
                      </span>
                    </div>
                  )}

                  <p className="text-sm text-ink-soft leading-relaxed italic">
                    {storageData.notice}
                  </p>
                  <p className="text-sm text-ink-muted leading-relaxed pt-1.5 border-t border-line">
                    <strong>Assumptions:</strong> Transport, commission, quality grade, and taxes are not included unless entered.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Market-level Weather Panel */}
      <div className="bg-surface rounded-2xl p-6 space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-sky/50 text-sky-ink rounded-2xl">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-base font-bold text-brand flex items-center gap-2">
                Mandi Logistics & Arrival Weather: {market} Mandi
              </h4>
              <p className="text-sm text-ink-soft">
                Weather conditions at this market hub — assessing rainfall disruption to arrivals, loading, and transit
              </p>
            </div>
          </div>
          {marketWeather?.location?.grid_key && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-tint text-good border border-line">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Grid: {marketWeather.location.grid_key}
            </span>
          )}
        </div>

        {weatherLoading ? (
          <div className="p-8 flex items-center justify-center space-x-2 text-ink-soft text-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-brand" />
            <span>Loading weather conditions for {market} mandi...</span>
          </div>
        ) : marketWeather && marketWeather.location && Array.isArray(marketWeather.days) && marketWeather.metrics ? (
          <div className="space-y-5">
            {/* Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-ground border border-line p-4 rounded-2xl space-y-1">
                <span className="text-sm text-ink-soft block font-bold">Current Temp</span>
                <span className="text-lg font-bold text-brand">
                  {marketWeather.current?.temp_c != null ? `${marketWeather.current.temp_c}°C` : "—"}
                </span>
                <span className="text-sm text-ink-muted block">At market site</span>
              </div>
              <div className="bg-ground border border-line p-4 rounded-2xl space-y-1">
                <span className="text-sm text-ink-soft block font-bold">Relative Humidity</span>
                <span className="text-lg font-bold text-brand">
                  {marketWeather.current?.rh_pct != null ? `${marketWeather.current.rh_pct}%` : "—"}
                </span>
                <span className="text-sm text-ink-muted block">Storage moisture risk</span>
              </div>
              <div className="bg-ground border border-line p-4 rounded-2xl space-y-1">
                <span className="text-sm text-ink-soft block font-bold">Recent Rain (7d)</span>
                <span className="text-lg font-bold text-brand">
                  {marketWeather.metrics.rain_7d_mm} mm
                </span>
                <span className="text-sm text-ink-muted block">Mandi yard conditions</span>
              </div>
              <div className="bg-sky/40 border border-sky p-4 rounded-2xl space-y-1">
                <span className="text-sm text-sky-ink block font-bold">Upcoming Rain Forecast</span>
                <span className="text-lg font-bold text-sky-ink">
                  {(marketWeather.days || [])
                    .filter((d) => d.phase === "future")
                    .slice(0, 3)
                    .reduce((sum, d) => sum + (d.precip_mm || 0), 0)
                    .toFixed(1)}{" "}
                  mm
                </span>
                <span className="text-sm text-sky-ink/80 block">Next 3 days combined</span>
              </div>
            </div>

            {/* 7-Day Arrival Disruption Forecast Strip */}
            <div>
              <span className="text-sm font-bold text-ink-soft block mb-2.5">
                7-Day Arrival Weather Forecast (Rain & Transit Window)
              </span>
              <div className="grid grid-cols-7 gap-2 text-center text-sm">
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
                            : "bg-ground border-line text-ink"
                        }`}
                      >
                        <span className="block text-sm font-bold text-ink-soft mb-1">
                          {idx === 0 ? "Today" : dateFormatted}
                        </span>
                        <div className="flex justify-center my-1.5">
                          <CloudRain
                            className={`w-4 h-4 ${
                              hasRainRisk ? "text-amber-600" : "text-brand"
                            }`}
                          />
                        </div>
                        <span className="block font-bold text-sm">
                          {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                        </span>
                        <span className="block text-sm text-ink-muted mt-0.5">
                          {day.precip_prob_pct != null ? `${day.precip_prob_pct}%` : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Practical takeaway */}
            <div className="p-4 bg-tint/50 rounded-2xl border border-line text-sm text-ink font-sans flex items-start gap-3">
              <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <span>
                <strong className="text-brand">Mandi Logistics Insight:</strong> If heavy rainfall (&gt;10mm) is forecasted on your planned sale date, expect slower unloading and transit delays on approach roads to {market}. Consider tarpaulin covers for open trolley transport.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-ground rounded-2xl border border-line text-sm text-ink-soft">
            Mandi-level weather observation is resolving for {market}, {state}.
          </div>
        )}
      </div>
    </div>
  );
};
