import React, { useEffect, useMemo, useState } from 'react';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitOnboarding, type OnboardingPayload, type OnboardingResult } from '../../lib/api/farmer';
import { searchWeatherLocations, type LocationSearchResult } from '../../lib/api/weather';
import { INDIA_GEO, getDistrictsByState, getDistrictLatLon } from '../../data/indiaGeo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: OnboardingResult) => void;
  initialFarmerId?: string;
  initialName?: string;
  initialFarmView?: any;
  initialProfile?: any;
  /** First-time setup: no way to dismiss until the farm is saved. */
  required?: boolean;
}

const CROPS = ['Wheat', 'Rice', 'Cotton', 'Soybean', 'Maize', 'Tomato'];
const SOIL_TYPES = ['Black (काली)', 'Alluvial (जलोढ़)', 'Red (लाल)', 'Loamy (दोमट)', 'Sandy loam (बलुई दोमट)', 'Clay loam (चिकनी दोमट)'];
const IRRIGATION = [
  { v: 'borewell', l: 'Borewell / tubewell' },
  { v: 'canal', l: 'Canal' },
  { v: 'drip', l: 'Drip' },
  { v: 'sprinkler', l: 'Sprinkler' },
  { v: 'rainfed', l: 'Rainfed (no irrigation)' },
];
const SEASONS = [{ v: 'kharif', l: 'Kharif (monsoon)' }, { v: 'rabi', l: 'Rabi (winter)' }, { v: 'zaid', l: 'Zaid (summer)' }];

type Loc = { lat: number; lon: number; label: string; source: 'village' | 'gps' | 'district' };

const field = 'w-full h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink';
const label = 'block text-sm font-medium text-ink mb-1.5';

