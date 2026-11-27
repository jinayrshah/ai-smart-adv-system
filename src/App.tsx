import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { CloudSun, Home, Loader2, MessageCircle, Sprout, TrendingUp, Tractor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { AuthPortal } from './components/auth/AuthPortal';
import { LanguageSelector } from './components/LanguageSelector';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TodayView } from './components/home/TodayView';
import type { MarketSelection } from './components/market/MarketDataView';
import { useUIStore, type UIActiveTab } from './stores/uiStore';
import { cacheProfile, loadFarmerProfile, normalizeFarmerProfile, readCachedProfile } from './lib/farmerProfile';

// Each tab's code is downloaded the first time the tab is opened, so the first screen loads fast
// on slow phones and networks.
const AdvisorView = lazy(() => import('./components/advisor/AdvisorView').then((m) => ({ default: m.AdvisorView })));
const WeatherStrip = lazy(() => import('./components/weather/WeatherStrip').then((m) => ({ default: m.WeatherStrip })));
const MarketDataView = lazy(() => import('./components/market/MarketDataView').then((m) => ({ default: m.MarketDataView })));
const MandiExplore = lazy(() => import('./components/market/MandiExplore').then((m) => ({ default: m.MandiExplore })));
const FarmView = lazy(() => import('./components/farmer/FarmView').then((m) => ({ default: m.FarmView })));
const FarmerOnboardingModal = lazy(() =>
  import('./components/farmer/FarmerOnboardingModal').then((m) => ({ default: m.FarmerOnboardingModal })));

const TabLoading = () => (
  <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-brand" size={28} aria-label="Loading" /></div>
);

function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  // Mounted on first visit, then kept mounted so each tab keeps its state (chat thread,
  // chart selection) when you switch away.
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  return <div hidden={!active}>{visited && <Suspense fallback={<TabLoading />}>{children}</Suspense>}</div>;
}

