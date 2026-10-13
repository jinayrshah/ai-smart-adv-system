import React, { useState, useEffect, useMemo } from 'react';
import { Logo } from './components/Logo';
import { ChatWidget } from './components/ChatWidget';
import { 
  Sprout, 
  CloudRain, 
  Home, 
  User, 
  RefreshCw, 
  ArrowRight,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Compass,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initKnowledgeBase } from './services/ragService';
import { WeatherStrip } from './components/weather/WeatherStrip';
import { MarketDataView, type MarketSelection } from './components/market/MarketDataView';
import { MandiExplore } from './components/market/MandiExplore';
import { useLocation } from './hooks/useLocation';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppContext';
import { Login } from './components/auth/Login';
import { ProfileSetup } from './components/auth/ProfileSetup';
import { ProfileSettings } from './components/auth/ProfileSettings';
import { LocationBanner } from './components/LocationBanner';
import { LanguageSelector } from './components/LanguageSelector';
import { FarmerOnboardingModal } from './components/farmer/FarmerOnboardingModal';
import { FarmDiagnosticCard } from './components/farmer/FarmDiagnosticCard';
import { AdvisoryChatCard } from './components/farmer/AdvisoryChatCard';
import { GovernmentSchemesCard } from './components/farmer/GovernmentSchemesCard';
import { CinematicHome } from './components/home/CinematicHome';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useUIStore, type UIActiveTab } from './stores/uiStore';
import { useTranslation } from 'react-i18next';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { normalizeFarmerProfile, formatIsoDate } from './lib/farmerProfile';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function TabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) {
    return null;
  }

  return <div>{children}</div>;
}

type Tab = UIActiveTab;

