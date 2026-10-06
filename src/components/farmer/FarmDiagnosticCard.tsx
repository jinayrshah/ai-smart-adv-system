import React, { useEffect, useState } from 'react';
import { 
  Sprout, 
  Droplets, 
  Thermometer, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Compass, 
  Info,
  Calendar
} from 'lucide-react';
import { 
  fetchFarmDiagnostic, 
  AgronomyDiagnosticResponse 
} from '../../lib/api/advisory';

interface Props {
  farmId: string;
  cropId?: string;
  onRefresh?: () => void;
}

export const FarmDiagnosticCard: React.FC<Props> = ({ farmId, cropId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<AgronomyDiagnosticResponse | null>(null);

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
  }, [farmId, cropId]);

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 flex items-center justify-center space-x-3 text-stone-400">
        <RefreshCw size={18} className="animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Computing precision growth stage & water balance...</span>
      </div>
    );
  }

  if (error || !diagnostic) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Info size={18} className="text-amber-400" />
          <span className="text-xs text-amber-300">{error || 'Diagnostics unavailable'}</span>
        </div>
        <button
          onClick={loadData}
          className="text-xs font-semibold px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { stage, irrigation, soil_flags, climate } = diagnostic;

  return (
    <div className="bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-xl space-y-4">
      {/* Header bar */}
      <div className="p-5 border-b border-dark-border/80 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-500/15 rounded-xl border border-emerald-500/30 text-emerald-400">
            <Sprout size={18} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-stone-100">
                {diagnostic.crop} — Physiological Stage & Precision Agronomy
              </h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {stage.method === 'gdd' ? 'GDD Thermal Time' : 'Calendar Fallback'}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Sown: {diagnostic.sowing_date} ({stage.days_since_sowing} days ago) • As of {diagnostic.as_of}
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          title="Recalculate Diagnostics"
          className="p-2 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Grid of 4 computation engines */}
      <div className="p-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Growth Stage & Thermal GDD Progress */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-300">
              <Calendar size={15} className="text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Current Growth Stage</span>
            </div>
            <span className="text-xs font-bold text-emerald-400">
              Stage {stage.stage_order}
            </span>
          </div>

          <div>
            <div className="text-base font-extrabold text-stone-100">
              {stage.stage_name}
            </div>
            <div className="flex items-center justify-between text-xs text-stone-400 mt-1">
              <span>Accumulated GDD: <strong className="text-stone-200">{stage.cumulative_gdd} °C-d</strong></span>
              {stage.next_stage_name && (
                <span className="text-[11px] text-zinc-500">
                  Next: {stage.next_stage_name}
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2 truncate" title={stage.source}>
            Source: {stage.source}
          </div>
        </div>

        {/* 2. Water Balance & ETc Deficit */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-300">
              <Droplets size={15} className="text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Water Balance & ETc</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
              irrigation.deficit_mm > 15 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            }`}>
              Deficit: {irrigation.deficit_mm} mm
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center py-0.5">
            <div className="bg-stone-800/50 p-2 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Today ETc</span>
              <span className="text-xs font-bold text-cyan-300">{irrigation.etc_today_mm} mm</span>
            </div>
            <div className="bg-stone-800/50 p-2 rounded-xl">
              <span className="text-[10px] text-stone-400 block">7d Need</span>
              <span className="text-xs font-bold text-stone-200">{irrigation.etc_7d_mm} mm</span>
            </div>
            <div className="bg-stone-800/50 p-2 rounded-xl">
              <span className="text-[10px] text-stone-400 block">7d Rain</span>
              <span className="text-xs font-bold text-emerald-300">{irrigation.rain_7d_mm} mm</span>
            </div>
          </div>

          <p className="text-xs text-stone-300 leading-relaxed">
            {irrigation.recommendation}
          </p>

          <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2 flex items-center justify-between">
            <span>Kc = {irrigation.kc}</span>
            <span>Source: {irrigation.source}</span>
          </div>
        </div>

        {/* 3. Soil Health Card & Nutrient Flags */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-300">
              <Layers size={15} className="text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Soil & Nutrient Status</span>
            </div>
            {soil_flags.length === 0 ? (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 size={13} />
                <span>Compliant</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-400">
                <AlertTriangle size={13} />
                <span>{soil_flags.length} Alert{soil_flags.length > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>

          {soil_flags.length === 0 ? (
            <p className="text-xs text-stone-400 leading-relaxed py-2">
              Soil texture and tested nutrient parameters match agronomic benchmarks for {diagnostic.crop}. No amendment flags raised.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {soil_flags.map((flag, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="font-bold text-amber-300 block capitalize">
                    {flag.flag_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-stone-300">{flag.notes}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2">
            ICAR / State Agricultural University Soil Standards
          </div>
        </div>

        {/* 4. Climate & Thermal Verdict */}
        <div className="p-4 rounded-2xl bg-stone-900/40 border border-dark-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-300">
              <Thermometer size={15} className="text-orange-400" />
              <span className="text-xs font-bold uppercase tracking-wider">Thermal & Climate Match</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
              climate.verdict === 'suitable'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : climate.verdict === 'marginal'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {climate.verdict}
            </span>
          </div>

          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-lg font-bold text-stone-100">{climate.observed_temp_c}°C</span>
              <span className="text-xs text-stone-400">
                (Optimal: {climate.ideal_temp_range[0]}°C – {climate.ideal_temp_range[1]}°C)
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed mt-1">
              {climate.notes}
            </p>
          </div>

          <div className="text-[10px] text-stone-500 italic border-t border-dark-border/40 pt-2 flex items-center justify-between">
            <span>Reading: {climate.reading_source.replace('_', ' ')}</span>
            <span>Source: {climate.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
