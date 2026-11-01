import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  fetchGovernmentSchemes,
  GovernmentScheme,
} from '../../lib/api/advisory';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Categories',
  income_support: 'Direct Income Support',
  crop_insurance: 'Crop Loss Insurance',
  credit_finance: 'Credit & Loans',
  soil_health: 'Soil Health & Testing',
  infrastructure: 'Post-Harvest Infrastructure',
  organic_farming: 'Organic Farming',
};

export const GovernmentSchemesCard: React.FC = () => {
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedScheme, setSelectedScheme] = useState<GovernmentScheme | null>(null);

  useEffect(() => {
    loadSchemes();
  }, [selectedCategory]);

  const loadSchemes = async () => {
    setLoading(true);
    try {
      const data = await fetchGovernmentSchemes({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        query: searchQuery || undefined,
      });
      setSchemes(data);
      if (data.length > 0 && !selectedScheme) {
        setSelectedScheme(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load schemes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSchemes();
  };

  return (
    <div className="bg-surface border border-line rounded-[24px] p-6 sm:p-8 space-y-6 text-ink">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-line">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-brand text-surface flex items-center justify-center font-bold shrink-0">
            <Landmark size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                National Agricultural Welfare Schemes
              </h2>
              <span className="text-sm px-3 py-0.5 rounded-full bg-brand text-surface font-bold">
                Official Central Govt
              </span>
            </div>
            <p className="text-sm text-ink-soft mt-1">
              Verified financial benefits, interest subventions, subsidized crop insurance, and direct DBT assistance.
            </p>
          </div>
        </div>

        {/* Search (33px rounded) */}
        <div className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                loadSchemes();
              }
            }}
            placeholder="Search scheme, subsidy, loan..."
            className="w-full bg-ground border border-line rounded-full pl-10 pr-4 py-2.5 text-sm text-ink placeholder-ink-soft focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all shadow-inner"
          />
          <Search size={14} className="absolute left-3.5 top-3 text-ink-soft" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
          <button
            key={catKey}
            onClick={() => setSelectedCategory(catKey)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              selectedCategory === catKey
                ? 'bg-brand text-surface'
                : 'bg-ground text-ink hover:text-brand hover:bg-tint border border-line'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Grid: Left Catalog, Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-1">
        {/* Schemes List */}
        <div className="lg:col-span-5 space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-ink-soft text-sm">
              <Loader2 size={16} className="animate-spin mr-2 text-brand" />
              Loading verified scheme catalog...
            </div>
          ) : schemes.length === 0 ? (
            <div className="text-center p-12 text-ink-soft text-sm">
              No matching welfare schemes found.
            </div>
          ) : (
            schemes.map((scheme) => {
              const isSelected = selectedScheme?.code === scheme.code;

              return (
                <div
                  key={scheme.code}
                  onClick={() => {
                    setSelectedScheme(scheme);
                  }}
                  className={`p-4 rounded-[20px] border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-tint border-brand ring-1 ring-brand/30'
                      : 'bg-ground border-line hover:bg-ground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-surface bg-brand px-2.5 py-0.5 rounded-full">
                      {scheme.code}
                    </span>
                    <ChevronRight size={14} className={isSelected ? 'text-brand' : 'text-ink-soft'} />
                  </div>
                  <h4 className="text-base font-bold text-ink mt-2 line-clamp-1">
                    {scheme.name}
                  </h4>
                  <p className="text-sm text-ink-soft mt-1 line-clamp-2 leading-relaxed">
                    {scheme.benefit_summary}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Scheme Detail */}
        <div className="lg:col-span-7 bg-ground border border-line rounded-[24px] p-6 flex flex-col justify-between">
          {selectedScheme ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl sm:text-2xl font-bold text-ink">
                    {selectedScheme.name} ({selectedScheme.code})
                  </h3>
                  {selectedScheme.official_portal && (
                    <a
                      href={selectedScheme.official_portal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-surface font-bold transition-colors bg-brand hover:bg-brand-dark px-3.5 py-1.5 rounded-full"
                    >
                      Official Portal <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Benefit Banner */}
              <div className="p-5 bg-brand text-surface rounded-[20px]">
                <div className="text-sm font-bold text-accent flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck size={14} /> Financial Benefit & Assistance
                </div>
                <p className="text-sm text-stone-200 leading-relaxed font-sans">
                  {selectedScheme.benefit_summary}
                </p>
              </div>

              {/* Eligibility & Application (Quilted pastel tiles) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 bg-sky border border-sky rounded-[20px] text-ink">
                  <div className="text-sm font-bold text-brand mb-1.5 flex items-center gap-1.5">
                    <CheckCircle size={13} /> Eligibility
                  </div>
                  <p className="text-sm text-ink leading-relaxed">
                    {selectedScheme.eligibility}
                  </p>
                </div>
                <div className="p-4 bg-warn-bg border border-warn-bg rounded-[20px] text-ink">
                  <div className="text-sm font-bold text-brand mb-1.5 flex items-center gap-1.5">
                    <HelpCircle size={13} /> How to Apply
                  </div>
                  <p className="text-sm text-ink leading-relaxed">
                    {selectedScheme.application_process}
                  </p>
                </div>
              </div>

              {/* AI Advisor Guidance */}
              <div className="pt-3 border-t border-line flex items-center gap-2.5 text-sm text-ink bg-surface p-3.5 rounded-2xl border border-line">
                <Sparkles size={16} className="text-brand shrink-0" />
                <span>
                  Questions about eligibility or deadlines? Switch to <strong className="text-brand">Ask</strong> above and ask the Advisor.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center p-12 text-ink-soft text-sm">
              Select a scheme from the list to view verified benefits and guidelines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
