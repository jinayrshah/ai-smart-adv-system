import React, { useEffect, useState } from 'react';
import { ArrowRight, Droplets, Loader2, MessageCircle, Pencil } from 'lucide-react';
import type { FarmerProfileView } from '../../lib/farmerProfile';
import { formatIsoDate } from '../../lib/farmerProfile';
import {
  fetchAgrometBulletin, fetchCropStages, fetchFarmDiagnostic, type AgrometBulletin,
  type AgronomyDiagnosticResponse, type CropStageNorm,
} from '../../lib/api/advisory';
import { fetchWeatherSummary, type WeatherSummaryResponse } from '../../lib/api/weather';
import { fetchLatestPrices, type LatestPriceRecord } from '../../services/marketApi';

type Async<T> = { data: T | null; error: string | null; loading: boolean };

function useAsync<T>(fn: (() => Promise<T>) | null, deps: unknown[]): Async<T> {
  const [s, set] = useState<Async<T>>({ data: null, error: null, loading: !!fn });
  useEffect(() => {
    if (!fn) return set({ data: null, error: null, loading: false });
    let live = true;
    set((p) => ({ ...p, loading: true, error: null }));
    fn().then(
      (data) => live && set({ data, error: null, loading: false }),
      (e) => live && set({ data: null, error: e?.message || 'Unavailable right now.', loading: false }),
    );
    return () => { live = false; };
  }, deps);
  return s;
}

const ACTION_TEXT: Record<string, { title: string; tone: string }> = {
  irrigate_now: { title: 'Irrigate now', tone: 'text-bad' },
  wait_for_rain: { title: 'Hold irrigation, rain is expected', tone: 'text-sky-ink' },
  no_irrigation_needed: { title: 'No irrigation needed', tone: 'text-good' },
  monitor: { title: 'Check soil moisture', tone: 'text-warn' },
};

const inr = (n: number | null | undefined) => (n == null ? '–' : `₹${Math.round(n).toLocaleString('en-IN')}`);

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-soft">{children}</p>;
}

