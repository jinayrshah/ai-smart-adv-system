import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, ChevronDown } from "lucide-react";
import { fetchMarketSearch } from "../../services/marketApi";

interface MandiAutocompleteProps {
  state: string;
  commodity: string;
  value: string;
  onChange: (market: string) => void;
}

const COMMON_MANDIS: Record<string, string[]> = {
  Maharashtra: [
    "Malegaon",
    "Lasalgaon",
    "Pune",
    "Nashik",
    "Nagpur",
    "Ahmednagar",
    "Jalgaon",
    "Baramati",
    "Solapur",
    "Mumbai",
  ],
  Gujarat: [
    "Rajkot",
    "Gondal",
    "Unjha",
    "Surat",
    "Ahmedabad",
    "Jamnagar",
    "Amreli",
    "Mahuva",
    "Junagadh",
  ],
  "Madhya Pradesh": [
    "Indore",
    "Ujjain",
    "Dewas",
    "Bhopal",
    "Sehore",
    "Neemuch",
    "Mandsaur",
    "Jabalpur",
  ],
  Punjab: [
    "Khanna",
    "Ludhiana",
    "Jalandhar",
    "Amritsar",
    "Bathinda",
    "Patiala",
    "Sangrur",
    "Moga",
  ],
  "Uttar Pradesh": [
    "Agra",
    "Kanpur",
    "Varanasi",
    "Lucknow",
    "Aligarh",
    "Meerut",
    "Bareilly",
    "Mathura",
  ],
  Rajasthan: [
    "Jaipur",
    "Kota",
    "Jodhpur",
    "Bikaner",
    "Sri Ganganagar",
    "Alwar",
    "Nagaur",
  ],
  Karnataka: [
    "Bengaluru",
    "Hubli",
    "Belgaum",
    "Shimoga",
    "Davanagere",
    "Mysore",
    "Tumkur",
  ],
};

export const MandiAutocomplete: React.FC<MandiAutocompleteProps> = ({
  state,
  commodity,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Debounced search when user types
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setApiSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetchMarketSearch(commodity, state, searchTerm.trim());
        const found = res.markets.map((m) => m.market);
        setApiSuggestions(found);
      } catch (err) {
        // Fallback silently to static list
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, state, commodity]);

  const presetList = COMMON_MANDIS[state] || [
    "Malegaon",
    "Lasalgaon",
    "Pune",
    "Nashik",
    "Rajkot",
    "Khanna",
  ];

  // Combine static and remote suggestions, deduped
  const combined = Array.from(
    new Set([...presetList, ...apiSuggestions])
  );

  const filtered = searchTerm.trim()
    ? combined.filter((m) =>
        m.toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : presetList;

  const handleSelect = (marketName: string) => {
    setSearchTerm(marketName);
    onChange(marketName);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
        Market (Mandi)
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search mandi..."
          className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-8 pr-7 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
        />
        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto py-1">
          <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
            {state} Mandis {loading && "(Searching...)"}
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">
              No matching mandi found. Press Enter to use "{searchTerm}".
            </div>
          ) : (
            filtered.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelect(m)}
                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-zinc-800 transition-colors ${
                  m.toLowerCase() === value.toLowerCase()
                    ? "bg-emerald-50 text-emerald-700 dark:bg-zinc-800/80 dark:text-emerald-400 font-bold"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  <span>{m}</span>
                </div>
                {presetList.includes(m) && (
                  <span className="text-[10px] text-zinc-400">Tracked</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
