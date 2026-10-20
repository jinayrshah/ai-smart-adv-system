import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import {
  User as UserIcon,
  MapPin,
  Sprout,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Edit3,
  Save,
  X,
  BarChart2,
  Droplets,
  Leaf,
  Sun,
  Calendar,
  Settings,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { normalizeFarmerProfile, formatIsoDate } from '../../lib/farmerProfile';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ProfileSettings: React.FC<{ onEditFarm?: () => void; farmerProfile?: any }> = ({ onEditFarm, farmerProfile: farmerProfileProp }) => {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword, logout } = useAuth();

  // Use prop if available, else fall back to localStorage
  const farmerProfile = farmerProfileProp ?? (() => {
    try {
      const saved = localStorage.getItem('farmer_onboarding_profile');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })();
  const farmView = React.useMemo(() => normalizeFarmerProfile(farmerProfile), [farmerProfile]);

  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [location, setLocation] = useState(user?.location || '');
  const [farmType, setFarmType] = useState(user?.farmType || farmView?.crop?.name || 'Mixed');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name || '');
    setLocation(user?.location || '');
    setFarmType(user?.farmType || farmView?.crop?.name || 'Mixed');
  }, [user, farmView]);

  const handleProfileUpdate = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setProfileLoading(true); setProfileError(null); setProfileSuccess(null);
    try {
      await updateProfile({ name, location, farmType });

      // Also sync profile changes into farmer_onboarding_profile so other
      // components (advisor, weather, home) pick up updated name/location
      try {
        const saved = localStorage.getItem('farmer_onboarding_profile');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.profile) {
            data.profile.full_name = name;
          }
          localStorage.setItem('farmer_onboarding_profile', JSON.stringify(data));
        }
      } catch {}

      setProfileSuccess('Profile updated successfully!');
      setEditingProfile(false);
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) { setProfileError(err.message); }
    finally { setProfileLoading(false); }
  };

  const handlePasswordChange = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return; }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
    setPasswordLoading(true); setPasswordError(null); setPasswordSuccess(null);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) { setPasswordError(err.message); }
    finally { setPasswordLoading(false); }
  };

  const avatarInitials = (user?.name || user?.identifier || 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const accountIcon = user?.type === 'mobile' ? <Phone size={13} /> : <Mail size={13} />;
  const accountTypeLabel = user?.type === 'mobile' ? 'Mobile Account' : 'Email Account';

  const farm = farmView?.farm;
  const crop = farmView?.crop;

  const stats = [
    { icon: <Leaf size={15} />, label: 'Active Crop', value: crop?.name || 'Not set' },
    { icon: <MapPin size={15} />, label: 'Location', value: farm?.district ? `${farm.district}, ${farm.state}` : (user?.location || 'Not set') },
    { icon: <BarChart2 size={15} />, label: 'Field Size', value: farm?.fieldSizeAcres ? `${farm.fieldSizeAcres} ac` : 'Not set' },
    { icon: <Droplets size={15} />, label: 'Irrigation', value: farm?.irrigationType || 'Not set' },
  ];

  return (
    <div className="space-y-5 pb-24 max-w-2xl mx-auto">

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative bg-[#07503f] rounded-[28px] overflow-hidden shadow-lg"
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#e8fe85]/10 translate-x-20 -translate-y-20" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-[#b2cee7]/10 -translate-x-10 translate-y-10" />
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-[72px] h-[72px] rounded-2xl bg-[#e8fe85] text-[#07503f] flex items-center justify-center font-bold text-2xl shadow-lg shrink-0 border-4 border-white/20 font-serif">
                {avatarInitials}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-serif text-white leading-tight">
                  {user?.name || 'Farmer Profile'}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[#e8fe85]">{accountIcon}</span>
                  <span className="text-[#e8fe85]/80 text-xs font-mono truncate max-w-[200px]">{user?.identifier}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[10px] font-mono font-medium">
                    {accountIcon} {accountTypeLabel}
                  </span>
                  {user?.role === 'admin' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e8fe85] text-[#07503f] text-[10px] font-mono font-bold">Admin</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-medium transition-all border border-white/20 cursor-pointer shrink-0"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-3 border border-white/10">
                <span className="text-[#e8fe85]">{s.icon}</span>
                <p className="text-white font-semibold text-sm mt-1 truncate leading-tight">{s.value}</p>
                <p className="text-[#e8fe85]/60 text-[9px] font-mono uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Farm Overview */}
      {farm && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white rounded-[24px] border border-[#c3cda7] overflow-hidden shadow-sm"
        >
          <div className="p-5 bg-[#f1efdf] border-b border-[#c3cda7] flex items-center gap-2">
            <Sprout size={17} className="text-[#07503f]" />
            <h2 className="text-sm font-bold font-serif text-[#07503f]">Farm Overview</h2>
            {onEditFarm && (
              <button
                type="button"
                onClick={onEditFarm}
                className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#07503f] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all hover:bg-[#0d6e57] cursor-pointer"
              >
                <Edit3 size={12} /> Edit Farm
              </button>
            )}
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileInfoRow icon={<Sprout size={13} />} label="Farm Name" value={farm.name} />
            {farm.state && <ProfileInfoRow icon={<MapPin size={13} />} label="State" value={farm.state} />}
            {farm.district && <ProfileInfoRow icon={<MapPin size={13} />} label="District" value={farm.district} />}
            {farm.soilType && <ProfileInfoRow icon={<BarChart2 size={13} />} label="Soil Type" value={farm.soilType} />}
            {farm.irrigationType && <ProfileInfoRow icon={<Droplets size={13} />} label="Irrigation Type" value={farm.irrigationType} />}
            {farm.fieldSizeAcres && <ProfileInfoRow icon={<BarChart2 size={13} />} label="Field Size" value={`${farm.fieldSizeAcres} acres`} />}
            {farm.npk && (farm.npk.n != null || farm.npk.p != null) && (
              <ProfileInfoRow
                icon={<Sun size={13} />}
                label="Soil Test (NPK)"
                value={`N: ${farm.npk.n ?? '—'}  P: ${farm.npk.p ?? '—'}  K: ${farm.npk.k ?? '—'}${farm.npk.ph != null ? `  pH: ${farm.npk.ph}` : ''}`}
              />
            )}
            {farm.gridKey && <ProfileInfoRow icon={<Sun size={13} />} label="Agromet Grid" value={farm.gridKey} />}
          </div>
        </motion.div>
      )}

      {/* Active Crop */}
      {crop && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="bg-white rounded-[24px] border border-[#c3cda7] overflow-hidden shadow-sm"
        >
          <div className="p-5 bg-[#f1efdf] border-b border-[#c3cda7] flex items-center gap-2">
            <Leaf size={17} className="text-[#07503f]" />
            <h2 className="text-sm font-bold font-serif text-[#07503f]">Active Crop</h2>
            <span className="ml-auto px-2.5 py-0.5 rounded-full bg-[#07503f] text-white text-[9px] font-mono font-bold uppercase">{crop.status}</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileInfoRow icon={<Leaf size={13} />} label="Crop" value={crop.name} />
            {crop.variety && <ProfileInfoRow icon={<Leaf size={13} />} label="Variety" value={crop.variety} />}
            {crop.sowingDate && <ProfileInfoRow icon={<Calendar size={13} />} label="Sowing Date" value={formatIsoDate(crop.sowingDate)} />}
            {crop.season && <ProfileInfoRow icon={<Sun size={13} />} label="Season" value={crop.season} />}
          </div>
        </motion.div>
      )}

      {/* Account Settings */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white rounded-[24px] border border-[#c3cda7] overflow-hidden shadow-sm"
      >
        <div className="p-5 bg-[#f1efdf] border-b border-[#c3cda7] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings size={17} className="text-[#07503f]" />
            <h2 className="text-sm font-bold font-serif text-[#07503f]">Account Settings</h2>
          </div>
          {!editingProfile && (
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#07503f] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all hover:bg-[#0d6e57] cursor-pointer"
            >
              <Edit3 size={13} /> Edit
            </button>
          )}
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          {editingProfile ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-semibold text-[#555e4a] uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]" size={14} />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-11 pr-4 text-[#212529] focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors text-sm font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-semibold text-[#555e4a] uppercase tracking-widest ml-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]" size={14} />
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                      placeholder="City / village"
                      className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-11 pr-4 text-[#212529] focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors text-sm font-mono" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-semibold text-[#555e4a] uppercase tracking-widest ml-1">Farm Type</label>
                <div className="relative">
                  <Sprout className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]" size={14} />
                  <select value={farmType} onChange={(e) => setFarmType(e.target.value)}
                    className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-11 pr-4 text-[#212529] focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors text-sm font-mono appearance-none">
                    <option value="Wheat">Wheat Farming (गेहूं)</option>
                    <option value="Rice">Rice / Paddy (धान)</option>
                    <option value="Cotton">Cotton Farming (कपास)</option>
                    <option value="Soybean">Soybean Farming (सोयाबीन)</option>
                    <option value="Tomato">Tomato / Vegetable (टमाटर)</option>
                    <option value="Maize">Maize Farming (मक्का)</option>
                    <option value="Mustard">Mustard Farming (सरसों)</option>
                    <option value="Onion">Onion Farming (प्याज़)</option>
                    <option value="Groundnut">Groundnut Farming (मूंगफली)</option>
                    <option value="Chickpea">Chickpea / Gram (चना)</option>
                    <option value="Mixed">Mixed Farming</option>
                  </select>
                </div>
              </div>
              {profileError && (
                <div className="flex items-center gap-2 text-rose-700 text-xs font-mono bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
                  <AlertCircle size={14} className="shrink-0" /><span>{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div className="flex items-center gap-2 text-[#07503f] text-xs font-mono bg-[#e6ecd5] p-3.5 rounded-2xl border border-[#c3cda7]">
                  <CheckCircle2 size={14} className="shrink-0" /><span>{profileSuccess}</span>
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={handleProfileUpdate} disabled={profileLoading}
                  className="flex-1 bg-[#07503f] hover:bg-[#064234] text-[#e8fe85] disabled:opacity-50 font-mono text-xs font-bold uppercase tracking-wider py-3 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                  {profileLoading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={13} />Save Changes</>}
                </button>
                <button type="button" onClick={() => { setEditingProfile(false); setProfileError(null); }}
                  className="px-5 py-3 rounded-full border border-[#c3cda7] text-[#555e4a] hover:bg-[#f1efdf] font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1">
                  <X size={13} /> Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileInfoRow icon={<UserIcon size={13} />} label="Full Name" value={user?.name || '—'} />
              <ProfileInfoRow icon={<MapPin size={13} />} label="Location" value={user?.location || '—'} />
              <ProfileInfoRow icon={<Sprout size={13} />} label="Farm Type" value={user?.farmType || '—'} />
              <ProfileInfoRow icon={accountIcon} label="Account" value={user?.identifier || '—'} />
              {profileSuccess && (
                <div className="col-span-full flex items-center gap-2 text-[#07503f] text-xs font-mono bg-[#e6ecd5] p-3.5 rounded-2xl border border-[#c3cda7]">
                  <CheckCircle2 size={14} className="shrink-0" /><span>{profileSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Security / Password */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="bg-white rounded-[24px] border border-[#c3cda7] overflow-hidden shadow-sm"
      >
        <div className="p-5 bg-[#f1efdf] border-b border-[#c3cda7] flex items-center gap-2">
          <Shield size={17} className="text-[#07503f]" />
          <h2 className="text-sm font-bold font-serif text-[#07503f]">Security</h2>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs text-[#6d6d6d] font-mono">Update your password. Minimum 6 characters.</p>
          <ProfilePasswordInput label="Current Password" value={oldPassword} onChange={setOldPassword} show={showPasswords} onToggle={() => setShowPasswords(!showPasswords)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ProfilePasswordInput label="New Password" value={newPassword} onChange={setNewPassword} show={showPasswords} onToggle={() => setShowPasswords(!showPasswords)} showToggle={false} />
            <ProfilePasswordInput label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} show={showPasswords} onToggle={() => setShowPasswords(!showPasswords)} showToggle={false} />
          </div>
          {passwordError && (
            <div className="flex items-center gap-2 text-rose-700 text-xs font-mono bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
              <AlertCircle size={14} className="shrink-0" /><span>{passwordError}</span>
            </div>
          )}
          {passwordSuccess && (
            <div className="flex items-center gap-2 text-[#07503f] text-xs font-mono bg-[#e6ecd5] p-3.5 rounded-2xl border border-[#c3cda7]">
              <CheckCircle2 size={14} className="shrink-0" /><span>{passwordSuccess}</span>
            </div>
          )}
          <button type="button" onClick={handlePasswordChange}
            disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}
            className="w-full bg-[#07503f] hover:bg-[#064234] text-[#e8fe85] disabled:opacity-40 font-mono text-xs font-bold uppercase tracking-wider py-3 rounded-full transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer">
            {passwordLoading ? <Loader2 className="animate-spin" size={16} /> : <><Lock size={13} />Change Password</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

function ProfileInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="text-[#07503f] mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-mono font-semibold text-[#6d6d6d] uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-[#212529] mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function ProfilePasswordInput({ label, value, onChange, show, onToggle, showToggle = true }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; showToggle?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono font-semibold text-[#555e4a] uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]" size={13} />
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-11 pr-10 text-[#212529] placeholder:text-[#555e4a]/50 focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors text-sm font-mono" />
        {showToggle && (
          <button type="button" onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555e4a] hover:text-[#212529] transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

