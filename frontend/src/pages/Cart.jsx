import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleAlert, Lock, ShoppingBag, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { useRequireAuth } from '../lib/session.js';
import { useToast } from '../lib/toast.jsx';
import { money } from '../lib/format.js';
import { ProductImage } from '../components/FacetCover.jsx';
import { EmptyState, PriceTag, Spinner } from '../components/ui.jsx';

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  const requireAuth = useRequireAuth();
  const toast = useToast();

  const [params] = useSearchParams();
  const canceled = params.get('canceled') === '1';
  const payments = useQuery({ queryKey: ['payments-config'], queryFn: () => api.get('/payments/config'), staleTime: 60_000 });
  const useStripe = payments.data?.provider === 'stripe';

  // Create the order (priced on the server), then hand off to Stripe's hosted checkout.
  // Without Stripe configured, continue to the built-in demo card form instead.
  const checkout = useMutation({
    mutationFn: async () => {
      const order = await api.post('/checkout', { productIds: cart.items.map((i) => i.id) });
      if (!useStripe) return { next: `/checkout/${order.orderId}` };
      const res = await api.post(`/checkout/${order.orderId}/stripe`);
      return res.url ? { redirect: res.url } : { next: `/orders/${order.orderId}?new=1` }; // $0 orders skip Stripe
    },
    onSuccess: ({ redirect, next }) => {
      if (redirect) window.location.assign(redirect);
      else navigate(next);
    },
    onError: (err) => {
      // Items the buyer already owns can't be bought twice — take them out of the cart.
      if (err.body?.ownedIds) {
        err.body.ownedIds.forEach(cart.remove);
        toast(err.message, { tone: 'error' });
      }
    },
  });
  const redirecting = checkout.isSuccess && Boolean(checkout.data?.redirect);

  if (!cart.count) {
    return (
      <div className="container-page max-w-2xl pt-16">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link to="/browse" className="btn-primary">Browse products</Link>}>
          Add a few things and they’ll wait here, even if you close the tab.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container-page pt-4">
      <div className="flex items-end gap-3">
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Cart</h1>
        <span className="mb-2 rounded-full bg-surface px-3 py-1 text-sm font-medium shadow-[var(--shadow-pop)]">{cart.count} {cart.count === 1 ? 'item' : 'items'}</span>
      </div>
      {canceled && (
        <p className="mt-5 flex items-center gap-2.5 rounded-[var(--radius-inner)] bg-surface px-5 py-3.5 text-sm text-ink-soft shadow-[var(--shadow-pop)]" role="status">
          <CircleAlert className="size-4 shrink-0 text-muted" /> Payment canceled — you haven’t been charged. Your cart is still here.
        </p>
      )}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_400px]">
        <ul className="card space-y-1 p-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 rounded-[var(--radius-inner)] p-3 transition hover:bg-wash">
              <Link to={`/products/${item.slug}`} className="shrink-0">
                <ProductImage product={item} className="h-20 w-28 rounded-2xl" showIcon={false} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{item.category?.name}</p>
                <Link to={`/products/${item.slug}`} className="line-clamp-1 font-display text-lg font-semibold tracking-[-0.02em] hover:text-iris">{item.title}</Link>
                <p className="text-sm text-muted">by {item.seller?.name}</p>
              </div>
              <PriceTag price={item.price} />
              <button onClick={() => cart.remove(item.id)} className="icon-btn size-10 shadow-none ring-1 ring-line hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${item.title}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <aside className="card-dark h-fit p-6 sm:p-7 lg:sticky lg:top-24">
          <p className="text-[13px] text-white/45">Order summary</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-white/55"><dt>Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
            {cart.savings > 0 && (
              <div className="flex justify-between text-[#7ef0bd]"><dt>Sale savings</dt><dd>−{money(cart.savings)}</dd></div>
            )}
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-white/55">Total</span>
            <span className="numeral text-[44px] leading-none text-white">{money(cart.total)}</span>
          </div>
          {checkout.isError && !checkout.error.body?.ownedIds && (
            <p className="mt-5 rounded-2xl bg-danger/15 px-4 py-3 text-sm text-[#ffb4b6]" role="alert">{checkout.error.message}</p>
          )}
          <button className="btn-primary btn-lg mt-6 w-full" disabled={checkout.isPending || redirecting || payments.isPending} onClick={() => requireAuth(() => checkout.mutate())}>
            {checkout.isPending || redirecting ? <Spinner className="size-4 text-white" /> : <Lock className="size-4" />}
            {redirecting ? 'Opening Stripe…' : 'Continue to payment'}
          </button>
          <p className="mt-3 text-center text-xs text-white/40">
            {useStripe ? 'You’ll pay on Stripe’s secure checkout page.' : 'Final prices are confirmed on the next step.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
