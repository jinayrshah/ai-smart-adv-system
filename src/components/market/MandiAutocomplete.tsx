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
      <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
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
          className="bg-stone-900 border border-stone-800 rounded-full pl-8 pr-7 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#e8fe85] w-48 shadow-inner"
        />
        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#e8fe85]"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-[#111827] border border-stone-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1 backdrop-blur-md">
          <div className="px-3.5 py-1.5 text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider border-b border-stone-800 flex items-center justify-between">
            <span>{state} Mandis</span>
            {loading && <span className="text-[#e8fe85] text-[9px] animate-pulse">Searching...</span>}
          </div>
          {filtered.length === 0 ? (
            <div className="px-3.5 py-2.5 text-xs text-stone-400 font-mono">
              No matching mandi found. Press Enter to use "{searchTerm}".
            </div>
          ) : (
            filtered.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelect(m)}
                className={`w-full text-left px-3.5 py-2 text-xs font-mono flex items-center justify-between hover:bg-stone-800/80 transition-colors ${
                  m.toLowerCase() === value.toLowerCase()
                    ? "bg-[#07503f]/40 text-[#e8fe85] font-bold border-l-2 border-[#e8fe85]"
                    : "text-stone-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{m}</span>
                </div>
                {presetList.includes(m) && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700">Tracked</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
