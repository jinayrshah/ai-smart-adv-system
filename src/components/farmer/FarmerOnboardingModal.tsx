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
  initialFarmView?: any;
  initialProfile?: any;
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

const labelClass = 'block text-xs font-semibold text-[#555e4a] mb-1.5 font-mono tracking-wide';
const inputClass = 'w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 px-4 text-[#212529] text-sm focus:border-[#07503f] focus:bg-white focus:outline-none transition-all shadow-xs';
const selectClass = `${inputClass} appearance-none cursor-pointer`;

export const FarmerOnboardingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onComplete,
  initialFarmerId,
  initialName = '',
  initialFarmView,
  initialProfile,
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

  // Pre-populate fields when opened or when initial data changes
  React.useEffect(() => {
    if (!isOpen) return;

    if (initialName) setFullName(initialName);
    if (initialProfile?.profile?.full_name) {
      setFullName(initialProfile.profile.full_name);
    } else if (initialFarmView?.fullName) {
      setFullName(initialFarmView.fullName);
    }

    if (initialProfile?.profile?.preferred_language) {
      setLanguage(initialProfile.profile.preferred_language);
    }
    if (initialProfile?.profile?.phone) {
      setPhone(initialProfile.profile.phone);
    }

    const farm = initialFarmView?.farm || initialProfile?.farm;
    if (farm) {
      if (farm.name) setFarmName(farm.name);
      if (farm.state) setState(farm.state);
      if (farm.district) setDistrict(farm.district);
      if (farm.lat != null) setLat(farm.lat);
      if (farm.lon != null) setLon(farm.lon);
      if (farm.fieldSizeAcres != null) setFieldSize(String(farm.fieldSizeAcres));
      else if (farm.field_size_acres != null) setFieldSize(String(farm.field_size_acres));
      if (farm.soilType) setSoilType(farm.soilType);
      else if (farm.soil_type) setSoilType(farm.soil_type);
      if (farm.irrigationType) setIrrigation(farm.irrigationType);
      else if (farm.irrigation_type) setIrrigation(farm.irrigation_type);

      const npk = farm.npk || farm.soil_npk;
      if (npk && typeof npk === 'object') {
        const hasValues = npk.n != null || npk.p != null || npk.k != null || npk.ph != null;
        if (hasValues) {
          setHasShc(true);
          setSoilN(npk.n != null ? String(npk.n) : '');
          setSoilP(npk.p != null ? String(npk.p) : '');
          setSoilK(npk.k != null ? String(npk.k) : '');
          setSoilPh(npk.ph != null ? String(npk.ph) : '');
        }
      }
    }

    const cropObj = initialFarmView?.crop || initialProfile?.crops?.[0];
    if (cropObj) {
      const cropName = cropObj.name || cropObj.crop;
      if (cropName) setSelectedCrop(cropName);
      if (cropObj.variety) setVariety(cropObj.variety);
      if (cropObj.season) setSeason(cropObj.season);
      const sDate = cropObj.sowingDate || cropObj.sowing_date;
      if (sDate) {
        setSowingDate(sDate);
        setNotSownYet(false);
      } else {
        setNotSownYet(true);
      }
    }
  }, [isOpen, initialFarmView, initialProfile, initialName]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-white border border-[#c3cda7] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c3cda7] flex items-center justify-between bg-[#f1efdf]">
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s as 1 | 2 | 3 | 4)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all ${
                    step === s
                      ? 'bg-[#07503f] text-[#e8fe85] shadow-xs'
                      : 'bg-white border border-[#c3cda7] text-[#555e4a] hover:text-[#212529] hover:bg-[#e6ecd5]'
                  }`}
                >
                  Step {s}
                </button>
              ))}
            </div>
            <h2 className="font-bold font-serif text-xl text-[#07503f] tracking-tight">
              {STEP_TITLES[step]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#e6ecd5] text-[#555e4a] hover:text-[#212529] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[#e6ecd5] w-full">
          <div
            className="h-full bg-[#07503f] transition-all duration-400 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm text-[#212529] bg-white">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-mono">
              ⚠ {error}
            </div>
          )}

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Your Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#555e4a] absolute left-4 top-1/2 -translate-y-1/2" />
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
                      className={`p-3 rounded-2xl border text-left font-medium transition-all ${
                        language === l.id
                          ? 'bg-[#07503f] border-[#07503f] text-[#e8fe85] font-bold shadow-xs'
                          : 'bg-[#f1efdf] border-[#c3cda7] text-[#212529] hover:bg-[#e6ecd5]'
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
                <div className="p-3 bg-[#e6ecd5]/50 rounded-2xl border border-[#c3cda7] text-xs flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#07503f] shrink-0" />
                  <span className="text-[#555e4a] font-mono">
                    Auto-set: <strong className="text-[#07503f] font-bold">{Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}</strong>
                    {' '}— adjust if your exact plot differs
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-[#555e4a] mb-1">Latitude</label>
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
                  <label className="block text-[11px] font-mono font-semibold text-[#555e4a] mb-1">Longitude</label>
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
                  <label className="block text-[11px] font-mono font-semibold text-[#555e4a] mb-1">Field Size (Acres)</label>
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

              <div className="pt-2 border-t border-[#c3cda7]">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasShc}
                    onChange={(e) => setHasShc(e.target.checked)}
                    className="w-4 h-4 rounded border-[#c3cda7] text-[#07503f] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-[#212529] flex items-center gap-1.5 font-medium">
                    <FileText className="w-3.5 h-3.5 text-[#07503f]" />
                    I have a <strong className="text-[#07503f]">Soil Health Card</strong> (मृदा स्वास्थ्य कार्ड)
                  </span>
                </label>

                {hasShc && (
                  <div className="mt-3 grid grid-cols-4 gap-2 p-4 bg-[#f1efdf] rounded-2xl border border-[#c3cda7]">
                    {[
                      { label: 'N (kg/ha)', val: soilN, set: setSoilN, ph: false },
                      { label: 'P (kg/ha)', val: soilP, set: setSoilP, ph: false },
                      { label: 'K (kg/ha)', val: soilK, set: setSoilK, ph: false },
                      { label: 'pH', val: soilPh, set: setSoilPh, ph: true },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="block text-[10px] font-mono text-[#555e4a] mb-1 font-semibold">{f.label}</label>
                        <input
                          type="number"
                          step={f.ph ? '0.1' : '1'}
                          value={f.val}
                          onChange={(e) => f.set(e.target.value)}
                          placeholder={f.ph ? '6.8' : '—'}
                          className="w-full bg-white border border-[#c3cda7] rounded-xl p-2 text-xs font-mono text-[#212529] focus:border-[#07503f] focus:outline-none shadow-2xs"
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
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        selectedCrop === c.name
                          ? 'bg-[#07503f] border-[#07503f] text-[#e8fe85] font-bold shadow-sm'
                          : 'bg-[#f1efdf] border-[#c3cda7] text-[#212529] hover:bg-[#e6ecd5]'
                      }`}
                    >
                      <span className="block text-xl mb-0.5">{c.emoji}</span>
                      <span className="block text-xs font-semibold">{c.name}</span>
                      <span className={`block text-[10px] ${selectedCrop === c.name ? 'text-[#e8fe85]/80' : 'text-[#555e4a]'}`}>{c.hindi}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-[#555e4a] mb-1 font-mono">
                    Crop Name (फसल का नाम — select above or type any crop):
                  </label>
                  <input
                    type="text"
                    value={selectedCrop}
                    onChange={(e) => setSelectedCrop(e.target.value)}
                    placeholder="e.g. Wheat, Groundnut, Mustard, Potato, Onion..."
                    className={inputClass}
                  />
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
                  <p className="text-[10px] text-[#555e4a] mt-1 font-mono pl-1">Leave blank if you don't know</p>
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
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-[#07503f]" />
                  Sowing Date (बुवाई की तारीख)
                </label>
                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notSownYet}
                    onChange={(e) => setNotSownYet(e.target.checked)}
                    className="w-4 h-4 rounded border-[#c3cda7] text-[#07503f] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-sm text-[#212529]">
                    I haven't sown yet — <span className="text-[#555e4a] font-medium">planning stage</span>
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
                  <div className="p-3 bg-[#fceace] border border-[#f5cba7] rounded-2xl text-xs text-[#93521e]">
                    ℹ You'll still get general crop advisory. Add sowing date later for precise GDD-based stage tracking.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#c3cda7] flex items-center justify-between bg-[#f1efdf]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white border border-[#c3cda7] text-[#212529] hover:bg-[#e6ecd5] transition-colors cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[#555e4a] hover:text-[#07503f] font-mono underline cursor-pointer"
            >
              Skip for now
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => { setError(null); setStep((s) => (s + 1) as any); }}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-bold bg-[#07503f] hover:bg-[#064234] text-[#e8fe85] transition-all shadow-sm cursor-pointer"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !selectedCrop}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold bg-[#07503f] hover:bg-[#064234] text-[#e8fe85] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
