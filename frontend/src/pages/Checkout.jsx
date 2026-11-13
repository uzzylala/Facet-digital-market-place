import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CreditCard, ExternalLink, FlaskConical, Lock, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { money } from '../lib/format.js';
import { ProductImage } from '../components/FacetCover.jsx';
import { ErrorState, PageLoader, Spinner } from '../components/ui.jsx';

const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v) => v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1 / $2');

/** Stripe Checkout: the server creates a hosted payment page for this order and we redirect to it. */
function StripePanel({ order, testMode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const canceled = params.get('canceled') === '1';

  const start = useMutation({
    mutationFn: () => api.post(`/checkout/${order.id}/stripe`),
    onSuccess: (res) => {
      if (res.url) window.location.assign(res.url);
      else navigate(`/orders/${order.id}?new=1`, { replace: true }); // $0 order fulfilled directly
    },
  });

  return (
    <div className="card flex flex-col p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">Secure payment by</p>
          <p className="mt-0.5 font-display text-[32px] font-bold leading-none tracking-[-0.04em] text-[#635bff]">stripe</p>
        </div>
        {testMode && <span className="rounded-full bg-warn-soft px-3 py-1.5 text-xs font-semibold text-warn">Test mode</span>}
      </div>

      {canceled && (
        <p className="mt-6 flex items-center gap-2.5 rounded-2xl bg-wash px-4 py-3 text-sm text-ink-soft" role="status">
          <CircleAlert className="size-4 shrink-0 text-muted" /> Payment canceled — you haven’t been charged. You can try again below.
        </p>
      )}

      <ul className="mt-6 grid gap-2.5 text-sm text-ink-soft sm:grid-cols-2">
        <li className="tile flex items-center gap-3 p-4"><Lock className="size-4 shrink-0 text-iris" /> Card details go straight to Stripe — never to Facet.</li>
        <li className="tile flex items-center gap-3 p-4"><ShieldCheck className="size-4 shrink-0 text-iris" /> Downloads unlock once Stripe confirms the payment.</li>
      </ul>

      {testMode && (
        <div className="mt-3 rounded-[var(--radius-inner)] bg-lilac p-4 text-sm text-ink-soft">
          <p className="font-semibold text-ink">Stripe test cards</p>
          <p className="mt-1">
            <span className="font-mono text-ink">4242 4242 4242 4242</span> succeeds · <span className="font-mono text-ink">4000 0000 0000 0002</span> is declined ·
            any future expiry, any CVC and any postal code.
          </p>
        </div>
      )}

      {start.isError && <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{start.error.message}</p>}

      <button className="btn-primary btn-lg mt-6 w-full" disabled={start.isPending} onClick={() => start.mutate()}>
        {start.isPending ? <Spinner className="size-4 text-white" /> : <Lock className="size-4" />}
        {start.isPending ? 'Opening Stripe…' : `Pay ${money(order.totalCents)} with Stripe`}
        {!start.isPending && <ExternalLink className="size-4 opacity-70" />}
      </button>
      <p className="mt-3 text-center text-xs text-muted">You’ll be taken to Stripe’s secure checkout page and brought back here afterwards.</p>
    </div>
  );
}

/** Demo provider (used when the server has no Stripe key): a simulated card form. */
function DemoCardForm({ order }) {
  const navigate = useNavigate();
  const cart = useCart();
  const qc = useQueryClient();
  const [card, setCard] = useState({ name: '', number: '4242 4242 4242 4242', expiry: '12 / 30', cvc: '123' });
  const set = (k) => (e) => setCard((c) => ({ ...c, [k]: k === 'number' ? formatCard(e.target.value) : k === 'expiry' ? formatExpiry(e.target.value) : e.target.value }));

  const pay = useMutation({
    mutationFn: () => api.post(`/checkout/${order.id}/pay`, { card: { number: card.number, name: card.name } }),
    onSuccess: () => {
      order.items.forEach((i) => cart.remove(i.productId));
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${order.id}?new=1`, { replace: true });
    },
  });

  return (
    <form
      className="card grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,320px)_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        pay.mutate();
      }}
    >
      {/* Live card preview */}
      <div>
        <div className="relative">
          <div className="absolute inset-x-6 -top-3 h-10 rounded-t-[22px] bg-blush/60" />
          <div className="absolute inset-x-3 -top-1.5 h-10 rounded-t-[22px] bg-azure/50" />
          <div className="card-brand relative flex aspect-[1.6] flex-col p-5 shadow-[var(--shadow-glow)]">
            <div className="flex items-center justify-between">
              <span className="flex">
                <span className="size-7 rounded-full bg-white/90" />
                <span className="-ml-3 size-7 rounded-full bg-white/45" />
              </span>
              <CreditCard className="size-5 text-white/80" />
            </div>
            <p className="mt-auto text-[11px] text-white/60">Card number</p>
            <p className="font-mono text-lg tracking-wider text-white">{card.number || '•••• •••• •••• ••••'}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-white/60">Name</p>
                <p className="truncate text-sm font-medium text-white">{card.name || 'Your name'}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/60">Expires</p>
                <p className="font-mono text-sm text-white">{card.expiry || 'MM / YY'}</p>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Lock className="size-3.5" /> Card details are never stored.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="cc-name">Name on card</label>
          <input id="cc-name" className="input" autoComplete="cc-name" value={card.name} onChange={set('name')} placeholder="Alex Morgan" />
        </div>
        <div>
          <label className="field-label" htmlFor="cc-number">Card number</label>
          <input id="cc-number" className="input font-mono" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={set('number')} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="cc-exp">Expiry</label>
            <input id="cc-exp" className="input font-mono" inputMode="numeric" autoComplete="cc-exp" value={card.expiry} onChange={set('expiry')} placeholder="MM / YY" required />
          </div>
          <div>
            <label className="field-label" htmlFor="cc-cvc">CVC</label>
            <input id="cc-cvc" className="input font-mono" inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={set('cvc')} maxLength={4} required />
          </div>
        </div>
        {pay.isError && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{pay.error.message}</p>}
        <button className="btn-primary btn-lg w-full" disabled={pay.isPending}>
          {pay.isPending ? <Spinner className="size-4 text-white" /> : <Lock className="size-4" />}
          Pay {money(order.totalCents)}
        </button>
      </div>
    </form>
  );
}

export default function Checkout() {
  const { orderId } = useParams();
  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => api.get(`/orders/${orderId}`) });
  const payments = useQuery({ queryKey: ['payments-config'], queryFn: () => api.get('/payments/config'), staleTime: Infinity });

  if (order.isPending || payments.isPending) return <PageLoader />;
  if (order.isError) return <div className="container-page pt-16"><ErrorState error={order.error} /></div>;
  if (order.data.status === 'paid') return <Navigate to={`/orders/${orderId}`} replace />;

  const o = order.data;
  const useStripe = payments.data?.provider === 'stripe';

  return (
    <div className="container-page max-w-6xl pt-4">
      <Link to="/cart" className="text-sm text-muted hover:text-ink">← Back to cart</Link>
      <h1 className="mt-3 text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Payment</h1>

      {!useStripe && (
        <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-inner)] bg-warn-soft p-4 text-sm text-ink-soft">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-warn" />
          <div>
            <p className="font-semibold text-ink">Demo checkout — no real payment is taken.</p>
            <p className="mt-0.5">
              The server still creates the order, prices it, and only releases downloads after the (simulated) charge succeeds.
              Use <span className="font-mono text-ink">4242 4242 4242 4242</span> to succeed or <span className="font-mono text-ink">4000 0000 0000 0002</span> to see a decline.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_400px]">
        {useStripe ? <StripePanel order={o} testMode={payments.data.testMode} /> : <DemoCardForm order={o} />}

        <aside className="card-dark h-fit p-6 sm:p-7">
          <p className="text-[13px] text-white/45">Order</p>
          <p className="font-mono text-sm text-white/80">{o.receiptNumber}</p>
          <ul className="mt-5 space-y-2.5">
            {o.items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 pr-4">
                <ProductImage product={{ ...i, id: i.productId }} className="h-12 w-16 shrink-0 rounded-xl" showIcon={false} />
                <span className="line-clamp-2 flex-1 text-sm text-white/85">{i.title}</span>
                <span className="font-display text-sm font-semibold text-white">{i.priceCents ? money(i.priceCents) : 'Free'}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between text-white/55"><dt>Subtotal</dt><dd>{money(o.subtotalCents)}</dd></div>
            {o.discountCents > 0 && <div className="flex justify-between text-[#7ef0bd]"><dt>Discounts</dt><dd>−{money(o.discountCents)}</dd></div>}
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-white/55">Total</span>
            <span className="numeral text-[40px] leading-none text-white">{money(o.totalCents)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
