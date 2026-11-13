import { useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Download, Printer, Receipt } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { useDownload } from '../lib/downloads.js';
import { date, dateTime, money } from '../lib/format.js';
import { Logo } from '../components/Layout.jsx';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui.jsx';

export function OrderHistory() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/orders') });

  return (
    <div className="container-page max-w-4xl pt-10">
      <p className="eyebrow mb-2">Account</p>
      <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Purchase history</h1>
      <div className="mt-8">
        {orders.isPending ? (
          <PageLoader />
        ) : orders.isError ? (
          <ErrorState error={orders.error} retry={orders.refetch} />
        ) : orders.data.length === 0 ? (
          <EmptyState icon={Receipt} title="No purchases yet" action={<Link to="/browse" className="btn-primary">Find something</Link>}>
            Receipts for everything you buy or claim will be kept here.
          </EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {orders.data.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-5 transition hover:bg-wash/50">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted">{o.receiptNumber}</p>
                  <p className="mt-0.5 line-clamp-1 font-medium">{o.items.map((i) => i.title).join(', ')}</p>
                </div>
                <span className="text-sm text-muted">{date(o.paidAt)}</span>
                <span className="w-24 text-right numeral text-lg">{o.totalCents ? money(o.totalCents) : 'Free'}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderReceipt() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const sessionId = params.get('session_id');
  const order = useQuery({ queryKey: ['order', id], queryFn: () => api.get(`/orders/${id}`) });
  const download = useDownload();
  const cart = useCart();
  const qc = useQueryClient();

  // Back from Stripe: ask the server to verify the session with Stripe before showing the order as paid.
  const confirm = useMutation({
    mutationFn: () => api.post(`/checkout/${id}/confirm`, { sessionId }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['order', id] }),
  });
  const confirmStarted = useRef(false);
  const status = order.data?.status;
  useEffect(() => {
    if (sessionId && status && status !== 'paid' && !confirmStarted.current) {
      confirmStarted.current = true;
      confirm.mutate();
    }
  }, [sessionId, status, confirm]);

  // Once paid, the purchased items no longer belong in the cart.
  const items = order.data?.items;
  const cleared = useRef(false);
  useEffect(() => {
    if (isNew && status === 'paid' && items && !cleared.current) {
      cleared.current = true;
      items.forEach((i) => cart.remove(i.productId));
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    }
  }, [isNew, status, items, cart, qc]);

  if (order.isPending) return <PageLoader />;
  if (order.isError) return <div className="container-page pt-16"><ErrorState error={order.error} /></div>;
  const o = order.data;

  if (sessionId && o.status !== 'paid') {
    return (
      <div className="container-page max-w-xl pt-16">
        {confirm.isError ? (
          <div className="card p-10 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger-soft text-danger"><CircleAlert className="size-7" /></span>
            <h1 className="mt-5 text-3xl">We couldn’t confirm that payment</h1>
            <p className="mt-2 text-ink-soft">{confirm.error.message}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button className="btn-ink" onClick={() => confirm.mutate()}>Check again</button>
              <Link to={`/checkout/${o.id}`} className="btn-ghost">Back to payment</Link>
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center">
            <Spinner className="mx-auto size-9" />
            <h1 className="mt-5 text-3xl">Confirming your payment…</h1>
            <p className="mt-2 text-ink-soft">Checking with Stripe. This only takes a moment.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl pt-10">
      {isNew && o.status === 'paid' && (
        <div className="no-print mb-8 animate-rise text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full text-white shadow-[var(--shadow-glow)]" style={{ background: 'var(--gradient-brand)' }}>
            <CircleCheck className="size-7" />
          </span>
          <h1 className="mt-5 text-[44px] leading-none tracking-[-0.04em]">It’s yours.</h1>
          <p className="mt-2 text-ink-soft">Payment confirmed. Download now, or any time from your library.</p>
        </div>
      )}

      <article className="card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6 sm:p-8">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted">Receipt</p>
            <p className="font-mono text-lg font-semibold">{o.receiptNumber}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{o.buyer.name}</p>
            <p className="text-muted">{o.buyer.email}</p>
            <p className="mt-3 text-muted">{dateTime(o.paidAt ?? o.createdAt)}</p>
            <span className={`badge mt-2 ${o.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warn/10 text-warn'}`}>{o.status}</span>
          </div>
        </header>

        <ul className="divide-y divide-line">
          {o.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-4 px-6 py-4 sm:px-8">
              <div className="min-w-0 flex-1">
                <Link to={`/products/${i.slug}`} className="font-medium hover:text-iris">{i.title}</Link>
                <p className="text-xs text-muted">by {i.seller}</p>
              </div>
              {o.status === 'paid' && (
                <button className="btn-ghost btn-sm no-print" onClick={() => download.mutate(i.productId)} disabled={download.isPending}>
                  {download.isPending && download.variables === i.productId ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
                  Download
                </button>
              )}
              <div className="w-24 text-right numeral text-[15px]">
                {i.listPriceCents !== i.priceCents && <p className="text-xs text-muted line-through">{money(i.listPriceCents)}</p>}
                <p>{i.priceCents ? money(i.priceCents) : 'Free'}</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-line bg-paper/60 px-6 py-5 text-sm sm:px-8">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="numeral">{money(o.subtotalCents)}</dd></div>
          {o.discountCents > 0 && <div className="flex justify-between"><dt className="text-muted">Discounts</dt><dd className="numeral">−{money(o.discountCents)}</dd></div>}
          <div className="flex justify-between text-base font-semibold"><dt>Total paid</dt><dd className="numeral">{money(o.totalCents)}</dd></div>
          <div className="flex justify-between pt-2 text-xs text-muted">
            <dt>Payment</dt>
            <dd>
              {o.totalCents === 0
                ? 'No payment required'
                : `${o.paymentProvider === 'stripe' ? 'Stripe' : 'Demo card'}${o.last4 ? ` · card •••• ${o.last4}` : ''}`}
              {o.paymentRef && <span className="ml-2 font-mono">{o.paymentRef.slice(0, 18)}</span>}
            </dd>
          </div>
        </dl>
      </article>

      <div className="no-print mt-6 flex flex-wrap justify-between gap-3">
        <Link to="/library" className="btn-primary">Go to library</Link>
        <button className="btn-ghost" onClick={() => window.print()}>
          <Printer className="size-4" /> Print receipt
        </button>
      </div>
    </div>
  );
}
