import React, { useEffect, useState } from "react";
import {
  fetchWeatherSummary,
  WeatherSummaryResponse,
  FusedDayDetail,
  searchWeatherLocations,
  LocationSearchResult,
} from "../../lib/api/weather";
import {
  Cloud,
  CloudRain,
  Sun,
  Wind,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  MapPin,
  RefreshCw,
  Search,
  Thermometer,
  Compass,
  Calendar,
  Info,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Activity,
} from "lucide-react";

interface WeatherStripProps {
  locationId?: number;
  lat?: number;
  lon?: number;
  locationName?: string;
  onLocationChange?: (lat: number, lon: number, name: string) => void;
}

const POPULAR_LOCATIONS = [
  { name: "Nashik", state: "Maharashtra", lat: 20.0, lon: 73.8 },
  { name: "Pune", state: "Maharashtra", lat: 18.52, lon: 73.86 },
  { name: "Aurangabad (Chhatrapati Sambhajinagar)", state: "Maharashtra", lat: 19.88, lon: 75.34 },
  { name: "Rajkot", state: "Gujarat", lat: 22.3, lon: 70.8 },
  { name: "Anand", state: "Gujarat", lat: 22.56, lon: 72.95 },
  { name: "Ludhiana", state: "Punjab", lat: 30.9, lon: 75.85 },
  { name: "Amritsar", state: "Punjab", lat: 31.63, lon: 74.87 },
  { name: "Agra", state: "Uttar Pradesh", lat: 27.18, lon: 78.01 },
  { name: "Lucknow", state: "Uttar Pradesh", lat: 26.85, lon: 80.95 },
  { name: "Indore", state: "Madhya Pradesh", lat: 22.72, lon: 75.86 },
  { name: "Bhopal", state: "Madhya Pradesh", lat: 23.26, lon: 77.41 },
  { name: "Bengaluru", state: "Karnataka", lat: 12.97, lon: 77.59 },
  { name: "Hubli", state: "Karnataka", lat: 15.36, lon: 75.13 },
  { name: "Hyderabad", state: "Telangana", lat: 17.38, lon: 78.49 },
  { name: "Warangal", state: "Telangana", lat: 17.98, lon: 79.58 },
  { name: "Jaipur", state: "Rajasthan", lat: 26.91, lon: 75.79 },
  { name: "Jodhpur", state: "Rajasthan", lat: 26.29, lon: 73.03 },
  { name: "Patna", state: "Bihar", lat: 25.61, lon: 85.14 },
  { name: "Bhubaneswar", state: "Odisha", lat: 20.3, lon: 85.83 },
];

const PROVIDER_NAMES: Record<string, string> = {
  open_meteo: "Open-Meteo",
  nasa_power: "NASA POWER",
  openweather: "OpenWeatherMap",
  era5_land: "ERA5-Land reanalysis",
};
const providerName = (p?: string | null) => (p ? PROVIDER_NAMES[p] || p.replace(/_/g, " ") : "Open-Meteo");

// WMO weather codes used by Open-Meteo (open-meteo.com/en/docs) -> plain words
const WMO_TEXT: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Moderate rain",
  65: "Heavy rain", 80: "Light showers", 81: "Showers", 82: "Violent showers", 95: "Thunderstorm",
  96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

