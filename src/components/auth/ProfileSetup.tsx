import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { User, MapPin, Sprout, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ProfileSetup: React.FC = () => {
  const { t } = useTranslation();
  const { updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [farmType, setFarmType] = useState('Vegetable');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setLoading(true);
    setError(null);
    try {
      await updateProfile({ name, location, farmType });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1efdf] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white border border-[#c3cda7] rounded-3xl p-8 shadow-xl"
      >
        <div className="text-left mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-serif font-bold text-[#07503f]">{t('profile.completeProfile')}</h1>
            {useAuth().user?.id?.startsWith('demo-user') && (
              <span className="text-[9px] font-mono font-bold bg-[#07503f] text-[#e8fe85] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {t('auth.demoMode')}
              </span>
            )}
          </div>
          <p className="text-[#555e4a] text-xs font-mono">
            {t('profile.profileDesc')}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#555e4a] font-semibold mb-2">
              {t('profile.fullName')}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]">
                <User size={16} />
              </div>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-12 pr-4 text-[#212529] text-xs font-mono focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors shadow-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#555e4a] font-semibold mb-2">
              {t('profile.location')}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]">
                <MapPin size={16} />
              </div>
              <input 
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter your region"
                className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-12 pr-4 text-[#212529] text-xs font-mono focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors shadow-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#555e4a] font-semibold mb-2">
              {t('profile.farmType')}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555e4a]">
                <Sprout size={16} />
              </div>
              <select 
                value={farmType}
                onChange={(e) => setFarmType(e.target.value)}
                className="w-full bg-[#f1efdf] border border-[#c3cda7] rounded-full py-2.5 pl-12 pr-4 text-[#212529] text-xs font-mono focus:outline-none focus:border-[#07503f] focus:bg-white transition-colors appearance-none shadow-xs"
              >
                <option value="Vegetable">Vegetable Farming</option>
                <option value="Fruit">Fruit Orchard</option>
                <option value="Grain">Grain/Cereal Production</option>
                <option value="Greenhouse">Greenhouse/Hydroponics</option>
                <option value="Mixed">Mixed Farming</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-rose-700 text-xs bg-rose-50 p-3 rounded-2xl border border-rose-200 font-mono">
              {error}
            </p>
          )}

          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name || !location}
            className="w-full bg-[#07503f] hover:bg-[#064234] disabled:opacity-50 text-[#e8fe85] text-xs font-mono font-bold uppercase tracking-wider py-3.5 rounded-full flex items-center justify-center space-x-2 transition-all shadow-sm cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin text-[#e8fe85]" size={18} /> : (
              <>
                <span>{t('profile.saveContinue')}</span>
                <ArrowRight size={16} className="text-[#e8fe85]" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
