import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Droplet,
  Compass
} from 'lucide-react';
import { submitOnboarding, OnboardingPayload, OnboardingResult } from '../../lib/api/farmer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: OnboardingResult) => void;
  initialFarmerId?: string;
  initialName?: string;
}

const DEEP_CROPS = [
  { name: 'Wheat', hindi: 'गेहूं', season: 'rabi' },
  { name: 'Tomato', hindi: 'टमाटर', season: 'kharif' },
  { name: 'Cotton', hindi: 'कपास', season: 'kharif' },
  { name: 'Soybean', hindi: 'सोयाबीन', season: 'kharif' },
  { name: 'Rice', hindi: 'धान (चावल)', season: 'kharif' },
  { name: 'Maize', hindi: 'मक्का', season: 'kharif' },
];

const SOIL_TYPES = [
  'Loamy (दोमट)',
  'Black Cotton (काली मिट्टी)',
  'Sandy Loam (बलुई दोमट)',
  'Clay Loam (चिकनी दोमट)',
  'Red Soil (लाल मिट्टी)',
  'Alluvial (जलोढ़ मिट्टी)',
];

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

  // Form State
  const [fullName, setFullName] = useState(initialName);
  const [language, setLanguage] = useState('hi');
  const [phone, setPhone] = useState('');

  // Farm Location
  const [farmName, setFarmName] = useState('My Field');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nashik');
  const [lat, setLat] = useState(20.0);
  const [lon, setLon] = useState(73.8);
  const [fieldSize, setFieldSize] = useState('3.0');

  // Soil
  const [soilType, setSoilType] = useState('Loamy (दोमट)');
  const [hasShc, setHasShc] = useState(false);
  const [soilN, setSoilN] = useState('240');
  const [soilP, setSoilP] = useState('18');
  const [soilK, setSoilK] = useState('300');
  const [soilPh, setSoilPh] = useState('6.8');
  const [irrigation, setIrrigation] = useState('drip');

  // Crop
  const [selectedCrop, setSelectedCrop] = useState('Tomato');
  const [variety, setVariety] = useState('Abhinav');
  const [sowingDate, setSowingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 40); // 40 days ago as typical mid-growth default
    return d.toISOString().split('T')[0];
  });
  const [season, setSeason] = useState('kharif');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: OnboardingPayload = {
        farmer_id: initialFarmerId,
        full_name: fullName.trim() || 'Farmer',
        preferred_language: language,
        phone: phone.trim() || undefined,
        farm_name: farmName.trim() || 'My farm',
        lat: Number(lat),
        lon: Number(lon),
        state,
        district,
        soil_type: soilType,
        soil_npk: hasShc ? {
          n: Number(soilN) || undefined,
          p: Number(soilP) || undefined,
          k: Number(soilK) || undefined,
          ph: Number(soilPh) || undefined,
        } : undefined,
        irrigation_type: irrigation,
        field_size_acres: Number(fieldSize) || 2.5,
        crops: [
          {
            crop: selectedCrop,
            variety: variety.trim() || undefined,
            sowing_date: sowingDate,
            season,
          }
        ],
      };

      const result = await submitOnboarding(payload);
      localStorage.setItem('agri_onboarded_farm', JSON.stringify(result));
      if (onComplete) onComplete(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg bg-[#111827] border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header (Forest banner styling) */}
        <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between bg-[#07503f]/15">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8fe85] font-mono">
              Precision Agronomy Setup
            </span>
            <h2 className="font-serif text-xl font-bold text-white tracking-tight">
              {step === 1 && 'Step 1: Farmer Identity & Language'}
              {step === 2 && 'Step 2: Farm Location & Micro-Grid'}
              {step === 3 && 'Step 3: Soil Health & Irrigation Type'}
              {step === 4 && 'Step 4: Active Crop & Sowing Date'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar (Lime vivid fill) */}
        <div className="h-1 bg-stone-800 w-full">
          <div 
            className="h-full bg-[#e8fe85] transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm text-stone-200">
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-2xl text-xs">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5 font-mono">Full Name (किसान का नाम)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full bg-stone-900 border border-stone-700/80 rounded-full py-2.5 pl-11 pr-4 text-stone-100 text-sm focus:border-[#e8fe85] focus:ring-1 focus:ring-[#e8fe85] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5 font-mono">Preferred Advisory Language</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'hi', label: 'Hindi (हिन्दी)' },
                    { id: 'mr', label: 'Marathi (मराठी)' },
                    { id: 'gu', label: 'Gujarati (ગુજરાતી)' },
                    { id: 'en', label: 'English' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLanguage(l.id)}
                      className={`p-3 rounded-2xl border text-left font-bold transition-all ${
                        language === l.id 
                          ? 'bg-[#07503f] border-[#e8fe85]/40 text-[#e8fe85] shadow-sm' 
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5 font-mono">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-stone-400 mb-1">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none appearance-none"
                  >
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Karnataka">Karnataka</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-stone-400 mb-1">District</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Nashik"
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-stone-400 mb-1">Plot Name</label>
                <input
                  type="text"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g. Main Orchard"
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 px-3 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.001"
                    value={lon}
                    onChange={(e) => setLon(Number(e.target.value))}
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 px-3 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 mb-1">Field Size (Acres)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={fieldSize}
                    onChange={(e) => setFieldSize(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 px-3 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-900/60 rounded-2xl border border-stone-800 text-xs text-stone-400 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#e8fe85] shrink-0" />
                <span className="font-mono text-[11px]">Weather Grid Snap: <strong className="text-stone-200">{Number(lat).toFixed(1)},{Number(lon).toFixed(1)}</strong> (11km Agromet grid)</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-400 mb-1.5">Dominant Soil Type</label>
                <select
                  value={soilType}
                  onChange={(e) => setSoilType(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none appearance-none"
                >
                  {SOIL_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-stone-400 mb-1.5">Primary Irrigation Source</label>
                <select
                  value={irrigation}
                  onChange={(e) => setIrrigation(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none appearance-none"
                >
                  <option value="drip">Drip Irrigation (ड्रिप)</option>
                  <option value="sprinkler">Sprinkler (फव्वारा)</option>
                  <option value="canal">Canal (नहर)</option>
                  <option value="borewell">Tube-well / Borewell (बोरवेल)</option>
                  <option value="rainfed">Rainfed / Dryland (वर्षा आधारित)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-stone-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasShc}
                    onChange={(e) => setHasShc(e.target.checked)}
                    className="rounded border-stone-700 text-[#07503f] focus:ring-0"
                  />
                  <span className="text-xs font-mono font-medium text-[#e8fe85] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    I have a Soil Health Card (मृदा स्वास्थ्य कार्ड)
                  </span>
                </label>

                {hasShc && (
                  <div className="grid grid-cols-4 gap-2 mt-3 p-3 bg-stone-900/60 rounded-2xl border border-stone-800">
                    <div>
                      <label className="block text-[10px] font-mono text-stone-400">N (kg/ha)</label>
                      <input
                        type="number"
                        value={soilN}
                        onChange={(e) => setSoilN(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-800 rounded-full p-2 text-xs font-mono text-stone-100 focus:border-[#e8fe85] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-stone-400">P (kg/ha)</label>
                      <input
                        type="number"
                        value={soilP}
                        onChange={(e) => setSoilP(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-800 rounded-full p-2 text-xs font-mono text-stone-100 focus:border-[#e8fe85] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-stone-400">K (kg/ha)</label>
                      <input
                        type="number"
                        value={soilK}
                        onChange={(e) => setSoilK(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-800 rounded-full p-2 text-xs font-mono text-stone-100 focus:border-[#e8fe85] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-stone-400">pH</label>
                      <input
                        type="number"
                        step="0.1"
                        value={soilPh}
                        onChange={(e) => setSoilPh(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-800 rounded-full p-2 text-xs font-mono text-stone-100 focus:border-[#e8fe85] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-400 mb-1.5">
                  Select Deep Advisory Crop (फसल)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DEEP_CROPS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setSelectedCrop(c.name);
                        setSeason(c.season);
                      }}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        selectedCrop === c.name
                          ? 'bg-[#07503f] border-[#e8fe85]/40 text-[#e8fe85] font-bold shadow-sm'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                      }`}
                    >
                      <span className="block text-xs font-mono">{c.name}</span>
                      <span className="block text-[10px] text-stone-400">{c.hindi}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-stone-400 mb-1">Variety / Hybrid (किस्म)</label>
                  <input
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="e.g. HD-2967"
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-stone-400 mb-1">Season</label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none appearance-none"
                  >
                    <option value="kharif">Kharif (खरीफ - Monsoon)</option>
                    <option value="rabi">Rabi (रबी - Winter)</option>
                    <option value="zaid">Zaid (जायद - Summer)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-stone-400 mb-1">
                  Sowing Date (बुवाई की तारीख - Used for GDD Stage Tracking)
                </label>
                <input
                  type="date"
                  value={sowingDate}
                  onChange={(e) => setSowingDate(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 px-4 text-stone-100 text-xs font-mono focus:border-[#e8fe85] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 flex items-center justify-between bg-stone-900/60">
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
              className="text-xs text-stone-400 hover:text-white underline font-mono"
            >
              Skip / Continue Anonymously
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as any)}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-bold bg-[#07503f] hover:bg-[#0d6e57] text-[#e8fe85] transition-all shadow-md"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold bg-[#07503f] hover:bg-[#0d6e57] text-[#e8fe85] transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Finish Onboarding & Personalize'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