export const FarmerOnboardingModal: React.FC<Props> = ({
  isOpen, onClose, onComplete, initialFarmerId, initialName = '', initialFarmView, initialProfile, required = false,
}) => {
  const { i18n } = useTranslation();
  const farm0 = initialFarmView?.farm;
  const crop0 = initialFarmView?.crop;

  const [fullName, setFullName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [loc, setLoc] = useState<Loc | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [crop, setCrop] = useState('');
  const [variety, setVariety] = useState('');
  const [sown, setSown] = useState(true);
  const [sowingDate, setSowingDate] = useState('');
  const [season, setSeason] = useState('kharif');

  const [fieldSize, setFieldSize] = useState('');
  const [soilType, setSoilType] = useState('');
  const [irrigation, setIrrigation] = useState('');
  const [npk, setNpk] = useState({ n: '', p: '', k: '', ph: '' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form from the saved farm every time it opens, so "Edit farm" edits what is stored.
  useEffect(() => {
    if (!isOpen) return;
    setFullName(initialFarmView?.fullName || initialProfile?.profile?.full_name || initialName || '');
    setFarmName(farm0?.name || '');
    setState(farm0?.state || '');
    setDistrict(farm0?.district || '');
    setLoc(farm0?.lat != null && farm0?.lon != null
      ? { lat: farm0.lat, lon: farm0.lon, label: [farm0.district, farm0.state].filter(Boolean).join(', ') || 'Saved location', source: 'village' }
      : null);
    setCrop(crop0?.name || '');
    setVariety(crop0?.variety || '');
    setSown(crop0 ? Boolean(crop0.sowingDate) : true);
    setSowingDate(crop0?.sowingDate || '');
    setSeason(crop0?.season || 'kharif');
    setFieldSize(farm0?.fieldSizeAcres != null ? String(farm0.fieldSizeAcres) : '');
    setSoilType(farm0?.soilType || '');
    setIrrigation(farm0?.irrigationType || '');
    const n = farm0?.npk || {};
    setNpk({ n: n.n ?? '', p: n.p ?? '', k: n.k ?? '', ph: n.ph ?? '' } as any);
    setError(null); setLocError(null); setResults(null); setQuery('');
  }, [isOpen, initialFarmView, initialProfile, initialName]);

  const districts = useMemo(() => getDistrictsByState(state), [state]);
  if (!isOpen) return null;

  const pickDistrict = (d: string) => {
    setDistrict(d);
    const g = getDistrictLatLon(state, d);
    // District centre is approximate; a village or GPS pick is more precise and is kept if already set.
    if (g && (!loc || loc.source === 'district')) setLoc({ lat: g.lat, lon: g.lon, label: `${d} (district centre)`, source: 'district' });
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocError(null);
    setSearching(true);
    try {
      setResults(await searchWeatherLocations(query));
    } catch (err: any) {
      setLocError(err.message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: LocationSearchResult) => {
    setLoc({ lat: r.lat, lon: r.lon, label: [r.name, r.district, r.state].filter(Boolean).join(', '), source: 'village' });
    const st = INDIA_GEO.find((s) => s.name.toLowerCase() === (r.state || '').toLowerCase());
    if (st) setState(st.name);
    if (r.district) setDistrict(r.district);
    setResults(null);
    setQuery('');
  };

  const useGps = () => {
    setLocError(null);
    if (!navigator.geolocation) return setLocError('This device cannot share its location. Search your village instead.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), label: 'Your current location', source: 'gps' });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Search your village or pick your district instead.'
          : 'Could not get your location. Search your village or pick your district instead.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError('Enter your name.');
    if (!loc) return setError('Set your farm location: search your village, use GPS, or pick your district.');
    if (!crop) return setError('Choose the crop you are growing.');
    if (sown && !sowingDate) return setError('Enter the sowing date, or choose “Not sown yet”.');
    setSaving(true);
    try {
      const num = (v: string) => (v === '' || v == null ? undefined : Number(v));
      const hasNpk = Object.values(npk).some((v) => v !== '' && v != null);
      const payload: OnboardingPayload = {
        farmer_id: initialFarmerId,
        full_name: fullName.trim(),
        preferred_language: (i18n.language || 'en').split('-')[0],
        farm_name: farmName.trim() || `${district || 'My'} farm`,
        lat: loc.lat,
        lon: loc.lon,
        state: state || undefined,
        district: district || undefined,
        soil_type: soilType || undefined,
        soil_npk: hasNpk ? { n: num(npk.n), p: num(npk.p), k: num(npk.k), ph: num(npk.ph) } : undefined,
        irrigation_type: irrigation || undefined,
        field_size_acres: num(fieldSize),
        crops: [{ crop, variety: variety.trim() || undefined, sowing_date: sown ? sowingDate : undefined, season }],
      };
      const result = await submitOnboarding(payload);
      onComplete?.(result);
    } catch (err: any) {
      setError(err.message || 'Could not save your farm. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="farm-title">
      <form onSubmit={save} className="w-full sm:max-w-2xl bg-surface sm:rounded-2xl rounded-t-2xl max-h-[95vh] flex flex-col shadow-xl">
        <header className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-line">
          <div>
            <h2 id="farm-title" className="text-2xl font-semibold text-ink">{required ? 'Set up your farm' : 'Edit your farm'}</h2>
            <p className="mt-1 text-ink-soft">Your advice, weather and prices are based on these details.</p>
          </div>
          {!required && (
            <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-ink-soft hover:bg-ash">
              <X size={20} />
            </button>
          )}
        </header>

        <div className="overflow-y-auto px-6 py-6 space-y-10">
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">You</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="f-name" className={label}>Your name</label>
                <input id="f-name" className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="f-farm" className={label}>Farm name <span className="text-ink-muted font-normal">(optional)</span></label>
                <input id="f-farm" className={field} value={farmName} onChange={(e) => setFarmName(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">Where is the field?</h3>
            <div className="rounded-xl bg-ground px-4 py-3 flex items-center gap-3">
              <MapPin size={20} className={loc ? 'text-brand' : 'text-ink-muted'} aria-hidden />
              {loc ? (
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{loc.label}</p>
                  <p className="text-sm text-ink-soft num">{loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}{loc.source === 'district' ? ' · approximate' : ''}</p>
                </div>
              ) : (
                <p className="text-ink-soft">No location set yet.</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex gap-2">
                <label htmlFor="f-q" className="sr-only">Search village or town</label>
                <input
                  id="f-q"
                  className={field}
                  placeholder="Search village or town"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(e); } }}
                />
                <button type="button" onClick={search} disabled={query.trim().length < 2 || searching}
                  className="h-12 px-4 rounded-xl bg-ash text-ink font-medium hover:bg-tint disabled:opacity-50 flex items-center gap-2">
                  {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  <span className="sr-only sm:not-sr-only">Search</span>
                </button>
              </div>
              <button type="button" onClick={useGps} disabled={locating}
                className="h-12 px-4 rounded-xl border border-line text-ink font-medium hover:bg-ash flex items-center justify-center gap-2">
                {locating ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
                I’m at the field
              </button>
            </div>
            {locError && <p role="alert" className="text-sm text-bad">{locError}</p>}
            {results && (
              <ul className="rounded-xl border border-line divide-y divide-line overflow-hidden">
                {results.length === 0 && <li className="px-4 py-3 text-ink-soft">No places found. Try a nearby town, or pick your district below.</li>}
                {results.map((r, i) => (
                  <li key={`${r.lat}-${r.lon}-${i}`}>
                    <button type="button" onClick={() => pickResult(r)} className="w-full text-left px-4 py-3 hover:bg-ground">
                      <span className="font-medium text-ink">{r.name}</span>
                      <span className="text-ink-soft"> · {[r.district, r.state].filter(Boolean).join(', ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="f-state" className={label}>State</label>
                <select id="f-state" className={field} value={state} onChange={(e) => { setState(e.target.value); setDistrict(''); }}>
                  <option value="">Choose state</option>
                  {INDIA_GEO.map((s) => <option key={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="f-district" className={label}>District</label>
                {districts.length > 0 && !districts.some((d) => d.name === district) && district ? (
                  <input id="f-district" className={field} value={district} onChange={(e) => setDistrict(e.target.value)} />
                ) : (
                  <select id="f-district" className={field} value={district} onChange={(e) => pickDistrict(e.target.value)} disabled={!state}>
                    <option value="">{state ? 'Choose district' : 'Choose state first'}</option>
                    {districts.map((d) => <option key={d.name}>{d.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">Crop this season</h3>
            <div role="radiogroup" aria-label="Crop" className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CROPS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={crop === c} onClick={() => setCrop(c)}
                  className={`h-12 rounded-xl font-medium transition-colors ${crop === c ? 'bg-brand text-white' : 'bg-ash text-ink hover:bg-tint'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="f-variety" className={label}>Variety <span className="text-ink-muted font-normal">(optional)</span></label>
                <input id="f-variety" className={field} value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. HD-2967" />
              </div>
              <div>
                <label htmlFor="f-season" className={label}>Season</label>
                <select id="f-season" className={field} value={season} onChange={(e) => setSeason(e.target.value)}>
                  {SEASONS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="f-sown" className={label}>Sowing date</label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input id="f-sown" type="date" max={today} className={`${field} sm:max-w-xs num`} value={sowingDate}
                  onChange={(e) => setSowingDate(e.target.value)} disabled={!sown} />
                <label className="inline-flex items-center gap-2 text-ink">
                  <input type="checkbox" className="w-5 h-5 accent-[var(--color-brand)]" checked={!sown} onChange={(e) => setSown(!e.target.checked)} />
                  Not sown yet
                </label>
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">Used to work out the crop stage. We never guess it.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">Soil and water <span className="text-ink-muted font-normal text-base">(optional, improves advice)</span></h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="f-size" className={label}>Field size (acres)</label>
                <input id="f-size" type="number" min="0" step="0.1" inputMode="decimal" className={`${field} num`} value={fieldSize} onChange={(e) => setFieldSize(e.target.value)} />
              </div>
              <div>
                <label htmlFor="f-soil" className={label}>Soil type</label>
                <select id="f-soil" className={field} value={soilType} onChange={(e) => setSoilType(e.target.value)}>
                  <option value="">Not sure</option>
                  {[...new Set([soilType, ...SOIL_TYPES].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="f-irr" className={label}>Irrigation</label>
                <select id="f-irr" className={field} value={irrigation} onChange={(e) => setIrrigation(e.target.value)}>
                  <option value="">Not sure</option>
                  {IRRIGATION.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            </div>
            <fieldset>
              <legend className={label}>Soil Health Card values</legend>
              <div className="grid grid-cols-4 gap-2">
                {([['n', 'N kg/ha'], ['p', 'P kg/ha'], ['k', 'K kg/ha'], ['ph', 'pH']] as const).map(([k, l]) => (
                  <div key={k}>
                    <label htmlFor={`f-${k}`} className="block text-sm text-ink-soft mb-1">{l}</label>
                    <input id={`f-${k}`} type="number" step="0.1" inputMode="decimal" className={`${field} num px-3`}
                      value={(npk as any)[k]} onChange={(e) => setNpk({ ...npk, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
            </fieldset>
          </section>
        </div>

        <footer className="px-6 py-4 border-t border-line flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          {error && <p role="alert" className="text-sm text-bad sm:mr-auto">{error}</p>}
          {!required && (
            <button type="button" onClick={onClose} className="h-12 px-6 rounded-full text-ink font-medium hover:bg-ash">Cancel</button>
          )}
          <button type="submit" disabled={saving}
            className="h-12 px-8 rounded-full bg-brand text-white font-semibold hover:bg-brand-dark disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save farm'}
          </button>
        </footer>
      </form>
    </div>
  );
};
