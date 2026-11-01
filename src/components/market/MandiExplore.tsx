import React, { useState } from "react";
import { fetchMarketSearch, MarketSearchResponse, MarketSearchResult } from "../../services/marketApi";
import { Search, MapPin, TrendingUp, Clock, Loader2, Star, Globe, GitCompare } from "lucide-react";

// The 6 deep-advisory crops (README §5 Q1) first, then popular explore-tier commodities
const DEEP_CROPS = ["Wheat", "Tomato", "Cotton", "Soybean", "Rice", "Maize"];
const ALL_CROPS = [
  ...DEEP_CROPS,
  "Onion", "Potato", "Sugarcane", "Groundnut", "Mustard", "Chana (Gram)",
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

const FAV_KEY = "mandi_favorites_v1";
const favKey = (m: MarketSearchResult, commodity: string) => `${commodity}|${m.state}|${m.district}|${m.market}`.toLowerCase();
const readFavs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
};

interface MandiExploreProps {
  /** Clicking a card opens it in the price-trend view above (one selection model). */
  onSelect?: (sel: { commodity: string; state: string; market: string }) => void;
  /** Clicking Compare on a card adds it to the compare panel. */
  onCompare?: (sel: { state: string; market: string }) => void;
}

export const MandiExplore: React.FC<MandiExploreProps> = ({ onSelect, onCompare }) => {
  const [favs, setFavs] = useState<string[]>(readFavs);
  const toggleFav = (k: string) => {
    setFavs((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: favourites last for this visit only */
      }
      return next;
    });
  };
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
        <div className="w-10 h-10 rounded-2xl bg-brand text-accent flex items-center justify-center font-bold">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-brand">
            Mandi Explorer
          </h2>
          <p className="text-sm text-ink-soft mt-0.5">
            Search any crop at any market across India — live prices from APMC mandis
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-surface rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-bold text-ink-soft mb-1.5">
              Crop / Commodity
            </label>
            <div className="relative">
              <input
                type="text"
                list="crop-suggestions"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                placeholder="Type or select a crop..."
                className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <datalist id="crop-suggestions">
                {ALL_CROPS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-bold text-ink-soft mb-1.5">
              State
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Select state...</option>
              {ALL_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-bold text-ink-soft mb-1.5">
              Market (optional)
            </label>
            <input
              type="text"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. Vashi, Azadpur"
              className="w-full bg-ground border border-line rounded-full px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand hover:bg-brand-dark text-accent rounded-full text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            ) : (
              <Search className="w-4 h-4 text-accent" />
            )}
            <span>Search</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-bad-bg rounded-2xl text-bad">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Result Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <h3 className="text-xl font-bold text-brand">
                {result.commodity} in {result.state}
                {result.market_filter && ` — ${result.market_filter}`}
              </h3>
              <span
                className={`px-3 py-0.5 text-sm font-bold rounded-full border ${
                  result.tier === "advisory"
                    ? "bg-tint text-good border-line"
                    : "bg-ground text-ink-soft border-line"
                }`}
              >
                {result.tier === "advisory" ? "Advisory Crop" : "Explore"}
              </span>
            </div>
            <div className="text-sm text-ink-soft">
              {result.total_records} records available
            </div>
          </div>

          {/* Market Cards */}
          {result.markets.length === 0 ? (
            <div className="bg-white border border-dashed border-line rounded-2xl p-10 text-center">
              <MapPin className="w-8 h-8 text-ink-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-ink">
                No price reports found for this search
              </p>
              <p className="text-sm text-ink-soft mt-1">
                This may mean no APMC has filed a report yet today, or the commodity name doesn't match data.gov.in's listing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.markets.map((m, idx) => (
                <MarketCard
                  key={`${m.market}-${idx}`}
                  index={idx}
                  market={m}
                  tier={result.tier}
                  isFavorite={favs.includes(favKey(m, result.commodity))}
                  onToggleFavorite={() => toggleFav(favKey(m, result.commodity))}
                  onOpen={
                    onSelect
                      ? () => onSelect({ commodity: result.commodity, state: m.state || result.state, market: m.market })
                      : undefined
                  }
                  onCompare={
                    onCompare
                      ? () => onCompare({ state: m.state || result.state, market: m.market })
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Tier B disclaimer */}
          {result.tier === "explore" && (
            <div className="text-sm leading-relaxed text-ink-soft mt-4 border-t border-line pt-3">
              <strong>Explore tier:</strong> Shows today's price as reported to APMCs. 
              For the 6 deep-advisory crops ({DEEP_CROPS.join(", ")}), open a market card to see its
              30/90/180-day trend above.
              Prices are indicative and sourced from data.gov.in (Agmarknet).
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===== Market Card Sub-Component (Pastel Quilt Rotating Surfaces) =====

const PASTEL_TINTS = [
  "hover:border-sky hover:bg-sky/10", // Sky
  "hover:border-warn-bg hover:bg-warn-bg/15", // Peach
  "hover:border-line hover:bg-tint/20", // Sage
  "hover:border-line hover:bg-ash/30", // Ash
];

const MarketCard: React.FC<{
  market: MarketSearchResult;
  tier: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen?: () => void;
  onCompare?: () => void;
  index?: number;
}> = ({ market: m, tier, isFavorite, onToggleFavorite, onOpen, onCompare, index = 0 }) => {
  const tintClass = PASTEL_TINTS[index % PASTEL_TINTS.length];

  return (
    <div
      className={`bg-surface rounded-2xl p-5 transition-all duration-300 ${tintClass} ${
        onOpen ? "cursor-pointer group hover:-translate-y-0.5 hover:" : ""
      }`}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      title={onOpen ? "Open this market's price trend" : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-ink-soft mb-1">
            <MapPin className="w-3 h-3 text-brand" />
            <span>{m.district || m.state}</span>
          </div>
          <h4 className="font-bold text-lg text-brand group-hover:text-brand-dark transition-colors">
            {m.market}
          </h4>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
          title={isFavorite ? "Remove from favourites" : "Add to favourites"}
          className="p-1.5 -m-1 rounded-full hover:bg-ground transition-colors cursor-pointer"
        >
          <Star className={`w-4 h-4 ${isFavorite ? "text-amber-500 fill-amber-500" : "text-line-strong"}`} />
        </button>
      </div>

      {m.latest_modal !== null && m.latest_modal !== undefined ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-brand">
              ₹{Number(m.latest_modal).toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-ink-soft">/qtl</span>
            <span className="text-sm font-bold text-accent bg-brand px-2.5 py-0.5 rounded-full">
              ₹{(Number(m.latest_modal) / 100).toFixed(1)} / kg
            </span>
          </div>

          {m.latest_min !== null && m.latest_max !== null && (
            <div className="flex items-center gap-1.5 text-sm text-ink-soft">
              <TrendingUp className="w-3.5 h-3.5 text-brand" />
              <span>Band: ₹{Number(m.latest_min).toLocaleString("en-IN")} – ₹{Number(m.latest_max).toLocaleString("en-IN")}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-ink-soft pt-2 border-t border-line">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-ink-muted" />
              <span>{m.latest_date}</span>
            </div>
            <span className="text-sm text-ink-muted">{m.source}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-ink-muted py-2">
          No price data available
        </div>
      )}

      {m.records_available > 1 && (
        <div className="mt-2 text-sm text-ink-muted">
          {m.records_available} recent report{m.records_available === 1 ? "" : "s"} on file{tier === "advisory" ? " • tracked" : ""}
        </div>
      )}

      {/* Compare button */}
      {onCompare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCompare();
          }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-line hover:border-brand hover:bg-tint text-brand text-sm font-semibold transition-all cursor-pointer"
        >
          <GitCompare className="w-3 h-3 text-brand" />
          Add to Compare
        </button>
      )}
    </div>
  );
};
