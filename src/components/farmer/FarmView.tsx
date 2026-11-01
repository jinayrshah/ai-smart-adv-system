import React, { useState } from 'react';
import { Loader2, LogOut, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { FarmerProfileView } from '../../lib/farmerProfile';
import { formatIsoDate } from '../../lib/farmerProfile';
import { LanguageSelector } from '../LanguageSelector';

const IRRIGATION: Record<string, string> = {
  borewell: 'Borewell / tubewell', canal: 'Canal', drip: 'Drip', sprinkler: 'Sprinkler', rainfed: 'Rainfed', other: 'Other',
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 py-3 border-b border-line last:border-0">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="text-ink font-medium text-right num">{v ?? <span className="text-ink-muted font-normal">Not added</span>}</dd>
    </div>
  );
}

/** One place for the farm, the crop and the account. */
export const FarmView: React.FC<{ farmView: FarmerProfileView | null; onEditFarm: () => void }> = ({ farmView, onEditFarm }) => {
  const { user, changePassword, logout } = useAuth();
  const farm = farmView?.farm;
  const crop = farmView?.crop;
  const npk = farm?.npk || {};
  const hasNpk = [npk.n, npk.p, npk.k, npk.ph].some((x) => x != null);

  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) return setPwMsg({ ok: false, text: 'New password needs at least 6 characters.' });
    setPwBusy(true);
    try {
      await changePassword(oldPw, newPw);
      setPwMsg({ ok: true, text: 'Password changed.' });
      setOldPw(''); setNewPw(''); setPwOpen(false);
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.message || 'Could not change the password.' });
    } finally {
      setPwBusy(false);
    }
  };

  const input = 'w-full h-12 rounded-xl border border-line bg-surface px-4 text-base';

  return (
    <div className="space-y-4 pb-28">
      <header className="pt-2 pb-2 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">{farmView?.fullName || user?.name || 'Your farm'}</h1>
          <p className="mt-1 text-ink-soft">{user?.identifier}</p>
        </div>
        <button onClick={onEditFarm} className="h-11 px-5 rounded-full bg-brand text-white font-semibold flex items-center gap-2 shrink-0">
          <Pencil size={16} aria-hidden /> Edit farm
        </button>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-surface rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink mb-2">Field</h2>
          <dl>
            <Row k="Name" v={farm?.name} />
            <Row k="Location" v={farm ? [farm.district, farm.state].filter(Boolean).join(', ') || null : null} />
            <Row k="Coordinates" v={farm?.lat != null && farm?.lon != null ? `${farm.lat.toFixed(4)}, ${farm.lon.toFixed(4)}` : null} />
            <Row k="Size" v={farm?.fieldSizeAcres != null ? `${farm.fieldSizeAcres} acres` : null} />
            <Row k="Irrigation" v={farm?.irrigationType ? IRRIGATION[farm.irrigationType] || farm.irrigationType : null} />
          </dl>
        </section>

        <section className="bg-surface rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink mb-2">Crop and soil</h2>
          <dl>
            <Row k="Crop" v={crop ? `${crop.name}${crop.variety ? ` (${crop.variety})` : ''}` : null} />
            <Row k="Sown" v={crop?.sowingDate ? formatIsoDate(crop.sowingDate) : crop ? 'Not sown yet' : null} />
            <Row k="Season" v={crop?.season ? crop.season[0].toUpperCase() + crop.season.slice(1) : null} />
            <Row k="Soil type" v={farm?.soilType} />
            <Row k="Soil test (N / P / K, pH)" v={hasNpk ? `${npk.n ?? '–'} / ${npk.p ?? '–'} / ${npk.k ?? '–'}, ${npk.ph ?? '–'}` : null} />
          </dl>
        </section>
      </div>

      <section className="bg-surface rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink mb-2">Account</h2>
        <div className="flex items-center justify-between gap-4 py-3 border-b border-line">
          <span className="text-ink-soft">Language</span>
          <LanguageSelector variant="light" />
        </div>
        <div className="py-3 border-b border-line">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink-soft">Password</span>
            <button onClick={() => { setPwOpen(!pwOpen); setPwMsg(null); }} className="text-brand font-medium underline underline-offset-4">
              {pwOpen ? 'Cancel' : 'Change'}
            </button>
          </div>
          {pwOpen && (
            <form onSubmit={savePw} className="mt-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3">
              <div>
                <label htmlFor="pw-old" className="sr-only">Current password</label>
                <input id="pw-old" type="password" placeholder="Current password" autoComplete="current-password" className={input} value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
              </div>
              <div>
                <label htmlFor="pw-new" className="sr-only">New password</label>
                <input id="pw-new" type="password" placeholder="New password" autoComplete="new-password" className={input} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <button disabled={pwBusy} className="h-12 px-5 rounded-full bg-brand text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {pwBusy && <Loader2 size={16} className="animate-spin" />} Save
              </button>
            </form>
          )}
          {pwMsg && <p role="status" className={`mt-2 text-sm ${pwMsg.ok ? 'text-good' : 'text-bad'}`}>{pwMsg.text}</p>}
        </div>
        <button onClick={logout} className="mt-3 h-11 px-4 -ml-4 rounded-full text-bad font-medium flex items-center gap-2 hover:bg-bad-bg">
          <LogOut size={18} aria-hidden /> Sign out
        </button>
      </section>
    </div>
  );
};
