import React, { useState } from 'react';
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
        language: 'en'
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
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={11} />
          <span>ICAR Verified Grounded</span>
        </span>
      );
    }
    if (confidence === 'partial') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <HelpCircle size={11} />
          <span>Partially Grounded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-500/20 text-stone-300 border border-stone-500/30">
        <AlertTriangle size={11} />
        <span>General Agronomy</span>
      </span>
    );
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-dark-border/80 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-brand-green/15 text-brand-green rounded-2xl border border-brand-green/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-100 flex items-center space-x-2">
              <span>Personalized Agronomic Advisor</span>
              {crop && (
                <span className="text-xs px-2 py-0.5 bg-stone-800 text-stone-300 rounded-full font-normal">
                  {crop}
                </span>
              )}
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Strictly grounded in ICAR Packages of Practice, FAO-56 thermal stages, and real-time agromet weather.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Quick prompt suggestions */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Suggested Agronomic Questions
          </p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(promptText)}
                disabled={loading}
                className="text-xs text-stone-300 hover:text-white bg-dark-bg/60 hover:bg-stone-800/80 border border-dark-border hover:border-emerald-500/40 rounded-xl px-3 py-2 text-left transition-all disabled:opacity-50"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input */}
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
            className="w-full bg-dark-bg/80 border border-dark-border rounded-2xl pl-4 pr-24 py-3.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-brand-green transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-4 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-1.5"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <span>Ask</span>
                <Send size={12} />
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Responses stream / history */}
        {history.length > 0 && (
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Recent Consultations
            </h3>
            {history.map(item => (
              <div
                key={item.id}
                className="bg-dark-bg/50 border border-dark-border/80 rounded-2xl p-5 space-y-3.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center space-x-2 text-xs font-bold text-stone-200">
                    <MessageSquare size={14} className="text-brand-green shrink-0" />
                    <span>{item.query}</span>
                  </div>
                  {renderConfidenceBadge(item.response.confidence)}
                </div>

                {/* Computed context summary chip if present */}
                {item.response.computed?.growth_stage && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300">
                    <span className="font-semibold flex items-center space-x-1">
                      <Sprout size={12} />
                      <span>Stage: {item.response.computed.growth_stage.stage_name}</span>
                    </span>
                    {item.response.computed.irrigation && (
                      <span className="text-stone-400">
                        • Deficit: {item.response.computed.irrigation.deficit_mm} mm
                      </span>
                    )}
                  </div>
                )}

                {/* Advisory response body */}
                <div className="text-sm text-stone-300 leading-relaxed whitespace-pre-line">
                  {item.response.response}
                </div>

                {/* Grounding Sources */}
                {item.response.sources && item.response.sources.length > 0 && (
                  <div className="pt-2 border-t border-dark-border/50">
                    <div className="text-[11px] font-bold text-stone-400 mb-1.5 flex items-center space-x-1">
                      <BookOpen size={12} className="text-emerald-400" />
                      <span>Grounded References & Package of Practice</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.response.sources.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[10px] bg-stone-800/80 text-stone-300 px-2 py-0.5 rounded-lg border border-dark-border"
                        >
                          {src.title} {src.page ? `(p. ${src.page})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback buttons */}
                <div className="pt-2 flex items-center justify-between text-xs text-stone-400 border-t border-dark-border/40">
                  <span className="text-[11px]">Was this agronomic guidance helpful?</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.id, 1)}
                      disabled={item.feedbackGiven !== null && item.feedbackGiven !== undefined}
                      className={`p-1.5 rounded-lg border transition-all ${
                        item.feedbackGiven === 1
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'hover:bg-stone-800 text-stone-400 border-dark-border'
                      }`}
                      title="Helpful"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(item.id, -1)}
                      disabled={item.feedbackGiven !== null && item.feedbackGiven !== undefined}
                      className={`p-1.5 rounded-lg border transition-all ${
                        item.feedbackGiven === -1
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'hover:bg-stone-800 text-stone-400 border-dark-border'
                      }`}
                      title="Not helpful"
                    >
                      <ThumbsDown size={13} />
                    </button>
                    {item.feedbackGiven && (
                      <span className="text-[10px] text-emerald-400 ml-1">
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
