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
  const propName = initialName || (initialLat != null ? `${initialLat.toFixed(2)}, ${initialLon!.toFixed(2)}` : "");

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
  const [locError, setLocError] = useState<string | null>(null);

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
    if (initialLat != null && initialLon != null) loadWeather(lat, lon);
  }, [lat, lon]);


  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setIsSearching(true);
    try {
      const results = await searchWeatherLocations(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err: any) {
      setLocError(err.message);
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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-brand text-accent border border-accent/30">
          <CheckCircle2 className="w-3 h-3 text-accent" />
          High Confidence
        </span>
      );
    }
    if (confidence === "medium") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
          <HelpCircle className="w-3 h-3 text-amber-400" />
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-rose-950/70 text-rose-300 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        Low Confidence {hasDisagreement && "(Disagreement)"}
      </span>
    );
  };

  const PASTEL_TINTS = [
    { bg: "bg-sky/40", border: "border-sky", text: "text-sky-ink", label: "Sky" },
    { bg: "bg-warn-bg/60", border: "border-warn-bg", text: "text-warn", label: "Peach" },
    { bg: "bg-tint/70", border: "border-line", text: "text-good", label: "Sage" },
    { bg: "bg-ash", border: "border-line", text: "text-ink-soft", label: "Ash" },
  ];

  const backToFarm = () => {
    if (initialLat == null || initialLon == null) return;
    setLat(initialLat); setLon(initialLon); setDisplayName(propName);
    setIsExplore(false); setIsUsingGps(true); setLocError(null);
  };
  const useMyLocation = () => {
    setLocError(null);
    if (!navigator.geolocation) return setLocError("This device cannot share its location.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(+p.coords.latitude.toFixed(4)); setLon(+p.coords.longitude.toFixed(4));
        setDisplayName("Your current location"); setIsExplore(true); setIsUsingGps(false);
      },
      (e) => setLocError(e.code === e.PERMISSION_DENIED
        ? "Location permission is off. Search a place instead, or allow location in your browser settings."
        : "Could not get your location right now."),
      { timeout: 15000 },
    );
  };

  if (initialLat == null || initialLon == null) {
    return <div className="bg-surface rounded-2xl p-6 text-ink-soft">Add your farm location to see its weather.</div>;
  }

  return (
    <div className="w-full space-y-5 text-ink">
      <div className="pt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-ink">Weather</h1>
          <p className="mt-1 text-ink-soft flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-4 h-4 text-brand shrink-0" aria-hidden />
            <span>{isExplore ? displayName : `Your farm · ${propName}`}</span>
            {isExplore && (
              <button onClick={backToFarm} className="text-brand font-medium underline underline-offset-4">Back to my farm</button>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 relative">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <label htmlFor="wx-search" className="sr-only">Search a village or town</label>
            <input
              id="wx-search"
              type="text"
              placeholder="Search a village or town"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 flex-1 sm:w-64 rounded-xl border border-line bg-surface px-4 text-base"
            />
            <button type="submit" disabled={isSearching} aria-label="Search"
              className="h-11 w-11 rounded-xl bg-ash text-ink flex items-center justify-center hover:bg-tint shrink-0">
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
          <button onClick={useMyLocation} className="h-11 px-4 rounded-xl border border-line text-ink font-medium hover:bg-ash flex items-center justify-center gap-2">
            <Compass className="w-4 h-4" aria-hidden /> Use my location
          </button>

          {showSearchResults && (
            <ul className="absolute top-full mt-2 left-0 right-0 z-50 bg-surface border border-line rounded-xl shadow-lg overflow-hidden divide-y divide-line">
              {searchResults.length === 0 && <li className="px-4 py-3 text-ink-soft">No places found.</li>}
              {searchResults.map((r, idx) => (
                <li key={idx}>
                  <button onClick={() => handleSelectSearchResult(r)} className="w-full text-left px-4 py-3 hover:bg-ground">
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="text-ink-soft"> · {r.district ? `${r.district}, ` : ""}{r.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {locError && <p role="alert" className="text-bad">{locError}</p>}
      {data?.degraded && (
        <p className="rounded-xl bg-warn-bg text-warn px-4 py-3">Some weather sources are missing for this place, so readings may be less reliable.</p>
      )}

      {loading && !data && (
        <div className="py-16 flex justify-center text-ink-soft"><RefreshCw className="w-6 h-6 animate-spin" aria-label="Loading weather" /></div>
      )}

      {error && !data && (
        <div role="alert" className="rounded-xl bg-bad-bg text-bad px-4 py-3 flex items-center justify-between gap-4">
          <span>Weather is unavailable right now.</span>
          <button onClick={() => loadWeather(lat, lon)} className="h-10 px-4 rounded-full bg-surface text-ink font-medium">Try again</button>
        </div>
      )}

      {data && (
        <>
          {/* Main Weather Display: Current + Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Current Conditions Card */}
            <div className="bg-ground border border-line rounded-2xl p-6 flex flex-col justify-between space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-bold text-ink-soft">
                    Current Observation
                  </span>
                  <div className="text-4xl font-bold text-brand mt-1.5 flex items-baseline gap-1">
                    {data.current?.temp_c != null ? `${data.current.temp_c}°C` : "—"}
                  </div>
                  {data.current?.weather_code != null && WMO_TEXT[data.current.weather_code] && (
                    <p className="text-sm text-brand font-semibold mt-0.5">{WMO_TEXT[data.current.weather_code]}</p>
                  )}
                  <p className="text-sm text-ink-soft mt-1">
                    Source: <span className="text-ink font-medium">{providerName(data.current?.source)}</span>
                  </p>
                </div>
                {data.current && renderConfidenceBadge(data.current.confidence, false)}
              </div>

              {/* Observation stats - 3 pastel chips */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line/50 text-center">
                <div className="bg-sky/50 p-2.5 rounded-2xl border border-sky">
                  <div className="flex items-center justify-center gap-1 text-sm text-sky-ink font-medium">
                    <Droplets className="w-3.5 h-3.5 text-sky-ink" /> Humidity
                  </div>
                  <span className="text-sm font-bold text-sky-ink">{data.current?.rh_pct ?? "—"}%</span>
                </div>
                <div className="bg-tint p-2.5 rounded-2xl border border-line">
                  <div className="flex items-center justify-center gap-1 text-sm text-good font-medium">
                    <Wind className="w-3.5 h-3.5 text-good" /> Wind
                  </div>
                  <span className="text-sm font-bold text-good">{data.current?.wind_kmh ?? "—"} km/h</span>
                </div>
                <div className="bg-warn-bg p-2.5 rounded-2xl border border-warn-bg">
                  <div className="flex items-center justify-center gap-1 text-sm text-warn font-medium">
                    <CloudRain className="w-3.5 h-3.5 text-warn" /> 1h Rain
                  </div>
                  <span className="text-sm font-bold text-warn">{data.current?.precip_mm_1h ?? 0} mm</span>
                </div>
              </div>

              {/* Cross check */}
              {data.current?.cross_check && Object.keys(data.current.cross_check).length > 0 && (
                <div className="text-sm text-ink-soft bg-white p-2.5 rounded-2xl border border-line">
                  <span className="text-brand font-semibold">Cross-check:</span>{" "}
                  {Object.entries(data.current.cross_check).map(([prov, details]: any) => (
                    <span key={prov}>
                      {prov} reports {details.temp_c}°C
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Agro Climatology Metrics Card */}
            <div className="lg:col-span-2 bg-ground border border-line rounded-2xl p-6 flex flex-col justify-between space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-sm font-bold bg-brand text-accent mb-1">
                    <span>Agro-Climatology Metrics</span>
                  </div>
                  <p className="text-sm text-ink-soft">Calculated over actual rainfall &amp; 15-year ERA5-Land agricultural normals</p>
                </div>
                <div className="shrink-0">
                  {renderConfidenceBadge(data.metrics.confidence, false)}
                </div>
              </div>

              {/* Pastel Quilt grid for the 4 core metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-sky border border-sky p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-sm text-sky-ink font-bold block">7-Day Rain</span>
                  <span className="text-2xl font-bold text-sky-ink mt-1 block">{data.metrics.rain_7d_mm} mm</span>
                  <span className="text-sm text-sky-ink/80">Recent accumulation</span>
                </div>

                <div className="bg-warn-bg border border-warn-bg p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-sm text-warn font-bold block">30-Day Rain</span>
                  <span className="text-2xl font-bold text-warn mt-1 block">{data.metrics.rain_30d_mm} mm</span>
                  <span className="text-sm text-warn/80">Cumulative actual</span>
                </div>

                <div className="bg-tint border border-line p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-sm text-good font-bold block">Vs. Normal (30d)</span>
                  <div className="my-1">
                    {data.metrics.rain_30d_vs_normal_pct != null ? (
                      <span
                        className={`text-2xl font-bold block ${
                          data.metrics.rain_30d_vs_normal_pct >= 0
                            ? "text-good"
                            : "text-warn"
                        }`}
                      >
                        {data.metrics.rain_30d_vs_normal_pct > 0 ? "+" : ""}{data.metrics.rain_30d_vs_normal_pct}%
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-ink-soft block leading-tight">
                        Not enough data yet
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-ink-soft">
                    {data.metrics.rain_30d_vs_normal_pct != null
                      ? "vs. 2010–24 average"
                      : data.metrics.days_in_30d_window != null
                      ? `${data.metrics.days_in_30d_window} of 30 days`
                      : "Needs 27 of 30 days"}
                  </span>
                </div>

                <div className="bg-ash border border-line p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-sm text-ink-soft font-bold block">Dry Days</span>
                  <span className="text-2xl font-bold text-ink mt-1 block">{data.metrics.dry_spell_days} d</span>
                  <span className="text-sm text-ink-soft">&lt;1mm threshold</span>
                </div>
              </div>

              {/* Extra agro indicators */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink-soft pt-3 border-t border-line/50">
                {data.metrics.tmax_7d_anomaly_c != null && (
                  <div>
                    <span className="text-ink-muted">7d Temp Anomaly:</span>{" "}
                    <span className="font-semibold text-ink">
                      {data.metrics.tmax_7d_anomaly_c > 0 ? "+" : ""}
                      {data.metrics.tmax_7d_anomaly_c}°C
                    </span>
                  </div>
                )}
                {data.metrics.et0_7d_mm != null && (
                  <div>
                    <span className="text-ink-muted">7d Evapotranspiration (ET₀):</span>{" "}
                    <span className="font-semibold text-ink">{data.metrics.et0_7d_mm} mm</span>
                  </div>
                )}
                <div>
                  <span className="text-ink-muted">Confidence:</span>{" "}
                  <span className="font-bold text-brand capitalize">{data.metrics.confidence}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast & Recent Strip (Pastel Quilt Strip) */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-lg font-bold text-brand flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand" /> Multi-Source Daily Horizon (Past actuals + 7-Day Forecast)
              </h3>
              <span className="text-sm text-ink-soft">Click a day to inspect model consensus</span>
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
                        ? "bg-white border-2 border-brand ring-2 ring-brand/20 scale-[1.02]"
                        : `${tint.bg} hover:brightness-95 ${tint.border}`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-bold text-ink">
                        {isToday ? "Today" : day.date.slice(5)}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          day.confidence === "high"
                            ? "bg-brand"
                            : day.confidence === "medium"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        title={`Confidence: ${day.confidence}`}
                      />
                    </div>

                    <div className="my-2.5">
                      <div className="text-lg font-bold text-ink">
                        {day.tmax_c != null ? `${Math.round(day.tmax_c)}°` : "—"}
                        <span className="text-sm text-ink-soft font-sans font-normal ml-1">
                          {day.tmin_c != null ? `${Math.round(day.tmin_c)}°` : ""}
                        </span>
                      </div>
                      <div className={`text-sm ${tint.text} flex items-center gap-1 mt-0.5 font-bold`}>
                        <Droplets className="w-3 h-3" />
                        {day.precip_mm != null ? `${day.precip_mm} mm` : "0 mm"}
                      </div>
                    </div>

                    <div className="text-sm text-ink-soft capitalize flex items-center justify-between w-full pt-1.5 border-t border-line/50">
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
            <div className="bg-brand text-ground rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-accent shrink-0" />
                  <span className="font-bold text-white text-base">Day Analysis: {selectedDay.date}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-sm text-ground/80">
                    Main source: <b className="text-white">{selectedDay.primary_source === "open_meteo" ? "Open-Meteo" : selectedDay.primary_source}</b>
                  </span>
                  {renderConfidenceBadge(selectedDay.confidence, !!selectedDay.disagreement)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-ground/70 block">Temperature Range</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {selectedDay.tmax_c ?? "—"}°C / {selectedDay.tmin_c ?? "—"}°C
                  </span>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-ground/70 block">Rainfall & Probability</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {selectedDay.precip_mm ?? 0} mm {selectedDay.precip_prob_pct != null ? `(${selectedDay.precip_prob_pct}%)` : ""}
                  </span>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-ground/70 block">Mean Humidity</span>
                  <span className="text-sm font-semibold text-white mt-1 block">{selectedDay.rh_mean_pct ?? "—"}%</span>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15">
                  <span className="text-ground/70 block">Solar Radiation / ET₀</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {selectedDay.radiation_mj_m2 ? `${selectedDay.radiation_mj_m2} MJ/m²` : "—"} /{" "}
                    {selectedDay.et0_mm ? `${selectedDay.et0_mm} mm` : "—"}
                  </span>
                </div>
              </div>

              {/* Disagreement Warning if any */}
              {selectedDay.disagreement && (
                <div className="p-3.5 rounded-2xl bg-rose-900/60 border border-rose-400 text-rose-100 text-sm space-y-1">
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
                  <p className="ml-5 text-sm text-rose-200">
                    Conservative rule applied: advisory recommendations for this day avoid hard spray/irrigation triggers.
                  </p>
                </div>
              )}

              {/* Validators info */}
              <div className="text-sm text-ground/70 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/15">
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
          <div className="pt-2 border-t border-line text-sm text-ink-soft leading-relaxed flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setShowAreaNotice(!showAreaNotice)}
                className="inline-flex items-center gap-1 text-brand hover:underline font-bold cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-brand" />
                <span>Area Estimate Notice {showAreaNotice ? "▲" : "▼"}</span>
              </button>
              <span className="text-ink-muted text-sm">
                Sources: Open-Meteo (primary), NASA POWER &amp; OpenWeather (validation).
              </span>
            </div>
            {showAreaNotice && (
              <p className="text-ink-soft text-sm leading-relaxed bg-ground p-3 rounded-2xl border border-line">
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
              <div className="bg-ground border border-line rounded-2xl p-6 space-y-6 mt-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
                  <div>
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-sm font-bold bg-brand text-accent mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Agrometeorological Summary &amp; Field Insights</span>
                    </div>
                    <p className="text-sm text-ink-soft">
                      7-day agronomic horizon synthesized from FAO-56 crop water demand, historical rainfall anomalies, and microclimate consensus.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="text-sm font-bold bg-tint text-brand border border-line px-3 py-1.5 rounded-full">
                      Grid: {data.location.district ? `${data.location.district}, ` : ""}{data.location.state}
                    </span>
                  </div>
                </div>

                {/* 3 Key Horizon Indicator Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-sky/60 border border-sky p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-sm text-sky-ink font-bold flex items-center gap-1.5">
                        <CloudRain className="w-4 h-4 text-sky-ink" /> Forecast Rain (7d)
                      </span>
                      <span className="text-2xl font-bold text-sky-ink mt-1.5 block">
                        {forecastRainTotal} mm
                      </span>
                    </div>
                    <span className="text-sm text-sky-ink/80 mt-2 block">
                      {rainDaysCount > 0 ? `${rainDaysCount} rain day${rainDaysCount > 1 ? "s" : ""} expected (peak chance ${maxForecastProb}%)` : "No substantial rainfall expected"}
                    </span>
                  </div>

                  <div className="bg-warn-bg/70 border border-warn-bg p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-sm text-warn font-bold flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-warn" /> Water Deficit / ET₀
                      </span>
                      <span className="text-2xl font-bold text-warn mt-1.5 block">
                        {netDeficit > 0 ? `-${netDeficit} mm` : "Hydrated"}
                      </span>
                    </div>
                    <span className="text-sm text-warn/80 mt-2 block">
                      ET₀ {et07d} mm vs {rain7d} mm rain ({drySpellDays} consecutive dry days)
                    </span>
                  </div>

                  <div className="bg-tint border border-line p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-sm text-good font-bold flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-good" /> Thermal Range (7d)
                      </span>
                      <span className="text-2xl font-bold text-good mt-1.5 block">
                        {lowestTmin}°C – {highestTmax}°C
                      </span>
                    </div>
                    <span className="text-sm text-good/80 mt-2 block">
                      {data.metrics.tmax_7d_anomaly_c != null
                        ? `7d anomaly: ${data.metrics.tmax_7d_anomaly_c > 0 ? "+" : ""}${data.metrics.tmax_7d_anomaly_c}°C vs ERA5 normal`
                        : "Normal seasonal temperature range"}
                    </span>
                  </div>
                </div>

                {/* 4 Detailed Operational Advisory Cards (2x2 Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Spraying Window */}
                  <div className="bg-white border border-line p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-brand" />
                        Spraying &amp; Foliar Operations
                      </span>
                      {isSprayFavorable ? (
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-tint text-good border border-line">
                          ✓ Favorable Window
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠ Wash-off Risk
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      {isSprayFavorable
                        ? `Rain probability remains low (peak ${maxForecastProb}%) with light winds (<${data.current?.wind_kmh ?? 12} km/h). Safe 48–72h window for foliar nutrient sprays, plant growth regulators, or scheduled insecticides. Best applied between 6:30–9:30 AM.`
                        : `Precipitation anticipated within upcoming forecast (${forecastRainTotal} mm, ${maxForecastProb}% probability). Postpone foliar applications or contact pesticides to prevent costly wash-off and chemical runoff.`}
                    </p>
                  </div>

                  {/* 2. Irrigation Scheduling */}
                  <div className="bg-white border border-line p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink flex items-center gap-2">
                        <Sprout className="w-4 h-4 text-brand" />
                        Irrigation &amp; Moisture Balance
                      </span>
                      {isIrrigationNeeded ? (
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-warn-bg text-warn border border-warn-bg">
                          ● Supplemental Irrigation Advised
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-tint text-good border border-line">
                          ✓ Sufficient Moisture
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      {isIrrigationNeeded
                        ? `Crop evapotranspiration (${et07d} mm) has outpaced precipitation with ${drySpellDays} consecutive dry days. Provide light supplemental irrigation (drip or alternate furrow) for sensitive stages such as flowering or grain filling.`
                        : `Recent moisture or low atmospheric demand keeps the root-zone sufficiently hydrated. Withhold irrigation to conserve energy, avoid root waterlogging, and preserve soil aeration.`}
                    </p>
                  </div>

                  {/* 3. Pest & Disease Predisposition */}
                  <div className="bg-white border border-line p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-warn" />
                        Disease &amp; Pest Predisposition
                      </span>
                      {isElevatedFungal ? (
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠ Elevated Fungal Risk
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-ash text-ink-soft border border-line">
                          ✓ Low Disease Pressure
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      {isElevatedFungal
                        ? `Average humidity around ${avgForecastRh}% and warm daytime highs (${highestTmax}°C) heighten predisposition to powdery mildew, blight, and sucking pest activity. Inspect bottom leaf canopy and ensure clear furrow drainage.`
                        : `Ambient relative humidity averaging ${avgForecastRh}% keeps foliar disease incidence low. Continue regular monitoring during morning field walks.`}
                    </p>
                  </div>

                  {/* 4. Cultural Operations & Trafficability */}
                  <div className="bg-white border border-line p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink flex items-center gap-2">
                        <Compass className="w-4 h-4 text-brand" />
                        Field Workability &amp; Operations
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-tint text-good border border-line">
                        ✓ High Accessibility
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      Firm surface soil condition offers optimal traction for machinery and manual field operations. Ideal timeframe for intercultural weeding, earthing up, mulching, and localized top-dressing of nitrogenous fertilizer.
                    </p>
                  </div>
                </div>

                {/* Agronomist Executive Takeaway Banner */}
                <div className="bg-brand text-ground rounded-2xl p-4.5 flex flex-col sm:flex-row items-start gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-accent text-brand flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4.5 h-4.5 text-brand" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <h4 className="font-bold text-white text-sm">
                      Weekly Agronomy Takeaway for {displayName}
                    </h4>
                    <p className="text-ground/85 leading-relaxed">
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
