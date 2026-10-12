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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          High Confidence
        </span>
      );
    }
    if (confidence === "medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <HelpCircle className="w-3 h-3" />
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <AlertTriangle className="w-3 h-3" />
        Low Confidence {hasDisagreement && "(Disagreement)"}
      </span>
    );
  };

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6 text-zinc-100">
      {/* Top Header & Location Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CloudRain className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Weather Intelligence & Agro Climatology
                {isExplore && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-normal flex items-center gap-1">
                    <Compass className="w-3 h-3" /> Explore Tier (India-wide)
                  </span>
                )}
                {data?.degraded && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-normal">
                    Degraded / Fallback
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {data?.location?.name || displayName} (Grid: {data?.location?.grid_key || `${lat.toFixed(1)},${lon.toFixed(1)}`})
              </p>
            </div>
          </div>
        </div>

        {/* Explore Search & Location Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              placeholder="Explore any village/district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 border border-zinc-700 rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-56"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
            >
              {isSearching ? "..." : "Go"}
            </button>
          </form>

          {/* Autocomplete dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 right-0 sm:right-auto z-50 w-full sm:w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-1 text-xs space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-zinc-400 border-b border-zinc-700/60 flex justify-between items-center">
                <span>Select Location</span>
                <button
                  type="button"
                  onClick={() => setShowSearchResults(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>
              {searchResults.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(r)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-700/80 text-zinc-200 transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-white">{r.name}</span>
                    <span className="text-[11px] text-zinc-400 block">
                      {r.district ? `${r.district}, ` : ""}{r.state}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {r.lat.toFixed(1)}, {r.lon.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <select
            className="bg-zinc-800 text-xs text-zinc-200 border border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (!isNaN(idx) && POPULAR_LOCATIONS[idx]) {
                handleSelectPreset(POPULAR_LOCATIONS[idx]);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Preset Tracked Mandis...
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
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
            title="Refresh weather data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {isExplore && (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <b>Explore Tier:</b> Weather for newly enrolled location is live via Open-Meteo. Confidence starts at <b>medium</b>; full multi-source cross-check validation runs during tonight&apos;s scheduled pipeline.
            </span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-zinc-400">
          <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
          <p className="text-sm">Fusing multi-source weather data across Open-Meteo, NASA POWER, and OpenWeather...</p>
        </div>
      )}

      {error && !data && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Main Weather Display: Current + Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Current Conditions Card */}
            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Current Observation</span>
                  <div className="text-3xl font-extrabold text-white mt-1 flex items-baseline gap-1">
                    {data.current?.temp_c != null ? `${data.current.temp_c}°C` : "—"}
                  </div>
                  {data.current?.weather_code != null && WMO_TEXT[data.current.weather_code] && (
                    <p className="text-sm text-zinc-200 mt-0.5">{WMO_TEXT[data.current.weather_code]}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-0.5">
                    From <span className="text-zinc-200">{providerName(data.current?.source)}</span>
                  </p>
                </div>
                {data.current && renderConfidenceBadge(data.current.confidence, false)}
              </div>

              {/* Observation stats */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-700/40 text-center">
                <div className="bg-zinc-900/40 p-2 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" /> Humidity
                  </div>
                  <span className="text-sm font-bold text-zinc-100">{data.current?.rh_pct ?? "—"}%</span>
                </div>
                <div className="bg-zinc-900/40 p-2 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                    <Wind className="w-3.5 h-3.5 text-teal-400" /> Wind
                  </div>
                  <span className="text-sm font-bold text-zinc-100">{data.current?.wind_kmh ?? "—"} km/h</span>
                </div>
                <div className="bg-zinc-900/40 p-2 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                    <CloudRain className="w-3.5 h-3.5 text-indigo-400" /> 1h Rain
                  </div>
                  <span className="text-sm font-bold text-zinc-100">{data.current?.precip_mm_1h ?? 0} mm</span>
                </div>
              </div>

              {/* Cross check */}
              {data.current?.cross_check && Object.keys(data.current.cross_check).length > 0 && (
                <div className="text-xs text-zinc-400 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                  <span className="text-zinc-300 font-medium">Cross-check:</span>{" "}
                  {Object.entries(data.current.cross_check).map(([prov, details]: any) => (
                    <span key={prov}>
                      {prov} reports {details.temp_c}°C
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Agro Climatology Metrics Card */}
            <div className="lg:col-span-2 bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 flex flex-col justify-between space-y-4">
              {/* §1.2 fix: flex-wrap + min-w-0 prevent badge from overlapping the header on narrow viewports */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Agro-Climatology Metrics</span>
                  <p className="text-xs text-zinc-400 mt-0.5">Calculated over historical actuals &amp; 15-year ERA5-Land normals</p>
                </div>
                <div className="shrink-0">
                  {renderConfidenceBadge(data.metrics.confidence, false)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-zinc-400 block">7-Day Rainfall</span>
                  <span className="text-xl font-bold text-white mt-1 block">{data.metrics.rain_7d_mm} mm</span>
                  <span className="text-[11px] text-zinc-500">Recent accumulation</span>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-zinc-400 block">30-Day Total</span>
                  <span className="text-xl font-bold text-white mt-1 block">{data.metrics.rain_30d_mm} mm</span>
                  <span className="text-[11px] text-zinc-500">Monthly total</span>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-zinc-400 block">Vs. Normal (30d)</span>
                  <div className="my-1">
                    {data.metrics.rain_30d_vs_normal_pct != null ? (
                      <span
                        className={`text-xl font-bold block ${
                          data.metrics.rain_30d_vs_normal_pct >= 0
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {data.metrics.rain_30d_vs_normal_pct > 0 ? "+" : ""}{data.metrics.rain_30d_vs_normal_pct}%
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-zinc-400 block leading-tight">
                        Not enough data yet
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {data.metrics.rain_30d_vs_normal_pct != null
                      ? "vs. the 2010–24 average"
                      : data.metrics.days_in_30d_window != null
                      ? `${data.metrics.days_in_30d_window} of 30 days on file`
                      : "Needs 27 of the last 30 days"}
                  </span>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-zinc-400 block">Consecutive Dry Days</span>
                  <span className="text-xl font-bold text-white mt-1 block">{data.metrics.dry_spell_days} days</span>
                  <span className="text-[11px] text-zinc-500">&lt;1mm daily threshold</span>
                </div>
              </div>

              {/* Extra agro indicators */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-2 border-t border-zinc-700/40">
                {data.metrics.tmax_7d_anomaly_c != null && (
                  <div>
                    <span className="text-zinc-500">7d Temp Anomaly:</span>{" "}
                    <span className="font-semibold text-zinc-200">
                      {data.metrics.tmax_7d_anomaly_c > 0 ? "+" : ""}
                      {data.metrics.tmax_7d_anomaly_c}°C
                    </span>
                  </div>
                )}
                {data.metrics.et0_7d_mm != null && (
                  <div>
                    <span className="text-zinc-500">7d Evapotranspiration (ET₀):</span>{" "}
                    <span className="font-semibold text-zinc-200">{data.metrics.et0_7d_mm} mm</span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">Metrics Confidence:</span>{" "}
                  <span className="font-medium text-emerald-400 capitalize">{data.metrics.confidence}</span> (inherited from 7d window)
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast & Recent Strip */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" /> Multi-Source Fused Daily Horizon (Past + Forecast)
              </h3>
              <span className="text-xs text-zinc-500">Click a day card to inspect validation & disagreements</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 overflow-x-auto pb-2">
              {data.days.map((day) => {
                const isSelected = selectedDay?.date === day.date;
                const isToday = day.phase === "today";
                const hasDisagreement = !!day.disagreement;

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-zinc-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/50"
                        : "bg-zinc-800/40 hover:bg-zinc-800/80 border-zinc-700/60"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-zinc-200">
                        {isToday ? "Today" : day.date.slice(5)}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.confidence === "high"
                            ? "bg-emerald-400"
                            : day.confidence === "medium"
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                        title={`Confidence: ${day.confidence}`}
                      />
                    </div>

                    <div className="my-2">
                      <div className="text-base font-bold text-white">
                        {day.tmax_c != null ? `${Math.round(day.tmax_c)}°` : "—"}
                        <span className="text-xs text-zinc-400 font-normal ml-1">
                          {day.tmin_c != null ? `${Math.round(day.tmin_c)}°` : ""}
                        </span>
                      </div>
                      <div className="text-xs text-blue-400 flex items-center gap-1 mt-0.5">
                        <Droplets className="w-3 h-3" />
                        {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-500 capitalize flex items-center justify-between w-full pt-1 border-t border-zinc-700/30">
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

          {/* Selected Day Deep Dive Panel */}
          {selectedDay && (
            <div className="bg-zinc-800/60 border border-zinc-700/80 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-700/60 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-white text-sm">Inspection: {selectedDay.date}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs text-zinc-400">
                    Main data source: <b className="text-zinc-200">{selectedDay.primary_source === "open_meteo" ? "Open-Meteo" : selectedDay.primary_source}</b>
                  </span>
                  {renderConfidenceBadge(selectedDay.confidence, !!selectedDay.disagreement)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500 block">Temperature High / Low</span>
                  <span className="text-sm font-semibold text-zinc-100">
                    {selectedDay.tmax_c ?? "—"}°C / {selectedDay.tmin_c ?? "—"}°C
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Precipitation & Probability</span>
                  <span className="text-sm font-semibold text-zinc-100">
                    {selectedDay.precip_mm ?? 0} mm {selectedDay.precip_prob_pct != null ? `(${selectedDay.precip_prob_pct}%)` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Relative Humidity (Mean)</span>
                  <span className="text-sm font-semibold text-zinc-100">{selectedDay.rh_mean_pct ?? "—"}%</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Solar Radiation / ET₀</span>
                  <span className="text-sm font-semibold text-zinc-100">
                    {selectedDay.radiation_mj_m2 ? `${selectedDay.radiation_mj_m2} MJ/m²` : "—"} /{" "}
                    {selectedDay.et0_mm ? `${selectedDay.et0_mm} mm` : "—"}
                  </span>
                </div>
              </div>

              {/* Disagreement Warning if any */}
              {selectedDay.disagreement && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
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
              <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-700/30">
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

          {/* Collapsible Area Estimate & Provenance Disclaimer (Architecture §19 & §15) */}
          {/* §1.2 fix: removed whitespace-nowrap on Sources line so it wraps on mobile instead of floating */}
          <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-500 leading-relaxed flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setShowAreaNotice(!showAreaNotice)}
                className="inline-flex items-center gap-1 text-zinc-400 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-emerald-400" />
                <span>Area Estimate Notice {showAreaNotice ? "▲" : "▼"}</span>
              </button>
              <span className="text-zinc-600 text-[10px]">
                Sources: Open-Meteo (primary), NASA POWER &amp; OpenWeather (validation).
              </span>
            </div>
            {showAreaNotice && (
              <p className="text-zinc-400 text-[10px] leading-relaxed">
                Weather is derived from the 0.1° (~9–11 km) ERA5-Land grid cell. Gridded rainfall reflects an area average; local farm-level rainfall may vary due to monsoon convection.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
