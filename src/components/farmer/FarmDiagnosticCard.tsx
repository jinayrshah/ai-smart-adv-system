import React, { useEffect, useState } from 'react';
import {
  Sprout,
  Droplets,
  Thermometer,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Calendar,
  Plus,
  CloudRain,
} from 'lucide-react';
import {
  fetchFarmDiagnostic,
  logIrrigation,
  AgronomyDiagnosticResponse,
  IrrigationAdvice,
} from '../../lib/api/advisory';
import { formatIsoDate } from '../../lib/farmerProfile';

interface Props {
  farmId: string;
  cropId?: string;
  onRefresh?: () => void;
}

const ACTION_COPY: Record<NonNullable<IrrigationAdvice['action']>, { label: string; tone: string }> = {
  irrigate_now: { label: 'Irrigate now', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  wait_for_rain: { label: 'Wait for rain', tone: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  monitor: { label: 'Keep an eye on it', tone: 'bg-stone-500/20 text-stone-300 border-stone-500/30' },
  no_irrigation_needed: { label: 'No irrigation needed', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  unknown: { label: 'Not enough data', tone: 'bg-stone-500/20 text-stone-400 border-stone-500/30' },
};

const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const FarmDiagnosticCard: React.FC<Props> = ({ farmId, cropId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<AgronomyDiagnosticResponse | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [logDate, setLogDate] = useState(todayIso());
  const [logMm, setLogMm] = useState('');
  const [logState, setLogState] = useState<{ saving: boolean; msg: string | null; err: boolean }>({
    saving: false,
    msg: null,
    err: false,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFarmDiagnostic(farmId, cropId);
      setDiagnostic(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load agronomic diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (farmId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, cropId]);

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const mm = parseFloat(logMm);
    if (!Number.isFinite(mm) || mm <= 0 || mm > 300) {
      setLogState({ saving: false, msg: 'Enter the depth of water applied, between 1 and 300 mm.', err: true });
      return;
    }
    setLogState({ saving: true, msg: null, err: false });
    try {
      await logIrrigation(farmId, {
        irrigated_on: logDate,
        amount_mm: mm,
        farm_crop_id: cropId ? Number(cropId) : null,
      });
      setLogState({ saving: false, msg: 'Saved. Water balance updated.', err: false });
      setLogMm('');
      setShowLog(false);
      loadData();
    } catch (err: any) {
      setLogState({ saving: false, msg: err.message || 'Could not save', err: true });
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 flex items-center justify-center space-x-3 text-stone-400">
        <RefreshCw size={18} className="animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Working out crop stage and soil water…</span>
      </div>
    );
  }

  if (error || !diagnostic) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <Info size={18} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">{error || 'Diagnostics unavailable'}</span>
        </div>
        <button
          onClick={loadData}
          className="text-xs font-semibold px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-colors shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  const { stage, irrigation, soil_flags, climate } = diagnostic;
  const action = ACTION_COPY[irrigation.action ?? 'monitor'] ?? ACTION_COPY.monitor;
  const isBalance = irrigation.method === 'fao56_water_balance';
  const depletionPct =
    isBalance && irrigation.taw_mm
      ? Math.min(100, Math.round(((irrigation.root_zone_depletion_mm ?? 0) / irrigation.taw_mm) * 100))
      : null;
  const rawPct =
    isBalance && irrigation.taw_mm ? Math.min(100, Math.round(((irrigation.raw_mm ?? 0) / irrigation.taw_mm) * 100)) : null;

  return (
    <div className="bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-xl space-y-4">
      {/* Header */}
      <div className="p-5 border-b border-dark-border/80 flex items-start justify-between gap-3 bg-white/[0.02]">
        <div className="flex items-start space-x-2.5 min-w-0">
          <div className="p-2 bg-emerald-500/15 rounded-xl border border-emerald-500/30 text-emerald-400 shrink-0">
            <Sprout size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-stone-100">{diagnostic.crop}: stage, water, soil and climate</h3>
              <span
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                title={
                  stage.method === 'gdd'
                    ? 'Stage worked out from heat accumulated since sowing (growing degree-days)'
                    : 'Not enough weather history yet, so the stage is estimated from days since sowing'
                }
              >
                {stage.method === 'gdd' ? 'From weather' : 'Estimated from days'}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Sown {formatIsoDate(diagnostic.sowing_date)} ({stage.days_since_sowing} days ago) • as of{' '}
              {formatIsoDate(diagnostic.as_of)}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          title="Refresh"
          aria-label="Refresh diagnostics"
          className="p-2 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors shrink-0"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="p-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Growth stage */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-stone-300">
              <Calendar size={15} className="text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Growth stage</span>
            </div>
            <span className="text-xs font-bold text-emerald-400">Stage {stage.stage_order}</span>
          </div>

          <div>
            <div className="text-base font-extrabold text-stone-100">{stage.stage_name}</div>
            {stage.stage_progress_pct != null && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden" aria-hidden>
                  <div className="h-full bg-emerald-500" style={{ width: `${stage.stage_progress_pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-stone-400 mt-1 gap-2">
                  <span>{Math.round(stage.stage_progress_pct)}% through this stage</span>
                  {stage.next_stage_name && <span className="text-zinc-500 text-right">Next: {stage.next_stage_name}</span>}
                </div>
              </div>
            )}
            <div className="text-xs text-stone-400 mt-2">
              {stage.cumulative_gdd != null ? (
                <span>
                  Heat accumulated: <strong className="text-stone-200">{stage.cumulative_gdd} degree-days</strong>
                  {stage.imputed_days ? ` (${stage.imputed_days} missing days estimated)` : ''}
                </span>
              ) : (
                <span>
                  Weather history covers {stage.weather_coverage_pct ?? 0}% of the season, so this is a calendar estimate.
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2 break-words">
            Source: {stage.source}
          </div>
        </div>

        {/* 2. Water */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-stone-300">
              <Droplets size={15} className="text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Water</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${action.tone}`}>
              {action.label}
            </span>
          </div>

          <p className="text-sm text-stone-200 leading-relaxed">{irrigation.recommendation}</p>

          {depletionPct != null && (
            <div>
              <div className="relative h-2 rounded-full bg-stone-800 overflow-hidden" aria-hidden>
                <div
                  className={`h-full ${depletionPct >= (rawPct ?? 100) ? 'bg-amber-500' : 'bg-cyan-500'}`}
                  style={{ width: `${depletionPct}%` }}
                />
                {rawPct != null && <div className="absolute top-0 h-full w-0.5 bg-stone-300/70" style={{ left: `${rawPct}%` }} />}
              </div>
              <div className="flex justify-between text-[11px] text-stone-400 mt-1 gap-2">
                <span>
                  Water used from root zone: {irrigation.root_zone_depletion_mm} of {irrigation.taw_mm} mm
                </span>
                <span>Stress line {irrigation.raw_mm} mm</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-stone-800/50 p-2 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Crop use, 7 days</span>
              <span className="text-xs font-bold text-stone-200">{irrigation.etc_7d_mm} mm</span>
            </div>
            <div className="bg-stone-800/50 p-2 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Useful rain, 7 days</span>
              <span className="text-xs font-bold text-emerald-300">
                {irrigation.effective_rain_7d_mm ?? irrigation.rain_7d_mm} mm
              </span>
            </div>
            <div className="bg-stone-800/50 p-2 rounded-xl">
              <span className="text-[10px] text-stone-400 block flex items-center justify-center gap-1">
                <CloudRain size={10} /> Next 3 days
              </span>
              <span className="text-xs font-bold text-sky-300">
                {irrigation.forecast_rain_3d_mm != null ? `${irrigation.forecast_rain_3d_mm} mm` : '—'}
              </span>
            </div>
          </div>

          {irrigation.assumptions && irrigation.assumptions.length > 0 && (
            <details className="text-[11px] text-stone-400">
              <summary className="cursor-pointer text-stone-300">How this was worked out</summary>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {irrigation.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="border-t border-dark-border/40 pt-2 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
              <span>
                {diagnostic.irrigation_events_logged
                  ? `${diagnostic.irrigation_events_logged} irrigation(s) logged this season`
                  : 'No irrigation logged yet'}
              </span>
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 font-semibold"
              >
                <Plus size={12} /> Log irrigation
              </button>
            </div>
            {showLog && (
              <form onSubmit={submitLog} className="flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-stone-400 flex flex-col">
                  Date
                  <input
                    type="date"
                    value={logDate}
                    max={todayIso()}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="mt-0.5 bg-stone-800 border border-dark-border rounded-lg px-2 py-1 text-stone-200 text-xs"
                    required
                  />
                </label>
                <label className="text-[11px] text-stone-400 flex flex-col">
                  Water applied (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={300}
                    step="0.5"
                    value={logMm}
                    onChange={(e) => setLogMm(e.target.value)}
                    placeholder="e.g. 50"
                    className="mt-0.5 w-28 bg-stone-800 border border-dark-border rounded-lg px-2 py-1 text-stone-200 text-xs"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={logState.saving}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold"
                >
                  {logState.saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
            {logState.msg && (
              <p className={`text-[11px] ${logState.err ? 'text-red-400' : 'text-emerald-400'}`}>{logState.msg}</p>
            )}
          </div>

          <div className="text-[10px] text-stone-500 italic break-words">
            Confidence: {irrigation.confidence} • Kc {irrigation.kc} • Source: {irrigation.source}
          </div>
        </div>

        {/* 3. Soil */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-stone-300">
              <Layers size={15} className="text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Soil and nutrients</span>
            </div>
            {soil_flags.length === 0 ? (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 size={13} />
                <span>No issues</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-400">
                <AlertTriangle size={13} />
                <span>
                  {soil_flags.length} alert{soil_flags.length > 1 ? 's' : ''}
                </span>
              </span>
            )}
          </div>

          {soil_flags.length === 0 ? (
            <p className="text-xs text-stone-400 leading-relaxed py-2">
              Nothing in your soil type or soil-test values falls outside the recommended range for {diagnostic.crop}.
              Add a Soil Health Card to check nutrients.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {soil_flags.map((flag, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="font-bold text-amber-300 block capitalize">{flag.flag_type.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-stone-300">{flag.notes}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2">
            Soil Health Card rating standards (DAC&FW) and crop norms
          </div>
        </div>

        {/* 4. Climate */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-stone-300">
              <Thermometer size={15} className="text-orange-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Temperature fit</span>
            </div>
            {climate && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                  climate.verdict === 'suitable'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : climate.verdict === 'marginal'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                {climate.verdict}
              </span>
            )}
          </div>

          {climate ? (
            <>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-bold text-stone-100">{Math.round(climate.observed_temp_c * 10) / 10}°C</span>
                  <span className="text-xs text-stone-400">
                    (best: {climate.ideal_temp_range[0]}–{climate.ideal_temp_range[1]}°C)
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed mt-1">{climate.notes}</p>
              </div>
              <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2 break-words">
                Reading: {climate.reading_source.replace(/_/g, ' ')} • Source: {climate.source}
              </div>
            </>
          ) : (
            <p className="text-xs text-stone-400 leading-relaxed py-2">
              No temperature reading is available for your farm's weather grid right now, so this check is skipped.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
