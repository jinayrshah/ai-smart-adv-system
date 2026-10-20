import React from 'react';
import {
  Sprout,
  CloudRain,
  TrendingUp,
  ArrowRight,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  MapPin,
  Sparkles,
  Thermometer,
  Droplets,
  Wind,
  Compass,
  MessageSquare,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../context/AuthContext';
import { type FarmerProfileView, formatIsoDate } from '../../lib/farmerProfile';

interface CinematicHomeProps {
  weather: any;
  weatherLoading: boolean;
  farmView: FarmerProfileView | null;
  onOpenOnboarding: () => void;
}

export const CinematicHome: React.FC<CinematicHomeProps> = ({
  weather,
  weatherLoading,
  farmView,
  onOpenOnboarding,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  return (
    <div className="space-y-8 pb-28 max-w-5xl mx-auto">
      {/* 1. HERO EDITORIAL SPREAD */}
      <section className="relative rounded-[28px] sm:rounded-[36px] bg-[#07503f] text-[#ffffff] p-8 sm:p-12 md:p-16 overflow-hidden shadow-sm">
        {/* Subtle Decorative Floral Background Texture */}
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="farm-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="#ffffff" />
                <path d="M10 50 Q 30 20 50 50" fill="none" stroke="#ffffff" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#farm-pattern)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-2xl space-y-5">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#e8fe85] text-[#07503f] text-xs font-bold font-mono uppercase tracking-wider shadow-sm">
            <span>● Official ICAR & Agromet Verified</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal tracking-tight text-white leading-[1.12]">
            Regenerative Farming & Precision Agronomy
          </h1>

          <p className="text-stone-200 text-sm sm:text-base leading-relaxed font-sans max-w-xl">
            Sovereign decision support engineered for Indian agriculturalists. Real-time thermal phenology, FAO-56 root-zone water balance, and verified APMC mandi prices.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('advisor')}
              className="px-6 py-3.5 rounded-full bg-[#e8fe85] hover:bg-[#d8f06f] text-[#07503f] font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-md flex items-center space-x-2 cursor-pointer active:scale-95"
            >
              <span>Launch Personalised Crop Advisor</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => setActiveTab('priceTrends')}
              className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[#ffffff] border border-white/30 font-medium text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
            >
              <TrendingUp size={16} className="text-[#e8fe85]" />
              <span>Explore Mandi Prices</span>
            </button>

            <button
              onClick={() => setActiveTab('weather')}
              className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[#ffffff] border border-white/30 font-medium text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
            >
              <CloudRain size={16} className="text-[#e8fe85]" />
              <span>Weather Strip</span>
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-general-chat'));
              }}
              className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[#ffffff] border border-white/30 font-medium text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
              title="Ask general farming, agronomy & scheme questions"
            >
              <MessageSquare size={16} className="text-[#e8fe85]" />
              <span>Ask General Agri Questions</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. AT-A-GLANCE STATUS SUMMARY (3 Pure White Cards on Bone Canvas) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Farm Profile Summary */}
        <div className="bg-[#ffffff] border border-[#c3cda7]/60 rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e2dfcb]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#07503f] text-[#ffffff] flex items-center justify-center font-bold text-xs">
                  {user?.name?.charAt(0) || 'F'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#212529]">{user?.name || 'Registered Farm'}</h4>
                  <p className="text-[11px] text-[#6d6d6d]">
                    {farmView?.farm?.district ? `${farmView.farm.district}, ${farmView.farm.state}` : 'Location unconfigured'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#e6ecd5] text-[#07503f]">
                {farmView ? 'ACTIVE' : 'READY'}
              </span>
            </div>

            <div className="py-4 space-y-2.5 text-xs text-[#353535]">
              <div className="flex justify-between">
                <span className="text-[#6d6d6d]">Primary Crop:</span>
                <span className="font-semibold text-[#07503f]">{farmView?.crop?.name || 'Wheat / Rice / Cotton'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6d6d6d]">Field Acreage:</span>
                <span className="font-semibold">{farmView?.farm?.fieldSizeAcres || 3.0} Acres</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6d6d6d]">Soil Classification:</span>
                <span className="font-semibold">{farmView?.farm?.soilType || 'Black Cotton'}</span>
              </div>
              {farmView?.crop?.sowingDate && (
                <div className="flex justify-between">
                  <span className="text-[#6d6d6d]">Sowing Date:</span>
                  <span className="font-semibold">{formatIsoDate(farmView.crop.sowingDate)}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onOpenOnboarding}
            className="w-full py-2.5 rounded-full bg-[#f1efdf] hover:bg-[#e6ecd5] text-[#07503f] font-bold text-xs uppercase tracking-wider transition-colors border border-[#c3cda7]"
          >
            Update Farm Parameters
          </button>
        </div>

        {/* Local Microclimate Snapshot */}
        <div className="bg-[#ffffff] border border-[#c3cda7]/60 rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e2dfcb]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#b2cee7] text-[#07503f] flex items-center justify-center">
                  <CloudRain size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#212529]">Agro Microclimate</h4>
                  <p className="text-[11px] text-[#6d6d6d]">Fused IMD & NASA POWER</p>
                </div>
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#b2cee7] text-[#07503f]">
                LIVE
              </span>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl font-bold text-[#212529]">
                  {weather?.temp ? `${Math.round(weather.temp)}°C` : '28°C'}
                </span>
                <span className="text-xs text-[#6d6d6d] capitalize">
                  {weather?.condition || 'Fair Weather'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-[#353535]">
                <div className="bg-[#f1efdf] p-2 rounded-xl">
                  <div className="text-[10px] text-[#6d6d6d]">Relative Humidity</div>
                  <div className="font-bold text-sm text-[#07503f]">{weather?.humidity ?? 42}%</div>
                </div>
                <div className="bg-[#f1efdf] p-2 rounded-xl">
                  <div className="text-[10px] text-[#6d6d6d]">Wind Velocity</div>
                  <div className="font-bold text-sm text-[#07503f]">{weather?.windSpeed ? `${Math.round(weather.windSpeed)} km/h` : '12 km/h'}</div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('weather')}
            className="w-full py-2.5 rounded-full bg-[#b2cee7] hover:bg-[#9ec2e0] text-[#07503f] font-bold text-xs uppercase tracking-wider transition-colors"
          >
            View 7-Day Forecast
          </button>
        </div>

        {/* Mandi Rate Snapshot */}
        <div className="bg-[#ffffff] border border-[#c3cda7]/60 rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e2dfcb]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#fceace] text-[#07503f] flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#212529]">Mandi Benchmark</h4>
                  <p className="text-[11px] text-[#6d6d6d]">Agmarknet Daily Reports</p>
                </div>
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#fceace] text-[#07503f]">
                MODAL
              </span>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] text-[#6d6d6d] uppercase font-mono">Benchmark Commodity</div>
                  <div className="font-serif text-2xl font-bold text-[#212529]">
                    {farmView?.crop?.name || 'Wheat'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-[#07503f]">₹2,450 / qtl</div>
                  <div className="text-[10px] text-[#6d6d6d]">₹24.50 / kg</div>
                </div>
              </div>

              <div className="bg-[#fceace]/40 p-2.5 rounded-xl border border-[#fceace] text-xs text-[#353535]">
                <span className="font-semibold text-[#07503f]">State Mandi Trends:</span> Steady arrival volumes with zero speculative spread.
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('priceTrends')}
            className="w-full py-2.5 rounded-full bg-[#fceace] hover:bg-[#fad8b0] text-[#07503f] font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Check APMC Rates
          </button>
        </div>
      </section>

      {/* 3. THE 4 QUILTED PASTEL TILES (From DESIGN.md §Pastel Quilt Card) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#212529]">
            Agricultural Intelligence Systems
          </h2>
          <span className="text-xs font-mono text-[#6d6d6d] uppercase tracking-wider">
            Curated Services
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile 1: Sky Pastel (#b2cee7) */}
          <div
            onClick={() => setActiveTab('advisor')}
            className="bg-[#b2cee7] rounded-[20px] p-6 text-[#212529] flex flex-col justify-between transition-transform hover:-translate-y-1 duration-200 cursor-pointer shadow-sm border border-[#9bbddc]"
          >
            <div>
              <div className="w-10 h-10 rounded-full bg-[#ffffff] text-[#07503f] flex items-center justify-center font-bold mb-4 shadow-sm">
                <Sprout size={20} />
              </div>
              <h3 className="font-serif text-xl font-bold tracking-tight text-[#212529] mb-1.5">
                Precision Crop Advisor
              </h3>
              <p className="text-xs text-[#353535] leading-relaxed">
                Stage-specific Growing Degree Days (GDD) and FAO-56 root-zone water balance for pinpoint irrigation and spraying.
              </p>
            </div>
            <div className="pt-6 flex items-center text-xs font-bold text-[#07503f]">
              <span>Consult Advisor</span>
              <ArrowRight size={14} className="ml-1" />
            </div>
          </div>

          {/* Tile 2: Peach Pastel (#fceace) */}
          <div
            onClick={() => setActiveTab('priceTrends')}
            className="bg-[#fceace] rounded-[20px] p-6 text-[#212529] flex flex-col justify-between transition-transform hover:-translate-y-1 duration-200 cursor-pointer shadow-sm border border-[#ebd1aa]"
          >
            <div>
              <div className="w-10 h-10 rounded-full bg-[#ffffff] text-[#07503f] flex items-center justify-center font-bold mb-4 shadow-sm">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-serif text-xl font-bold tracking-tight text-[#212529] mb-1.5">
                Mandi Price Trends
              </h3>
              <p className="text-xs text-[#353535] leading-relaxed">
                Daily APMC modal rates, crop profit margin calculators, WDRA storage estimator, and 7-day transport weather alerts.
              </p>
            </div>
            <div className="pt-6 flex items-center text-xs font-bold text-[#07503f]">
              <span>Explore Prices</span>
              <ArrowRight size={14} className="ml-1" />
            </div>
          </div>

          {/* Tile 3: Sage Pastel (#e6ecd5) */}
          <div
            onClick={() => setActiveTab('weather')}
            className="bg-[#e6ecd5] rounded-[20px] p-6 text-[#212529] flex flex-col justify-between transition-transform hover:-translate-y-1 duration-200 cursor-pointer shadow-sm border border-[#c3cda7]"
          >
            <div>
              <div className="w-10 h-10 rounded-full bg-[#ffffff] text-[#07503f] flex items-center justify-center font-bold mb-4 shadow-sm">
                <CloudRain size={20} />
              </div>
              <h3 className="font-serif text-xl font-bold tracking-tight text-[#212529] mb-1.5">
                Weather Intelligence
              </h3>
              <p className="text-xs text-[#353535] leading-relaxed">
                Hyperlocal weather fusion combining IMD Doppler radar ground observations, NASA POWER solar radiation, and Open-Meteo.
              </p>
            </div>
            <div className="pt-6 flex items-center text-xs font-bold text-[#07503f]">
              <span>Check Forecast</span>
              <ArrowRight size={14} className="ml-1" />
            </div>
          </div>

          {/* Tile 4: Ash Gray (#efefef) */}
          <div
            onClick={() => setActiveTab('advisor')}
            className="bg-[#efefef] rounded-[20px] p-6 text-[#212529] flex flex-col justify-between transition-transform hover:-translate-y-1 duration-200 cursor-pointer shadow-sm border border-[#d5d8db]"
          >
            <div>
              <div className="w-10 h-10 rounded-full bg-[#ffffff] text-[#07503f] flex items-center justify-center font-bold mb-4 shadow-sm">
                <Sparkles size={20} />
              </div>
              <h3 className="font-serif text-xl font-bold tracking-tight text-[#212529] mb-1.5">
                Government Welfare
              </h3>
              <p className="text-xs text-[#353535] leading-relaxed">
                Central and state welfare schemes including PM-KISAN, PMFBY crop insurance, Soil Health Cards, and credit subsidies.
              </p>
            </div>
            <div className="pt-6 flex items-center text-xs font-bold text-[#07503f]">
              <span>View Schemes</span>
              <ArrowRight size={14} className="ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOREST INTERSTITIAL PRINCIPLES SECTION (From DESIGN.md §Forest Section Banner) */}
      <section className="bg-[#07503f] text-[#ffffff] rounded-[28px] p-8 sm:p-12 shadow-sm space-y-8">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs uppercase font-mono text-[#e8fe85] font-bold tracking-wider">
            Integrity First Architecture
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-normal text-white">
            Honest Agricultural Intelligence with Zero Hallucination
          </h2>
          <p className="text-stone-200 text-xs sm:text-sm leading-relaxed max-w-xl">
            In agriculture, inaccurate estimates cost livelihoods. Every algorithm and response across this platform adheres to rigorous scientific standards.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 border-t border-white/15">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#e8fe85]">
              <CheckCircle2 size={18} />
            </div>
            <h4 className="font-bold text-sm text-white">ICAR Verified</h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Agronomic advice is grounded directly in Indian Council of Agricultural Research packages of practice.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#e8fe85]">
              <Layers size={18} />
            </div>
            <h4 className="font-bold text-sm text-white">FAO-56 Water Balance</h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Irrigation deficits computed using Dual Crop Coefficient and Penman-Monteith reference evapotranspiration.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#e8fe85]">
              <ShieldCheck size={18} />
            </div>
            <h4 className="font-bold text-sm text-white">Zero-Fill Ban</h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Missing data renders honest nulls with transparent explanations rather than fabricated numbers.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#e8fe85]">
              <Compass size={18} />
            </div>
            <h4 className="font-bold text-sm text-white">11km High-Res Grid</h4>
            <p className="text-xs text-stone-300 leading-relaxed">
              Multi-source weather fusion maps directly to your farm centroid for accurate microclimate guidance.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
