import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Camera, Loader2, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  askAdvisory, checkCropDisease, sendAdvisoryFeedback,
  type AdvisoryAskResponse, type DiseaseCheckResponse,
} from '../../lib/api/advisory';
import type { FarmerProfileView } from '../../lib/farmerProfile';
import { formatIsoDate } from '../../lib/farmerProfile';
import { GovernmentSchemesCard } from '../farmer/GovernmentSchemesCard';

type Msg =
  | { kind: 'q'; text: string; photo?: string }
  | { kind: 'a'; res: AdvisoryAskResponse; feedback?: 1 | -1 }
  | { kind: 'dx'; res: DiseaseCheckResponse }
  | { kind: 'err'; text: string; retry: () => void };

const CONFIDENCE_KEY: Record<string, string> = {
  grounded: 'chat.confGrounded',
  partial: 'chat.confPartial',
  insufficient: 'chat.confInsufficient',
};

function suggestions(t: TFunction, crop?: string) {
  const c = crop?.toLowerCase() || t('chat.myCrop', 'my crop');
  return [
    t('chat.sugWater', { crop: c, defaultValue: 'How much water does {{crop}} need this week?' }),
    t('chat.sugFert', 'What fertilizer should I apply at this stage?'),
    t('chat.sugPests', 'Which pests should I watch for now?'),
    t('chat.sugSchemes', { crop: c, defaultValue: 'Are there government schemes for {{crop}} farmers?' }),
  ];
}

interface Props {
  farmView: FarmerProfileView | null;
  /** A question handed over from Today; sent once when it changes. */
  initialQuestion?: { text: string; nonce: number } | null;
  onEditFarm: () => void;
}

