import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
    <div className="bg-[#111827] border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-stone-800">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold shadow-md shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                National Agricultural Welfare Schemes
              </h2>
              <span className="text-[11px] px-3 py-0.5 rounded-full bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 font-bold">
                Official Central Govt
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Verified financial benefits, interest subventions, subsidized crop insurance, and direct DBT assistance.
            </p>
          </div>
        </div>

        {/* Search (33px rounded) */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scheme, subsidy, loan..."
            className="w-full bg-stone-900 border border-stone-700/80 rounded-full pl-10 pr-4 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-[#e8fe85] focus:border-[#e8fe85] transition-all"
          />
          <Search size={14} className="absolute left-3.5 top-3 text-stone-400" />
        </form>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
        {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
          <button
            key={catKey}
            onClick={() => setSelectedCategory(catKey)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              selectedCategory === catKey
                ? 'bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/40 shadow-md'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Grid: Left Catalog, Right Details & Q&A */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-1">
        {/* Schemes List */}
        <div className="lg:col-span-5 space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-stone-400 text-xs font-mono">
              <Loader2 size={16} className="animate-spin mr-2 text-[#e8fe85]" />
              Loading verified scheme catalog...
            </div>
          ) : schemes.length === 0 ? (
            <div className="text-center p-12 text-stone-400 text-xs">
              No matching welfare schemes found.
            </div>
          ) : (
            schemes.map((scheme, idx) => {
              const isSelected = selectedScheme?.code === scheme.code;
              const tints = ['border-[#d0e6f6]/30', 'border-[#f8d4c8]/30', 'border-[#d9e2d5]/30', 'border-[#d5d8db]/30'];
              const tint = tints[idx % tints.length];

              return (
                <div
                  key={scheme.code}
                  onClick={() => {
                    setSelectedScheme(scheme);
                    setAskResponse(null);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#07503f]/30 border-[#e8fe85] ring-1 ring-[#e8fe85]/40 shadow-lg'
                      : `bg-stone-900/60 ${tint} hover:bg-stone-800/60`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#e8fe85] bg-[#07503f] px-2.5 py-0.5 rounded-full border border-[#e8fe85]/20">
                      {scheme.code}
                    </span>
                    <ChevronRight size={14} className={isSelected ? 'text-[#e8fe85]' : 'text-stone-500'} />
                  </div>
                  <h4 className="font-serif text-base font-bold text-stone-100 mt-2 line-clamp-1">
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
        <div className="lg:col-span-7 bg-stone-900/70 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          {selectedScheme ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl font-bold text-white">
                    {selectedScheme.name} ({selectedScheme.code})
                  </h3>
                  {selectedScheme.official_portal && (
                    <a
                      href={selectedScheme.official_portal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#e8fe85] hover:underline font-bold transition-colors bg-[#07503f]/50 px-3 py-1 rounded-full border border-[#07503f]"
                    >
                      Portal <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Benefit Banner (Forest Section Banner) */}
              <div className="p-4 bg-[#07503f]/25 border border-[#07503f]/50 rounded-2xl">
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#e8fe85] flex items-center gap-1.5 mb-1.5 font-mono">
                  <ShieldCheck size={14} /> Financial Benefit & Assistance
                </div>
                <p className="text-xs text-stone-200 leading-relaxed">
                  {selectedScheme.benefit_summary}
                </p>
              </div>

              {/* Eligibility & Application (Pastel cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 bg-[#d0e6f6]/10 border border-[#d0e6f6]/25 rounded-2xl">
                  <div className="text-[11px] font-bold text-[#d0e6f6] mb-1.5 flex items-center gap-1.5 font-mono">
                    <CheckCircle size={13} /> Eligibility
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    {selectedScheme.eligibility}
                  </p>
                </div>
                <div className="p-4 bg-[#f8d4c8]/10 border border-[#f8d4c8]/25 rounded-2xl">
                  <div className="text-[11px] font-bold text-[#f8d4c8] mb-1.5 flex items-center gap-1.5 font-mono">
                    <HelpCircle size={13} /> How to Apply
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    {selectedScheme.application_process}
                  </p>
                </div>
              </div>

              {/* Grounded RAG Q&A Assistant */}
              <div className="pt-3 border-t border-stone-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300 mb-2.5 font-mono">
                  <Sparkles size={14} className="text-[#e8fe85]" />
                  Ask Scheme Specific Question (Grounded RAG)
                </div>

                <form onSubmit={handleAsk} className="flex gap-2">
                  <input
                    type="text"
                    value={askQuery}
                    onChange={(e) => setAskQuery(e.target.value)}
                    placeholder="e.g. What is the subsidized premium rate or cut-off date?"
                    className="flex-1 bg-stone-900 border border-stone-700/80 rounded-full px-4 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-[#e8fe85] focus:border-[#e8fe85]"
                  />
                  <button
                    type="submit"
                    disabled={asking || !askQuery.trim()}
                    className="px-5 py-2.5 bg-[#07503f] hover:bg-[#0d6e57] disabled:opacity-50 text-[#e8fe85] rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    {asking ? <Loader2 size={13} className="animate-spin text-[#e8fe85]" /> : <Send size={13} />}
                    Ask
                  </button>
                </form>

                {askError && (
                  <div className="mt-2.5 p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-xs text-rose-300">
                    <AlertCircle size={14} />
                    {askError}
                  </div>
                )}

                {askResponse && (
                  <div className="mt-3 p-4 bg-stone-900/90 border border-stone-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono">
                        Grounded Answer
                      </span>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          askResponse.confidence === 'grounded'
                            ? 'bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {askResponse.confidence}
                      </span>
                    </div>
                    <div className="text-xs text-stone-200 leading-relaxed prose prose-invert prose-xs max-w-none prose-p:text-stone-200 prose-headings:text-white prose-headings:text-sm prose-li:text-stone-300 prose-strong:text-white">
                      <ReactMarkdown>{askResponse.answer}</ReactMarkdown>
                    </div>
                    {askResponse.sources.length > 0 && (
                      <div className="pt-2 border-t border-stone-800 flex flex-wrap gap-1.5">
                        {askResponse.sources.map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2.5 py-0.5 bg-stone-800 text-stone-300 rounded-full border border-stone-700"
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
            <div className="text-center p-12 text-stone-400 text-xs">
              Select a scheme from the list to view verified benefits and guidelines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