export function AppContent() {
  const { t, i18n } = useTranslation();
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { appData, updateModuleData } = useAppContext();
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const [showFarmerOnboarding, setShowFarmerOnboarding] = useState(false);
  const [farmerProfile, setFarmerProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('farmer_onboarding_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const farmView = useMemo(() => normalizeFarmerProfile(farmerProfile), [farmerProfile]);
  const [marketSelection, setMarketSelection] = useState<MarketSelection | null>(null);
  const [compareSlots, setCompareSlots] = useState<{ state: string; market: string }[]>([]);

  const handleAddCompare = (sel: { state: string; market: string }) => {
    setCompareSlots((prev) => {
      if (prev.length >= 3) return prev;
      if (prev.some((s) => s.state === sel.state && s.market === sel.market)) return prev;
      return [...prev, sel];
    });
  };

  const { location, loading: locationLoading, error: locationError, denied: locationDenied, refresh: refreshLocation } = useLocation();

  useEffect(() => {
    if (locationDenied || locationError) {
      setShowLocationBanner(true);
    } else {
      setShowLocationBanner(false);
    }
  }, [locationDenied, locationError]);

  useEffect(() => {
    if (location) {
      fetchWeather(location.city || appData.weatherCity, location.lat, location.lon);
    }
  }, [location]);

  useEffect(() => {
    initKnowledgeBase();
  }, []);

  useEffect(() => {
    if (user) {
      fetchWeather(user.location || 'Bangalore', location?.lat, location?.lon);
    }
  }, [user]);

  const fetchWeather = async (city: string, lat?: number, lon?: number) => {
    updateModuleData('weatherLoading', true);
    updateModuleData('weatherError', null);
    updateModuleData('weatherCity', city);
    try {
      let url = `/api/weather/${city}`;
      if (lat && lon) {
        url += `?lat=${lat}&lon=${lon}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.status === 'ok') {
        updateModuleData('weather', data);
      } else {
        updateModuleData('weatherError', data.error || "Weather service unavailable");
      }
    } catch (err) {
      console.error("Failed to fetch weather:", err);
      updateModuleData('weatherError', "Failed to connect to weather service.");
    } finally {
      updateModuleData('weatherLoading', false);
    }
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#07503f] border-t-[#e8fe85] animate-spin" />
          <p className="text-stone-400 text-xs font-mono uppercase tracking-widest">
            Initializing Agronomic Grid...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!user.name || !user.location) {
    return <ProfileSetup />;
  }

  const renderAdvisor = () => (
    <div className="space-y-6 pb-24">
      {/* Precision Agronomy Profile / Onboarding Banner */}
      {farmerProfile ? (
        <>
          <div className="bg-gradient-to-r from-[#07503f]/30 via-dark-card to-zinc-900/60 rounded-3xl border border-[#07503f]/40 p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30">
                    Precision Farm Profile Active
                  </span>
                  <span className="text-xs text-zinc-400">
                    Weather grid: {farmView?.farm?.gridKey || '11km Agro Grid'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-stone-100 mt-2 font-serif">
                  🌾 {farmView?.farm?.name || 'My Farm'}
                  {farmView?.crop ? ` • ${farmView.crop.name}` : ''}
                  {farmView?.crop?.variety ? ` (${farmView.crop.variety})` : ''}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Soil: <span className="text-emerald-400 font-medium">{farmView?.farm?.soilType || 'Black Cotton'}</span>
                  {farmView?.crop?.sowingDate && (
                    <> • Sown: <span className="text-stone-300 font-medium">{formatIsoDate(farmView.crop.sowingDate)}</span></>
                  )}
                  {farmView?.farm?.npk && [farmView.farm.npk.n, farmView.farm.npk.p, farmView.farm.npk.k, farmView.farm.npk.ph].some((v) => v != null) && (
                    <span>
                      {' '}• Soil test: N {farmView.farm.npk.n ?? '–'} kg/ha, P {farmView.farm.npk.p ?? '–'} kg/ha, K {farmView.farm.npk.k ?? '–'} kg/ha, pH {farmView.farm.npk.ph ?? '–'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFarmerOnboarding(true)}
                  className="px-4 py-2 bg-[#07503f] hover:bg-[#0d6e57] text-[#f1efdf] rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow"
                >
                  Edit Farm
                </button>
              </div>
            </div>
          </div>

          {farmView?.farm?.id != null && (
            <FarmDiagnosticCard
              farmId={String(farmView.farm.id)}
              cropId={farmView.crop?.id != null ? String(farmView.crop.id) : undefined}
            />
          )}
        </>
      ) : (
        <div className="bg-gradient-to-r from-[#07503f]/25 via-dark-card to-zinc-900/50 rounded-3xl border border-[#07503f]/30 p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30">
                <Sprout size={12} />
                <span>Phase 1 Precision Agronomy</span>
              </div>
              <h3 className="text-lg font-bold text-stone-100 font-serif">Set Up Your Farm & Crop Cycle</h3>
              <p className="text-xs text-stone-400 max-w-xl">
                Link your farm GPS coordinates, soil test card (NPK & pH), and sowing date to unlock stage-based agro-advisories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFarmerOnboarding(true)}
              className="px-5 py-2.5 bg-[#e8fe85] hover:bg-[#d8f06f] text-[#07503f] rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center space-x-2 shrink-0"
            >
              <span>Onboard Farm</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Grounded Precision Agronomy Q&A Consultation */}
      <AdvisoryChatCard
        farmId={farmView?.farm?.id != null ? String(farmView.farm.id) : undefined}
        crop={farmView?.crop?.name}
        farmerId={farmView?.profileId ?? undefined}
        sowingDate={farmView?.crop?.sowingDate ?? undefined}
        soilType={farmView?.farm?.soilType ?? undefined}
      />

      {/* Verified Government Schemes & Subsidies */}
      <GovernmentSchemesCard />
    </div>
  );

  const renderWeather = () => {
    // Prefer farmer's district+state from onboarding over raw GPS city name
    const farmerLocationName = farmView?.farm?.district && farmView?.farm?.state
      ? `${farmView.farm.district}, ${farmView.farm.state}`
      : location?.city || user?.location;
    // Prefer GPS coords; fallback to farmer profile district centroid if GPS denied
    const weatherLat = location?.lat ?? farmView?.farm?.lat ?? undefined;
    const weatherLon = location?.lon ?? farmView?.farm?.lon ?? undefined;
    return (
      <div className="space-y-6 pb-24">
        <WeatherStrip
          lat={weatherLat}
          lon={weatherLon}
          locationName={farmerLocationName}
        />
      </div>
    );
  };

  const renderPriceTrends = () => (
    <div className="space-y-6 pb-24">
      <MarketDataView
        selection={marketSelection}
        farmFieldSizeAcres={farmView?.farm?.fieldSizeAcres ?? null}
        initialCommodity={
          farmView?.crop && ['Wheat', 'Tomato', 'Cotton', 'Soybean', 'Rice', 'Maize'].includes(farmView.crop.name)
            ? farmView.crop.name
            : undefined
        }
        externalCompareSlots={compareSlots}
      />

      {/* Mandi Explorer — clicking a card loads it in the view above or adds to compare */}
      <div className="border-t border-zinc-800 pt-6 mt-8">
        <MandiExplore
          onSelect={(sel) => setMarketSelection({ ...sel, nonce: Date.now() })}
          onCompare={handleAddCompare}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-bg text-stone-200 font-sans selection:bg-[#07503f]/40">
      {/* Arva Header */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-dark-bg/85 backdrop-blur-md border-b border-dark-border z-40 px-6 flex items-center justify-between">
        <div 
          onClick={() => switchTab('home')}
          className="flex items-center space-x-3 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold shadow-md">
            <Sprout size={22} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-serif font-bold text-xl tracking-tight leading-none text-white group-hover:text-[#e8fe85] transition-colors">
              Smart Agriculture
            </h1>
            <div className="flex items-center mt-1">
              <span className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.15em] font-mono">
                AI Precision Agronomy
              </span>
              {user?.id?.startsWith('demo-user') && (
                <span className="ml-2 text-[8px] font-bold bg-[#e8fe85]/20 text-[#e8fe85] px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-[#e8fe85]/30">
                  Demo Mode
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <LanguageSelector />
          <button 
            onClick={() => switchTab('profile')}
            className={cn(
              "w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center border border-dark-border overflow-hidden transition-all",
              activeTab === 'profile' ? "border-[#e8fe85] ring-2 ring-[#e8fe85]/20" : "hover:border-stone-500"
            )}
            title="Farmer Profile & Settings"
          >
            {user?.name ? (
              <span className="text-xs font-bold text-[#e8fe85]">{user.name.charAt(0)}</span>
            ) : (
              <User size={18} className="text-stone-400" />
            )}
          </button>
        </div>
      </header>

      <LocationBanner 
        show={showLocationBanner} 
        onClose={() => setShowLocationBanner(false)} 
        error={locationError}
        denied={locationDenied}
      />

      {/* Main Content Viewport */}
      <main className="pt-24 px-4 sm:px-6 mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <TabPanel active={activeTab === 'home'}>
            <ErrorBoundary fallbackTitle="Unable to load Home dashboard">
              <CinematicHome
                weather={appData.weather}
                weatherLoading={appData.weatherLoading}
                farmView={farmView}
                onOpenOnboarding={() => setShowFarmerOnboarding(true)}
              />
            </ErrorBoundary>
          </TabPanel>

          <TabPanel active={activeTab === 'advisor'}>
            <ErrorBoundary fallbackTitle="Unable to load Crop Advisor">
              {renderAdvisor()}
            </ErrorBoundary>
          </TabPanel>

          <TabPanel active={activeTab === 'priceTrends'}>
            <ErrorBoundary fallbackTitle="Unable to load Mandi Price Trends">
              {renderPriceTrends()}
            </ErrorBoundary>
          </TabPanel>

          <TabPanel active={activeTab === 'weather'}>
            <ErrorBoundary fallbackTitle="Unable to load Weather Intelligence">
              {renderWeather()}
            </ErrorBoundary>
          </TabPanel>

          <TabPanel active={activeTab === 'profile'}>
            <ErrorBoundary fallbackTitle="Unable to load Profile Settings">
              <ProfileSettings />
            </ErrorBoundary>
          </TabPanel>
        </motion.div>
      </main>

      <FarmerOnboardingModal
        isOpen={showFarmerOnboarding}
        onClose={() => setShowFarmerOnboarding(false)}
        initialFarmerId={user?.id}
        initialName={user?.name}
        onComplete={(result) => {
          setFarmerProfile(result);
          const lang = result?.profile?.preferred_language;
          if (lang && lang !== i18n.language) {
            i18n.changeLanguage(lang);
          }
          try {
            localStorage.setItem('farmer_onboarding_profile', JSON.stringify(result));
          } catch {}
          setShowFarmerOnboarding(false);
        }}
      />

      {/* Arva Clean Pill Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-bg/90 backdrop-blur-xl border-t border-dark-border z-50 px-3 py-2.5">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {[
            { id: 'home', icon: Home, label: t('common.home') },
            { id: 'advisor', icon: Sprout, label: t('common.advisor') },
            { id: 'priceTrends', icon: TrendingUp, label: t('common.priceTrends') || 'Prices' },
            { id: 'weather', icon: CloudRain, label: t('common.weather') },
            { id: 'profile', icon: User, label: t('common.profile') },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => switchTab(item.id as Tab)}
                className={cn(
                  "flex flex-col items-center py-1.5 px-3 rounded-full transition-all duration-200 active:scale-95",
                  isActive
                    ? "bg-[#07503f] text-[#e8fe85] shadow-md shadow-[#07503f]/40 font-bold"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/40"
                )}
              >
                <item.icon size={19} className={cn("transition-transform", isActive && "scale-110")} />
                <span className="text-[10px] uppercase tracking-wider mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <ChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
