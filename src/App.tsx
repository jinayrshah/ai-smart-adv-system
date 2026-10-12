import React, { useState, useEffect, useMemo } from 'react';
import { Logo } from './components/Logo';
import { ChatWidget } from './components/ChatWidget';
import { 
  Sprout, 
  Bug, 
  History, 
  LayoutDashboard, 
  ChevronRight, 
  Upload, 
  Thermometer, 
  Droplets, 
  CloudRain, 
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Camera,
  X,
  Home,
  TrendingUp,
  BookOpen,
  Settings,
  Bell,
  Search,
  Languages,
  User,
  Wind,
  Sun,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Filter,
  ArrowLeft,
  RefreshCw,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  Map,
  LogOut,
  Loader2,
  ShoppingBag,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { agricultureService, CropInput, PredictionResult, WeatherContext } from './services/aiService';
import { initKnowledgeBase } from './services/ragService';
import { marketService, MarketPrice, MarketFilters } from './services/marketService';
import { MarketDataView, type MarketSelection } from './components/market/MarketDataView';
import { MandiExplore } from './components/market/MandiExplore';
import { WeatherStrip } from './components/weather/WeatherStrip';
import { fetchWeatherSummary } from './lib/api/weather';
import { articles, Article } from './data/articles';
import { useGreeting, useWeather, getFarmingInsights } from './hooks/useAgricultureDashboard';
import { useLocation } from './hooks/useLocation';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppContext';
import { Login } from './components/auth/Login';
import { ProfileSetup } from './components/auth/ProfileSetup';
import { ProfileSettings } from './components/auth/ProfileSettings';
import { LocationBanner } from './components/LocationBanner';
import { LanguageSelector } from './components/LanguageSelector';
import { FertilizerRecommendation } from './components/fertilizer/FertilizerRecommendation';
import { HistoryModal } from './components/HistoryModal';
import { FarmerOnboardingModal } from './components/farmer/FarmerOnboardingModal';
import { FarmDiagnosticCard } from './components/farmer/FarmDiagnosticCard';
import { AdvisoryChatCard } from './components/farmer/AdvisoryChatCard';
import { GovernmentSchemesCard } from './components/farmer/GovernmentSchemesCard';
import { Marketplace } from './components/marketplace/Marketplace';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useHistoryStore } from './stores/historyStore';
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

const HERO_CONTENT = [
  {
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=1200",
    titleKey: "home.slogan1",
    subtitleKey: "home.subtitle1"
  },
  {
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=1200",
    titleKey: "home.slogan2",
    subtitleKey: "home.subtitle2"
  },
  {
    image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=1200",
    titleKey: "home.slogan3",
    subtitleKey: "home.subtitle3"
  },
  {
    image: "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=1200",
    titleKey: "home.slogan4",
    subtitleKey: "home.subtitle4"
  },
  {
    image: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=1200",
    titleKey: "home.slogan5",
    subtitleKey: "home.subtitle5"
  }
];

