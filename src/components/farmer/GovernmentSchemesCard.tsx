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
    <div className="bg-[#ffffff] border border-[#c3cda7] rounded-[24px] p-6 sm:p-8 shadow-sm space-y-6 text-[#212529]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-[#e2dfcb]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#07503f] text-[#ffffff] flex items-center justify-center font-bold shadow-sm shrink-0">
            <Landmark size={22} className="text-[#e8fe85]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#212529] tracking-tight">
                National Agricultural Welfare Schemes
              </h2>
              <span className="text-[11px] px-3 py-0.5 rounded-full bg-[#07503f] text-[#ffffff] font-bold font-mono">
                Official Central Govt
              </span>
            </div>
            <p className="text-xs text-[#6d6d6d] mt-1">
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
            className="w-full bg-[#faf9f2] border border-[#c3cda7] rounded-full pl-10 pr-4 py-2.5 text-xs text-[#212529] placeholder-[#6d6d6d] focus:outline-none focus:ring-1 focus:ring-[#07503f] focus:border-[#07503f] transition-all shadow-inner"
          />
          <Search size={14} className="absolute left-3.5 top-3 text-[#6d6d6d]" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
          <button
            key={catKey}
            onClick={() => setSelectedCategory(catKey)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              selectedCategory === catKey
                ? 'bg-[#07503f] text-[#ffffff] shadow-sm'
                : 'bg-[#f1efdf] text-[#353535] hover:text-[#07503f] hover:bg-[#e6ecd5] border border-[#c3cda7]'
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
            <div className="flex items-center justify-center p-12 text-[#6d6d6d] text-xs font-mono">
              <Loader2 size={16} className="animate-spin mr-2 text-[#07503f]" />
              Loading verified scheme catalog...
            </div>
          ) : schemes.length === 0 ? (
            <div className="text-center p-12 text-[#6d6d6d] text-xs">
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
                      ? 'bg-[#e6ecd5] border-[#07503f] ring-1 ring-[#07503f]/30 shadow-sm'
                      : 'bg-[#faf9f2] border-[#e2dfcb] hover:bg-[#f1efdf]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#ffffff] bg-[#07503f] px-2.5 py-0.5 rounded-full font-mono">
                      {scheme.code}
                    </span>
                    <ChevronRight size={14} className={isSelected ? 'text-[#07503f]' : 'text-[#6d6d6d]'} />
                  </div>
                  <h4 className="font-serif text-base font-bold text-[#212529] mt-2 line-clamp-1">
                    {scheme.name}
                  </h4>
                  <p className="text-xs text-[#6d6d6d] mt-1 line-clamp-2 leading-relaxed">
                    {scheme.benefit_summary}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Scheme Detail */}
        <div className="lg:col-span-7 bg-[#faf9f2] border border-[#e2dfcb] rounded-[24px] p-6 flex flex-col justify-between shadow-sm">
          {selectedScheme ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#212529]">
                    {selectedScheme.name} ({selectedScheme.code})
                  </h3>
                  {selectedScheme.official_portal && (
                    <a
                      href={selectedScheme.official_portal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#ffffff] font-bold transition-colors bg-[#07503f] hover:bg-[#0d6e57] px-3.5 py-1.5 rounded-full shadow-sm"
                    >
                      Official Portal <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Benefit Banner */}
              <div className="p-5 bg-[#07503f] text-[#ffffff] rounded-[20px] shadow-sm">
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#e8fe85] flex items-center gap-1.5 mb-1.5 font-mono">
                  <ShieldCheck size={14} /> Financial Benefit & Assistance
                </div>
                <p className="text-xs text-stone-200 leading-relaxed font-sans">
                  {selectedScheme.benefit_summary}
                </p>
              </div>

              {/* Eligibility & Application (Quilted pastel tiles) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 bg-[#b2cee7] border border-[#9bbddc] rounded-[20px] text-[#212529]">
                  <div className="text-[11px] font-bold text-[#07503f] mb-1.5 flex items-center gap-1.5 font-mono">
                    <CheckCircle size={13} /> Eligibility
                  </div>
                  <p className="text-xs text-[#212529] leading-relaxed">
                    {selectedScheme.eligibility}
                  </p>
                </div>
                <div className="p-4 bg-[#fceace] border border-[#ebd1aa] rounded-[20px] text-[#212529]">
                  <div className="text-[11px] font-bold text-[#07503f] mb-1.5 flex items-center gap-1.5 font-mono">
                    <HelpCircle size={13} /> How to Apply
                  </div>
                  <p className="text-xs text-[#212529] leading-relaxed">
                    {selectedScheme.application_process}
                  </p>
                </div>
              </div>

              {/* AI Advisor Guidance */}
              <div className="pt-3 border-t border-[#e2dfcb] flex items-center gap-2.5 text-xs text-[#353535] bg-[#ffffff] p-3.5 rounded-2xl border border-[#c3cda7]">
                <Sparkles size={16} className="text-[#07503f] shrink-0" />
                <span>
                  Have questions about eligibility, application deadlines, or subsidies? Ask our <strong className="text-[#07503f]">AI Advisor</strong> directly in the chat below.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center p-12 text-[#6d6d6d] text-xs">
              Select a scheme from the list to view verified benefits and guidelines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