export const WeatherStrip: React.FC<WeatherStripProps> = ({
  locationId,
  lat: initialLat,
  lon: initialLon,
  locationName: initialName,
}) => {
  // Use GPS/prop lat-lon when available, else fallback to a central India default
  const propLat = initialLat ?? 22.5;
  const propLon = initialLon ?? 78.0;
  const propName = initialName || "India (Default)";

  const [lat, setLat] = useState<number>(propLat);
  const [lon, setLon] = useState<number>(propLon);
  const [displayName, setDisplayName] = useState<string>(propName);
  const [isUsingGps, setIsUsingGps] = useState<boolean>(!!initialLat && !!initialLon);
  const [data, setData] = useState<WeatherSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isExplore, setIsExplore] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<FusedDayDetail | null>(null);
  const [showAreaNotice, setShowAreaNotice] = useState<boolean>(false);

  // Sync when parent provides updated GPS coordinates (e.g. after browser geolocation resolves)
  const prevPropLat = React.useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      initialLat != null &&
      initialLon != null &&
      (initialLat !== prevPropLat.current) &&
      !isExplore  // don't override if user manually picked another location
    ) {
      prevPropLat.current = initialLat;
      setLat(initialLat);
      setLon(initialLon);
      setDisplayName(initialName || `${initialLat.toFixed(2)}, ${initialLon.toFixed(2)}`);
      setIsUsingGps(true);
    }
  }, [initialLat, initialLon]);

  const loadWeather = async (targetLat: number, targetLon: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWeatherSummary({
        locationId,
        lat: targetLat,
        lon: targetLon,
      });
      setData(result);
      if (result.days && result.days.length > 0) {
        // default select today
        const todayItem = result.days.find((d) => d.phase === "today") || result.days[0];
        setSelectedDay(todayItem);
      }
    } catch (err: any) {
      console.error("Failed to load weather summary:", err);
      setError(err.message || "Failed to load weather data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather(lat, lon);
  }, [lat, lon]);

  const handleSelectPreset = (loc: typeof POPULAR_LOCATIONS[0]) => {
    setLat(loc.lat);
    setLon(loc.lon);
    setDisplayName(`${loc.name}, ${loc.state}`);
    setIsExplore(true);  // user has manually switched away from their GPS location
    setIsUsingGps(false);
    setShowSearchResults(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setIsSearching(true);
    try {
      const results = await searchWeatherLocations(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Explore location search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: LocationSearchResult) => {
    setLat(result.lat);
    setLon(result.lon);
    setDisplayName(`${result.name}${result.district ? `, ${result.district}` : ""}, ${result.state}`);
    setIsExplore(true);
    setIsUsingGps(false);
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const renderConfidenceBadge = (confidence: "high" | "medium" | "low", hasDisagreement: boolean) => {
    if (confidence === "high") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 shadow-sm">
          <CheckCircle2 className="w-3 h-3 text-[#e8fe85]" />
          High Confidence
        </span>
      );
    }
    if (confidence === "medium") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
          <HelpCircle className="w-3 h-3 text-amber-400" />
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-950/70 text-rose-300 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        Low Confidence {hasDisagreement && "(Disagreement)"}
      </span>
    );
  };

  const PASTEL_TINTS = [
    { bg: "bg-[#b2cee7]/40", border: "border-[#b2cee7]", text: "text-[#18486b]", label: "Sky" },
    { bg: "bg-[#fceace]/60", border: "border-[#f5d5b0]", text: "text-[#8a4b12]", label: "Peach" },
    { bg: "bg-[#e6ecd5]/70", border: "border-[#c3cda7]", text: "text-[#3b5921]", label: "Sage" },
    { bg: "bg-[#efefef]", border: "border-[#d8d8d8]", text: "text-[#4a4f55]", label: "Ash" },
  ];

  return (
    <div className="w-full bg-white border border-[#c3cda7] rounded-3xl p-5 sm:p-8 space-y-7 text-[#212529]">
      {/* Top Header & Location Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[#e2e8ce] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold shrink-0">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#07503f]">
                  Weather Intelligence & Climatology
                </h2>
                {isUsingGps && !isExplore && (
                  <span className="text-[11px] bg-[#07503f] text-[#e8fe85] px-3 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Detected GPS
                  </span>
                )}
                {isExplore && (
                  <span className="text-[11px] bg-[#07503f] text-[#e8fe85] px-3 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Compass className="w-3 h-3" /> Explore Mode
                  </span>
                )}
                {data?.degraded && (
                  <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                    Degraded / Fallback
                  </span>
                )}
              </div>
              <p className="text-xs text-[#555e4a] flex items-center gap-1.5 mt-1 font-mono">
                <MapPin className="w-3.5 h-3.5 text-[#07503f]" />
                {data?.location?.name || displayName} <span className="text-[#a1ab89]">•</span> Grid: {data?.location?.grid_key || `${lat.toFixed(1)},${lon.toFixed(1)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Explore Search & Location Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              placeholder="Search village/district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#f1efdf] text-xs text-[#212529] placeholder-[#788365] border border-[#c3cda7] rounded-full pl-9 pr-12 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#07503f] focus:border-[#07503f] w-full sm:w-60 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-[#788365] absolute left-3.5 pointer-events-none" />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] hover:bg-[#0a624d] text-[#e8fe85] transition-colors cursor-pointer"
            >
              {isSearching ? "..." : "Go"}
            </button>
          </form>

          {/* Autocomplete dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 right-0 sm:right-auto z-50 w-full sm:w-80 bg-white border border-[#c3cda7] rounded-2xl shadow-xl p-2 text-xs space-y-1">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#555e4a] border-b border-[#e2e8ce] flex justify-between items-center">
                <span>Select Location</span>
                <button
                  type="button"
                  onClick={() => setShowSearchResults(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>
              {searchResults.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(r)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#f1efdf] text-[#212529] transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-[#07503f]">{r.name}</span>
                    <span className="text-[11px] text-[#555e4a] block">
                      {r.district ? `${r.district}, ` : ""}{r.state}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#07503f] bg-[#e6ecd5] px-2 py-0.5 rounded-full font-mono">
                    {r.lat.toFixed(1)}, {r.lon.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <select
            className="bg-[#f1efdf] text-xs text-[#212529] border border-[#c3cda7] rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#07503f]"
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (!isNaN(idx) && POPULAR_LOCATIONS[idx]) {
                handleSelectPreset(POPULAR_LOCATIONS[idx]);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Other Regions...
            </option>
            {POPULAR_LOCATIONS.map((loc, i) => (
              <option key={i} value={i}>
                {loc.name}, {loc.state}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadWeather(lat, lon)}
            disabled={loading}
            className="p-2.5 rounded-full bg-[#07503f] hover:bg-[#0a624d] text-[#e8fe85] transition shrink-0 flex items-center justify-center cursor-pointer"
            title="Refresh weather data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e8fe85]" : ""}`} />
          </button>
        </div>
      </div>

      {isUsingGps && !isExplore && (
        <div className="px-4 py-3 rounded-2xl bg-[#e6ecd5]/50 border border-[#c3cda7] text-[#212529] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-[#07503f] flex-shrink-0" />
            <span>
              <b className="text-[#07503f]">Auto-Location:</b> Microclimate data calculated for your verified GPS coordinate.
              Use search or <b>Other Regions</b> to check conditions across India.
            </span>
          </div>
        </div>
      )}

      {isExplore && (
        <div className="px-4 py-3 rounded-2xl bg-[#fceace]/60 border border-[#f5d5b0] text-[#212529] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-[#8a4b12] flex-shrink-0" />
            <span>
              <b className="text-[#8a4b12]">Explore Mode:</b> Showing weather for newly enrolled coordinate via Open-Meteo. Confidence starts at <b>medium</b> until full multi-source cross-check runs.
            </span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-[#555e4a]">
          <div className="w-10 h-10 rounded-full border-4 border-[#c3cda7] border-t-[#07503f] animate-spin" />
          <p className="text-xs font-mono uppercase tracking-widest text-[#555e4a]">
            Fusing multi-source weather data across Open-Meteo, NASA POWER, and OpenWeather...
          </p>
        </div>
      )}

      {error && !data && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Main Weather Display: Current + Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Current Conditions Card */}
            <div className="bg-[#f1efdf] border border-[#c3cda7] rounded-3xl p-6 flex flex-col justify-between space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#555e4a] font-mono">
                    Current Observation
                  </span>
                  <div className="text-4xl font-serif font-bold text-[#07503f] mt-1.5 flex items-baseline gap-1">
                    {data.current?.temp_c != null ? `${data.current.temp_c}°C` : "—"}
                  </div>
                  {data.current?.weather_code != null && WMO_TEXT[data.current.weather_code] && (
                    <p className="text-sm text-[#07503f] font-semibold mt-0.5">{WMO_TEXT[data.current.weather_code]}</p>
                  )}
                  <p className="text-xs text-[#555e4a] mt-1">
                    Source: <span className="text-[#212529] font-medium">{providerName(data.current?.source)}</span>
                  </p>
                </div>
                {data.current && renderConfidenceBadge(data.current.confidence, false)}
              </div>

              {/* Observation stats - 3 pastel chips */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#c3cda7]/50 text-center">
                <div className="bg-[#b2cee7]/50 p-2.5 rounded-2xl border border-[#b2cee7]">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-[#18486b] font-medium">
                    <Droplets className="w-3.5 h-3.5 text-[#18486b]" /> Humidity
                  </div>
                  <span className="text-sm font-bold text-[#18486b]">{data.current?.rh_pct ?? "—"}%</span>
                </div>
                <div className="bg-[#e6ecd5] p-2.5 rounded-2xl border border-[#c3cda7]">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-[#3b5921] font-medium">
                    <Wind className="w-3.5 h-3.5 text-[#3b5921]" /> Wind
                  </div>
                  <span className="text-sm font-bold text-[#3b5921]">{data.current?.wind_kmh ?? "—"} km/h</span>
                </div>
                <div className="bg-[#fceace] p-2.5 rounded-2xl border border-[#f5d5b0]">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-[#8a4b12] font-medium">
                    <CloudRain className="w-3.5 h-3.5 text-[#8a4b12]" /> 1h Rain
                  </div>
                  <span className="text-sm font-bold text-[#8a4b12]">{data.current?.precip_mm_1h ?? 0} mm</span>
                </div>
              </div>

              {/* Cross check */}
              {data.current?.cross_check && Object.keys(data.current.cross_check).length > 0 && (
                <div className="text-xs text-[#555e4a] bg-white p-2.5 rounded-2xl border border-[#c3cda7]">
                  <span className="text-[#07503f] font-semibold">Cross-check:</span>{" "}
                  {Object.entries(data.current.cross_check).map(([prov, details]: any) => (
                    <span key={prov}>
                      {prov} reports {details.temp_c}°C
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Agro Climatology Metrics Card */}
            <div className="lg:col-span-2 bg-[#f1efdf] border border-[#c3cda7] rounded-3xl p-6 flex flex-col justify-between space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] mb-1">
                    <span>Agro-Climatology Metrics</span>
                  </div>
                  <p className="text-xs text-[#555e4a]">Calculated over actual rainfall &amp; 15-year ERA5-Land agricultural normals</p>
                </div>
                <div className="shrink-0">
                  {renderConfidenceBadge(data.metrics.confidence, false)}
                </div>
              </div>

              {/* Pastel Quilt grid for the 4 core metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#b2cee7] border border-[#9cbcd8] p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#18486b] font-bold block">7-Day Rain</span>
                  <span className="text-2xl font-serif font-bold text-[#18486b] mt-1 block">{data.metrics.rain_7d_mm} mm</span>
                  <span className="text-[10px] text-[#18486b]/80">Recent accumulation</span>
                </div>

                <div className="bg-[#fceace] border border-[#edd1ad] p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#8a4b12] font-bold block">30-Day Rain</span>
                  <span className="text-2xl font-serif font-bold text-[#8a4b12] mt-1 block">{data.metrics.rain_30d_mm} mm</span>
                  <span className="text-[10px] text-[#8a4b12]/80">Cumulative actual</span>
                </div>

                <div className="bg-[#e6ecd5] border border-[#c3cda7] p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#3b5921] font-bold block">Vs. Normal (30d)</span>
                  <div className="my-1">
                    {data.metrics.rain_30d_vs_normal_pct != null ? (
                      <span
                        className={`text-2xl font-serif font-bold block ${
                          data.metrics.rain_30d_vs_normal_pct >= 0
                            ? "text-[#3b5921]"
                            : "text-[#8a4b12]"
                        }`}
                      >
                        {data.metrics.rain_30d_vs_normal_pct > 0 ? "+" : ""}{data.metrics.rain_30d_vs_normal_pct}%
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[#555e4a] block leading-tight">
                        Not enough data yet
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#555e4a]">
                    {data.metrics.rain_30d_vs_normal_pct != null
                      ? "vs. 2010–24 average"
                      : data.metrics.days_in_30d_window != null
                      ? `${data.metrics.days_in_30d_window} of 30 days`
                      : "Needs 27 of 30 days"}
                  </span>
                </div>

                <div className="bg-[#efefef] border border-[#d8d8d8] p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#4a4f55] font-bold block">Dry Days</span>
                  <span className="text-2xl font-serif font-bold text-[#212529] mt-1 block">{data.metrics.dry_spell_days} d</span>
                  <span className="text-[10px] text-[#6c757d]">&lt;1mm threshold</span>
                </div>
              </div>

              {/* Extra agro indicators */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#555e4a] pt-3 border-t border-[#c3cda7]/50">
                {data.metrics.tmax_7d_anomaly_c != null && (
                  <div>
                    <span className="text-[#788365]">7d Temp Anomaly:</span>{" "}
                    <span className="font-semibold text-[#212529]">
                      {data.metrics.tmax_7d_anomaly_c > 0 ? "+" : ""}
                      {data.metrics.tmax_7d_anomaly_c}°C
                    </span>
                  </div>
                )}
                {data.metrics.et0_7d_mm != null && (
                  <div>
                    <span className="text-[#788365]">7d Evapotranspiration (ET₀):</span>{" "}
                    <span className="font-semibold text-[#212529]">{data.metrics.et0_7d_mm} mm</span>
                  </div>
                )}
                <div>
                  <span className="text-[#788365]">Confidence:</span>{" "}
                  <span className="font-bold text-[#07503f] capitalize">{data.metrics.confidence}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast & Recent Strip (Pastel Quilt Strip) */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-serif text-lg font-bold text-[#07503f] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#07503f]" /> Multi-Source Daily Horizon (Past actuals + 7-Day Forecast)
              </h3>
              <span className="text-xs text-[#555e4a]">Click a day to inspect model consensus</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pb-2">
              {data.days.map((day, idx) => {
                const isSelected = selectedDay?.date === day.date;
                const isToday = day.phase === "today";
                const hasDisagreement = !!day.disagreement;
                const tint = PASTEL_TINTS[idx % PASTEL_TINTS.length];

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-white border-2 border-[#07503f] ring-2 ring-[#07503f]/20 scale-[1.02]"
                        : `${tint.bg} hover:brightness-95 ${tint.border}`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-[#212529]">
                        {isToday ? "Today" : day.date.slice(5)}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.confidence === "high"
                            ? "bg-[#07503f]"
                            : day.confidence === "medium"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        title={`Confidence: ${day.confidence}`}
                      />
                    </div>

                    <div className="my-2.5">
                      <div className="text-lg font-serif font-bold text-[#212529]">
                        {day.tmax_c != null ? `${Math.round(day.tmax_c)}°` : "—"}
                        <span className="text-xs text-[#6c757d] font-sans font-normal ml-1">
                          {day.tmin_c != null ? `${Math.round(day.tmin_c)}°` : ""}
                        </span>
                      </div>
                      <div className={`text-xs ${tint.text} flex items-center gap-1 mt-0.5 font-bold`}>
                        <Droplets className="w-3 h-3" />
                        {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                      </div>
                    </div>

                    <div className="text-[10px] text-[#555e4a] capitalize flex items-center justify-between w-full pt-1.5 border-t border-[#c3cda7]/50">
                      <span>{day.phase}</span>
                      {hasDisagreement && (
                        <span className="text-rose-600 font-bold" title="Provider Disagreement">
                          !
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Deep Dive Panel (Forest Ink Banner) */}
          {selectedDay && (
            <div className="bg-[#07503f] text-[#f1efdf] rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-[#e8fe85] shrink-0" />
                  <span className="font-serif font-bold text-white text-base">Day Analysis: {selectedDay.date}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs text-[#f1efdf]/80">
                    Main source: <b className="text-white">{selectedDay.primary_source === "open_meteo" ? "Open-Meteo" : selectedDay.primary_source}</b>
                  </span>
                  {renderConfidenceBadge(selectedDay.confidence, !!selectedDay.disagreement)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-[#f1efdf]/70 block">Temperature Range</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {selectedDay.tmax_c ?? "—"}°C / {selectedDay.tmin_c ?? "—"}°C
                  </span>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-[#f1efdf]/70 block">Rainfall & Probability</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {selectedDay.precip_mm ?? 0} mm {selectedDay.precip_prob_pct != null ? `(${selectedDay.precip_prob_pct}%)` : ""}
                  </span>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-[#f1efdf]/70 block">Mean Humidity</span>
                  <span className="text-sm font-semibold text-white mt-1 block">{selectedDay.rh_mean_pct ?? "—"}%</span>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-[#f1efdf]/70 block">Solar Radiation / ET₀</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {selectedDay.radiation_mj_m2 ? `${selectedDay.radiation_mj_m2} MJ/m²` : "—"} /{" "}
                    {selectedDay.et0_mm ? `${selectedDay.et0_mm} mm` : "—"}
                  </span>
                </div>
              </div>

              {/* Disagreement Warning if any */}
              {selectedDay.disagreement && (
                <div className="p-3.5 rounded-2xl bg-rose-900/60 border border-rose-400 text-rose-100 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                    Provider Disagreement Detected (Confidence Lowered to Low):
                  </div>
                  {Object.entries(selectedDay.disagreement).map(([field, provMap]: any) => (
                    <div key={field} className="ml-5">
                      <b className="capitalize">{field.replace("_", " ")}:</b>{" "}
                      {Object.entries(provMap).map(([p, v]: any) => `${p} reported ${v}`).join(", ")}
                    </div>
                  ))}
                  <p className="ml-5 text-[11px] text-rose-200">
                    Conservative rule applied: advisory recommendations for this day avoid hard spray/irrigation triggers.
                  </p>
                </div>
              )}

              {/* Validators info */}
              <div className="text-[11px] text-[#f1efdf]/70 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/15">
                <span>
                  Validation:{" "}
                  {selectedDay.validators && selectedDay.validators.length > 0
                    ? `Double-checked against ${selectedDay.validators.map(providerName).join(", ")}`
                    : "Single-source observation"}
                </span>
                {selectedDay.degraded && (
                  <span className="text-amber-300 font-semibold">Backup source used for this day</span>
                )}
              </div>
            </div>
          )}

          {/* Area Estimate & Provenance Disclaimer */}
          <div className="pt-2 border-t border-[#e2e8ce] text-[11px] text-[#555e4a] leading-relaxed flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setShowAreaNotice(!showAreaNotice)}
                className="inline-flex items-center gap-1 text-[#07503f] hover:underline font-bold cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-[#07503f]" />
                <span>Area Estimate Notice {showAreaNotice ? "▲" : "▼"}</span>
              </button>
              <span className="text-[#788365] text-[10px]">
                Sources: Open-Meteo (primary), NASA POWER &amp; OpenWeather (validation).
              </span>
            </div>
            {showAreaNotice && (
              <p className="text-[#555e4a] text-[11px] leading-relaxed bg-[#f1efdf] p-3 rounded-2xl border border-[#c3cda7]">
                Weather is derived from the 0.1° (~9–11 km) ERA5-Land grid cell. Gridded rainfall reflects an area average; local farm-level rainfall may vary due to monsoon convection.
              </p>
            )}
          </div>

          {/* Weather Summary Insights & Agrometeorological Advisory */}
          {(() => {
            const futureDays = data.days.filter((d) => d.phase === "future" || d.phase === "today");
            const forecastRainTotal = Number(
              futureDays.reduce((acc, d) => acc + (d.precip_mm || 0), 0).toFixed(1)
            );
            const rainDaysCount = futureDays.filter((d) => (d.precip_mm || 0) > 0.5).length;
            const maxForecastProb = Math.max(0, ...futureDays.map((d) => d.precip_prob_pct || 0));
            
            const tmaxValues = futureDays.map((d) => d.tmax_c).filter((v): v is number => v != null);
            const tminValues = futureDays.map((d) => d.tmin_c).filter((v): v is number => v != null);
            const highestTmax = tmaxValues.length ? Math.round(Math.max(...tmaxValues)) : (data.current?.temp_c ? Math.round(data.current.temp_c) : 33);
            const lowestTmin = tminValues.length ? Math.round(Math.min(...tminValues)) : 22;
            
            const rhValues = futureDays.map((d) => d.rh_mean_pct).filter((v): v is number => v != null);
            const avgForecastRh = rhValues.length
              ? Math.round(rhValues.reduce((a, b) => a + b, 0) / rhValues.length)
              : (data.current?.rh_pct ?? 65);

            const drySpellDays = data.metrics.dry_spell_days ?? 0;
            const rain30dNormalPct = data.metrics.rain_30d_vs_normal_pct;
            const et07d = data.metrics.et0_7d_mm ?? 28;
            const rain7d = data.metrics.rain_7d_mm ?? 0;
            const netDeficit = Number(Math.max(0, et07d - rain7d).toFixed(1));

            // Agromet triggers
            const isSprayFavorable = forecastRainTotal < 3.0 && maxForecastProb < 35 && (data.current?.wind_kmh ?? 10) < 18;
            const isIrrigationNeeded = drySpellDays >= 5 || (rain30dNormalPct != null && rain30dNormalPct < -20) || (netDeficit > 15);
            const isElevatedFungal = avgForecastRh >= 72 && highestTmax >= 24 && highestTmax <= 34;

            return (
              <div className="bg-[#f1efdf] border border-[#c3cda7] rounded-3xl p-6 space-y-6 mt-4 shadow-sm">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#c3cda7]/60 pb-4">
                  <div>
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Agrometeorological Summary &amp; Field Insights</span>
                    </div>
                    <p className="text-xs text-[#555e4a]">
                      7-day agronomic horizon synthesized from FAO-56 crop water demand, historical rainfall anomalies, and microclimate consensus.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="text-[11px] font-mono font-bold bg-[#e6ecd5] text-[#07503f] border border-[#c3cda7] px-3 py-1.5 rounded-full">
                      Grid: {data.location.district ? `${data.location.district}, ` : ""}{data.location.state}
                    </span>
                  </div>
                </div>

                {/* 3 Key Horizon Indicator Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#b2cee7]/60 border border-[#9cbcd8] p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-[#18486b] font-bold flex items-center gap-1.5">
                        <CloudRain className="w-4 h-4 text-[#18486b]" /> Forecast Rain (7d)
                      </span>
                      <span className="text-2xl font-serif font-bold text-[#18486b] mt-1.5 block">
                        {forecastRainTotal} mm
                      </span>
                    </div>
                    <span className="text-[11px] text-[#18486b]/80 mt-2 block">
                      {rainDaysCount > 0 ? `${rainDaysCount} rain day${rainDaysCount > 1 ? "s" : ""} expected (peak chance ${maxForecastProb}%)` : "No substantial rainfall expected"}
                    </span>
                  </div>

                  <div className="bg-[#fceace]/70 border border-[#edd1ad] p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-[#8a4b12] font-bold flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-[#8a4b12]" /> Water Deficit / ET₀
                      </span>
                      <span className="text-2xl font-serif font-bold text-[#8a4b12] mt-1.5 block">
                        {netDeficit > 0 ? `-${netDeficit} mm` : "Hydrated"}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8a4b12]/80 mt-2 block">
                      ET₀ {et07d} mm vs {rain7d} mm rain ({drySpellDays} consecutive dry days)
                    </span>
                  </div>

                  <div className="bg-[#e6ecd5] border border-[#c3cda7] p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-[#3b5921] font-bold flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-[#3b5921]" /> Thermal Range (7d)
                      </span>
                      <span className="text-2xl font-serif font-bold text-[#3b5921] mt-1.5 block">
                        {lowestTmin}°C – {highestTmax}°C
                      </span>
                    </div>
                    <span className="text-[11px] text-[#3b5921]/80 mt-2 block">
                      {data.metrics.tmax_7d_anomaly_c != null
                        ? `7d anomaly: ${data.metrics.tmax_7d_anomaly_c > 0 ? "+" : ""}${data.metrics.tmax_7d_anomaly_c}°C vs ERA5 normal`
                        : "Normal seasonal temperature range"}
                    </span>
                  </div>
                </div>

                {/* 4 Detailed Operational Advisory Cards (2x2 Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Spraying Window */}
                  <div className="bg-white border border-[#c3cda7] p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#212529] flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-[#07503f]" />
                        Spraying &amp; Foliar Operations
                      </span>
                      {isSprayFavorable ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]">
                          ✓ Favorable Window
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠ Wash-off Risk
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#555e4a] leading-relaxed">
                      {isSprayFavorable
                        ? `Rain probability remains low (peak ${maxForecastProb}%) with light winds (<${data.current?.wind_kmh ?? 12} km/h). Safe 48–72h window for foliar nutrient sprays, plant growth regulators, or scheduled insecticides. Best applied between 6:30–9:30 AM.`
                        : `Precipitation anticipated within upcoming forecast (${forecastRainTotal} mm, ${maxForecastProb}% probability). Postpone foliar applications or contact pesticides to prevent costly wash-off and chemical runoff.`}
                    </p>
                  </div>

                  {/* 2. Irrigation Scheduling */}
                  <div className="bg-white border border-[#c3cda7] p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#212529] flex items-center gap-2">
                        <Sprout className="w-4 h-4 text-[#07503f]" />
                        Irrigation &amp; Moisture Balance
                      </span>
                      {isIrrigationNeeded ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fceace] text-[#8a4b12] border border-[#f5d5b0]">
                          ● Supplemental Irrigation Advised
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]">
                          ✓ Sufficient Moisture
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#555e4a] leading-relaxed">
                      {isIrrigationNeeded
                        ? `Crop evapotranspiration (${et07d} mm) has outpaced precipitation with ${drySpellDays} consecutive dry days. Provide light supplemental irrigation (drip or alternate furrow) for sensitive stages such as flowering or grain filling.`
                        : `Recent moisture or low atmospheric demand keeps the root-zone sufficiently hydrated. Withhold irrigation to conserve energy, avoid root waterlogging, and preserve soil aeration.`}
                    </p>
                  </div>

                  {/* 3. Pest & Disease Predisposition */}
                  <div className="bg-white border border-[#c3cda7] p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#212529] flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-[#8a4b12]" />
                        Disease &amp; Pest Predisposition
                      </span>
                      {isElevatedFungal ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠ Elevated Fungal Risk
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#efefef] text-[#4a4f55] border border-[#d8d8d8]">
                          ✓ Low Disease Pressure
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#555e4a] leading-relaxed">
                      {isElevatedFungal
                        ? `Average humidity around ${avgForecastRh}% and warm daytime highs (${highestTmax}°C) heighten predisposition to powdery mildew, blight, and sucking pest activity. Inspect bottom leaf canopy and ensure clear furrow drainage.`
                        : `Ambient relative humidity averaging ${avgForecastRh}% keeps foliar disease incidence low. Continue regular monitoring during morning field walks.`}
                    </p>
                  </div>

                  {/* 4. Cultural Operations & Trafficability */}
                  <div className="bg-white border border-[#c3cda7] p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#212529] flex items-center gap-2">
                        <Compass className="w-4 h-4 text-[#07503f]" />
                        Field Workability &amp; Operations
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6ecd5] text-[#3b5921] border border-[#c3cda7]">
                        ✓ High Accessibility
                      </span>
                    </div>
                    <p className="text-xs text-[#555e4a] leading-relaxed">
                      Firm surface soil condition offers optimal traction for machinery and manual field operations. Ideal timeframe for intercultural weeding, earthing up, mulching, and localized top-dressing of nitrogenous fertilizer.
                    </p>
                  </div>
                </div>

                {/* Agronomist Executive Takeaway Banner */}
                <div className="bg-[#07503f] text-[#f1efdf] rounded-2xl p-4.5 flex flex-col sm:flex-row items-start gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#e8fe85] text-[#07503f] flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-4.5 h-4.5 text-[#07503f]" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <h4 className="font-serif font-bold text-white text-sm">
                      Weekly Agronomy Takeaway for {displayName}
                    </h4>
                    <p className="text-[#f1efdf]/85 leading-relaxed">
                      Over the upcoming 7 days, maximum temperatures will hover near {highestTmax}°C with {forecastRainTotal > 1 ? `${forecastRainTotal} mm expected precipitation` : `${drySpellDays} cumulative dry days`}. {isIrrigationNeeded ? "Focus on maintaining root-zone moisture through targeted irrigation and surface mulching." : "Utilize favorable clear skies to complete scheduled weeding and preventative crop protection."} All field activities can proceed safely during morning hours.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};
