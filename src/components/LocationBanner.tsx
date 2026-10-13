import React from 'react';
import { MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocationBannerProps {
  show: boolean;
  onClose: () => void;
  error?: string | null;
  denied?: boolean;
}

export const LocationBanner: React.FC<LocationBannerProps> = ({ show, onClose, error, denied }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-950/40 border-b border-amber-500/30 overflow-hidden font-mono"
        >
          <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <MapPin size={14} className="text-amber-400" />
              </div>
              <p className="text-xs text-amber-200">
                <span className="font-bold text-amber-300">
                  {denied ? "Location access denied." : "Location notice."}
                </span> {error || "Defaulting to representative agro-climatic region."}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/5 rounded-full transition-colors text-amber-400 hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
