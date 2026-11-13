import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowUpRight, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { cx } from '../lib/format.js';
import { ProductCard } from '../components/ProductCard.jsx';

const STARTERS = [
  'A React admin dashboard template for a SaaS app',
  'Icons that work for a fintech product, under $30',
  'Something to help me price my startup',
  'Cinematic color grading for travel videos',
  'A free serif font for long-form reading',
  'Notion templates for a student',
];

function AssistantTurn({ turn, onFollowUp, last }) {
  return (
    <div className="animate-rise">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: 'var(--gradient-brand)' }}>
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="card inline-block max-w-2xl rounded-tl-lg px-5 py-3.5 text-[15px] leading-relaxed text-ink">{turn.content}</p>
          {turn.recommendations?.length > 0 && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {turn.recommendations.map((r) => (
                <ProductCard key={r.product.id} product={r.product} reason={r.reason} />
              ))}
            </div>
          )}
          {last && turn.followUp && (
            <button onClick={() => onFollowUp(turn.followUp)} className="chip mt-4 border-transparent bg-lilac text-iris hover:text-iris-deep">
              <Sparkles className="size-3 text-iris" /> {turn.followUp}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Assistant() {
  const [params, setParams] = useSearchParams();
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get('/ai/status'), staleTime: Infinity });

  const ask = useMutation({
    mutationFn: ({ message, history }) => api.post('/ai/assistant', { message, history }),
    onSuccess: (data) =>
      setTurns((t) => [...t, { role: 'assistant', content: data.reply, recommendations: data.recommendations, followUp: data.followUp }]),
    onError: (err) => setTurns((t) => [...t, { role: 'assistant', content: err.message, recommendations: [] }]),
  });

  const send = (text) => {
    const message = text.trim();
    if (!message || ask.isPending) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: 'user', content: message }]);
    setInput('');
    ask.mutate({ message, history });
  };

  // Arriving from the home page hero with ?q=… (ref guard: StrictMode mounts twice in dev)
  const initial = params.get('q');
  const sentInitial = useRef(false);
  useEffect(() => {
    if (initial && !sentInitial.current) {
      sentInitial.current = true;
      send(initial);
      setParams({}, { replace: true });
    }
    // Mount-only: runs once for the ?q= the page was opened with.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, ask.isPending]);

  const empty = turns.length === 0;

  return (
    <div className="container-page flex min-h-[calc(100dvh-5rem)] flex-col pt-6">
      <header className={cx('mx-auto w-full max-w-3xl text-center transition-all', empty ? 'mt-[6vh]' : 'mt-0')}>
        <p className="mx-auto mb-5 flex w-fit items-center justify-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft shadow-[var(--shadow-pop)]">
          <Sparkles className="size-3.5 text-iris" />
          {status.data?.enabled ? `Marketplace assistant · Gemini` : 'Marketplace assistant · keyword matching'}
        </p>
        {empty && (
          <>
            <h1 className="text-[44px] leading-[1.02] tracking-[-0.045em] sm:text-[68px]">
              Tell me what you’re <span className="text-opal">making</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-ink-soft">
              Describe the project, your stack and your budget. I’ll pick the products from the catalog that actually fit, and say why.
            </p>
          </>
        )}
      </header>

      <div className={cx('mx-auto w-full flex-1 space-y-8', empty ? 'max-w-3xl' : 'max-w-6xl')}>
        {empty ? (
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="card group flex items-center justify-between gap-3 p-5 text-left text-sm font-medium text-ink-soft transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] hover:text-ink">
                {s}
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wash text-ink-soft transition group-hover:bg-night group-hover:text-white">
                  <ArrowUpRight className="size-4" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          turns.map((turn, i) =>
            turn.role === 'user' ? (
              <div key={i} className="flex animate-rise justify-end">
                <p className="max-w-xl rounded-[24px] rounded-br-lg bg-night px-5 py-3.5 text-[15px] text-white">{turn.content}</p>
              </div>
            ) : (
              <AssistantTurn
                key={i}
                turn={turn}
                last={i === turns.length - 1}
                // The follow-up is a question for the buyer, so prefill the box instead of sending it.
                onFollowUp={(q) => {
                  setInput(`${q.replace(/\?$/, '')}: `);
                  inputRef.current?.focus();
                }}
              />
            ),
          )
        )}
        {ask.isPending && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="grid size-10 place-items-center rounded-full text-white" style={{ background: 'var(--gradient-brand)' }}>
              <Sparkles className="size-[18px] animate-pulse" />
            </span>
            Looking through the catalog…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mx-auto mt-8 w-full max-w-3xl bg-gradient-to-t from-paper via-paper to-transparent pb-6 pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-[28px] bg-surface p-2 pl-5 shadow-[var(--shadow-lift)] focus-within:ring-4 focus-within:ring-iris/10"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={empty ? 'e.g. a Next.js starter with Stripe billing, under $150' : 'Refine — add a budget, a stack, a style…'}
            aria-label="Message the assistant"
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted"
          />
          {!empty && (
            <button type="button" onClick={() => setTurns([])} className="btn-quiet size-10 rounded-full p-0" aria-label="Start over">
              <RotateCcw className="size-4" />
            </button>
          )}
          <button className="grid size-11 shrink-0 place-items-center rounded-full bg-night text-white transition hover:bg-iris disabled:opacity-35" disabled={!input.trim() || ask.isPending} aria-label="Send">
            <ArrowUp className="size-[18px]" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted">Recommendations come only from products listed on Facet.</p>
      </div>
    </div>
  );
}