export function AppContent() {
  const { t, i18n } = useTranslation();
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { appData, updateModuleData } = useAppContext();
  const history = useHistoryStore((state) => state.history);
  const addEntry = useHistoryStore((state) => state.addEntry);
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const showHistory = useUIStore((state) => state.showHistory);
  const setShowHistory = useUIStore((state) => state.setShowHistory);

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

  const [lastMarketUpdate, setLastMarketUpdate] = useState<Date>(new Date());

  const greetingKey = useGreeting();
  const { location, loading: locationLoading, error: locationError, denied: locationDenied, refresh: refreshLocation, setManualLocation } = useLocation();
  const { weather, loading: weatherDataLoading, error: weatherError, refresh: refreshWeather } = useWeather(user?.location || location?.city || appData.weatherCity, location?.lat, location?.lon);
  const farmingInsights = weather ? getFarmingInsights(weather, t) : [];

  useEffect(() => {
    if (locationDenied || locationError) {
      setShowLocationBanner(true);
    } else {
      setShowLocationBanner(false);
    }
  }, [locationDenied, locationError]);

  useEffect(() => {
    if (location) {
      // Update market filters based on location
      const newFilters = {
        ...appData.marketFilters,
        state: location.state || appData.marketFilters.state,
        district: location.district || appData.marketFilters.district
      };
      updateModuleData('marketFilters', newFilters);
      fetchMarketData(newFilters);
      
      // Update weather based on location
      fetchWeather(location.city || appData.weatherCity, location.lat, location.lon);
    }
  }, [location]);

  useEffect(() => {
    initKnowledgeBase();
  }, []);

  useEffect(() => {
    console.log('market:', appData.market);
    console.log('priceTrends:', appData.priceTrends);
    console.log('selectedMarketCrop:', appData.selectedMarketCrop);
    console.log('result:', appData.fertilizer);
    console.log('activeTab:', activeTab);
  }, [activeTab, appData.fertilizer, appData.market, appData.priceTrends, appData.selectedMarketCrop]);

  useEffect(() => {
    if (user) {
      fetchWeather(user.location || 'Bangalore', location?.lat, location?.lon);
      fetchMarketData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Auto-refresh market data every 5 minutes
    const interval = setInterval(() => {
      fetchMarketData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const fetchMarketData = async (filters = appData.marketFilters) => {
    updateModuleData('marketLoading', true);
    updateModuleData('marketError', null);
    try {
      const data = await marketService.getPrices(filters);
      if (!data || data.length === 0) {
        updateModuleData('market', []);
        updateModuleData('selectedMarketCrop', null);
        updateModuleData('priceTrends', null);
        updateModuleData('marketError', 'No market data available');
        return;
      }

      updateModuleData('market', data);
      setLastMarketUpdate(new Date());

      let selected = appData.selectedMarketCrop;
      if (!selected || !data.some((item) => item.id === selected.id)) {
        selected = data[0];
        updateModuleData('selectedMarketCrop', selected);
      }

      // Fetch insight for the selected crop
      if (selected) {
        try {
          const insightData = await marketService.getMarketInsight({
            state: selected.state,
            district: selected.district,
            commodity: selected.commodity
          });
          updateModuleData('priceTrends', insightData.ai_summary);
          
          // Update the selected crop with real history from the backend
          const updatedSelected = {
            ...selected,
            history: insightData.history.map((h: any) => ({
              date: h.arrival_date,
              price: Number(h.modal_price)
            }))
          };
          updateModuleData('selectedMarketCrop', updatedSelected);
        } catch (e) {
          console.error("Failed to fetch insight", e);
        }
      }

    } catch (err: any) {
      console.error("Failed to fetch market data");
      updateModuleData('marketError', err.message || "Failed to connect to market service.");
    } finally {
      updateModuleData('marketLoading', false);
    }
  };

  const handleMarketFilterChange = (newFilters: Partial<MarketFilters>) => {
    const updated = { ...appData.marketFilters, ...newFilters };
    updateModuleData('marketFilters', updated);
    
    // Only fetch from API if state or district changed
    if (newFilters.state !== undefined || newFilters.district !== undefined) {
      fetchMarketData(updated);
    }
  };

  const handleCropSelect = async (crop: any) => {
    updateModuleData('selectedMarketCrop', crop);
    updateModuleData('priceTrends', 'Analyzing market trends...');
    try {
      const insightData = await marketService.getMarketInsight({
        state: crop.state,
        district: crop.district,
        commodity: crop.commodity
      });
      updateModuleData('priceTrends', insightData.ai_summary);
      
      const updatedCrop = {
        ...crop,
        history: insightData.history.map((h: any) => ({
          date: h.arrival_date,
          price: Number(h.modal_price)
        }))
      };
      updateModuleData('selectedMarketCrop', updatedCrop);
    } catch (e) {
      console.error("Failed to fetch crop insight", e);
      updateModuleData('priceTrends', 'Analysis unavailable.');
    }
  };

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
        if (data.fallback) {
          console.warn('[WEATHER] Using fallback weather data');
        }
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

  const [heroIndex, setHeroIndex] = useState(() => new Date().getHours() % HERO_CONTENT.length);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentHour = new Date().getHours();
      setHeroIndex(currentHour % HERO_CONTENT.length);
    }, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const [diseaseSubmitted, setDiseaseSubmitted] = useState(false);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
  };

  const resetDiseaseResult = () => {
    updateModuleData('disease', null);
    updateModuleData('diseaseError', null);
    updateModuleData('selectedImage', null);
    setDiseaseSubmitted(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateModuleData('selectedImage', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDiseaseDetection = async (e?: React.FormEvent | React.MouseEvent) => {
    console.log("Disease Detection triggered");
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!appData.selectedImage) return;
    updateModuleData('diseaseLoading', true);
    updateModuleData('diseaseError', null);
    try {
      const cropHint = farmView?.crop?.name;
      const res = await agricultureService.detectDisease(appData.selectedImage, cropHint);
      updateModuleData('disease', res);
      addEntry({
        id: Date.now(),
        module: 'disease',
        input: { image: 'Uploaded Image' },
        output: res,
        timestamp: new Date().toISOString(),
      });
      setDiseaseSubmitted(true);
      switchTab('disease');
    } catch (err: any) {
      updateModuleData('diseaseError', err.message);
    } finally {
      updateModuleData('diseaseLoading', false);
    }
  };

  const renderHome = () => (
    <div className="space-y-6 pb-24">
      {/* Hero Section */}
      <div className="relative h-64 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-900/20">
        <AnimatePresence mode="wait">
          <motion.div
            key={heroIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <img 
              src={HERO_CONTENT[heroIndex].image} 
              alt="Hero" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          </motion.div>
        </AnimatePresence>
        
        <div className="absolute inset-0 p-8 flex flex-col justify-end">
          <motion.div
            key={`text-${heroIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2">
              {t(greetingKey)}, {user?.name || (user?.id?.startsWith('demo-user') ? t('auth.demoMode') : t('common.profile'))}
            </h2>
            <p className="text-stone-300 text-sm md:text-base max-w-md">
              {t(HERO_CONTENT[heroIndex].titleKey)}
            </p>
            <div className="mt-4 flex items-center space-x-2">
              <div className="w-8 h-1 rounded-full bg-brand-green" />
              <div className="text-[10px] text-stone-400 font-medium">
                {t(HERO_CONTENT[heroIndex].subtitleKey)}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* AI Smart Farming Command Center - Alerts */}
      <AnimatePresence>
        {farmingInsights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-stone-300 flex items-center">
                <LayoutDashboard size={14} className="mr-2 text-emerald-500" />
                {t('home.commandCenter')}
              </h3>
              <span className="text-[10px] text-stone-500 bg-stone-800/50 px-2 py-0.5 rounded-full">
                {t('home.liveAnalysis')}
              </span>
            </div>
            {farmingInsights.map((insight, index) => {
              const Icon = insight.type === 'rain' ? CloudRain : insight.type === 'heat' ? Sun : Sprout;
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "p-4 rounded-2xl border flex items-start space-x-3",
                    insight.color
                  )}
                >
                  <div className="p-2 rounded-xl bg-white/5">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold mb-0.5">{insight.title}</h4>
                    <p className="text-xs opacity-80 leading-relaxed">{insight.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Location Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            location ? "bg-brand-green animate-pulse" : locationDenied ? "bg-amber-500" : "bg-stone-600"
          )} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
            {locationLoading ? "Fetching Location..." : location ? `Location: ${location.city || location.state}` : locationDenied ? "Location Denied" : "Location Unknown"}
          </span>
        </div>
        <button 
          onClick={() => refreshLocation()}
          disabled={locationLoading}
          className="p-1.5 hover:bg-stone-800 rounded-lg transition-colors text-stone-500 hover:text-brand-green disabled:opacity-50"
          title="Refresh Location"
        >
          <RefreshCw size={14} className={cn(locationLoading && "animate-spin")} />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-dark-card p-4 rounded-2xl border border-dark-border relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Thermometer size={16} className="text-orange-500" />
              <span className="text-xs text-stone-400 font-medium">{t('home.temperature')}</span>
            </div>
            {weather && !weatherDataLoading && (
              <span className="text-[10px] text-stone-500 flex items-center">
                <MapPin size={8} className="mr-1" /> {weather.location}
              </span>
            )}
          </div>
          
          {weatherDataLoading ? (
            <div className="space-y-2">
              <div className="h-7 w-16 bg-stone-800 animate-pulse rounded" />
              <div className="h-3 w-24 bg-stone-800 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="text-xl font-bold">{weather?.temp ?? 28}°C</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-1">
                {weather?.condition ?? 'Clear Sky'}
              </div>
            </>
          )}
        </div>

        <div className="bg-dark-card p-4 rounded-2xl border border-dark-border">
          <div className="flex items-center space-x-2 mb-2">
            <Droplets size={16} className="text-blue-500" />
            <span className="text-xs text-stone-400 font-medium">{t('home.humidity')}</span>
          </div>
          
          {weatherDataLoading ? (
            <div className="space-y-2">
              <div className="h-7 w-16 bg-stone-800 animate-pulse rounded" />
              <div className="h-3 w-20 bg-stone-800 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="text-xl font-bold">{weather?.humidity ?? 65}%</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-1">
                Optimal range
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 gap-4">
        <button 
          onClick={() => switchTab('advisor')}
          className="bg-brand-green p-6 rounded-3xl flex items-center justify-between group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mr-4">
              <Sprout className="text-white" />
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-bold text-lg">{t('home.cropAdvisor')}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full">Personalized</span>
              </div>
              <p className="text-white/70 text-sm">{t('home.cropAdvisorDesc')}</p>
            </div>
          </div>
          <ChevronRight className="text-white group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={() => switchTab('priceTrends')}
          className="bg-dark-card p-6 rounded-3xl border border-dark-border flex items-center justify-between group hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mr-4">
              <TrendingUp className="text-emerald-400" />
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-bold text-lg">Mandi Price Trends</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Live Ingest</span>
              </div>
              <p className="text-stone-400 text-sm">Real APMC modal prices, unit conversions, AI market insights & storage calculators</p>
            </div>
          </div>
          <ChevronRight className="text-stone-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={() => switchTab('weather')}
          className="bg-dark-card p-6 rounded-3xl border border-dark-border flex items-center justify-between group hover:border-cyan-500/50 transition-colors"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center mr-4">
              <CloudRain className="text-cyan-400" />
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-bold text-lg">Weather Intelligence</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">Multi-Source</span>
              </div>
              <p className="text-stone-400 text-sm">Open-Meteo, NASA POWER & IMD 3-way fusion with confidence ratings</p>
            </div>
          </div>
          <ChevronRight className="text-stone-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={() => switchTab('fertilizer')}
          className="bg-dark-card p-6 rounded-3xl border border-dark-border flex items-center justify-between group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center mr-4">
              <FlaskConical className="text-brand-green" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-bold text-lg">{t('home.fertilizerRecommendation')}</h3>
              <p className="text-stone-400 text-sm">{t('home.fertilizerRecommendationDesc')}</p>
            </div>
          </div>
          <ChevronRight className="text-stone-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={() => switchTab('disease')}
          className="bg-dark-card p-6 rounded-3xl border border-dark-border flex items-center justify-between group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mr-4">
              <Bug className="text-amber-500" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-bold text-lg">{t('home.diseaseDetection')}</h3>
              <p className="text-stone-400 text-sm">{t('home.diseaseDetectionDesc')}</p>
            </div>
          </div>
          <ChevronRight className="text-stone-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button 
          onClick={() => switchTab('marketplace')}
          className="bg-dark-card p-6 rounded-3xl border border-dark-border flex items-center justify-between group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mr-4">
              <Store className="text-blue-500" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-bold text-lg">{t('home.marketing')}</h3>
              <p className="text-stone-400 text-sm">{t('home.marketingDesc')}</p>
            </div>
          </div>
          <ChevronRight className="text-stone-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Recent History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{t('home.recentActivities')}</h3>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="text-brand-green text-sm font-medium"
          >
            {t('home.seeAll')}
          </button>
        </div>
        <div className="space-y-3">
          {history.slice(0, 3).map((item) => {
            const output = item.output || {};
            const confidence = typeof output.confidence === 'number' ? output.confidence : null;
            const resultLabel =
              typeof output.result === 'string'
                ? output.result
                : typeof output.fertilizerName === 'string'
                  ? output.fertilizerName
                  : 'Saved Analysis';

            return (
            <div key={item.id} className="bg-dark-card p-4 rounded-2xl border border-dark-border flex items-center justify-between">
              <div className="flex items-center">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mr-3",
                  item.module === 'soil'
                    ? "bg-emerald-500/10 text-emerald-500"
                    : item.module === 'fertilizer'
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-amber-500/10 text-amber-500"
                )}>
                  {item.module === 'soil' ? <Sprout size={18} /> : item.module === 'fertilizer' ? <FlaskConical size={18} /> : <Bug size={18} />}
                </div>
                <div>
                  <div className="font-bold text-sm">{resultLabel}</div>
                  <div className="text-[10px] text-stone-500">{new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-stone-500 uppercase font-bold">{item.module}</div>
                <div className="text-xs font-bold text-brand-green">
                  {confidence !== null ? `${(confidence * 100).toFixed(0)}%` : 'Saved'}
                </div>
              </div>
            </div>
          )})}
          {history.length === 0 && (
            <div className="text-center py-8 text-stone-500 text-sm italic">{t('home.noActivities')}</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAdvisor = () => (
    <div className="space-y-6 pb-24">
      {/* Precision Agronomy Profile / Onboarding Banner */}
      {farmerProfile ? (
        <>
        <div className="bg-gradient-to-r from-emerald-950/40 via-dark-card to-zinc-900/60 rounded-3xl border border-emerald-500/30 p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Precision Farm Profile Active
                </span>
                <span className="text-xs text-zinc-400">
                  Weather grid: {farmView?.farm?.gridKey || 'not set'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-stone-100 mt-2">
                🌾 {farmView?.farm?.name || 'My farm'}
                {farmView?.crop ? ` • ${farmView.crop.name}` : ''}
                {farmView?.crop?.variety ? ` (${farmView.crop.variety})` : ''}
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Soil: <span className="text-emerald-400 font-medium">{farmView?.farm?.soilType || 'Not provided'}</span>
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
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold border border-dark-border transition-colors"
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
        <div className="bg-gradient-to-r from-emerald-950/30 via-dark-card to-zinc-900/50 rounded-3xl border border-emerald-500/20 p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-green/20 text-brand-green border border-brand-green/30">
                <Sprout size={12} />
                <span>Phase 1 Precision Agronomy</span>
              </div>
              <h3 className="text-lg font-bold text-stone-100">Set Up Your Farm & Crop Cycle</h3>
              <p className="text-xs text-stone-400 max-w-xl">
                Link your farm GPS coordinates (snaps to 11km agromet weather grid), soil test card (NPK & pH), and sowing date to unlock stage-based agro-advisories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFarmerOnboarding(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 shrink-0"
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

  const renderDisease = () => (
    <div className="space-y-6 pb-24">
      <div className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden">
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold flex items-center">
            <Camera className="mr-2 text-amber-500" />
            {t('disease.diseaseDetection')}
          </h2>
          <p className="text-stone-500 text-sm mt-1">{t('disease.scanUpload')}</p>
        </div>
        <form
          onSubmit={handleDiseaseDetection}
          noValidate
          className="p-6"
        >
          {!appData.selectedImage ? (
            <div className="border-2 border-dashed border-dark-border rounded-2xl p-12 flex flex-col items-center justify-center bg-dark-bg/50 hover:bg-dark-bg transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="text-stone-600 mb-2" size={32} />
              <p className="text-stone-400 text-sm font-medium">{t('disease.tapToUpload')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden aspect-square bg-dark-bg">
                <img src={appData.selectedImage} alt="Selected" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                <button 
                  type="button"
                  onClick={resetDiseaseResult}
                  className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-1.5 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
              <button 
                type="submit"
                disabled={appData.diseaseLoading}
                className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50"
              >
                {appData.diseaseLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : t('disease.startDiagnosis')}
              </button>
              {(appData.disease || appData.diseaseError) && (
                <button
                  type="button"
                  onClick={resetDiseaseResult}
                  className="w-full border border-dark-border text-stone-300 font-bold py-3 rounded-2xl transition-all hover:border-stone-500"
                >
                  New Upload
                </button>
              )}
            </div>
          )}
        </form>
      </div>
      {renderResult(appData.disease, appData.diseaseError, {
        onReset: resetDiseaseResult,
        resetLabel: 'Clear Diagnosis'
      })}
    </div>
  );

  const renderWeather = () => (
    <div className="space-y-6 pb-24">
      {/* Phase 3: Multi-Source Weather Intelligence & Climatology */}
      <WeatherStrip
        lat={location?.lat}
        lon={location?.lon}
        locationName={location?.city || user?.location}
      />

    </div>
  );

  const renderPriceTrends = () => {
    return (
      <div className="space-y-6 pb-24">
        <MarketDataView
          selection={marketSelection}
          farmFieldSizeAcres={farmView?.farm?.fieldSizeAcres ?? null}
          initialCommodity={
            farmView?.crop && ['Wheat', 'Tomato', 'Cotton', 'Soybean', 'Rice', 'Maize'].includes(farmView.crop.name)
              ? farmView.crop.name
              : undefined
          }
        />

        {/* Mandi Explorer — clicking a card loads it in the view above */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-8">
          <MandiExplore
            onSelect={(sel) => setMarketSelection({ ...sel, nonce: Date.now() })}
          />
        </div>
      </div>
    );
  };

  const toggleBookmark = (id: string) => {
    const newBookmarks = appData.learn.bookmarks.includes(id) 
      ? appData.learn.bookmarks.filter(b => b !== id) 
      : [...appData.learn.bookmarks, id];
    updateModuleData('learn', { ...appData.learn, bookmarks: newBookmarks });
  };

  const renderLearn = () => {
    if (appData.learn.selectedArticle) {
      return (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6 pb-24"
        >
          <button 
            onClick={() => updateModuleData('learn', { ...appData.learn, selectedArticle: null })}
            className="flex items-center text-stone-400 hover:text-white transition-colors mb-4 group"
          >
            <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Learning Center
          </button>

          <div className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden">
            <div className="h-64 relative">
              <img 
                src={appData.learn.selectedArticle.image} 
                alt={appData.learn.selectedArticle.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-transparent to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <span className="text-[10px] bg-brand-green text-white px-3 py-1 rounded-full font-bold uppercase tracking-wider mb-2 inline-block">
                  {appData.learn.selectedArticle.category}
                </span>
                <h2 className="text-3xl font-bold text-white">{appData.learn.selectedArticle.title}</h2>
              </div>
            </div>
            
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-8 text-stone-500 text-sm">
                <span className="flex items-center">
                  <History size={14} className="mr-1" />
                  {appData.learn.selectedArticle.time}
                </span>
                <button 
                  onClick={() => toggleBookmark(appData.learn.selectedArticle.id)}
                  className="flex items-center hover:text-brand-green transition-colors"
                >
                  {appData.learn.bookmarks.includes(appData.learn.selectedArticle.id) ? (
                    <><BookmarkCheck size={14} className="mr-1 text-brand-green" /> Saved</>
                  ) : (
                    <><Bookmark size={14} className="mr-1" /> Save for later</>
                  )}
                </button>
              </div>

              <div className="prose prose-invert max-w-none">
                <div className="markdown-body text-stone-300 leading-relaxed space-y-4">
                  <Markdown>{appData.learn.selectedArticle.content}</Markdown>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-dark-border">
                <h4 className="font-bold mb-4">Related Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {articles
                    .filter(a => a.category === appData.learn.selectedArticle.category && a.id !== appData.learn.selectedArticle.id)
                    .slice(0, 3)
                    .map(related => (
                      <button 
                        key={related.id}
                        onClick={() => updateModuleData('learn', { ...appData.learn, selectedArticle: related })}
                        className="px-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs hover:border-brand-green transition-colors"
                      >
                        {related.title}
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    const filteredArticles = articles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(appData.learn.searchQuery.toLowerCase()) ||
                          article.description.toLowerCase().includes(appData.learn.searchQuery.toLowerCase());
      const matchesCategory = appData.learn.selectedCategory === 'All' || article.category === appData.learn.selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const categories = ['All', ...Array.from(new Set(articles.map(a => a.category)))];

    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Learning Center</h2>
          <div className="flex items-center space-x-2 text-stone-500 text-sm">
            <BookOpen size={16} />
            <span>{articles.length} Articles</span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
            <input 
              type="text" 
              placeholder="Search articles, techniques..." 
              value={appData.learn.searchQuery}
              onChange={(e) => updateModuleData('learn', { ...appData.learn, searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-dark-card border border-dark-border text-sm focus:border-brand-green outline-none transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar">
            <Filter size={14} className="text-stone-500 shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => updateModuleData('learn', { ...appData.learn, selectedCategory: cat })}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                  appData.learn.selectedCategory === cat 
                    ? "bg-brand-green border-brand-green text-white" 
                    : "bg-dark-card border-dark-border text-stone-400 hover:border-stone-600"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 gap-6">
          {filteredArticles.map((article) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={article.id} 
              onClick={() => updateModuleData('learn', { ...appData.learn, selectedArticle: article })}
              className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden group hover:shadow-2xl hover:shadow-brand-green/5 transition-all duration-300 cursor-pointer"
            >
              <div className="h-48 overflow-hidden relative">
                <img 
                  src={article.image} 
                  alt={article.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(article.id);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-brand-green transition-colors"
                >
                  {appData.learn.bookmarks.includes(article.id) ? (
                    <BookmarkCheck size={18} className="fill-current" />
                  ) : (
                    <Bookmark size={18} />
                  )}
                </button>
                <div className="absolute bottom-4 left-4">
                  <span className="text-[10px] bg-brand-green text-white px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-lg">
                    {article.category}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-[10px] text-stone-500 font-bold uppercase flex items-center">
                    <History size={12} className="mr-1" />
                    {article.time}
                  </span>
                </div>
                <h3 className="font-bold text-xl mb-2 group-hover:text-brand-green transition-colors">{article.title}</h3>
                <p className="text-stone-400 text-sm mb-6 line-clamp-2 leading-relaxed">
                  {article.description}
                </p>
                <div className="flex items-center justify-between">
                  <button className="flex items-center text-brand-green text-sm font-bold group/link">
                    Read Article 
                    <ArrowRight size={16} className="ml-1 group-hover/link:translate-x-1 transition-transform" />
                  </button>
                  {appData.learn.bookmarks.includes(article.id) && (
                    <span className="text-[10px] text-brand-green font-bold uppercase">Saved</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4 border border-dark-border">
              <Search size={24} className="text-stone-600" />
            </div>
            <p className="text-stone-500 font-medium">No articles found matching your search.</p>
            <button 
              onClick={() => {
                updateModuleData('learn', { ...appData.learn, searchQuery: '', selectedCategory: 'All' });
              }}
              className="mt-4 text-brand-green text-sm font-bold"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderResult = (
    result: any,
    error: string | null = null,
    options?: { onReset?: () => void; resetLabel?: string }
  ) => (
    <AnimatePresence>
      {(result || error) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-start">
              <AlertCircle className="text-red-500 mr-4 shrink-0" />
              <div>
                <h3 className="text-red-500 font-bold">Error</h3>
                <p className="text-red-400 text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : result && (
            <div className={cn(
              "p-6 rounded-3xl border",
              result.confidence < 0.8 ? "bg-amber-500/10 border-amber-500/20" : "bg-brand-green/10 border-brand-green/20"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {result.confidence < 0.8 ? (
                    <AlertCircle className="text-amber-500 mr-2" />
                  ) : (
                    <CheckCircle2 className="text-brand-green mr-2" />
                  )}
                  <h3 className={cn(
                    "text-xl font-bold",
                    result.confidence < 0.8 ? "text-amber-500" : "text-brand-green"
                  )}>
                    {result.result}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Confidence</div>
                  <div className="text-lg font-bold">{(result.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-stone-300">Recommendations:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="bg-dark-bg/50 p-3 rounded-xl border border-dark-border text-stone-400 text-xs leading-relaxed">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {options?.onReset && (
                <button
                  type="button"
                  onClick={options.onReset}
                  className="mt-5 w-full rounded-2xl border border-dark-border px-4 py-3 text-sm font-bold text-stone-300 transition-colors hover:border-stone-500"
                >
                  {options.resetLabel || 'Clear Result'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!user.name || !user.location) {
    return <ProfileSetup />;
  }

  return (
    <div className="min-h-screen bg-dark-bg text-stone-200 font-sans selection:bg-brand-green/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border z-40 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3 group cursor-pointer">
          <Logo size={40} />
          <div className="flex flex-col">
            <h1 className="font-bold text-xl tracking-tight leading-none text-white group-hover:text-brand-green transition-colors">Smart Agriculture</h1>
            <div className="flex items-center mt-1">
              <span className="text-[10px] font-medium text-stone-500 uppercase tracking-[0.15em]">AI Powered Farming Intelligence</span>
              {user?.id?.startsWith('demo-user') && (
                <span className="ml-2 text-[8px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/30">
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
              "w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center border border-dark-border overflow-hidden transition-all",
              activeTab === 'profile' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "hover:border-stone-600"
            )}
          >
            {user?.name ? (
              <span className="text-xs font-bold text-emerald-500">{user.name.charAt(0)}</span>
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

      {/* Main Content */}
      <main className={cn(
        "pt-24 px-6 mx-auto",
        activeTab === 'marketplace' || activeTab === 'fertilizer' || activeTab === 'priceTrends' ? "max-w-6xl" : "max-w-lg"
      )}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <TabPanel active={activeTab === 'home'}>
            <ErrorBoundary fallbackTitle="Unable to load Home dashboard">{renderHome()}</ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'advisor'}>
            <ErrorBoundary fallbackTitle="Unable to load Crop Advisor">{renderAdvisor()}</ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'fertilizer'}>
            <ErrorBoundary fallbackTitle="Unable to load Fertilizer Calculator"><FertilizerRecommendation /></ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'disease'}>
            <ErrorBoundary fallbackTitle="Unable to load Disease Detection">{renderDisease()}</ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'marketplace'}>
            <ErrorBoundary fallbackTitle="Unable to load Marketplace">
              <Marketplace 
                initialLocation={location ? `${location.city}, ${location.state}` : user?.location} 
              />
            </ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'weather'}>
            <ErrorBoundary fallbackTitle="Unable to load Weather Intelligence">{renderWeather()}</ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'priceTrends'}>
            <ErrorBoundary fallbackTitle="Unable to load Market Price Trends">{renderPriceTrends()}</ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'learn'}>
            <ErrorBoundary fallbackTitle="Unable to load Learning Center">{renderLearn()}</ErrorBoundary>
          </TabPanel>
          <TabPanel active={activeTab === 'profile'}>
            <ErrorBoundary fallbackTitle="Unable to load Profile Settings"><ProfileSettings /></ErrorBoundary>
          </TabPanel>
        </motion.div>
      </main>

      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} />
      <FarmerOnboardingModal
        isOpen={showFarmerOnboarding}
        onClose={() => setShowFarmerOnboarding(false)}
        initialFarmerId={user?.id}
        initialName={user?.name}
        onComplete={(result) => {
          setFarmerProfile(result);
          // One language setting for the whole app (README §8): the advisory language the
          // farmer picked during onboarding also drives the UI dictionaries.
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-card/90 backdrop-blur-lg border-t border-dark-border z-50 px-2 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {[
            { id: 'home', icon: Home, label: t('common.home') },
            { id: 'advisor', icon: Sprout, label: t('common.advisor') },
            { id: 'fertilizer', icon: FlaskConical, label: t('common.fertilizer') },
            { id: 'disease', icon: Bug, label: t('common.disease') },
            { id: 'marketplace', icon: Store, label: t('common.marketplace') },
            { id: 'weather', icon: CloudRain, label: t('common.weather') },
            { id: 'priceTrends', icon: TrendingUp, label: t('common.priceTrends') },
            { id: 'learn', icon: BookOpen, label: t('common.learn') },
            { id: 'history', icon: History, label: 'History' },
            { id: 'profile', icon: User, label: t('common.profile') },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'history') {
                  setShowHistory(true);
                  return;
                }

                switchTab(item.id as Tab);
              }}
              className={cn(
                "flex flex-col items-center p-2 rounded-xl transition-all min-w-[56px]",
                (item.id === 'history' ? showHistory : activeTab === item.id)
                  ? "text-brand-green" 
                  : "text-stone-500 hover:text-stone-300"
              )}
            >
              <item.icon size={20} className={cn(
                "mb-1 transition-transform",
                ((item.id === 'history' ? showHistory : activeTab === item.id)) && "scale-110"
              )} />
              <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
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
