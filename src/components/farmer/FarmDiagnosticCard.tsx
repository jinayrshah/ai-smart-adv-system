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
  irrigate_now: { label: 'Irrigate now', tone: 'bg-amber-100 text-amber-900 border-amber-300' },
  wait_for_rain: { label: 'Wait for rain', tone: 'bg-sky-100 text-sky-900 border-sky-300' },
  monitor: { label: 'Keep an eye on it', tone: 'bg-stone-100 text-stone-800 border-stone-300' },
  no_irrigation_needed: { label: 'No irrigation needed', tone: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  unknown: { label: 'Not enough data', tone: 'bg-stone-100 text-stone-600 border-stone-300' },
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
      <div className="bg-[#ffffff] border border-[#c3cda7] rounded-[24px] p-8 flex items-center justify-center space-x-3 text-[#212529] shadow-sm">
        <div className="w-6 h-6 rounded-full border-2 border-[#07503f] border-t-transparent animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#6d6d6d]">Evaluating phenology & root-zone water balance…</span>
      </div>
    );
  }

  if (error || !diagnostic) {
    return (
      <div className="bg-[#fceace] border border-[#e4cb9f] rounded-[24px] p-6 flex items-center justify-between gap-4 shadow-sm text-[#212529]">
        <div className="flex items-center space-x-3 min-w-0">
          <Info size={20} className="text-[#07503f] shrink-0" />
          <span className="text-xs text-[#353535]">{error || 'Diagnostics unavailable'}</span>
        </div>
        <button
          onClick={loadData}
          className="text-xs font-bold px-4 py-2 bg-[#07503f] text-[#ffffff] rounded-full transition-colors shrink-0"
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
    <div className="bg-[#ffffff] border border-[#c3cda7] rounded-[24px] overflow-hidden shadow-sm space-y-4">
      {/* Header */}
      <div className="p-6 border-b border-[#e2dfcb] flex items-start justify-between gap-4 bg-[#faf9f2]">
        <div className="flex items-start space-x-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#07503f] text-[#ffffff] flex items-center justify-center font-bold shadow-sm shrink-0">
            <Sprout size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#212529] tracking-tight">
                {diagnostic.crop}: Stage, Water, Soil & Climate Fit
              </h3>
              <span
                className="text-[11px] uppercase font-bold px-3 py-0.5 rounded-full bg-[#07503f] text-[#ffffff] shadow-sm font-mono"
                title={
                  stage.method === 'gdd'
                    ? 'Stage worked out from heat accumulated since sowing (growing degree-days)'
                    : 'Not enough weather history yet, so the stage is estimated from days since sowing'
                }
              >
                {stage.method === 'gdd' ? 'From GDD Weather' : 'Calendar Estimate'}
              </span>
            </div>
            <p className="text-xs text-[#6d6d6d] mt-1 font-mono">
              Sown {formatIsoDate(diagnostic.sowing_date)} ({stage.days_since_sowing} days ago) • As of {formatIsoDate(diagnostic.as_of)}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          title="Refresh"
          aria-label="Refresh diagnostics"
          className="p-2.5 bg-[#f1efdf] hover:bg-[#e6ecd5] text-[#07503f] rounded-full transition-colors shrink-0 shadow-sm border border-[#c3cda7]"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="p-6 pt-2 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Growth stage (Pastel Sage #e6ecd5) */}
        <div className="p-5 rounded-[20px] bg-[#e6ecd5] border border-[#c3cda7] space-y-3.5 min-w-0 text-[#212529]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#07503f]">
              <Calendar size={16} />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Growth Stage</span>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#07503f] text-[#ffffff]">
              Stage {stage.stage_order}
            </span>
          </div>

          <div>
            <div className="font-serif text-2xl font-bold text-[#212529]">{stage.stage_name}</div>
            {stage.stage_progress_pct != null && (
              <div className="mt-2.5">
                <div className="h-2.5 rounded-full bg-white/70 overflow-hidden" aria-hidden>
                  <div className="h-full bg-[#07503f]" style={{ width: `${stage.stage_progress_pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-[#353535] mt-1.5 gap-2">
                  <span className="font-semibold text-[#07503f]">{Math.round(stage.stage_progress_pct)}% through this stage</span>
                  {stage.next_stage_name && <span className="text-[#6d6d6d] text-right font-medium">Next: {stage.next_stage_name}</span>}
                </div>
              </div>
            )}
            <div className="text-xs text-[#353535] mt-2.5 leading-relaxed">
              {stage.cumulative_gdd != null ? (
                <span>
                  Heat accumulated: <strong className="text-[#07503f] font-bold">{stage.cumulative_gdd} degree-days</strong>
                  {stage.imputed_days ? ` (${stage.imputed_days} missing days estimated)` : ''}
                </span>
              ) : (
                <span>
                  Weather history covers {stage.weather_coverage_pct ?? 0}% of the season, so this is a calendar estimate.
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-[#6d6d6d] italic border-t border-[#c3cda7]/60 pt-2 break-words font-mono">
            Source: {stage.source}
          </div>
        </div>

        {/* 2. Water Balance (Pastel Sky #b2cee7) */}
        <div className="p-5 rounded-[20px] bg-[#b2cee7] border border-[#9bbddc] space-y-3.5 min-w-0 text-[#212529]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#07503f]">
              <Droplets size={16} />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Water Balance</span>
            </div>
            <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full uppercase border shadow-sm ${action.tone}`}>
              {action.label}
            </span>
          </div>

          <p className="text-sm text-[#212529] font-medium leading-relaxed">{irrigation.recommendation}</p>

          {depletionPct != null && (
            <div>
              <div className="relative h-2.5 rounded-full bg-white/70 overflow-hidden" aria-hidden>
                <div
                  className={`h-full ${depletionPct >= (rawPct ?? 100) ? 'bg-amber-600' : 'bg-[#07503f]'}`}
                  style={{ width: `${depletionPct}%` }}
                />
                {rawPct != null && <div className="absolute top-0 h-full w-1 bg-amber-800" style={{ left: `${rawPct}%` }} />}
              </div>
              <div className="flex justify-between text-[11px] text-[#353535] mt-1.5 gap-2">
                <span>
                  Root zone depletion: {irrigation.root_zone_depletion_mm} / {irrigation.taw_mm} mm
                </span>
                <span className="text-[#07503f] font-bold">Stress line: {irrigation.raw_mm} mm</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#ffffff]/80 p-2 rounded-xl border border-[#9bbddc]">
              <span className="text-[10px] text-[#6d6d6d] block">Crop use, 7d</span>
              <span className="text-xs font-bold text-[#212529]">{irrigation.etc_7d_mm} mm</span>
            </div>
            <div className="bg-[#ffffff]/80 p-2 rounded-xl border border-[#9bbddc]">
              <span className="text-[10px] text-[#6d6d6d] block">Rain, 7d</span>
              <span className="text-xs font-bold text-[#07503f]">
                {irrigation.effective_rain_7d_mm ?? irrigation.rain_7d_mm} mm
              </span>
            </div>
            <div className="bg-[#ffffff]/80 p-2 rounded-xl border border-[#9bbddc]">
              <span className="text-[10px] text-[#6d6d6d] block flex items-center justify-center gap-1">
                <CloudRain size={10} /> Next 3d
              </span>
              <span className="text-xs font-bold text-[#07503f]">
                {irrigation.forecast_rain_3d_mm != null ? `${irrigation.forecast_rain_3d_mm} mm` : '—'}
              </span>
            </div>
          </div>

          {irrigation.assumptions && irrigation.assumptions.length > 0 && (
            <details className="text-[11px] text-[#353535]">
              <summary className="cursor-pointer text-[#07503f] font-bold hover:underline">How this was computed</summary>
              <ul className="list-disc pl-4 mt-1.5 space-y-0.5 text-[#353535]">
                {irrigation.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="border-t border-[#9bbddc] pt-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#353535]">
              <span>
                {diagnostic.irrigation_events_logged
                  ? `${diagnostic.irrigation_events_logged} irrigation(s) logged`
                  : 'No irrigation logged yet'}
              </span>
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#07503f] text-[#ffffff] hover:bg-[#0d6e57] font-bold text-xs transition-colors shadow-sm"
              >
                <Plus size={12} /> Log Irrigation
              </button>
            </div>
            {showLog && (
              <form onSubmit={submitLog} className="flex flex-wrap items-end gap-2.5 p-3 rounded-2xl bg-[#ffffff] border border-[#9bbddc]">
                <label className="text-[11px] text-[#212529] flex flex-col font-medium">
                  Date
                  <input
                    type="date"
                    value={logDate}
                    max={todayIso()}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="mt-1 bg-[#f1efdf] border border-[#c3cda7] rounded-full px-3 py-1.5 text-[#212529] text-xs focus:ring-1 focus:ring-[#07503f]"
                    required
                  />
                </label>
                <label className="text-[11px] text-[#212529] flex flex-col font-medium">
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
                    className="mt-1 w-28 bg-[#f1efdf] border border-[#c3cda7] rounded-full px-3 py-1.5 text-[#212529] text-xs focus:ring-1 focus:ring-[#07503f]"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={logState.saving}
                  className="px-4 py-2 rounded-full bg-[#07503f] hover:bg-[#0d6e57] disabled:opacity-60 text-[#ffffff] text-xs font-bold transition-all shadow"
                >
                  {logState.saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
            {logState.msg && (
              <p className={`text-[11px] font-medium ${logState.err ? 'text-rose-600' : 'text-[#07503f]'}`}>{logState.msg}</p>
            )}
          </div>

          <div className="text-[10px] text-[#6d6d6d] italic break-words font-mono">
            Confidence: {irrigation.confidence} • Kc: {irrigation.kc} • Source: {irrigation.source}
          </div>
        </div>

        {/* 3. Soil & Nutrients (Pastel Peach #fceace) */}
        <div className="p-5 rounded-[20px] bg-[#fceace] border border-[#ebd1aa] space-y-3.5 min-w-0 text-[#212529]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#07503f]">
              <Layers size={16} />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Soil & Nutrients</span>
            </div>
            {soil_flags.length === 0 ? (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#07503f] bg-white px-2.5 py-0.5 rounded-full border border-[#ebd1aa]">
                <CheckCircle2 size={13} />
                <span>Optimum</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                <AlertTriangle size={13} />
                <span>
                  {soil_flags.length} alert{soil_flags.length > 1 ? 's' : ''}
                </span>
              </span>
            )}
          </div>

          {soil_flags.length === 0 ? (
            <p className="text-xs text-[#353535] leading-relaxed py-2">
              Soil type and laboratory test values align with recommended agronomic ranges for {diagnostic.crop}.
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {soil_flags.map((flag, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-white border border-[#ebd1aa] text-xs">
                  <span className="font-bold text-amber-900 block capitalize">{flag.flag_type.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-[#353535] mt-0.5 block">{flag.notes}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-[#6d6d6d] italic border-t border-[#ebd1aa] pt-2 font-mono">
            Soil Health Card rating standards (DAC&FW) and crop norms
          </div>
        </div>

        {/* 4. Thermal Suitability (Pastel Ash #efefef) */}
        <div className="p-5 rounded-[20px] bg-[#efefef] border border-[#d5d8db] space-y-3.5 min-w-0 text-[#212529]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#07503f]">
              <Thermometer size={16} />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Thermal Suitability</span>
            </div>
            {climate && (
              <span
                className={`text-[11px] font-bold px-3 py-0.5 rounded-full uppercase border shadow-sm ${
                  climate.verdict === 'suitable'
                    ? 'bg-[#07503f] text-[#ffffff] border-[#07503f]'
                    : climate.verdict === 'marginal'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
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
                  <span className="font-serif text-2xl font-bold text-[#212529]">{Math.round(climate.observed_temp_c * 10) / 10}°C</span>
                  <span className="text-xs text-[#6d6d6d] font-mono">
                    (Optimal: {climate.ideal_temp_range[0]}–{climate.ideal_temp_range[1]}°C)
                  </span>
                </div>
                <p className="text-xs text-[#353535] leading-relaxed mt-1.5">{climate.notes}</p>
              </div>
              <div className="text-[10px] text-[#6d6d6d] italic border-t border-[#d5d8db] pt-2 break-words font-mono">
                Reading: {climate.reading_source.replace(/_/g, ' ')} • Source: {climate.source}
              </div>
            </>
          ) : (
            <p className="text-xs text-[#6d6d6d] leading-relaxed py-2">
              No temperature reading is available for your farm's weather grid right now, so this check is skipped.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
