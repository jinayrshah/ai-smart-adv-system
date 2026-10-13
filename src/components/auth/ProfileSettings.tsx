import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { User as UserIcon, MapPin, Sprout, Lock, Eye, EyeOff, Loader2, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ProfileSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword, logout } = useAuth();
  
  // Profile State
  const [name, setName] = useState(user?.name || '');
  const [location, setLocation] = useState(user?.location || '');
  const [farmType, setFarmType] = useState(user?.farmType || 'Vegetable');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleProfileUpdate = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      await updateProfile({ name, location, farmType });
      setProfileSuccess(t('common.success'));
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.error'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('auth.error'));
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess(t('common.success'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold font-serif text-stone-100">{t('profile.settings')}</h2>
        <button 
          onClick={logout}
          className="flex items-center space-x-2 px-4 py-2 rounded-full bg-rose-950/40 text-rose-300 border border-rose-800/50 text-xs font-mono uppercase tracking-wider hover:bg-rose-900/60 transition-all shadow-sm"
        >
          <LogOut size={14} />
          <span>{t('common.logout')}</span>
        </button>
      </div>

      {/* Profile Information */}
      <div className="bg-[#111827] rounded-3xl border border-stone-800 overflow-hidden shadow-xl">
        <div className="p-6 bg-[#07503f]/20 border-b border-stone-800">
          <h3 className="text-lg font-bold font-serif text-stone-100 flex items-center">
            <UserIcon className="mr-2 text-[#e8fe85]" size={20} />
            {t('profile.personalInfo')}
          </h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest ml-1">{t('profile.fullName')}</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 pl-12 pr-4 text-stone-200 focus:outline-none focus:border-[#e8fe85] transition-colors text-xs font-mono shadow-inner"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest ml-1">{t('profile.location')}</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 pl-12 pr-4 text-stone-200 focus:outline-none focus:border-[#e8fe85] transition-colors text-xs font-mono shadow-inner"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest ml-1">{t('profile.farmType')}</label>
            <div className="relative">
              <Sprout className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <select 
                value={farmType}
                onChange={(e) => setFarmType(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 pl-12 pr-4 text-stone-200 focus:outline-none focus:border-[#e8fe85] transition-colors text-xs font-mono appearance-none shadow-inner"
              >
                <option value="Vegetable">Vegetable Farming</option>
                <option value="Fruit">Fruit Orchard</option>
                <option value="Grain">Grain/Cereal Production</option>
                <option value="Greenhouse">Greenhouse/Hydroponics</option>
                <option value="Mixed">Mixed Farming</option>
              </select>
            </div>
          </div>

          {profileError && (
            <div className="flex items-center space-x-2 text-rose-300 text-xs font-mono bg-rose-950/40 p-3 rounded-2xl border border-rose-800">
              <AlertCircle size={14} />
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="flex items-center space-x-2 text-[#e8fe85] text-xs font-mono bg-[#07503f]/40 p-3 rounded-2xl border border-[#07503f]">
              <CheckCircle2 size={14} />
              <span>{profileSuccess}</span>
            </div>
          )}

          <button 
            type="button"
            onClick={handleProfileUpdate}
            disabled={profileLoading}
            className="w-full bg-[#07503f] hover:bg-[#0c6b54] text-[#f1efdf] disabled:opacity-50 font-mono text-xs font-bold uppercase tracking-wider py-3.5 rounded-full border border-[#e8fe85]/30 shadow-lg shadow-[#07503f]/40 transition-all flex items-center justify-center space-x-2"
          >
            {profileLoading ? <Loader2 className="animate-spin text-[#e8fe85]" size={18} /> : t('profile.updateProfile')}
          </button>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-[#111827] rounded-3xl border border-stone-800 overflow-hidden shadow-xl">
        <div className="p-6 bg-[#07503f]/20 border-b border-stone-800">
          <h3 className="text-lg font-bold font-serif text-stone-100 flex items-center">
            <Lock className="mr-2 text-amber-400" size={20} />
            {t('profile.security')}
          </h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest ml-1">{t('profile.currentPassword')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input 
                type={showPasswords ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 pl-12 pr-12 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-[#e8fe85] transition-colors text-xs font-mono shadow-inner"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
              >
                {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest ml-1">{t('auth.newPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 pl-12 pr-4 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-[#e8fe85] transition-colors text-xs font-mono shadow-inner"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest ml-1">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-900 border border-stone-800 rounded-full py-2.5 pl-12 pr-4 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-[#e8fe85] transition-colors text-xs font-mono shadow-inner"
                  required
                />
              </div>
            </div>
          </div>

          {passwordError && (
            <div className="flex items-center space-x-2 text-rose-300 text-xs font-mono bg-rose-950/40 p-3 rounded-2xl border border-rose-800">
              <AlertCircle size={14} />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center space-x-2 text-[#e8fe85] text-xs font-mono bg-[#07503f]/40 p-3 rounded-2xl border border-[#07503f]">
              <CheckCircle2 size={14} />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <button 
            type="button"
            onClick={handlePasswordChange}
            disabled={passwordLoading}
            className="w-full bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 disabled:opacity-50 font-mono text-xs font-bold uppercase tracking-wider py-3.5 rounded-full transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer"
          >
            {passwordLoading ? <Loader2 className="animate-spin text-[#e8fe85]" size={18} /> : t('profile.changePassword')}
          </button>
        </div>
      </div>
    </div>
  );
};