export function AppContent() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const [farmerProfile, setFarmerProfile] = useState<any>(null);
  const [profileState, setProfileState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingFarm, setEditingFarm] = useState(false);
  const [question, setQuestion] = useState<{ text: string; nonce: number } | null>(null);
  const [marketSelection, setMarketSelection] = useState<MarketSelection | null>(null);
  const [compareSlots, setCompareSlots] = useState<{ state: string; market: string }[]>([]);

  const farmView = useMemo(() => normalizeFarmerProfile(farmerProfile), [farmerProfile]);

  const loadProfile = (userId: string) => {
    setProfileState('loading');
    setProfileError(null);
    loadFarmerProfile(userId).then(
      (p) => { setFarmerProfile(p); cacheProfile(userId, p); setProfileState('ready'); },
      (e) => { setProfileError(e.message); setProfileState(readCachedProfile(userId) ? 'ready' : 'error'); },
    );
  };

  // Each account sees only its own farm: show its cached copy at once, then the server's.
  useEffect(() => {
    if (!user) { setFarmerProfile(null); return; }
    setFarmerProfile(readCachedProfile(user.id));
    loadProfile(user.id);
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <Loader2 className="animate-spin text-brand" size={32} aria-label="Loading" />
      </div>
    );
  }
  if (!user) return <AuthPortal />;

  const hasFarm = !!farmView?.farm;
  const saveFarm = (result: any) => {
    setFarmerProfile(result);
    cacheProfile(user.id, result);
    const lang = result?.profile?.preferred_language;
    if (lang && lang !== i18n.language) i18n.changeLanguage(lang);
    setEditingFarm(false);
  };
  const ask = (text?: string) => {
    setActiveTab('advisor');
    if (text) setQuestion({ text, nonce: Date.now() });
  };

  const tabs: { id: UIActiveTab; icon: React.ElementType; label: string }[] = [
    { id: 'home', icon: Home, label: t('common.today', 'Today') },
    { id: 'advisor', icon: MessageCircle, label: t('common.advisor', 'Advisor') },
    { id: 'priceTrends', icon: TrendingUp, label: t('common.prices', 'Prices') },
    { id: 'weather', icon: CloudSun, label: t('common.weather', 'Weather') },
    { id: 'profile', icon: Tractor, label: t('common.farm', 'Farm') },
  ];

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-40 bg-brand text-white">
        <div className="mx-auto max-w-5xl h-16 px-4 sm:px-6 flex items-center justify-between">
          <button onClick={() => setActiveTab('home')} className="flex items-center gap-2.5 h-11 -ml-1 pl-1 pr-2 rounded-xl">
            <span className="w-8 h-8 rounded-lg bg-accent text-brand flex items-center justify-center"><Sprout size={18} aria-hidden /></span>
            <span className="text-lg font-semibold">Smart Agriculture</span>
          </button>
          <LanguageSelector />
        </div>
      </header>

      {profileState === 'error' && (
        <div role="alert" className="bg-warn-bg text-warn">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <span>Could not load your farm. {profileError}</span>
            <button onClick={() => loadProfile(user.id)} className="h-10 px-4 rounded-full bg-surface text-ink font-medium shrink-0">Retry</button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-6">
        {profileState === 'loading' && !hasFarm ? (
          <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-brand" size={28} aria-label="Loading your farm" /></div>
        ) : (
          <>
            <TabPanel active={activeTab === 'home'}>
              <ErrorBoundary fallbackTitle="Could not load Today">
                {hasFarm && <TodayView farmView={farmView!} onAsk={ask} onEditFarm={() => setEditingFarm(true)} onOpen={setActiveTab} />}
              </ErrorBoundary>
            </TabPanel>
            <TabPanel active={activeTab === 'advisor'}>
              <ErrorBoundary fallbackTitle="Could not load the Advisor">
                <AdvisorView farmView={farmView} initialQuestion={question} onEditFarm={() => setEditingFarm(true)} />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel active={activeTab === 'priceTrends'}>
              <ErrorBoundary fallbackTitle="Could not load Prices">
                <div className="space-y-10 pb-28">
                  <h1 className="pt-2 text-3xl font-semibold text-ink">Prices</h1>
                  <MarketDataView
                    key={`${farmView?.crop?.name}|${farmView?.farm?.state}`}
                    selection={marketSelection}
                    farmFieldSizeAcres={farmView?.farm?.fieldSizeAcres ?? null}
                    initialCommodity={farmView?.crop?.name === 'Soybean' ? 'Soyabean' : farmView?.crop?.name}
                    initialState={farmView?.farm?.state ?? undefined}
                    externalCompareSlots={compareSlots}
                  />
                  <MandiExplore
                    onSelect={(sel) => setMarketSelection({ ...sel, nonce: Date.now() })}
                    onCompare={(sel) => setCompareSlots((prev) =>
                      prev.length >= 3 || prev.some((s) => s.state === sel.state && s.market === sel.market) ? prev : [...prev, sel])}
                  />
                </div>
              </ErrorBoundary>
            </TabPanel>
            <TabPanel active={activeTab === 'weather'}>
              <ErrorBoundary fallbackTitle="Could not load Weather">
                <div className="pb-28">
                  <WeatherStrip
                    lat={farmView?.farm?.lat ?? undefined}
                    lon={farmView?.farm?.lon ?? undefined}
                    locationName={[farmView?.farm?.district, farmView?.farm?.state].filter(Boolean).join(', ') || undefined}
                  />
                </div>
              </ErrorBoundary>
            </TabPanel>
            <TabPanel active={activeTab === 'profile'}>
              <ErrorBoundary fallbackTitle="Could not load your farm">
                <FarmView farmView={farmView} onEditFarm={() => setEditingFarm(true)} />
              </ErrorBoundary>
            </TabPanel>
          </>
        )}
      </main>

      {(editingFarm || (profileState === 'ready' && !hasFarm)) && (
      <Suspense fallback={null}>
      <FarmerOnboardingModal
        isOpen
        required={!hasFarm}
        onClose={() => setEditingFarm(false)}
        initialFarmerId={user.id}
        initialName={user.name || ''}
        initialFarmView={farmView}
        initialProfile={farmerProfile}
        onComplete={saveFarm}
      />
      </Suspense>
      )}

      <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto max-w-lg grid grid-cols-5">
          {tabs.map(({ id, icon: Icon, label }) => {
            const on = activeTab === id;
            return (
              <li key={id}>
                <button
                  onClick={() => setActiveTab(id)}
                  aria-current={on ? 'page' : undefined}
                  className={`w-full h-[72px] flex flex-col items-center justify-center gap-1 text-sm transition-colors ${on ? 'text-brand font-semibold' : 'text-ink-soft hover:text-ink'}`}
                >
                  <span className={`w-14 h-8 rounded-full flex items-center justify-center ${on ? 'bg-accent' : ''}`}>
                    <Icon size={20} aria-hidden />
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
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
