/**
 * The onboarding API returns { profile, farm: { name, grid_key, soil_npk, ... }, crops: [...] }.
 * Earlier UI code read farm.farm_name / farm.agromet_grid_id / farm.shc_n and a singular
 * `crop` that the API never returns, so the farm card showed the literal placeholders
 * "My Farm • Selected Crop" / "Sown: Current Season" (cleanup doc A1) and the advisor chat
 * was never told the farmer's crop. Everything reads the profile through this normalizer.
 */

export interface FarmView {
  id: number | null;
  name: string;
  gridKey: string | null;
  soilType: string | null;
  irrigationType: string | null;
  fieldSizeAcres: number | null;
  lat: number | null;
  lon: number | null;
  state: string | null;
  district: string | null;
  npk: { n?: number | null; p?: number | null; k?: number | null; ph?: number | null };
}

export interface CropView {
  id: number | null;
  name: string;
  variety: string | null;
  sowingDate: string | null;
  season: string | null;
  status: string;
}

export interface FarmerProfileView {
  profileId: string | null;
  fullName: string | null;
  farm: FarmView | null;
  crop: CropView | null;
  crops: CropView[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

function toCrop(c: any): CropView | null {
  if (!c) return null;
  const name = c.crop ?? c.crop_name;
  if (!name) return null;
  return {
    id: num(c.id),
    name: String(name),
    variety: c.variety ?? null,
    sowingDate: c.sowing_date ?? null,
    season: c.season ?? null,
    status: c.status ?? 'active',
  };
}

export function normalizeFarmerProfile(raw: any): FarmerProfileView | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw.farm ?? null;
  const npkSrc = (f?.soil_npk && typeof f.soil_npk === 'object') ? f.soil_npk : {};
  const farm: FarmView | null = f
    ? {
        id: num(f.id),
        name: f.name ?? f.farm_name ?? 'My farm',
        gridKey: f.grid_key ?? f.agromet_grid_id ?? null,
        soilType: f.soil_type ?? null,
        irrigationType: f.irrigation_type ?? null,
        fieldSizeAcres: num(f.field_size_acres),
        lat: num(f.lat),
        lon: num(f.lon),
        state: f.state ?? null,
        district: f.district ?? null,
        npk: {
          n: num(npkSrc.n ?? f.shc_n),
          p: num(npkSrc.p ?? f.shc_p),
          k: num(npkSrc.k ?? f.shc_k),
          ph: num(npkSrc.ph ?? f.shc_ph),
        },
      }
    : null;

  const rawCrops: any[] = Array.isArray(raw.crops) ? raw.crops : raw.crop ? [raw.crop] : [];
  const crops = rawCrops.map(toCrop).filter((c): c is CropView => c !== null);
  const crop = crops.find((c) => c.status === 'active') ?? crops[0] ?? null;

  return {
    profileId: raw.profile?.id ?? null,
    fullName: raw.profile?.full_name ?? null,
    farm,
    crop,
    crops,
  };
}

/** Human-friendly date ("27 Aug 2026") for an ISO date; returns the input if unparsable. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