export const AdvisorView: React.FC<Props> = ({ farmView, initialQuestion, onEditFarm }) => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'ask' | 'schemes'>('ask');
  const [thread, setThread] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastDisease, setLastDisease] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const farm = farmView?.farm;
  const crop = farmView?.crop;
  const lang = (i18n.language || 'en').split('-')[0];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread, busy]);

  const ask = async (q: string, force = false) => {
    if (!q.trim() || (busy && !force)) return;
    // Last few turns of this chat (before this question), so "and the next spray?" keeps its subject.
    const history = thread
      .flatMap((m): { role: 'user' | 'assistant'; text: string }[] => m.kind === 'q' && !m.photo ? [{ role: 'user' as const, text: m.text }]
        : m.kind === 'a' ? [{ role: 'assistant' as const, text: m.res.response.slice(0, 1500) }] : [])
      .slice(-6);
    setView('ask');
    setThread((t) => [...t, { kind: 'q', text: q }]);
    setText('');
    setBusy(true);
    try {
      const res = await askAdvisory({
        query: q,
        farm_id: farm?.id ?? undefined,
        farmer_id: farmView?.profileId ?? undefined,
        crop: crop?.name,
        sowing_date: crop?.sowingDate ?? undefined,
        soil_type: farm?.soilType ?? undefined,
        lat: farm?.lat ?? undefined,
        lon: farm?.lon ?? undefined,
        disease_label: lastDisease ?? undefined,
        language: lang,
        history,
      });
      setThread((t) => [...t, { kind: 'a', res }]);
    } catch (e: any) {
      setThread((t) => [...t, { kind: 'err', text: e.message, retry: () => ask(q) }]);
    } finally {
      setBusy(false);
    }
  };

  const sendPhoto = async (file: File) => {
    const url = URL.createObjectURL(file);
    setView('ask');
    const label = t('chat.checkThisLeaf', 'Check this leaf');
    setThread((prev) => [...prev, { kind: 'q', text: label, photo: url }]);
    setBusy(true);
    try {
      const res = await checkCropDisease(file, crop?.name, farm?.id ?? undefined);
      setThread((t) => [...t, { kind: 'dx', res }]);
      if (res.status === 'model' || res.status === 'vision') setLastDisease(res.label);
      else if (res.status === 'unavailable') {
        // No model could look at the photo: still answer from the farm's crop, stage and weather.
        const c = crop?.name || 'crop';
        await ask(`My ${c} leaves show disease or pest symptoms (the photo could not be analysed automatically). `
          + `What are the most likely diseases or pests for ${c} at this stage and in this weather, how can I tell them apart by look, and what should I do for each?`, true);
        return;
      }
    } catch (e: any) {
      setThread((t) => [...t, { kind: 'err', text: e.message, retry: () => sendPhoto(file) }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (initialQuestion?.text) ask(initialQuestion.text); }, [initialQuestion?.nonce]);

  const feedback = async (i: number, id: number, fb: 1 | -1) => {
    setThread((t) => t.map((m, j) => (j === i && m.kind === 'a' ? { ...m, feedback: fb } : m)));
    try { await sendAdvisoryFeedback(id, fb); } catch { /* feedback is best effort */ }
  };

  return (
    <div className="pb-44">
      <div className="flex items-center justify-between gap-4 pt-2 pb-4">
        <h1 className="text-3xl font-semibold text-ink">{t('chat.title', 'Advisor')}</h1>
        <div role="tablist" aria-label="Advisor sections" className="inline-flex rounded-full bg-ash p-1">
          {([['ask', t('chat.tabAsk', 'Ask')], ['schemes', t('chat.tabSchemes', 'Schemes')]] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`h-10 px-5 rounded-full text-sm font-semibold ${view === v ? 'bg-surface text-ink' : 'text-ink-soft hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {view === 'schemes' ? <GovernmentSchemesCard /> : (
        <>
          <p className="text-ink-soft">
            {crop ? (
              <>{t('chat.usesFarm', { crop: crop.name, defaultValue: 'Answers use your farm: {{crop}}' })}
                {crop.sowingDate ? t('chat.sownOn', { date: formatIsoDate(crop.sowingDate), defaultValue: ', sown {{date}}' }) : t('chat.notSown', ', not sown yet')}
                {farm?.district ? `, ${farm.district}` : ''}.{' '}
                <button onClick={onEditFarm} className="text-brand font-medium underline underline-offset-4">{t('chat.change', 'Change')}</button></>
            ) : t('chat.addFarm', 'Add your farm for answers about your own crop and weather.')}
          </p>

          {thread.length === 0 && (
            <div className="mt-6 grid sm:grid-cols-2 gap-2">
              {suggestions(t, crop?.name).map((s) => (
                <button key={s} onClick={() => ask(s)} className="text-left rounded-xl bg-surface px-4 py-3 text-ink hover:bg-tint transition-colors">
                  {s}
                </button>
              ))}
              <button onClick={() => fileRef.current?.click()} className="text-left rounded-xl bg-surface px-4 py-3 text-ink hover:bg-tint transition-colors flex items-center gap-2 sm:col-span-2">
                <Camera size={18} className="text-brand" aria-hidden /> {t('chat.checkLeaf', 'Check a sick leaf from a photo')}
              </button>
            </div>
          )}

          <ol className="mt-6 space-y-4" aria-live="polite">
            {thread.map((m, i) => (
              <li key={i}>
                {m.kind === 'q' && (
                  <div className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-md bg-brand text-white px-4 py-3">
                    {m.photo && <img src={m.photo} alt="Your leaf photo" className="mb-2 rounded-lg max-h-56 object-cover" />}
                    {m.text}
                  </div>
                )}

                {m.kind === 'a' && (
                  <article className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-5 py-4">
                    {m.res.generated_by === 'deterministic' && (
                      <p className="mb-3 rounded-lg bg-warn-bg text-warn px-3 py-2 text-sm">
                        {t('chat.offline', 'The AI model could not be reached, so this answer is built only from your farm’s computed data and matching guidance.')}
                      </p>
                    )}
                    <div className="prose prose-sm sm:prose-base max-w-none text-ink prose-headings:text-ink prose-strong:text-ink">
                      <ReactMarkdown>{m.res.response}</ReactMarkdown>
                    </div>
                    <p className="mt-3 text-sm text-ink-soft">{t(CONFIDENCE_KEY[m.res.confidence] || 'chat.confInsufficient')}</p>
                    {m.res.sources.length > 0 && (
                      <ul className="mt-2 text-sm text-ink-soft space-y-0.5">
                        {m.res.sources.slice(0, 4).map((s, k) => (
                          <li key={k}>{t('chat.source', 'Source')}: {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a> : s.title}{s.page ? `, p. ${s.page}` : ''}</li>
                        ))}
                      </ul>
                    )}
                    {!!m.res.computed?.assumptions?.length && (
                      <p className="mt-2 text-sm text-ink-muted">{t('chat.assumed', 'Assumed:')} {m.res.computed.assumptions.join(' ')}</p>
                    )}
                    {m.res.id > 0 && (
                      <div className="mt-3 flex items-center gap-1 text-ink-soft">
                        <span className="text-sm mr-1">{t('chat.helpful', 'Helpful?')}</span>
                        <button aria-label={t('chat.helpfulYes', 'Helpful')} aria-pressed={m.feedback === 1} onClick={() => feedback(i, m.res.id, 1)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center hover:bg-ash ${m.feedback === 1 ? 'text-good' : ''}`}><ThumbsUp size={18} /></button>
                        <button aria-label={t('chat.helpfulNo', 'Not helpful')} aria-pressed={m.feedback === -1} onClick={() => feedback(i, m.res.id, -1)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center hover:bg-ash ${m.feedback === -1 ? 'text-bad' : ''}`}><ThumbsDown size={18} /></button>
                      </div>
                    )}
                  </article>
                )}

                {m.kind === 'dx' && <Diagnosis res={m.res} onAsk={ask} />}

                {m.kind === 'err' && (
                  <div className="max-w-[92%] rounded-2xl bg-bad-bg text-bad px-5 py-4 flex items-center justify-between gap-4">
                    <span>{m.text}</span>
                    <button onClick={() => { setThread((t) => t.filter((_, j) => j !== i)); m.retry(); }} className="h-10 px-4 rounded-full bg-surface text-ink font-medium shrink-0">{t('chat.tryAgain', 'Try again')}</button>
                  </div>
                )}
              </li>
            ))}
            {busy && (
              <li className="flex items-center gap-2 text-ink-soft"><Loader2 size={18} className="animate-spin" /> {t('chat.working', 'Working on it…')}</li>
            )}
          </ol>
          <div ref={endRef} />

          <form onSubmit={(e) => { e.preventDefault(); ask(text); }}
            className="fixed bottom-[72px] inset-x-0 z-30 px-4 pb-3 pt-2 bg-ground">
            <div className="mx-auto max-w-3xl flex items-end gap-2 bg-surface rounded-2xl p-2 border border-line">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.target.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label={t('chat.sendPhoto', 'Send a leaf photo')}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-brand hover:bg-ash disabled:opacity-50 shrink-0">
                <Camera size={20} />
              </button>
              <label htmlFor="advisor-q" className="sr-only">{t('chat.yourQuestion', 'Your question')}</label>
              <textarea id="advisor-q" rows={1} value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }}
                placeholder={t('chat.askAbout', { crop: crop?.name.toLowerCase() || t('chat.yourCrop', 'your crop'), defaultValue: 'Ask about {{crop}}…' })}
                className="flex-1 min-w-0 resize-none border-0 bg-transparent px-2 py-2.5 text-base max-h-32 focus:shadow-none" />
              <button type="submit" disabled={busy || !text.trim()} aria-label={t('chat.send', 'Send')}
                className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center disabled:opacity-40 shrink-0">
                <Send size={18} />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

function Diagnosis({ res, onAsk }: { res: DiseaseCheckResponse; onAsk: (q: string) => void }) {
  const unusable = res.status === 'rejected' || res.status === 'unavailable';
  return (
    <article className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-5 py-4">
      <p className="text-sm text-ink-soft">
        {res.status === 'unavailable' ? 'Leaf check · photo not analysed'
          : res.status === 'model' ? `Leaf check · trained model ${res.model_version || ''}`.trim()
          : res.status === 'vision' ? 'Leaf check · AI visual assessment, not a lab test' : 'Leaf check'}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-ink">{res.label}</h3>
      {res.scientific_name && <p className="text-ink-soft italic">{res.scientific_name}</p>}
      {!unusable && (
        <p className="mt-1 text-sm text-ink-soft">
          Confidence: {res.confidence_status}{res.status === 'model' ? ` (${Math.round(res.confidence * 100)}%)` : ''}
        </p>
      )}
      <p className="mt-3 text-ink">
        {res.status === 'unavailable'
          ? 'The photo could not be analysed automatically. The advisor’s answer below lists the most likely problems for your crop right now and how to tell them apart. Show the plant to your KVK to confirm.'
          : res.advisory_note}
      </p>
      {res.treatments.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold text-ink">What the guidance says</h4>
          <ul className="mt-2 space-y-3">
            {res.treatments.map((t, i) => (
              <li key={i} className="text-ink">
                <p className="line-clamp-5">{t.treatment_text}</p>
                <p className="text-sm text-ink-soft mt-1">{t.source_title}{t.page_number ? `, p. ${t.page_number}` : ''}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!unusable && !/healthy/i.test(res.label) && (
        <button onClick={() => onAsk(`How do I manage ${res.label} in my field?`)} className="mt-4 h-11 px-4 rounded-full bg-tint text-brand font-semibold">
          Ask how to manage it
        </button>
      )}
    </article>
  );
}
