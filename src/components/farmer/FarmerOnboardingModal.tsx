import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  User,
  MapPin,
  Sprout,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileText,
  X,
  Layers,
  Compass,
  Calendar,
} from 'lucide-react';
import { submitOnboarding, OnboardingPayload, OnboardingResult } from '../../lib/api/farmer';
import { INDIA_GEO, getDistrictsByState, getDistrictLatLon, getStateLatLon } from '../../data/indiaGeo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: OnboardingResult) => void;
  initialFarmerId?: string;
  initialName?: string;
}

const DEEP_CROPS = [
  { name: 'Wheat', hindi: 'गेहूं', season: 'rabi', emoji: '🌾' },
  { name: 'Tomato', hindi: 'टमाटर', season: 'kharif', emoji: '🍅' },
  { name: 'Cotton', hindi: 'कपास', season: 'kharif', emoji: '🪴' },
  { name: 'Soybean', hindi: 'सोयाबीन', season: 'kharif', emoji: '🫘' },
  { name: 'Rice', hindi: 'धान', season: 'kharif', emoji: '🌾' },
  { name: 'Maize', hindi: 'मक्का', season: 'kharif', emoji: '🌽' },
];

const SOIL_TYPES = [
  'Loamy (दोमट)',
  'Black Cotton (काली मिट्टी)',
  'Sandy Loam (बलुई दोमट)',
  'Clay Loam (चिकनी दोमट)',
  'Red Soil (लाल मिट्टी)',
  'Alluvial (जलोढ़ मिट्टी)',
];

