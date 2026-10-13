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
      <div className="bg-[#111827] border border-stone-800 rounded-3xl p-8 flex items-center justify-center space-x-3 text-stone-400 shadow-xl">
        <div className="w-6 h-6 rounded-full border-2 border-[#07503f] border-t-[#e8fe85] animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-stone-300">Evaluating phenology & root-zone water balance…</span>
      </div>
    );
  }

  if (error || !diagnostic) {
    return (
      <div className="bg-amber-950/40 border border-amber-500/30 rounded-3xl p-6 flex items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3 min-w-0">
          <Info size={20} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-200">{error || 'Diagnostics unavailable'}</span>
        </div>
        <button
          onClick={loadData}
          className="text-xs font-bold px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-full transition-colors shrink-0"
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
    <div className="bg-[#111827] border border-stone-800 rounded-3xl overflow-hidden shadow-2xl space-y-4">
      {/* Header */}
      <div className="p-6 border-b border-stone-800 flex items-start justify-between gap-4 bg-[#07503f]/10">
        <div className="flex items-start space-x-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold shadow-md shrink-0">
            <Sprout size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
                {diagnostic.crop}: Stage, Water, Soil & Climate Fit
              </h3>
              <span
                className="text-[11px] uppercase font-bold px-3 py-0.5 rounded-full bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 shadow-sm"
                title={
                  stage.method === 'gdd'
                    ? 'Stage worked out from heat accumulated since sowing (growing degree-days)'
                    : 'Not enough weather history yet, so the stage is estimated from days since sowing'
                }
              >
                {stage.method === 'gdd' ? 'From GDD Weather' : 'Calendar Estimate'}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1 font-mono">
              Sown {formatIsoDate(diagnostic.sowing_date)} ({stage.days_since_sowing} days ago) • As of {formatIsoDate(diagnostic.as_of)}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          title="Refresh"
          aria-label="Refresh diagnostics"
          className="p-2.5 bg-[#07503f]/40 hover:bg-[#07503f] text-[#e8fe85] rounded-full transition-colors shrink-0 shadow"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="p-6 pt-2 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Growth stage (Pastel Sage) */}
        <div className="p-5 rounded-2xl bg-[#d9e2d5]/10 border border-[#d9e2d5]/25 space-y-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#d9e2d5]">
              <Calendar size={16} className="text-[#e8fe85]" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Growth Stage</span>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30">
              Stage {stage.stage_order}
            </span>
          </div>

          <div>
            <div className="font-serif text-xl font-bold text-white">{stage.stage_name}</div>
            {stage.stage_progress_pct != null && (
              <div className="mt-2.5">
                <div className="h-2 rounded-full bg-stone-800 overflow-hidden" aria-hidden>
                  <div className="h-full bg-[#e8fe85]" style={{ width: `${stage.stage_progress_pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-stone-400 mt-1.5 gap-2">
                  <span className="font-medium text-stone-300">{Math.round(stage.stage_progress_pct)}% through this stage</span>
                  {stage.next_stage_name && <span className="text-stone-400 text-right">Next: {stage.next_stage_name}</span>}
                </div>
              </div>
            )}
            <div className="text-xs text-stone-300 mt-2.5 leading-relaxed">
              {stage.cumulative_gdd != null ? (
                <span>
                  Heat accumulated: <strong className="text-white">{stage.cumulative_gdd} degree-days</strong>
                  {stage.imputed_days ? ` (${stage.imputed_days} missing days estimated)` : ''}
                </span>
              ) : (
                <span>
                  Weather history covers {stage.weather_coverage_pct ?? 0}% of the season, so this is a calendar estimate.
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-stone-400 italic border-t border-[#d9e2d5]/20 pt-2 break-words font-mono">
            Source: {stage.source}
          </div>
        </div>

        {/* 2. Water (Pastel Sky) */}
        <div className="p-5 rounded-2xl bg-[#d0e6f6]/10 border border-[#d0e6f6]/25 space-y-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#d0e6f6]">
              <Droplets size={16} className="text-[#d0e6f6]" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Water Balance</span>
            </div>
            <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full uppercase border shadow-sm ${action.tone}`}>
              {action.label}
            </span>
          </div>

          <p className="text-sm text-stone-200 leading-relaxed">{irrigation.recommendation}</p>

          {depletionPct != null && (
            <div>
              <div className="relative h-2.5 rounded-full bg-stone-800 overflow-hidden" aria-hidden>
                <div
                  className={`h-full ${depletionPct >= (rawPct ?? 100) ? 'bg-amber-400' : 'bg-[#d0e6f6]'}`}
                  style={{ width: `${depletionPct}%` }}
                />
                {rawPct != null && <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${rawPct}%` }} />}
              </div>
              <div className="flex justify-between text-[11px] text-stone-300 mt-1.5 gap-2">
                <span>
                  Root zone depletion: {irrigation.root_zone_depletion_mm} / {irrigation.taw_mm} mm
                </span>
                <span className="text-amber-300 font-medium">Stress line: {irrigation.raw_mm} mm</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
              <span className="text-[10px] text-stone-400 block">Crop use, 7d</span>
              <span className="text-xs font-bold text-stone-100">{irrigation.etc_7d_mm} mm</span>
            </div>
            <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
              <span className="text-[10px] text-stone-400 block">Rain, 7d</span>
              <span className="text-xs font-bold text-[#e8fe85]">
                {irrigation.effective_rain_7d_mm ?? irrigation.rain_7d_mm} mm
              </span>
            </div>
            <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800">
              <span className="text-[10px] text-stone-400 block flex items-center justify-center gap-1">
                <CloudRain size={10} /> Next 3d
              </span>
              <span className="text-xs font-bold text-[#d0e6f6]">
                {irrigation.forecast_rain_3d_mm != null ? `${irrigation.forecast_rain_3d_mm} mm` : '—'}
              </span>
            </div>
          </div>

          {irrigation.assumptions && irrigation.assumptions.length > 0 && (
            <details className="text-[11px] text-stone-400">
              <summary className="cursor-pointer text-stone-300 font-medium hover:text-white">How this was computed</summary>
              <ul className="list-disc pl-4 mt-1.5 space-y-0.5">
                {irrigation.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="border-t border-[#d0e6f6]/20 pt-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
              <span>
                {diagnostic.irrigation_events_logged
                  ? `${diagnostic.irrigation_events_logged} irrigation(s) logged this season`
                  : 'No irrigation logged yet'}
              </span>
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#07503f] text-[#e8fe85] hover:bg-[#0d6e57] font-bold text-xs transition-colors shadow-sm"
              >
                <Plus size={12} /> Log Irrigation
              </button>
            </div>
            {showLog && (
              <form onSubmit={submitLog} className="flex flex-wrap items-end gap-2.5 p-3 rounded-2xl bg-stone-900/80 border border-stone-700/80">
                <label className="text-[11px] text-stone-300 flex flex-col font-medium">
                  Date
                  <input
                    type="date"
                    value={logDate}
                    max={todayIso()}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="mt-1 bg-stone-800 border border-stone-700 rounded-full px-3 py-1.5 text-stone-100 text-xs focus:ring-1 focus:ring-[#e8fe85]"
                    required
                  />
                </label>
                <label className="text-[11px] text-stone-300 flex flex-col font-medium">
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
                    className="mt-1 w-28 bg-stone-800 border border-stone-700 rounded-full px-3 py-1.5 text-stone-100 text-xs focus:ring-1 focus:ring-[#e8fe85]"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={logState.saving}
                  className="px-4 py-2 rounded-full bg-[#07503f] hover:bg-[#0d6e57] disabled:opacity-60 text-[#e8fe85] text-xs font-bold transition-all shadow"
                >
                  {logState.saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
            {logState.msg && (
              <p className={`text-[11px] font-medium ${logState.err ? 'text-rose-400' : 'text-[#e8fe85]'}`}>{logState.msg}</p>
            )}
          </div>

          <div className="text-[10px] text-stone-400 italic break-words font-mono">
            Confidence: {irrigation.confidence} • Kc: {irrigation.kc} • Source: {irrigation.source}
          </div>
        </div>

        {/* 3. Soil (Pastel Peach) */}
        <div className="p-5 rounded-2xl bg-[#f8d4c8]/10 border border-[#f8d4c8]/25 space-y-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#f8d4c8]">
              <Layers size={16} className="text-[#f8d4c8]" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Soil & Nutrients</span>
            </div>
            {soil_flags.length === 0 ? (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#e8fe85] bg-[#07503f]/50 px-2.5 py-0.5 rounded-full border border-[#07503f]">
                <CheckCircle2 size={13} />
                <span>Optimum</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                <AlertTriangle size={13} />
                <span>
                  {soil_flags.length} alert{soil_flags.length > 1 ? 's' : ''}
                </span>
              </span>
            )}
          </div>

          {soil_flags.length === 0 ? (
            <p className="text-xs text-stone-300 leading-relaxed py-2">
              Soil type and laboratory test values align with recommended agronomic ranges for {diagnostic.crop}.
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {soil_flags.map((flag, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs">
                  <span className="font-bold text-amber-200 block capitalize">{flag.flag_type.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-stone-300 mt-0.5 block">{flag.notes}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-stone-400 italic border-t border-[#f8d4c8]/20 pt-2 font-mono">
            Soil Health Card rating standards (DAC&FW) and crop norms
          </div>
        </div>

        {/* 4. Climate (Pastel Ash) */}
        <div className="p-5 rounded-2xl bg-[#d5d8db]/10 border border-[#d5d8db]/25 space-y-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#d5d8db]">
              <Thermometer size={16} className="text-[#d5d8db]" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Thermal Suitability</span>
            </div>
            {climate && (
              <span
                className={`text-[11px] font-bold px-3 py-0.5 rounded-full uppercase border shadow-sm ${
                  climate.verdict === 'suitable'
                    ? 'bg-[#07503f] text-[#e8fe85] border-[#e8fe85]/30'
                    : climate.verdict === 'marginal'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                    : 'bg-rose-950/60 text-rose-300 border-rose-500/30'
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
                  <span className="font-serif text-2xl font-bold text-white">{Math.round(climate.observed_temp_c * 10) / 10}°C</span>
                  <span className="text-xs text-stone-400 font-mono">
                    (Optimal: {climate.ideal_temp_range[0]}–{climate.ideal_temp_range[1]}°C)
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed mt-1.5">{climate.notes}</p>
              </div>
              <div className="text-[10px] text-stone-400 italic border-t border-[#d5d8db]/20 pt-2 break-words font-mono">
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
