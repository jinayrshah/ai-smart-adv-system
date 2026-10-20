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
  return (
    <div className={active ? 'block' : 'hidden'} aria-hidden={!active}>
      {children}
    </div>
  );
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
          <div className="bg-[#ffffff] rounded-[24px] border border-[#c3cda7] p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] text-[#ffffff]">
                    Precision Farm Profile Active
                  </span>
                  <span className="text-xs text-[#6d6d6d] font-mono">
                    Weather grid: {farmView?.farm?.gridKey || '11km Agro Grid'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#212529] mt-2 font-serif">
                  🌾 {farmView?.farm?.name || 'My Farm'}
                  {farmView?.crop ? ` • ${farmView.crop.name}` : ''}
                  {farmView?.crop?.variety ? ` (${farmView.crop.variety})` : ''}
                </h3>
                <p className="text-xs text-[#353535] mt-1">
                  Soil: <span className="text-[#07503f] font-semibold">{farmView?.farm?.soilType || 'Black Cotton'}</span>
                  {farmView?.crop?.sowingDate && (
                    <> • Sown: <span className="text-[#212529] font-medium">{formatIsoDate(farmView.crop.sowingDate)}</span></>
                  )}
                  {farmView?.farm?.npk && [farmView.farm.npk.n, farmView.farm.npk.p, farmView.farm.npk.k, farmView.farm.npk.ph].some((v) => v != null) && (
                    <span>
                      {' '}• Soil test: N {farmView.farm.npk.n ?? '–'} kg/ha, P {farmView.farm.npk.p ?? '–'} kg/ha, K {farmView.farm.npk.k ?? '–'} kg/ha, pH {farmView.farm.npk.ph ?? '–'}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#07503f] font-mono hover:underline"
                >
                  <span>Edit farm & crop details in Profile Settings →</span>
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
        <div className="bg-[#ffffff] rounded-[24px] border border-[#c3cda7] p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#e6ecd5] text-[#07503f] border border-[#c3cda7]">
                <Sprout size={13} />
                <span>Phase 1 Precision Agronomy</span>
              </div>
              <h3 className="text-xl font-bold text-[#212529] font-serif">Set Up Your Farm & Crop Cycle</h3>
              <p className="text-xs text-[#6d6d6d] max-w-xl">
                Link your farm GPS coordinates, soil test card (NPK & pH), and sowing date to unlock stage-based agro-advisories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFarmerOnboarding(true)}
              className="px-6 py-3 bg-[#07503f] hover:bg-[#0d6e57] text-[#ffffff] rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-2 shrink-0"
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
    <div className="min-h-screen bg-[#f1efdf] text-[#212529] font-sans selection:bg-[#07503f]/20 selection:text-[#07503f]">
      {/* Header Bar */}
      <header className="sticky top-0 left-0 right-0 h-16 bg-[#07503f] text-[#ffffff] border-b border-[#04362b] z-40 px-4 sm:px-8 flex items-center justify-between shadow-md">
        <div 
          onClick={() => switchTab('home')}
          className="flex items-center space-x-3 group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-[#ffffff] text-[#07503f] flex items-center justify-center font-bold shadow-sm">
            <Sprout size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-serif font-bold text-lg sm:text-xl tracking-tight leading-none text-white group-hover:text-[#e8fe85] transition-colors">
              Smart Agriculture
            </h1>
            <div className="flex items-center mt-0.5">
              <span className="text-[9px] font-medium text-[#e8fe85] uppercase tracking-[0.15em] font-mono">
                AI Precision Agronomy
              </span>
              {user?.id?.startsWith('demo-user') && (
                <span className="ml-2 text-[8px] font-bold bg-[#e8fe85] text-[#07503f] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Demo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          <LanguageSelector />
          <button 
            onClick={() => switchTab('profile')}
            className={cn(
              "w-9 h-9 rounded-full bg-[#ffffff] text-[#07503f] flex items-center justify-center border border-white/20 overflow-hidden transition-all shadow-sm font-bold",
              activeTab === 'profile' ? "ring-2 ring-[#e8fe85]" : "hover:bg-[#f1efdf]"
            )}
            title="Farmer Profile & Settings"
          >
            {user?.name ? (
              <span className="text-xs font-bold text-[#07503f]">{user.name.charAt(0).toUpperCase()}</span>
            ) : (
              <User size={16} className="text-[#07503f]" />
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

      {/* Main Content Viewport on Bone Canvas */}
      <main className="pt-6 px-4 sm:px-6 mx-auto max-w-5xl">
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
              <ProfileSettings onEditFarm={() => setShowFarmerOnboarding(true)} farmerProfile={farmerProfile} />
            </ErrorBoundary>
          </TabPanel>
        </motion.div>
      </main>

      <FarmerOnboardingModal
        isOpen={showFarmerOnboarding}
        onClose={() => setShowFarmerOnboarding(false)}
        initialFarmerId={farmerProfile?.profile?.id || user?.id}
        initialName={farmView?.fullName || user?.name || ''}
        initialFarmView={farmView}
        initialProfile={farmerProfile}
        onComplete={(result) => {
          setFarmerProfile(result);
          const lang = result?.profile?.preferred_language;
          if (lang && lang !== i18n.language) {
            i18n.changeLanguage(lang);
          }
          try {
            localStorage.setItem('farmer_onboarding_profile', JSON.stringify(result));
          } catch {}

          // Refresh weather for the updated farm location
          const farm = result?.farm;
          if (farm) {
            const city = farm.district || farm.state || user?.location || 'Bangalore';
            fetchWeather(city, farm.lat, farm.lon);
          }

          setShowFarmerOnboarding(false);
        }}
      />

      {/* Arva Clean Pill Bottom Navigation (DESIGN.md §Pill Nav Element) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#07503f] border-t border-[#04362b] z-50 px-3 py-2 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-around">
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
                  "flex flex-col items-center py-1.5 px-4 rounded-full transition-all duration-200 active:scale-95 cursor-pointer",
                  isActive
                    ? "bg-[#e8fe85] text-[#07503f] font-bold shadow-md"
                    : "text-stone-200 hover:text-white hover:bg-white/10"
                )}
              >
                <item.icon size={18} className={cn("transition-transform", isActive && "scale-110")} />
                <span className="text-[10px] uppercase tracking-wider mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {activeTab === 'home' && <ChatWidget />}
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
