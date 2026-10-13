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
} from "lucide-react";

interface WeatherStripProps {
  locationId?: number;
  lat?: number;
  lon?: number;
  locationName?: string;
  onLocationChange?: (lat: number, lon: number, name: string) => void;
}

const POPULAR_LOCATIONS = [
  { name: "Nashik (Lasalgaon)", state: "Maharashtra", lat: 20.0, lon: 73.8 },
  { name: "Pune", state: "Maharashtra", lat: 18.52, lon: 73.86 },
  { name: "Rajkot", state: "Gujarat", lat: 22.3, lon: 70.8 },
  { name: "Surat", state: "Gujarat", lat: 21.17, lon: 72.83 },
  { name: "Khanna / Ludhiana", state: "Punjab", lat: 30.7, lon: 76.2 },
  { name: "Agra", state: "Uttar Pradesh", lat: 27.18, lon: 78.01 },
  { name: "Indore", state: "Madhya Pradesh", lat: 22.72, lon: 75.86 },
  { name: "Bengaluru", state: "Karnataka", lat: 12.97, lon: 77.59 },
  { name: "Kota", state: "Rajasthan", lat: 25.21, lon: 75.86 },
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
  lat: initialLat = 20.0,
  lon: initialLon = 73.8,
  locationName: initialName = "Nashik (Maharashtra)",
}) => {
  const [lat, setLat] = useState<number>(initialLat);
  const [lon, setLon] = useState<number>(initialLon);
  const [displayName, setDisplayName] = useState<string>(initialName);
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
    setIsExplore(false);
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
    { bg: "bg-[#d0e6f6]/10", border: "border-[#d0e6f6]/30", text: "text-[#d0e6f6]", label: "Sky" },
    { bg: "bg-[#f8d4c8]/10", border: "border-[#f8d4c8]/30", text: "text-[#f8d4c8]", label: "Peach" },
    { bg: "bg-[#d9e2d5]/10", border: "border-[#d9e2d5]/30", text: "text-[#d9e2d5]", label: "Sage" },
    { bg: "bg-[#d5d8db]/10", border: "border-[#d5d8db]/30", text: "text-[#d5d8db]", label: "Ash" },
  ];

  return (
    <div className="w-full bg-[#111827] border border-[#1f2937] rounded-3xl p-5 sm:p-8 shadow-2xl space-y-7 text-stone-200">
      {/* Top Header & Location Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-stone-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold shadow-md shrink-0">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Weather Intelligence & Agro Climatology
                </h2>
                {isExplore && (
                  <span className="text-[11px] bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Compass className="w-3 h-3" /> Explore Tier (India-wide)
                  </span>
                )}
                {data?.degraded && (
                  <span className="text-[11px] bg-amber-950/60 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    Degraded / Fallback
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-1 font-mono">
                <MapPin className="w-3.5 h-3.5 text-[#e8fe85]" />
                {data?.location?.name || displayName} <span className="text-stone-500">•</span> Grid: {data?.location?.grid_key || `${lat.toFixed(1)},${lon.toFixed(1)}`}
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
              className="bg-stone-900 text-xs text-stone-100 placeholder-stone-500 border border-stone-700/80 rounded-full pl-9 pr-10 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#e8fe85] focus:border-[#e8fe85] w-full sm:w-60 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 pointer-events-none" />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] hover:bg-[#0d6e57] text-[#e8fe85] transition-colors"
            >
              {isSearching ? "..." : "Go"}
            </button>
          </form>

          {/* Autocomplete dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 right-0 sm:right-auto z-50 w-full sm:w-80 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl p-2 text-xs space-y-1 backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-stone-400 border-b border-stone-800 flex justify-between items-center">
                <span>Select Location</span>
                <button
                  type="button"
                  onClick={() => setShowSearchResults(false)}
                  className="text-stone-500 hover:text-stone-300"
                >
                  ✕
                </button>
              </div>
              {searchResults.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(r)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-800 text-stone-200 transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-white">{r.name}</span>
                    <span className="text-[11px] text-stone-400 block">
                      {r.district ? `${r.district}, ` : ""}{r.state}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#e8fe85] bg-[#07503f]/40 px-2 py-0.5 rounded-full border border-[#07503f]">
                    {r.lat.toFixed(1)}, {r.lon.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <select
            className="bg-stone-900 text-xs text-stone-200 border border-stone-700/80 rounded-full px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#e8fe85]"
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (!isNaN(idx) && POPULAR_LOCATIONS[idx]) {
                handleSelectPreset(POPULAR_LOCATIONS[idx]);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Preset Mandis...
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
            className="p-2.5 rounded-full bg-[#07503f] hover:bg-[#0d6e57] text-[#e8fe85] transition shadow-md shrink-0 flex items-center justify-center"
            title="Refresh weather data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e8fe85]" : ""}`} />
          </button>
        </div>
      </div>

      {isExplore && (
        <div className="px-4 py-3 rounded-2xl bg-[#07503f]/20 border border-[#07503f]/40 text-[#f1efdf] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-[#e8fe85] flex-shrink-0" />
            <span>
              <b className="text-white">Explore Tier:</b> Weather for newly enrolled location is live via Open-Meteo. Confidence starts at <b>medium</b>; full multi-source cross-check validation runs during tonight&apos;s scheduled pipeline.
            </span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-stone-400">
          <div className="w-10 h-10 rounded-full border-4 border-[#07503f] border-t-[#e8fe85] animate-spin" />
          <p className="text-xs font-mono uppercase tracking-widest text-stone-400">
            Fusing multi-source weather data across Open-Meteo, NASA POWER, and OpenWeather...
          </p>
        </div>
      )}

      {error && !data && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Main Weather Display: Current + Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Current Conditions Card */}
            <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 font-mono">
                    Current Observation
                  </span>
                  <div className="text-4xl font-serif font-bold text-white mt-1.5 flex items-baseline gap-1">
                    {data.current?.temp_c != null ? `${data.current.temp_c}°C` : "—"}
                  </div>
                  {data.current?.weather_code != null && WMO_TEXT[data.current.weather_code] && (
                    <p className="text-sm text-[#e8fe85] font-medium mt-0.5">{WMO_TEXT[data.current.weather_code]}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1">
                    From <span className="text-stone-200 font-medium">{providerName(data.current?.source)}</span>
                  </p>
                </div>
                {data.current && renderConfidenceBadge(data.current.confidence, false)}
              </div>

              {/* Observation stats */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-stone-800 text-center">
                <div className="bg-stone-900/60 p-2.5 rounded-2xl border border-stone-800/80">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-stone-400">
                    <Droplets className="w-3.5 h-3.5 text-[#d0e6f6]" /> Humidity
                  </div>
                  <span className="text-sm font-bold text-stone-100">{data.current?.rh_pct ?? "—"}%</span>
                </div>
                <div className="bg-stone-900/60 p-2.5 rounded-2xl border border-stone-800/80">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-stone-400">
                    <Wind className="w-3.5 h-3.5 text-[#d9e2d5]" /> Wind
                  </div>
                  <span className="text-sm font-bold text-stone-100">{data.current?.wind_kmh ?? "—"} km/h</span>
                </div>
                <div className="bg-stone-900/60 p-2.5 rounded-2xl border border-stone-800/80">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-stone-400">
                    <CloudRain className="w-3.5 h-3.5 text-[#f8d4c8]" /> 1h Rain
                  </div>
                  <span className="text-sm font-bold text-stone-100">{data.current?.precip_mm_1h ?? 0} mm</span>
                </div>
              </div>

              {/* Cross check */}
              {data.current?.cross_check && Object.keys(data.current.cross_check).length > 0 && (
                <div className="text-xs text-stone-400 bg-stone-900/80 p-2.5 rounded-2xl border border-stone-800">
                  <span className="text-stone-300 font-medium">Cross-check:</span>{" "}
                  {Object.entries(data.current.cross_check).map(([prov, details]: any) => (
                    <span key={prov}>
                      {prov} reports {details.temp_c}°C
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Agro Climatology Metrics Card */}
            <div className="lg:col-span-2 bg-[#111827] border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 mb-1">
                    <span>Agro-Climatology Metrics</span>
                  </div>
                  <p className="text-xs text-stone-400">Calculated over historical actuals &amp; 15-year ERA5-Land normals</p>
                </div>
                <div className="shrink-0">
                  {renderConfidenceBadge(data.metrics.confidence, false)}
                </div>
              </div>

              {/* Pastel Quilt grid for the 4 core metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#d0e6f6]/10 border border-[#d0e6f6]/25 p-3.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#d0e6f6] font-semibold block">7-Day Rainfall</span>
                  <span className="text-2xl font-serif font-bold text-white mt-1 block">{data.metrics.rain_7d_mm} mm</span>
                  <span className="text-[10px] text-stone-400">Recent accumulation</span>
                </div>

                <div className="bg-[#f8d4c8]/10 border border-[#f8d4c8]/25 p-3.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#f8d4c8] font-semibold block">30-Day Total</span>
                  <span className="text-2xl font-serif font-bold text-white mt-1 block">{data.metrics.rain_30d_mm} mm</span>
                  <span className="text-[10px] text-stone-400">Monthly total</span>
                </div>

                <div className="bg-[#d9e2d5]/10 border border-[#d9e2d5]/25 p-3.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#d9e2d5] font-semibold block">Vs. Normal (30d)</span>
                  <div className="my-1">
                    {data.metrics.rain_30d_vs_normal_pct != null ? (
                      <span
                        className={`text-2xl font-serif font-bold block ${
                          data.metrics.rain_30d_vs_normal_pct >= 0
                            ? "text-[#e8fe85]"
                            : "text-amber-400"
                        }`}
                      >
                        {data.metrics.rain_30d_vs_normal_pct > 0 ? "+" : ""}{data.metrics.rain_30d_vs_normal_pct}%
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-stone-400 block leading-tight">
                        Not enough data yet
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400">
                    {data.metrics.rain_30d_vs_normal_pct != null
                      ? "vs. 2010–24 average"
                      : data.metrics.days_in_30d_window != null
                      ? `${data.metrics.days_in_30d_window} of 30 days`
                      : "Needs 27 of 30 days"}
                  </span>
                </div>

                <div className="bg-[#d5d8db]/10 border border-[#d5d8db]/25 p-3.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-xs text-[#d5d8db] font-semibold block">Consecutive Dry Days</span>
                  <span className="text-2xl font-serif font-bold text-white mt-1 block">{data.metrics.dry_spell_days} d</span>
                  <span className="text-[10px] text-stone-400">&lt;1mm daily threshold</span>
                </div>
              </div>

              {/* Extra agro indicators */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 pt-3 border-t border-stone-800">
                {data.metrics.tmax_7d_anomaly_c != null && (
                  <div>
                    <span className="text-stone-500">7d Temp Anomaly:</span>{" "}
                    <span className="font-semibold text-stone-200">
                      {data.metrics.tmax_7d_anomaly_c > 0 ? "+" : ""}
                      {data.metrics.tmax_7d_anomaly_c}°C
                    </span>
                  </div>
                )}
                {data.metrics.et0_7d_mm != null && (
                  <div>
                    <span className="text-stone-500">7d Evapotranspiration (ET₀):</span>{" "}
                    <span className="font-semibold text-stone-200">{data.metrics.et0_7d_mm} mm</span>
                  </div>
                )}
                <div>
                  <span className="text-stone-500">Metrics Confidence:</span>{" "}
                  <span className="font-medium text-[#e8fe85] capitalize">{data.metrics.confidence}</span> (inherited from 7d window)
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast & Recent Strip (Pastel Quilt Strip) */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-serif text-lg font-bold text-stone-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#e8fe85]" /> Multi-Source Fused Daily Horizon (Past + Forecast)
              </h3>
              <span className="text-xs text-stone-400">Click a day card to inspect validation & disagreements</span>
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
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-200 ${
                      isSelected
                        ? "bg-[#07503f]/40 border-[#e8fe85] ring-2 ring-[#e8fe85]/40 shadow-lg scale-[1.02]"
                        : `${tint.bg} hover:brightness-125 ${tint.border}`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-stone-200">
                        {isToday ? "Today" : day.date.slice(5)}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.confidence === "high"
                            ? "bg-[#e8fe85]"
                            : day.confidence === "medium"
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                        title={`Confidence: ${day.confidence}`}
                      />
                    </div>

                    <div className="my-2.5">
                      <div className="text-lg font-serif font-bold text-white">
                        {day.tmax_c != null ? `${Math.round(day.tmax_c)}°` : "—"}
                        <span className="text-xs text-stone-400 font-sans font-normal ml-1">
                          {day.tmin_c != null ? `${Math.round(day.tmin_c)}°` : ""}
                        </span>
                      </div>
                      <div className={`text-xs ${tint.text} flex items-center gap-1 mt-0.5 font-medium`}>
                        <Droplets className="w-3 h-3" />
                        {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                      </div>
                    </div>

                    <div className="text-[10px] text-stone-400 capitalize flex items-center justify-between w-full pt-1.5 border-t border-stone-800">
                      <span>{day.phase}</span>
                      {hasDisagreement && (
                        <span className="text-rose-400 font-bold" title="Provider Disagreement">
                          !
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Deep Dive Panel (Forest Section Banner) */}
          {selectedDay && (
            <div className="bg-[#07503f]/20 border border-[#07503f]/50 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#07503f]/40 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-[#e8fe85] shrink-0" />
                  <span className="font-serif font-bold text-white text-base">Inspection: {selectedDay.date}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs text-stone-300">
                    Main source: <b className="text-white">{selectedDay.primary_source === "open_meteo" ? "Open-Meteo" : selectedDay.primary_source}</b>
                  </span>
                  {renderConfidenceBadge(selectedDay.confidence, !!selectedDay.disagreement)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-stone-900/40 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 block">Temperature High / Low</span>
                  <span className="text-sm font-semibold text-stone-100 mt-1 block">
                    {selectedDay.tmax_c ?? "—"}°C / {selectedDay.tmin_c ?? "—"}°C
                  </span>
                </div>
                <div className="bg-stone-900/40 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 block">Precipitation & Probability</span>
                  <span className="text-sm font-semibold text-stone-100 mt-1 block">
                    {selectedDay.precip_mm ?? 0} mm {selectedDay.precip_prob_pct != null ? `(${selectedDay.precip_prob_pct}%)` : ""}
                  </span>
                </div>
                <div className="bg-stone-900/40 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 block">Relative Humidity (Mean)</span>
                  <span className="text-sm font-semibold text-stone-100 mt-1 block">{selectedDay.rh_mean_pct ?? "—"}%</span>
                </div>
                <div className="bg-stone-900/40 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 block">Solar Radiation / ET₀</span>
                  <span className="text-sm font-semibold text-stone-100 mt-1 block">
                    {selectedDay.radiation_mj_m2 ? `${selectedDay.radiation_mj_m2} MJ/m²` : "—"} /{" "}
                    {selectedDay.et0_mm ? `${selectedDay.et0_mm} mm` : "—"}
                  </span>
                </div>
              </div>

              {/* Disagreement Warning if any */}
              {selectedDay.disagreement && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Provider Disagreement Detected (Confidence Lowered to Low):
                  </div>
                  {Object.entries(selectedDay.disagreement).map(([field, provMap]: any) => (
                    <div key={field} className="ml-5">
                      <b className="capitalize">{field.replace("_", " ")}:</b>{" "}
                      {Object.entries(provMap).map(([p, v]: any) => `${p} reported ${v}`).join(", ")}
                    </div>
                  ))}
                  <p className="ml-5 text-[11px] text-rose-400/80">
                    Advisory contract rule enforced: Weather-linked advice is phrased conservatively without hard instructions.
                  </p>
                </div>
              )}

              {/* Validators info */}
              <div className="text-[11px] text-stone-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#07503f]/30">
                <span>
                  Validation:{" "}
                  {selectedDay.validators && selectedDay.validators.length > 0
                    ? `Double-checked against ${selectedDay.validators.map(providerName).join(", ")}`
                    : "Not yet double-checked against a second source"}
                </span>
                {selectedDay.degraded && (
                  <span className="text-amber-400">Backup source used for this day</span>
                )}
              </div>
            </div>
          )}

          {/* Area Estimate & Provenance Disclaimer */}
          <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400 leading-relaxed flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setShowAreaNotice(!showAreaNotice)}
                className="inline-flex items-center gap-1 text-[#e8fe85] hover:underline font-bold cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Area Estimate Notice {showAreaNotice ? "▲" : "▼"}</span>
              </button>
              <span className="text-stone-500 text-[10px]">
                Sources: Open-Meteo (primary), NASA POWER &amp; OpenWeather (validation).
              </span>
            </div>
            {showAreaNotice && (
              <p className="text-stone-400 text-[11px] leading-relaxed bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
                Weather is derived from the 0.1° (~9–11 km) ERA5-Land grid cell. Gridded rainfall reflects an area average; local farm-level rainfall may vary due to monsoon convection.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
