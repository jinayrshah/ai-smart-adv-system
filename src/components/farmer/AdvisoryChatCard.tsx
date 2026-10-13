import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Droplets,
  Sprout
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: number;
      query: string;
      response: AdvisoryAskResponse;
      feedbackGiven?: 1 | -1 | null;
    }>
  >([]);

  const quickPrompts = [
    `How much irrigation does my ${crop || 'crop'} need right now?`,
    `What fertilizer should I apply at the current growth stage?`,
    `What are the major pest & disease risks to watch out for?`,
    `Are there government schemes available for this crop?`
  ];

  const handleAsk = async (textToAsk: string) => {
    const q = textToAsk.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await askAdvisory({
        query: q,
        farm_id: farmId ? Number(farmId) : undefined,
        crop: crop || undefined,
        farmer_id: farmerId || undefined,
        sowing_date: sowingDate || undefined,
        soil_type: soilType || undefined,
        // The backend answers in English and translates with Bhashini (README §8).
        language: (i18n.language || 'en').split('-')[0]
      });

      setHistory(prev => [
        {
          id: resp.id,
          query: q,
          response: resp,
          feedbackGiven: null
        },
        ...prev
      ]);
      setQuery('');
    } catch (err: any) {
      setError(err.message || 'Failed to get advisory response. Please try again.');
    } finally {
      setLoading(false);
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
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 shadow-sm">
          <CheckCircle2 size={12} className="text-[#e8fe85]" />
          <span>ICAR Verified Grounded</span>
        </span>
      );
    }
    if (confidence === 'partial') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/30">
          <HelpCircle size={12} className="text-amber-400" />
          <span>Partially Grounded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
        <AlertTriangle size={12} className="text-stone-400" />
        <span>General Agronomy</span>
      </span>
    );
  };

  return (
    <div className="bg-[#111827] border border-stone-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-stone-800 flex items-center justify-between bg-[#07503f]/10">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#07503f] text-[#e8fe85] flex items-center justify-center font-bold shadow-md shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white flex items-center space-x-2 tracking-tight">
              <span>Personalized Agronomic Advisor</span>
              {crop && (
                <span className="text-xs px-3 py-0.5 bg-[#07503f] text-[#e8fe85] border border-[#e8fe85]/30 rounded-full font-bold">
                  {crop}
                </span>
              )}
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Strictly grounded in ICAR Packages of Practice, FAO-56 thermal stages, and real-time agromet weather.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick prompt suggestions */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider font-mono">
            Suggested Agronomic Inquiries
          </p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(promptText)}
                disabled={loading}
                className="text-xs text-stone-300 hover:text-white bg-stone-900 hover:bg-[#07503f]/20 border border-stone-700/80 hover:border-[#e8fe85]/60 rounded-full px-4 py-2 text-left transition-all duration-200 disabled:opacity-50"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input (33px rounded with pill submit button) */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleAsk(query);
          }}
          className="relative"
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Ask anything about ${crop || 'your crop'}, irrigation, fertilizers, or diseases...`}
            disabled={loading}
            className="w-full bg-stone-900 border border-stone-700/80 rounded-full pl-5 pr-28 py-3.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-[#e8fe85] focus:border-[#e8fe85] transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-5 bg-[#07503f] hover:bg-[#0d6e57] text-[#e8fe85] rounded-full text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-2 shadow-md"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin text-[#e8fe85]" />
            ) : (
              <>
                <span>Ask</span>
                <Send size={12} />
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Responses stream / history */}
        {history.length > 0 && (
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider font-mono">
              Recent Consultations
            </h3>
            {history.map(item => (
              <div
                key={item.id}
                className="bg-stone-900/60 border border-stone-800 rounded-3xl p-6 space-y-4 shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center space-x-2.5 text-xs font-bold text-white">
                    <MessageSquare size={15} className="text-[#e8fe85] shrink-0" />
                    <span>{item.query}</span>
                  </div>
                  {renderConfidenceBadge(item.response.confidence)}
                </div>

                {/* Computed context summary chip if present */}
                {item.response.computed?.growth_stage && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-[#07503f]/20 border border-[#07503f]/40 rounded-2xl text-[11px] text-[#f1efdf]">
                    <span className="font-bold flex items-center space-x-1.5 text-[#e8fe85]">
                      <Sprout size={14} />
                      <span>Stage: {item.response.computed.growth_stage.stage_name}</span>
                    </span>
                    {item.response.computed.irrigation && (
                      <span className="text-stone-300">
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
                  <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-[11px] text-amber-200">
                    <span className="font-bold block mb-1">This answer is approximate because:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-stone-300">
                      {item.response.computed.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Advisory response body */}
                <div className="text-sm text-stone-200 leading-relaxed whitespace-pre-line">
                  {item.response.response}
                </div>

                {/* Grounding Sources (Forest Section style) */}
                {item.response.sources && item.response.sources.length > 0 && (
                  <div className="pt-3 border-t border-stone-800">
                    <div className="text-[11px] font-bold text-stone-400 mb-2 flex items-center space-x-1.5 font-mono">
                      <BookOpen size={13} className="text-[#e8fe85]" />
                      <span>Grounded References & ICAR Package of Practice</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.response.sources.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[11px] bg-stone-800 text-stone-300 px-3 py-1 rounded-full border border-stone-700/80"
                        >
                          {src.title} {src.page ? `(p. ${src.page})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback buttons */}
                <div className="pt-3 flex items-center justify-between text-xs text-stone-400 border-t border-stone-800">
                  <span className="text-[11px]">Was this agronomic guidance helpful?</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.id, 1)}
                      disabled={item.feedbackGiven !== null && item.feedbackGiven !== undefined}
                      className={`p-2 rounded-full border transition-all ${
                        item.feedbackGiven === 1
                          ? 'bg-[#07503f] text-[#e8fe85] border-[#e8fe85]/40'
                          : 'hover:bg-stone-800 text-stone-400 border-stone-700'
                      }`}
                      title="Helpful"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.id, -1)}
                      disabled={item.feedbackGiven !== null && item.feedbackGiven !== undefined}
                      className={`p-2 rounded-full border transition-all ${
                        item.feedbackGiven === -1
                          ? 'bg-rose-950/60 text-rose-400 border-rose-500/40'
                          : 'hover:bg-stone-800 text-stone-400 border-stone-700'
                      }`}
                      title="Not helpful"
                    >
                      <ThumbsDown size={13} />
                    </button>
                    {item.feedbackGiven && (
                      <span className="text-[11px] text-[#e8fe85] font-bold ml-1">
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
