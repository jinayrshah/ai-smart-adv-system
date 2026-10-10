import React, { useState } from "react";
import { fetchMarketSearch, MarketSearchResponse, MarketSearchResult } from "../../services/marketApi";
import { Search, MapPin, TrendingUp, Clock, Loader2, Star, Globe } from "lucide-react";

// Common Indian crops beyond the 6 advisory ones
const ALL_CROPS = [
  // Advisory tier (6 core)
  "Wheat", "Rice", "Maize", "Sugarcane", "Potato", "Cotton",
  // Explore tier - popular commodities
  "Onion", "Tomato", "Soyabean", "Groundnut", "Mustard", "Chana (Gram)",
  "Tur/Arhar Dal", "Urad Dal", "Moong Dal", "Jowar (Sorghum)", "Bajra (Pearl Millet)",
  "Garlic", "Ginger", "Green Chilli", "Capsicum", "Brinjal", "Cauliflower",
  "Cabbage", "Banana", "Mango", "Apple", "Guava", "Papaya",
  "Turmeric", "Cumin", "Coriander", "Jute", "Coconut", "Rubber",
];

const ALL_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export const MandiExplore: React.FC = () => {
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [market, setMarket] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketSearchResponse | null>(null);

  const handleSearch = async () => {
    if (!commodity || !state) {
      setError("Please select both a crop and a state");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketSearch(commodity, state, market || undefined);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-md">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Mandi Explorer
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Search any crop at any market across India — live prices from APMC mandis
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Crop / Commodity
            </label>
            <div className="relative">
              <input
                type="text"
                list="crop-suggestions"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                placeholder="Type or select a crop..."
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="crop-suggestions">
                {ALL_CROPS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              State
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select state...</option>
              {ALL_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Market (optional)
            </label>
            <input
              type="text"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. Vashi, Azadpur"
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Search</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Result Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {result.commodity} in {result.state}
                {result.market_filter && ` — ${result.market_filter}`}
              </h3>
              <span
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                  result.tier === "advisory"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                }`}
              >
                {result.tier === "advisory" ? "Advisory Crop" : "Explore"}
              </span>
            </div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              {result.total_records} records available
            </div>
          </div>

          {/* Market Cards */}
          {result.markets.length === 0 ? (
            <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center">
              <MapPin className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                No price reports found for this search
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                This may mean no APMC has filed a report yet today, or the commodity name doesn't match data.gov.in's listing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.markets.map((m, idx) => (
                <MarketCard key={`${m.market}-${idx}`} market={m} tier={result.tier} />
              ))}
            </div>
          )}

          {/* Tier B disclaimer */}
          {result.tier === "explore" && (
            <div className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <strong>Explore tier:</strong> Shows today's price as reported to APMCs. 
              For 6 deep-advisory crops (Wheat, Rice, Maize, Sugarcane, Potato, Cotton), 
              use the Advisory tab for 30/90/180-day trends with full data coverage.
              Prices are indicative and sourced from data.gov.in (Agmarknet).
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===== Market Card Sub-Component =====

const MarketCard: React.FC<{ market: MarketSearchResult; tier: string }> = ({ market: m, tier }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
            <MapPin className="w-3 h-3" />
            <span>{m.district || m.state}</span>
          </div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{m.market}</h4>
        </div>
        {tier === "advisory" && (
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        )}
      </div>

      {m.latest_modal !== null && m.latest_modal !== undefined ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{Number(m.latest_modal).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">/qtl</span>
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
              ₹{(Number(m.latest_modal) / 100).toFixed(1)} / kg
            </span>
          </div>

          {m.latest_min !== null && m.latest_max !== null && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <TrendingUp className="w-3 h-3" />
              <span>Range: ₹{Number(m.latest_min).toLocaleString("en-IN")} – ₹{Number(m.latest_max).toLocaleString("en-IN")}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{m.latest_date}</span>
            </div>
            <span className="font-mono text-[10px]">{m.source}</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-zinc-400 dark:text-zinc-500 py-2">
          No price data available
        </div>
      )}

      {m.records_available > 1 && (
        <div className="mt-2 text-[10px] text-zinc-400">
          {m.records_available} historical records
        </div>
      )}
    </div>
  );
};
