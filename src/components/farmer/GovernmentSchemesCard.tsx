import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Send,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  fetchGovernmentSchemes,
  askSchemeAdvisory,
  GovernmentScheme,
  SchemeAskResponse,
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

  // Q&A State
  const [askQuery, setAskQuery] = useState<string>('');
  const [asking, setAsking] = useState<boolean>(false);
  const [askResponse, setAskResponse] = useState<SchemeAskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

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

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim()) return;

    setAsking(true);
    setAskError(null);
    setAskResponse(null);
    try {
      const res = await askSchemeAdvisory({
        query: askQuery,
        scheme_code: selectedScheme?.code,
      });
      setAskResponse(res);
    } catch (err: any) {
      setAskError(err.message || 'Failed to retrieve scheme advisory');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Landmark size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
              National Agricultural Welfare Schemes
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                Official Central Govt
              </span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Verified financial benefits, interest subventions, subsidized crop insurance, and direct DBT assistance.
            </p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scheme, subsidy, loan..."
            className="w-full bg-stone-950/80 border border-stone-800 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-stone-500" />
        </form>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
        {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
          <button
            key={catKey}
            onClick={() => setSelectedCategory(catKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === catKey
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                : 'bg-stone-800/60 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Grid: Left Catalog, Right Details & Q&A */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
        {/* Schemes List */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-stone-500 text-xs">
              <Loader2 size={16} className="animate-spin mr-2 text-emerald-400" />
              Loading verified scheme catalog...
            </div>
          ) : schemes.length === 0 ? (
            <div className="text-center p-8 text-stone-500 text-xs">
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
                    setAskResponse(null);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm'
                      : 'bg-stone-950/40 border-stone-800/80 hover:border-stone-700/80 hover:bg-stone-800/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                      {scheme.code}
                    </span>
                    <ChevronRight size={14} className={isSelected ? 'text-emerald-400' : 'text-stone-600'} />
                  </div>
                  <h4 className="text-sm font-semibold text-stone-200 mt-2 line-clamp-1">
                    {scheme.name}
                  </h4>
                  <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                    {scheme.benefit_summary}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Scheme Detail & RAG Q&A */}
        <div className="lg:col-span-7 bg-stone-950/60 border border-stone-800/80 rounded-2xl p-5 flex flex-col justify-between">
          {selectedScheme ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-stone-100">
                    {selectedScheme.name} ({selectedScheme.code})
                  </h3>
                  {selectedScheme.official_portal && (
                    <a
                      href={selectedScheme.official_portal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                      Official Portal <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Benefit Banner */}
              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                  <ShieldCheck size={14} /> Financial Benefit & Assistance
                </div>
                <p className="text-xs text-stone-200 leading-relaxed">
                  {selectedScheme.benefit_summary}
                </p>
              </div>

              {/* Eligibility & Application */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-stone-900/60 border border-stone-800 rounded-xl">
                  <div className="text-[11px] font-semibold text-stone-400 mb-1 flex items-center gap-1">
                    <CheckCircle size={12} className="text-emerald-400" /> Eligibility
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    {selectedScheme.eligibility}
                  </p>
                </div>
                <div className="p-3 bg-stone-900/60 border border-stone-800 rounded-xl">
                  <div className="text-[11px] font-semibold text-stone-400 mb-1 flex items-center gap-1">
                    <HelpCircle size={12} className="text-emerald-400" /> How to Apply
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    {selectedScheme.application_process}
                  </p>
                </div>
              </div>

              {/* Grounded RAG Q&A Assistant */}
              <div className="pt-2 border-t border-stone-800/80">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 mb-2">
                  <Sparkles size={14} className="text-amber-400" />
                  Ask Scheme Specific Question (Grounded RAG)
                </div>

                <form onSubmit={handleAsk} className="flex gap-2">
                  <input
                    type="text"
                    value={askQuery}
                    onChange={(e) => setAskQuery(e.target.value)}
                    placeholder={`e.g. What is the subsidized premium rate or cut-off date?`}
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="submit"
                    disabled={asking || !askQuery.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    {asking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Ask
                  </button>
                </form>

                {askError && (
                  <div className="mt-2.5 p-2.5 bg-red-950/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
                    <AlertCircle size={14} />
                    {askError}
                  </div>
                )}

                {askResponse && (
                  <div className="mt-3 p-3.5 bg-stone-900/90 border border-stone-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                        Grounded Answer
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          askResponse.confidence === 'grounded'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {askResponse.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-stone-200 leading-relaxed">
                      {askResponse.answer}
                    </p>
                    {askResponse.sources.length > 0 && (
                      <div className="pt-2 border-t border-stone-800/60 flex flex-wrap gap-1.5">
                        {askResponse.sources.map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 bg-stone-800/80 text-stone-400 rounded-md"
                          >
                            Source: {s.title} {s.page ? `(p.${s.page})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-stone-500 text-xs">
              Select a scheme from the list to view verified benefits and guidelines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