const FIELD_SIZE_OPTIONS = ['0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '7', '10', '15', '20'];

const labelClass = 'block text-xs font-semibold text-stone-300 mb-1.5 font-mono tracking-wide';
const inputClass = 'w-full bg-stone-900 border border-stone-700/80 rounded-xl py-2.5 px-4 text-stone-100 text-sm focus:border-[#e8fe85] focus:ring-1 focus:ring-[#e8fe85] focus:outline-none transition-all';
const selectClass = `${inputClass} appearance-none cursor-pointer`;

export const FarmerOnboardingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onComplete,
  initialFarmerId,
  initialName = '',
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Identity
  const [fullName, setFullName] = useState(initialName);
  const [language, setLanguage] = useState('hi');
  const [phone, setPhone] = useState('');

  // Step 2: Farm Location
  const [farmName, setFarmName] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [lat, setLat] = useState<number | ''>('');
  const [lon, setLon] = useState<number | ''>('');
  const [fieldSize, setFieldSize] = useState('');

  // Step 3: Soil & Irrigation
  const [soilType, setSoilType] = useState('Loamy (दोमट)');
  const [hasShc, setHasShc] = useState(false);
  const [soilN, setSoilN] = useState('');
  const [soilP, setSoilP] = useState('');
  const [soilK, setSoilK] = useState('');
  const [soilPh, setSoilPh] = useState('');
  const [irrigation, setIrrigation] = useState('borewell');

  // Step 4: Crop
  const [selectedCrop, setSelectedCrop] = useState('');
  const [variety, setVariety] = useState('');
  const [notSownYet, setNotSownYet] = useState(false);
  const [sowingDate, setSowingDate] = useState('');
  const [season, setSeason] = useState('kharif');

  const districts = useMemo(() => getDistrictsByState(state), [state]);

  const handleStateChange = (newState: string) => {
    setState(newState);
    setDistrict('');
    const geo = getStateLatLon(newState);
    if (geo) { setLat(geo.lat); setLon(geo.lon); }
  };

  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    const geo = getDistrictLatLon(state, newDistrict);
    if (geo) { setLat(geo.lat); setLon(geo.lon); }
  };

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedCrop) { setError('Please select a crop to continue.'); return; }
    setLoading(true);
    setError(null);
    try {
      const payload: OnboardingPayload = {
        farmer_id: initialFarmerId,
        full_name: fullName.trim() || 'Farmer',
        preferred_language: language,
        phone: phone.trim() || undefined,
        farm_name: farmName.trim() || `${district || state || 'My'} Farm`,
        lat: Number(lat) || 20.0,
        lon: Number(lon) || 78.0,
        state: state || undefined,
        district: district || undefined,
        soil_type: soilType,
        soil_npk: hasShc ? {
          n: soilN ? Number(soilN) : undefined,
          p: soilP ? Number(soilP) : undefined,
          k: soilK ? Number(soilK) : undefined,
          ph: soilPh ? Number(soilPh) : undefined,
        } : undefined,
        irrigation_type: irrigation,
        field_size_acres: fieldSize ? Number(fieldSize) : 2.5,
        crops: [
          {
            crop: selectedCrop,
            variety: variety.trim() || undefined,
            sowing_date: notSownYet ? undefined : (sowingDate || undefined),
            season,
          }
        ],
      };

      const result = await submitOnboarding(payload);
      localStorage.setItem('farmer_onboarding_profile', JSON.stringify(result));
      if (onComplete) onComplete(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const STEP_TITLES = [
    '', 
    'Your Details',
    'Farm Location',
    'Soil & Irrigation',
    'Your Crop',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-[#0f172a] border border-stone-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-[#07503f]/10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#e8fe85]/70 font-mono mb-0.5">
              Step {step} of 4
            </p>
            <h2 className="font-bold text-lg text-white tracking-tight">
              {STEP_TITLES[step]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-stone-800 w-full">
          <div
            className="h-full bg-[#e8fe85] transition-all duration-400 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm text-stone-200">
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
              ⚠ {error}
            </div>
          )}

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Your Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Advisory Language (सलाह की भाषा)</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'hi', label: 'हिन्दी (Hindi)' },
                    { id: 'mr', label: 'मराठी (Marathi)' },
                    { id: 'gu', label: 'ગુજરાતી (Gujarati)' },
                    { id: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
                    { id: 'te', label: 'తెలుగు (Telugu)' },
                    { id: 'en', label: 'English' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLanguage(l.id)}
                      className={`p-3 rounded-xl border text-left font-medium transition-all ${
                        language === l.id
                          ? 'bg-[#07503f] border-[#e8fe85]/50 text-[#e8fe85] shadow-sm'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white hover:border-stone-600'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Phone (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Farm Location ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Farm / Plot Name</label>
                <input
                  type="text"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g. North Field, Gaon ka Khet"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>State (राज्य) *</label>
                  <select
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select State —</option>
                    {INDIA_GEO.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>District (जिला) *</label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    disabled={!state || districts.length === 0}
                    className={selectClass}
                  >
                    <option value="">— Select District —</option>
                    {districts.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(lat !== '' || lon !== '') && (
                <div className="p-3 bg-[#07503f]/10 rounded-xl border border-[#07503f]/30 text-xs flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#e8fe85] shrink-0" />
                  <span className="text-stone-300 font-mono">
                    Auto-set: <strong className="text-white">{Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}</strong>
                    {' '}— adjust if your exact plot differs
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-stone-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 19.99"
                    className={`${inputClass} text-xs`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-stone-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.001"
                    value={lon}
                    onChange={(e) => setLon(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 73.79"
                    className={`${inputClass} text-xs`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-stone-400 mb-1">Field Size (Acres)</label>
                  <select
                    value={fieldSize}
                    onChange={(e) => setFieldSize(e.target.value)}
                    className={`${selectClass} text-xs`}
                  >
                    <option value="">Select</option>
                    {FIELD_SIZE_OPTIONS.map(s => (
                      <option key={s} value={s}>{s} {Number(s) === 1 ? 'acre' : 'acres'}</option>
                    ))}
                    <option value="custom">Other (enter above)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Soil & Irrigation ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Soil Type (मिट्टी का प्रकार)</label>
                <select
                  value={soilType}
                  onChange={(e) => setSoilType(e.target.value)}
                  className={selectClass}
                >
                  {SOIL_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Irrigation Source (सिंचाई का साधन)</label>
                <select
                  value={irrigation}
                  onChange={(e) => setIrrigation(e.target.value)}
                  className={selectClass}
                >
                  <option value="drip">Drip Irrigation (ड्रिप)</option>
                  <option value="sprinkler">Sprinkler (फव्वारा)</option>
                  <option value="canal">Canal / Nehr (नहर)</option>
                  <option value="borewell">Borewell / Tubewell (बोरवेल)</option>
                  <option value="rainfed">Rainfed / Dryland (वर्षा आधारित)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-stone-800/60">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasShc}
                    onChange={(e) => setHasShc(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-600 text-[#07503f] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-stone-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#e8fe85]" />
                    I have a <strong className="text-[#e8fe85]">Soil Health Card</strong> (मृदा स्वास्थ्य कार्ड)
                  </span>
                </label>

                {hasShc && (
                  <div className="mt-3 grid grid-cols-4 gap-2 p-4 bg-stone-900/60 rounded-xl border border-stone-700/60">
                    {[
                      { label: 'N (kg/ha)', val: soilN, set: setSoilN, ph: false },
                      { label: 'P (kg/ha)', val: soilP, set: setSoilP, ph: false },
                      { label: 'K (kg/ha)', val: soilK, set: setSoilK, ph: false },
                      { label: 'pH', val: soilPh, set: setSoilPh, ph: true },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="block text-[10px] font-mono text-stone-400 mb-1">{f.label}</label>
                        <input
                          type="number"
                          step={f.ph ? '0.1' : '1'}
                          value={f.val}
                          onChange={(e) => f.set(e.target.value)}
                          placeholder={f.ph ? '6.8' : '—'}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs font-mono text-stone-100 focus:border-[#e8fe85] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Crop ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Select Your Crop (फसल चुनें)</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEEP_CROPS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => { setSelectedCrop(c.name); setSeason(c.season); }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        selectedCrop === c.name
                          ? 'bg-[#07503f] border-[#e8fe85]/50 text-[#e8fe85] font-bold shadow-md'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800 hover:border-stone-600'
                      }`}
                    >
                      <span className="block text-xl mb-0.5">{c.emoji}</span>
                      <span className="block text-xs font-semibold">{c.name}</span>
                      <span className="block text-[10px] text-stone-400">{c.hindi}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Variety / Hybrid (किस्म)</label>
                  <input
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="e.g. HD-2967 (optional)"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-stone-500 mt-1 font-mono pl-1">Leave blank if you don't know</p>
                </div>
                <div>
                  <label className={labelClass}>Season (मौसम)</label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className={selectClass}
                  >
                    <option value="kharif">Kharif (खरीफ — Monsoon)</option>
                    <option value="rabi">Rabi (रबी — Winter)</option>
                    <option value="zaid">Zaid (जायद — Summer)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-[#e8fe85]" />
                  Sowing Date (बुवाई की तारीख)
                </label>
                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notSownYet}
                    onChange={(e) => setNotSownYet(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-600 text-[#07503f] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-stone-300">
                    I haven't sown yet — <span className="text-stone-500">planning stage</span>
                  </span>
                </label>
                {!notSownYet && (
                  <input
                    type="date"
                    value={sowingDate}
                    onChange={(e) => setSowingDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputClass}
                  />
                )}
                {notSownYet && (
                  <div className="p-3 bg-amber-950/30 border border-amber-700/40 rounded-xl text-xs text-amber-300">
                    ℹ You'll still get general crop advisory. Add sowing date later for precise GDD-based stage tracking.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 flex items-center justify-between bg-stone-900/40">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-stone-500 hover:text-stone-300 font-mono underline"
            >
              Skip for now
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => { setError(null); setStep((s) => (s + 1) as any); }}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-bold bg-[#07503f] hover:bg-[#0d6e57] text-[#e8fe85] transition-all shadow-md"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !selectedCrop}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold bg-[#e8fe85] hover:bg-[#d8f070] text-[#07503f] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving…' : 'Save Farm Profile'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
