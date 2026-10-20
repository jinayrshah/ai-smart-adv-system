import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, ChevronDown, Loader2 } from "lucide-react";
import { fetchMarketList, MarketListItem } from "../../services/marketApi";

interface MandiAutocompleteProps {
  state: string;
  commodity: string;
  value: string;
  onChange: (market: string) => void;
}

export const MandiAutocomplete: React.FC<MandiAutocompleteProps> = ({
  state,
  commodity,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [allMarkets, setAllMarkets] = useState<MarketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal search term when external value changes
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Whenever state or commodity changes, load the full list of markets from backend
  useEffect(() => {
    if (!state) {
      setAllMarkets([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setAllMarkets([]);

    fetchMarketList(state, commodity || undefined)
      .then((res) => {
        if (!cancelled) {
          setAllMarkets(res.markets || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message || "Could not load markets");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state, commodity]);

  // Filter by search term (client-side, instant)
  const filtered = searchTerm.trim()
    ? allMarkets.filter((m) =>
        m.market.toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : allMarkets;

  const handleSelect = (marketName: string) => {
    setSearchTerm(marketName);
    onChange(marketName);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchTerm.trim()) {
        const exactMatch = allMarkets.find(
          (m) => m.market.toLowerCase() === searchTerm.trim().toLowerCase()
        );
        const committed = exactMatch ? exactMatch.market : searchTerm.trim();
        setSearchTerm(committed);
        onChange(committed);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleBlur = () => {
    if (searchTerm.trim() && searchTerm.trim() !== value) {
      const exactMatch = allMarkets.find(
        (m) => m.market.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      const committed = exactMatch ? exactMatch.market : searchTerm.trim();
      setSearchTerm(committed);
      onChange(committed);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-widest mb-1.5">
        Market (Mandi)
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={state ? "Search mandi..." : "Select a state first"}
          disabled={!state}
          className="bg-[#f1efdf] border border-[#c3cda7] rounded-full pl-8 pr-7 py-2 text-xs text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#07503f] w-52 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-[#07503f] absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
        ) : (
          <Search className="w-3.5 h-3.5 text-[#788365] absolute left-3 top-1/2 -translate-y-1/2" />
        )}
        <button
          type="button"
          onClick={() => state && setIsOpen(!isOpen)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#788365] hover:text-[#07503f] cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && state && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-[#c3cda7] rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto py-1">
          <div className="px-3.5 py-1.5 text-[10px] font-mono font-bold text-[#555e4a] uppercase tracking-wider border-b border-[#e2e8ce] flex items-center justify-between sticky top-0 bg-white">
            <span>
              {state} Mandis
              {!loading && allMarkets.length > 0 && (
                <span className="ml-1.5 text-[#788365] normal-case">
                  ({filtered.length} of {allMarkets.length})
                </span>
              )}
            </span>
            {loading && (
              <span className="text-[#07503f] text-[9px] font-bold flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </span>
            )}
          </div>

          {loadError ? (
            <div className="px-3.5 py-3 text-xs text-rose-600 font-mono">
              ⚠️ {loadError}. Type to search or press Enter to use custom name.
            </div>
          ) : loading ? (
            <div className="px-3.5 py-4 text-xs text-[#555e4a] font-mono text-center">
              Fetching mandis from database...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-[#555e4a] font-mono">
              {allMarkets.length === 0
                ? `No mandis found for ${state}${commodity ? ` / ${commodity}` : ""}. Try a broader search.`
                : `No match for "${searchTerm}". Press Enter to use this name.`}
            </div>
          ) : (
            filtered.map((m) => (
              <button
                key={`${m.market}-${m.district}`}
                type="button"
                onClick={() => handleSelect(m.market)}
                className={`w-full text-left px-3.5 py-2 text-xs font-mono flex items-center justify-between hover:bg-[#f1efdf] transition-colors cursor-pointer ${
                  m.market.toLowerCase() === value.toLowerCase()
                    ? "bg-[#e6ecd5] text-[#07503f] font-bold border-l-2 border-[#07503f]"
                    : "text-[#212529]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#788365] shrink-0" />
                  <div className="min-w-0">
                    <span className="block truncate">{m.market}</span>
                    {m.district && (
                      <span className="text-[10px] text-[#788365] block truncate">
                        {m.district}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#f1efdf] text-[#555e4a] border border-[#c3cda7] shrink-0 ml-2">
                  {m.records}d
                </span>
              </button>
            ))
          )}

          {/* Free-type hint */}
          {searchTerm.trim() && !filtered.some(
            (m) => m.market.toLowerCase() === searchTerm.toLowerCase().trim()
          ) && !loading && (
            <div className="px-3.5 py-2 border-t border-[#e2e8ce] mt-1 bg-[#f1efdf]/50">
              <button
                type="button"
                onClick={() => handleSelect(searchTerm.trim())}
                className="w-full text-left text-[10px] font-mono text-[#07503f] hover:underline transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <span>↵</span>
                Use "{searchTerm.trim()}" as market name
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
