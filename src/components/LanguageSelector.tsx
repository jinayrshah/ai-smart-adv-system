import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' }
];

interface LanguageSelectorProps {
  variant?: 'forest' | 'light';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'forest' }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language.split('-')[0]) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  const buttonStyle = variant === 'forest'
    ? 'text-white/90 hover:text-accent hover:bg-white/10 border-white/20 bg-white/5'
    : 'text-ink hover:bg-tint border-line bg-white';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-1.5 px-3 py-1.5 transition-colors rounded-full border cursor-pointer text-xs shadow-2xs",
          buttonStyle
        )}
        aria-label="Select Language"
      >
        <Languages size={15} />
        <span className="text-xs font-bold">{currentLanguage.code}</span>
        <ChevronDown size={12} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
          <div
            className="lang-menu-in absolute right-0 mt-2 w-52 bg-white border border-line rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-2 space-y-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer",
                    i18n.language.split('-')[0] === lang.code
                      ? "bg-brand text-accent font-bold shadow-xs"
                      : "text-ink hover:bg-ground"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold">{lang.name}</span>
                    <span className="text-xs opacity-75">{lang.nativeName}</span>
                  </div>
                  {i18n.language.split('-')[0] === lang.code && (
                    <Check size={14} className="text-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>
      )}
    </div>
  );
};
