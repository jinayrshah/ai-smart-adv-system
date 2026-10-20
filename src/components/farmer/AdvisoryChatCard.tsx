import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sprout,
  RotateCcw,
} from 'lucide-react';
import {
  askAdvisory,
  sendAdvisoryFeedback,
  AdvisoryAskResponse
} from '../../lib/api/advisory';

interface Props {
  farmId?: string;
  crop?: string;
  farmerId?: string;
  sowingDate?: string;
  soilType?: string;
}

export const AdvisoryChatCard: React.FC<Props> = ({
  farmId,
  crop,
  farmerId,
  sowingDate,
  soilType
}) => {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [pendingQuery, setPendingQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `advisory_chat_history_${farmerId || farmId || 'farmer'}`;

  const [history, setHistory] = useState<
    Array<{
      id: number;
      query: string;
      response: AdvisoryAskResponse;
      feedbackGiven?: 1 | -1 | null;
    }>
  >(() => {
    try {
      const saved = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync history to both sessionStorage and localStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(history));
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {}
  }, [history, storageKey]);

  // When farmer or farm changes, load their corresponding history
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
      if (saved) {
        setHistory(JSON.parse(saved));
      } else {
        setHistory([]);
      }
    } catch {}
  }, [storageKey]);

  const handleClearHistory = () => {
    setHistory([]);
    try {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    } catch {}
  };

  const quickPrompts = [
    `How much water does my ${crop || 'crop'} need right now?`,
    `What fertilizer should I apply at the current stage?`,
    `What pests & diseases should I watch out for now?`,
    `Are there government schemes for ${crop || 'this crop'}?`,
    `When should I harvest based on current weather?`,
  ];

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, loading]);

  const handleAsk = async (textToAsk: string) => {
    const q = textToAsk.trim();
    if (!q || loading) return;

    setLoading(true);
    setPendingQuery(q);
    setError(null);

    try {
      const parsedFarmId = (farmId && !isNaN(Number(farmId)) && Number(farmId) > 0) ? Number(farmId) : undefined;
      let resp: AdvisoryAskResponse | null = null;

      try {
        resp = await askAdvisory({
          query: q,
          farm_id: parsedFarmId,
          crop: crop || undefined,
          farmer_id: farmerId || undefined,
          sowing_date: sowingDate || undefined,
          soil_type: soilType || undefined,
          language: (i18n.language || 'en').split('-')[0]
        });
      } catch (firstErr: any) {
        // If failed with crop-specific validation, retry as general query without crop
        console.warn('Advisory ask failed, retrying without crop:', firstErr?.message || firstErr);
        try {
          resp = await askAdvisory({
            query: q,
            farm_id: parsedFarmId,
            farmer_id: farmerId || undefined,
            language: (i18n.language || 'en').split('-')[0]
          });
        } catch (retryErr: any) {
          console.warn('Advisory ask retry also failed:', retryErr?.message || retryErr);
        }
      }

      // Final fallback: direct Gemini chat if backend is completely down
      if (!resp?.response) {
        try {
          const { generateChatResponse } = await import('../../services/ragService');
          const fallbackText = await generateChatResponse(q);
          if (fallbackText) {
            resp = {
              id: 0,
              response: fallbackText,
              confidence: 'partial' as const,
              sources: [],
              computed: {} as any,
              retrieved_chunk_ids: [],
              generated_by: 'direct_gemini_fallback',
            };
          }
        } catch (fbErr) {
          console.warn('Final Gemini fallback failed:', fbErr);
        }
      }

      if (resp?.response) {
        setHistory(prev => [
          {
            id: resp!.id,
            query: q,
            response: resp!,
            feedbackGiven: null
          },
          ...prev
        ]);
        setQuery('');
        setPendingQuery('');
      } else {
        setError('The advisory service is temporarily unavailable. Please try again in a moment or consult your local KVK.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get advisory response. Please try again.');
    } finally {
      setLoading(false);
      setPendingQuery('');
    }
  };

  const handleFeedback = async (queryId: number, fb: 1 | -1) => {
    try {
      await sendAdvisoryFeedback(queryId, fb);
      setHistory(prev =>
        prev.map(item =>
          item.id === queryId ? { ...item, feedbackGiven: fb } : item
        )
      );
    } catch (err) {
      console.error('Failed to submit feedback', err);
    }
  };

  const renderConfidenceBadge = (confidence: string) => {
    if (confidence === 'grounded') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] text-[#ffffff] shadow-sm font-mono">
          <CheckCircle2 size={12} className="text-[#e8fe85]" />
          <span>ICAR Verified Grounded</span>
        </span>
      );
    }
    if (confidence === 'partial') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#fceace] text-[#07503f] border border-[#ebd1aa] font-mono">
          <HelpCircle size={12} className="text-[#07503f]" />
          <span>Partially Grounded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#efefef] text-[#353535] border border-[#d5d8db] font-mono">
        <AlertTriangle size={12} className="text-[#6d6d6d]" />
        <span>General Agronomy</span>
      </span>
    );
  };

  return (
    <div className="bg-[#ffffff] border border-[#c3cda7] rounded-[24px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-[#e2dfcb] flex items-center justify-between bg-[#faf9f2]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#07503f] text-[#ffffff] flex items-center justify-center font-bold shadow-sm shrink-0">
            <Sparkles size={22} className="text-[#e8fe85]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#212529] flex items-center space-x-2 tracking-tight">
              <span>Personalized Agronomic Advisor</span>
              {crop && (
                <span className="text-xs px-3 py-0.5 bg-[#07503f] text-[#ffffff] rounded-full font-bold">
                  {crop}
                </span>
              )}
            </h2>
            <p className="text-xs text-[#6d6d6d] mt-1">
              Strictly grounded in ICAR Packages of Practice, FAO-56 thermal stages, and real-time agromet weather.
            </p>
          </div>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-[#555e4a] hover:text-[#b42318] bg-[#f1efdf] hover:bg-[#fee4e2] border border-[#c3cda7] hover:border-[#fecdca] rounded-full transition-all cursor-pointer font-mono shrink-0 ml-3"
            title="Clear discussion history"
          >
            <RotateCcw size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Quick prompt suggestions */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider font-mono">
            Suggested Agronomic Inquiries
          </p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAsk(promptText);
                }}
                disabled={loading}
                className="text-xs text-[#212529] hover:text-[#07503f] bg-[#f1efdf] hover:bg-[#e6ecd5] border border-[#c3cda7] rounded-full px-4 py-2 text-left transition-all duration-200 disabled:opacity-50 cursor-pointer"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input (33px rounded with pill submit button) */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAsk(query);
              }
            }}
            placeholder={`Ask anything about ${crop || 'your crop'}, irrigation, fertilizers, or diseases...`}
            disabled={loading}
            className="w-full bg-[#ffffff] border border-[#c3cda7] rounded-full pl-5 pr-28 py-3.5 text-sm text-[#212529] placeholder-[#6d6d6d] focus:outline-none focus:ring-1 focus:ring-[#07503f] focus:border-[#07503f] transition-all shadow-inner"
          />
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleAsk(query);
            }}
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-[#07503f] hover:bg-[#0d6e57] text-[#ffffff] rounded-full text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-2 shadow-sm cursor-pointer"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin text-[#ffffff]" />
            ) : (
              <>
                <span>Ask</span>
                <Send size={12} />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Active pending inquiry loading indicator */}
        {loading && (
          <div className="bg-[#faf9f2] border border-[#c3cda7] rounded-[24px] p-6 space-y-4 shadow-sm animate-pulse">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2.5 text-sm font-bold text-[#212529]">
                <MessageSquare size={16} className="text-[#07503f] shrink-0" />
                <span>{pendingQuery || 'Analyzing agronomic inquiry...'}</span>
              </div>
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#e6ecd5] text-[#07503f] font-mono shrink-0">
                <Loader2 size={12} className="animate-spin text-[#07503f]" />
                <span>Consulting ICAR & Agro-weather...</span>
              </span>
            </div>
            <div className="space-y-2.5 pt-2">
              <div className="h-4 bg-[#e6ecd5]/70 rounded-md w-3/4"></div>
              <div className="h-4 bg-[#e6ecd5]/50 rounded-md w-5/6"></div>
              <div className="h-4 bg-[#e6ecd5]/60 rounded-md w-2/3"></div>
            </div>
          </div>
        )}

        {/* Responses stream / history */}
        {history.length > 0 && (
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-[#6d6d6d] uppercase tracking-wider font-mono">
              Recent Consultations
            </h3>
            {history.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="bg-[#faf9f2] border border-[#e2dfcb] rounded-[24px] p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center space-x-2.5 text-sm font-bold text-[#212529]">
                    <MessageSquare size={16} className="text-[#07503f] shrink-0" />
                    <span>{item.query}</span>
                  </div>
                  {renderConfidenceBadge(item.response.confidence)}
                </div>

                {/* Computed context summary chip if present */}
                {item.response.computed?.growth_stage && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-[#e6ecd5] border border-[#c3cda7] rounded-2xl text-[11px] text-[#212529]">
                    <span className="font-bold flex items-center space-x-1.5 text-[#07503f]">
                      <Sprout size={14} />
                      <span>Stage: {item.response.computed.growth_stage.stage_name}</span>
                    </span>
                    {item.response.computed.irrigation && (
                      <span className="text-[#353535]">
                        • Water:{' '}
                        {{
                          irrigate_now: 'irrigate now',
                          wait_for_rain: 'wait for forecast rain',
                          no_irrigation_needed: 'no irrigation needed',
                          monitor: 'keep an eye on it',
                          unknown: 'not enough data',
                        }[item.response.computed.irrigation.action ?? 'monitor'] ?? 'see answer'}
                      </span>
                    )}
                  </div>
                )}

                {item.response.computed?.assumptions && item.response.computed.assumptions.length > 0 && (
                  <div className="p-3 bg-[#fceace] border border-[#ebd1aa] rounded-2xl text-[11px] text-[#212529]">
                    <span className="font-bold block mb-1 text-[#07503f]">This answer is approximate because:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[#353535]">
                      {item.response.computed.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Advisory response body — rendered as Markdown */}
                <div className="text-sm text-[#212529] leading-relaxed prose prose-stone max-w-none prose-p:text-[#212529] prose-headings:text-[#212529] prose-headings:font-bold prose-strong:text-[#07503f] prose-li:text-[#353535]">
                  <ReactMarkdown>{item.response.response}</ReactMarkdown>
                </div>

                {/* Grounding Sources */}
                {item.response.sources && item.response.sources.length > 0 && (
                  <div className="pt-3 border-t border-[#e2dfcb]">
                    <div className="text-[11px] font-bold text-[#07503f] mb-2 flex items-center space-x-1.5 font-mono">
                      <BookOpen size={13} />
                      <span>Grounded References & ICAR Package of Practice</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.response.sources.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[11px] bg-[#ffffff] text-[#07503f] px-3 py-1 rounded-full border border-[#c3cda7] shadow-xs"
                        >
                          {src.title} {src.page ? `(p. ${src.page})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback buttons */}
                <div className="pt-3 flex items-center justify-between text-xs text-[#6d6d6d] border-t border-[#e2dfcb]">
                  <span className="text-[11px]">Was this agronomic guidance helpful?</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.id, 1)}
                      disabled={item.feedbackGiven !== null && item.feedbackGiven !== undefined}
                      className={`p-2 rounded-full border transition-all cursor-pointer ${
                        item.feedbackGiven === 1
                          ? 'bg-[#07503f] text-[#ffffff] border-[#07503f]'
                          : 'hover:bg-[#f1efdf] text-[#6d6d6d] border-[#c3cda7]'
                      }`}
                      title="Helpful"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.id, -1)}
                      disabled={item.feedbackGiven !== null && item.feedbackGiven !== undefined}
                      className={`p-2 rounded-full border transition-all cursor-pointer ${
                        item.feedbackGiven === -1
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'hover:bg-[#f1efdf] text-[#6d6d6d] border-[#c3cda7]'
                      }`}
                      title="Not helpful"
                    >
                      <ThumbsDown size={13} />
                    </button>
                    {item.feedbackGiven && (
                      <span className="text-[11px] text-[#07503f] font-bold ml-1">
                        Feedback recorded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