/** The season as a line: sowing on the left, the crop's stages, a marker at today. */
function SeasonLine({ stages, current }: { stages: CropStageNorm[]; current: AgronomyDiagnosticResponse['stage'] }) {
  const total = stages[stages.length - 1]?.gdd_cumulative_at_stage_end || 0;
  const pctOf = (g: number) => (total ? Math.min(100, (g / total) * 100) : 0);
  let todayPct: number;
  if (current.cumulative_gdd != null && total) {
    todayPct = pctOf(current.cumulative_gdd);
  } else {
    // Calendar fallback: no heat units, so place today inside the current stage's own segment.
    const i = stages.findIndex((s) => s.stage_order === current.stage_order);
    const start = i > 0 ? pctOf(stages[i - 1].gdd_cumulative_at_stage_end) : 0;
    const end = i >= 0 ? pctOf(stages[i].gdd_cumulative_at_stage_end) : 0;
    todayPct = start + ((current.stage_progress_pct ?? 50) / 100) * (end - start);
  }
  let prev = 0;
  return (
    <div>
      <div className="relative h-3 rounded-full bg-ash overflow-hidden" aria-hidden>
        <div className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${todayPct}%` }} />
        {stages.slice(0, -1).map((s) => (
          <span key={s.stage_order} className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${pctOf(s.gdd_cumulative_at_stage_end)}%` }} />
        ))}
      </div>
      <ol className="mt-3 hidden md:grid gap-1" style={{ gridTemplateColumns: stages.map((s) => {
        const w = Math.max(6, pctOf(s.gdd_cumulative_at_stage_end) - prev); prev = pctOf(s.gdd_cumulative_at_stage_end); return `${w}fr`;
      }).join(' ') }}>
        {stages.map((s) => {
          const isNow = s.stage_order === current.stage_order;
          return (
            <li key={s.stage_order} className={`text-sm leading-tight ${isNow ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
              <span className="sr-only">{isNow ? 'Current stage: ' : ''}</span>{s.stage_name}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface Props {
  farmView: FarmerProfileView;
  onAsk: (question?: string) => void;
  onEditFarm: () => void;
  onOpen: (tab: 'priceTrends' | 'weather') => void;
}

export const TodayView: React.FC<Props> = ({ farmView, onAsk, onEditFarm, onOpen }) => {
  const farm = farmView.farm!;
  const crop = farmView.crop;
  const [q, setQ] = useState('');

  const diag = useAsync(
    farm.id != null && crop?.sowingDate ? () => fetchFarmDiagnostic(String(farm.id), crop.id != null ? String(crop.id) : undefined) : null,
    [farm.id, crop?.id, crop?.sowingDate],
  );
  const stages = useAsync(crop ? () => fetchCropStages(crop.name) : null, [crop?.name]);
  const weather = useAsync<WeatherSummaryResponse>(
    farm.lat != null && farm.lon != null ? () => fetchWeatherSummary({ lat: farm.lat!, lon: farm.lon! }) : null,
    [farm.lat, farm.lon],
  );
  const prices = useAsync<LatestPriceRecord[]>(
    crop ? () => fetchLatestPrices(crop.name, farm.state || undefined, undefined, undefined, 20).then((r) => r.records) : null,
    [crop?.name, farm.state],
  );

  const imd = useAsync<AgrometBulletin | null>(
    farm.district ? () => fetchAgrometBulletin(farm.district!, crop?.name) : null,
    [farm.district, crop?.name],
  );
  const d = diag.data;
  const action = d?.irrigation.action ? ACTION_TEXT[d.irrigation.action] : undefined;
  const next3 = (weather.data?.days || []).filter((x) => x.phase !== 'past').slice(0, 3);
  const rain3 = next3.reduce((s, x) => s + (x.precip_mm || 0), 0);
  const nearest = (prices.data || []).filter((r) => r.modal_price != null)
    .sort((a, b) => (a.district === farm.district ? -1 : 0) - (b.district === farm.district ? -1 : 0) || b.arrival_date.localeCompare(a.arrival_date))[0];

  return (
    <div className="space-y-4 pb-28">
      <section className="pt-2 pb-4">
        <p className="text-ink-soft">{farm.name}{farm.district ? ` · ${farm.district}${farm.state ? `, ${farm.state}` : ''}` : ''}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl sm:text-4xl font-semibold text-ink">
            {crop ? `${crop.name}${d ? `, ${d.stage.stage_name.toLowerCase()}` : ''}` : 'No crop added'}
          </h1>
          {d && <span className="text-lg text-ink-soft num">day {d.stage.days_since_sowing}</span>}
        </div>
        {!crop?.sowingDate && (
          <p className="mt-3 text-ink-soft">
            Add your sowing date to see the crop stage and water advice.{' '}
            <button onClick={onEditFarm} className="text-brand font-medium underline underline-offset-4">Add sowing date</button>
          </p>
        )}
      </section>

      {d && stages.data && stages.data.length > 1 && (
        <section className="bg-surface rounded-2xl p-5 sm:p-6">
          <SeasonLine stages={stages.data} current={d.stage} />
          <p className="mt-4 text-sm text-ink-soft">
            Sown {formatIsoDate(crop?.sowingDate)}.
            {d.stage.next_stage_name ? ` Next: ${d.stage.next_stage_name}.` : ''}
            {d.stage.method === 'calendar_fallback' ? ' Stage estimated from the calendar; weather data for heat units was not available.' : ' Stage from accumulated heat units (GDD).'}
          </p>
        </section>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); onAsk(q.trim() || undefined); setQ(''); }}
        className="bg-brand rounded-2xl p-5 sm:p-6 text-white"
      >
        <label htmlFor="today-ask" className="text-lg font-semibold">Ask about your {crop?.name.toLowerCase() || 'crop'}</label>
        <div className="mt-3 flex gap-2">
          <input id="today-ask" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Should I spray this week?"
            className="flex-1 min-w-0 h-12 rounded-xl px-4 text-base bg-white text-ink border-0" />
          <button type="submit" className="h-12 px-5 rounded-xl bg-accent text-brand font-semibold flex items-center gap-2 shrink-0">
            <MessageCircle size={18} aria-hidden /> Ask
          </button>
        </div>
        <p className="mt-2 text-sm text-white/75">You can also send a photo of a sick leaf in the Advisor.</p>
      </form>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Water">
          {!crop?.sowingDate ? <Muted>Needs the sowing date.</Muted>
            : diag.loading ? <Loader2 className="animate-spin text-ink-muted" aria-label="Loading" />
            : diag.error ? <Muted>Water advice is unavailable right now. {diag.error}</Muted>
            : d && (
              <div>
                {action ? <p className={`text-2xl font-semibold ${action.tone}`}>{action.title}</p>
                  : <p className="text-2xl font-semibold text-ink-soft">Not enough data to advise</p>}
                <p className="mt-2 text-ink">{d.irrigation.recommendation}</p>
                {d.irrigation.data_available !== false && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 num">
                    <div><dt className="text-sm text-ink-soft">Crop water use, 7 days</dt><dd className="text-lg font-semibold">{d.irrigation.etc_7d_mm.toFixed(0)} mm</dd></div>
                    <div><dt className="text-sm text-ink-soft">Rain, last 7 days</dt><dd className="text-lg font-semibold">{d.irrigation.rain_7d_mm.toFixed(0)} mm</dd></div>
                  </dl>
                )}
              </div>
            )}
        </Panel>

        <Panel title="Weather" action={<button onClick={() => onOpen('weather')} className="text-sm text-brand font-medium flex items-center gap-1">7 days <ArrowRight size={14} /></button>}>
          {weather.loading ? <Loader2 className="animate-spin text-ink-muted" aria-label="Loading" />
            : weather.error ? <Muted>Weather is unavailable right now.</Muted>
            : weather.data && (
              <div>
                <p className="text-2xl font-semibold text-ink num">
                  {weather.data.current?.temp_c != null ? `${Math.round(weather.data.current.temp_c)}°C now` : '–'}
                </p>
                <p className="mt-2 text-ink flex items-center gap-2">
                  <Droplets size={18} className="text-sky-ink" aria-hidden />
                  {next3.length ? (rain3 >= 1 ? `${rain3.toFixed(0)} mm rain expected in the next 3 days` : 'No rain expected in the next 3 days') : 'No forecast on file'}
                </p>
                {d?.climate && (
                  <p className="mt-2 text-ink-soft">
                    {d.climate.verdict === 'suitable' ? 'Temperatures suit this stage.' : d.climate.notes || `Conditions are ${d.climate.verdict} for this stage.`}
                  </p>
                )}
                {weather.data.stale && <p className="mt-2 text-sm text-warn">Last updated {formatIsoDate(weather.data.as_of)}; newer data is not available yet.</p>}
              </div>
            )}
        </Panel>

        <Panel title={`${crop?.name || 'Crop'} price`} action={<button onClick={() => onOpen('priceTrends')} className="text-sm text-brand font-medium flex items-center gap-1">Trends <ArrowRight size={14} /></button>}>
          {prices.loading ? <Loader2 className="animate-spin text-ink-muted" aria-label="Loading" />
            : prices.error ? <Muted>Prices are unavailable right now.</Muted>
            : nearest ? (
              <div>
                <p className="text-2xl font-semibold text-ink num">{inr(nearest.modal_price)} <span className="text-base font-normal text-ink-soft">per quintal</span></p>
                <p className="mt-2 text-ink">{nearest.market}{nearest.district ? `, ${nearest.district}` : ''}</p>
                <p className="mt-1 text-sm text-ink-soft num">Range {inr(nearest.min_price)}–{inr(nearest.max_price)} · reported {formatIsoDate(nearest.arrival_date)} · {nearest.source}</p>
              </div>
            ) : <Muted>No recent {crop?.name.toLowerCase()} prices reported in {farm.state || 'your state'}.</Muted>}
        </Panel>

        {imd.data && (
          <section className="bg-surface rounded-2xl p-5 sm:p-6 md:col-span-2">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-ink">This week’s IMD advice for {imd.data.district}</h2>
              <a href={imd.data.source_url} target="_blank" rel="noreferrer" className="text-sm text-brand font-medium shrink-0">Bulletin</a>
            </div>
            <ul className="space-y-2 text-ink">
              {imd.data.passages.slice(0, 3).map((p, i) => <li key={i} className="line-clamp-4">{p}</li>)}
            </ul>
            <p className="mt-3 text-sm text-ink-soft">India Meteorological Department agromet bulletin{imd.data.published_on ? `, issued ${formatIsoDate(imd.data.published_on)}` : ''}.</p>
          </section>
        )}

        <Panel title="Soil" action={<button onClick={onEditFarm} className="text-sm text-brand font-medium flex items-center gap-1"><Pencil size={14} /> Edit</button>}>
          {d && d.soil_flags.length > 0 ? (
            <ul className="space-y-2">
              {d.soil_flags.slice(0, 3).map((f, i) => <li key={i} className="text-ink">{f.notes || f.flag_type.replace(/_/g, ' ')}</li>)}
            </ul>
          ) : farm.soilType ? (
            <p className="text-ink">{farm.soilType}{d ? ' · no problems flagged for this crop.' : ''}</p>
          ) : (
            <Muted>Add your soil type or Soil Health Card values for soil checks.</Muted>
          )}
        </Panel>
      </div>
    </div>
  );
};
