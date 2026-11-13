import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Eye, MessageSquareText, Package, Pencil, Plus, Receipt, Store, Trash2, Wand2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useSession } from '../../lib/session.js';
import { useToast } from '../../lib/toast.jsx';
import { compact, cx, date, money, moneyShort, timeAgo } from '../../lib/format.js';
import { ProductImage } from '../../components/FacetCover.jsx';
import { RevenueChart } from '../../components/RevenueChart.jsx';
import { Avatar, Delta, EmptyState, ErrorState, PageLoader, PriceTag, Rating, Spinner, StatusPill } from '../../components/ui.jsx';

/* ───────────── Layout + onboarding ───────────── */

function Onboarding() {
  const { profile } = useSession();
  const qc = useQueryClient();
  const [storeName, setStoreName] = useState(profile?.name ? `${profile.name}'s Studio` : '');
  const [bio, setBio] = useState('');
  const open = useMutation({
    mutationFn: () => api.patch('/me', { becomeSeller: true, storeName, bio }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  return (
    <div className="container-page grid gap-5 pt-4 lg:grid-cols-2">
      <div className="card-dark relative flex flex-col overflow-hidden p-8 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full opacity-50 blur-3xl" style={{ background: 'var(--gradient-brand)' }} />
        <p className="relative text-[13px] font-medium text-white/50">Seller studio</p>
        <h1 className="relative mt-3 text-[48px] leading-[1.02] tracking-[-0.045em] text-white sm:text-[60px]">Open your store.</h1>
        <ul className="relative mt-auto space-y-3 pt-12">
          {[
            [Wand2, 'Gemini drafts your listing from the file you upload'],
            [Package, 'Files are stored privately and delivered by expiring links'],
            [Receipt, 'Track sales, revenue, orders and reviews in one place'],
          ].map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-sm text-white/80">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white"><Icon className="size-4" /></span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <form
        className="card space-y-5 p-8 sm:p-10"
        onSubmit={(e) => {
          e.preventDefault();
          open.mutate();
        }}
      >
        <h2 className="text-2xl">Name your store</h2>
        <div>
          <label className="field-label" htmlFor="store">Store name</label>
          <input id="store" className="input" required minLength={2} maxLength={60} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <p className="field-hint">Shown on every product you sell. You can change it later.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="bio">About your store <span className="text-muted">(optional)</span></label>
          <textarea id="bio" className="input min-h-28" maxLength={400} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you make and who it's for." />
        </div>
        {open.isError && <p className="text-sm text-danger">{open.error.message}</p>}
        <button className="btn-primary btn-lg w-full" disabled={open.isPending}>
          {open.isPending ? <Spinner className="size-4 text-white" /> : <Store className="size-4" />} Open my store
        </button>
      </form>
    </div>
  );
}

const TABS = [
  { to: '/studio', label: 'Overview', end: true },
  { to: '/studio/products', label: 'Products' },
  { to: '/studio/orders', label: 'Orders' },
  { to: '/studio/reviews', label: 'Reviews' },
];

export function StudioLayout() {
  const { isSignedIn, isPending, profile } = useSession();
  const location = useLocation();

  if (isPending) return <PageLoader />;
  if (!isSignedIn) return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!profile?.isSeller) return <Onboarding />;

  return (
    <div className="container-page pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Seller studio</p>
          <h1 className="text-[36px] leading-tight tracking-[-0.04em] sm:text-[48px]">{profile.storeName ?? profile.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="segmented overflow-x-auto">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx('segment whitespace-nowrap', isActive && 'segment-active')}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/studio/products/new" className="btn-primary">
            <Plus className="size-4" /> New product
          </Link>
        </div>
      </div>
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  );
}

/* ───────────── Overview ───────────── */

function StatTile({ label, value, note, delta }) {
  return (
    <div className="card flex flex-col p-6">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <Delta value={delta} />
      </div>
      <p className="numeral mt-auto pt-6 text-[44px] leading-none">{value}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}

const PERIODS = [7, 30, 90];

export function StudioOverview() {
  const [days, setDays] = useState(30);
  const stats = useQuery({ queryKey: ['seller-stats', days], queryFn: () => api.get('/seller/stats', { days }) });
  const orders = useQuery({ queryKey: ['seller-orders', 6], queryFn: () => api.get('/seller/orders', { limit: 6 }) });
  const reviews = useQuery({ queryKey: ['seller-reviews'], queryFn: () => api.get('/seller/reviews') });

  if (stats.isPending) return <PageLoader />;
  if (stats.isError) return <ErrorState error={stats.error} retry={stats.refetch} />;
  const s = stats.data;
  const delta = s.previousPeriodRevenueCents ? (s.periodRevenueCents - s.previousPeriodRevenueCents) / s.previousPeriodRevenueCents : null;

  if (s.published + s.drafts === 0) {
    return (
      <EmptyState icon={Wand2} title="List your first product" action={<Link to="/studio/products/new" className="btn-primary"><Plus className="size-4" /> New product</Link>}>
        Upload your file and let Gemini draft the title, description, tags and price. Sales and reviews will show up here.
      </EmptyState>
    );
  }

  const topMax = Math.max(1, ...s.topProducts.map((p) => p.revenueCents));

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Revenue — the one solid brand block */}
      <div className="card-brand relative flex min-h-[220px] flex-col overflow-hidden p-6 lg:col-span-4">
        <div className="hatch pointer-events-none absolute -bottom-12 -right-10 size-52 rounded-full text-white opacity-15" />
        <div className="relative flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-white/75">Revenue · last {days} days</p>
          {delta !== null && (
            <span className="badge bg-white/20 px-2.5 py-1 text-white">{delta >= 0 ? '+' : ''}{Math.round(delta * 100)}%</span>
          )}
        </div>
        <p className="numeral relative mt-auto pt-8 text-[56px] leading-none text-white">{moneyShort(s.periodRevenueCents)}</p>
        <p className="relative mt-2 text-xs text-white/70">
          {delta !== null ? `vs ${moneyShort(s.previousPeriodRevenueCents)} the ${days} days before` : 'No sales in the previous period'}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-3 lg:col-span-8">
        <StatTile label={`Sales · ${days} days`} value={compact(s.periodSales)} note={`${compact(s.sales)} all time`} />
        <StatTile label="Lifetime revenue" value={moneyShort(s.revenueCents)} note={`${compact(s.customers)} customers`} />
        <StatTile label="Views to sales" value={`${(s.conversionRate * 100).toFixed(1)}%`} note={`${compact(s.views)} views · ${s.avgRating ? s.avgRating.toFixed(1) : '—'}★ avg`} />
      </div>

      <section className="card p-6 lg:col-span-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">Daily revenue</h2>
            <p className="text-sm text-muted">After discounts</p>
          </div>
          <div className="inline-flex gap-1 rounded-full bg-wash p-1">
            {PERIODS.map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cx('rounded-full px-3.5 py-1.5 text-[13px] font-medium transition', days === d ? 'bg-night text-white' : 'text-ink-soft hover:text-ink')} aria-pressed={days === d}>
                {d} days
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2">
          <RevenueChart series={s.series} />
        </div>
      </section>

      <section className="card-dark p-6 lg:col-span-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-white">Top products</h2>
          <Link to="/studio/products" className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white hover:text-ink" aria-label="Manage products">
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <ol className="mt-5 space-y-4">
          {s.topProducts.map((p, i) => (
            <li key={p.id}>
              <div className="flex items-baseline justify-between gap-3">
                <Link to={`/products/${p.slug}`} className="line-clamp-1 text-sm font-medium text-white/90 hover:text-white">
                  <span className="mr-2 text-white/35">{i + 1}</span>{p.title}
                </Link>
                <span className="shrink-0 font-display text-sm font-semibold text-white">{moneyShort(p.revenueCents)}</span>
              </div>
              <div className="hatch relative mt-2 h-2 overflow-hidden rounded-full text-white/15">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(p.revenueCents / topMax) * 100}%`, background: 'var(--gradient-brand)' }} />
              </div>
              <p className="mt-1.5 flex items-center gap-3 text-[11px] text-white/40">
                <span>{p.sales} sales</span>
                <span className="flex items-center gap-1"><Eye className="size-3" /> {compact(p.views)}</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-6 lg:col-span-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Recent orders</h2>
          <Link to="/studio/orders" className="btn-quiet btn-sm">All orders <ArrowUpRight className="size-3.5" /></Link>
        </div>
        <OrderRows orders={orders.data ?? []} compact />
      </section>

      <section className="card p-6 lg:col-span-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Latest reviews</h2>
          <Link to="/studio/reviews" className="btn-quiet btn-sm">All <ArrowUpRight className="size-3.5" /></Link>
        </div>
        <div className="space-y-3">
          {(reviews.data ?? []).slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} flat />)}
          {reviews.data?.length === 0 && <p className="text-sm text-muted">No reviews yet.</p>}
        </div>
      </section>
    </div>
  );
}

/* ───────────── Products ───────────── */

function PricingRow({ product, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    price: (product.price.listCents / 100).toFixed(2),
    discount: String(product.price.discountPercent || 0),
    endsAt: product.price.discountEndsAt ? product.price.discountEndsAt.slice(0, 10) : '',
    status: product.status,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/seller/products/${product.id}/pricing`, {
        priceCents: Math.round(Number(form.price) * 100),
        discountPercent: Number(form.discount) || 0,
        discountEndsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
        status: form.status,
      }),
    onSuccess: () => {
      toast('Pricing saved');
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      onClose();
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  });

  const preview = Math.round(Number(form.price || 0) * 100 * (1 - (Number(form.discount) || 0) / 100));

  return (
    <tr>
      <td colSpan={6} className="px-3 pb-3">
        <div className="rounded-[var(--radius-inner)] bg-wash p-4">
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="w-32">
            <label className="field-label">Price (USD)</label>
            <input className="input bg-surface" type="number" min="0" max="999" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="w-28">
            <label className="field-label">Discount %</label>
            <input className="input bg-surface" type="number" min="0" max="90" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          </div>
          <div className="w-44">
            <label className="field-label">Discount ends</label>
            <input className="input bg-surface" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </div>
          <div className="w-36">
            <label className="field-label">Status</label>
            <select className="input bg-surface" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <p className="pb-2.5 text-sm text-muted">
            Buyers pay <span className="numeral text-ink">{preview ? money(preview) : 'Free'}</span>
          </p>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-quiet btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn-ink btn-sm" disabled={save.isPending}>{save.isPending && <Spinner className="size-3.5 text-white" />} Save</button>
          </div>
        </form>
        </div>
      </td>
    </tr>
  );
}

export function StudioProducts() {
  const products = useQuery({ queryKey: ['seller-products'], queryFn: () => api.get('/seller/products') });
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();
  const toast = useToast();

  const remove = useMutation({
    mutationFn: (id) => api.del(`/seller/products/${id}`),
    onSuccess: (res) => {
      toast(res.archived ? 'Archived — existing customers keep access' : 'Product deleted');
      qc.invalidateQueries({ queryKey: ['seller-products'] });
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  });

  if (products.isPending) return <PageLoader />;
  if (products.isError) return <ErrorState error={products.error} retry={products.refetch} />;
  if (!products.data.length) {
    return (
      <EmptyState icon={Package} title="No products yet" action={<Link to="/studio/products/new" className="btn-primary"><Plus className="size-4" /> New product</Link>}>
        Your listings, drafts and archived products will be managed here.
      </EmptyState>
    );
  }

  return (
    <div className="card overflow-x-auto p-3">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Product</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Price</th>
            <th className="px-3 py-3 text-right font-medium">Sales</th>
            <th className="px-3 py-3 text-right font-medium">Revenue</th>
            <th className="px-5 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {products.data.map((p) => (
            <ProductRowGroup
              key={p.id}
              product={p}
              editing={editing === p.id}
              onEdit={() => setEditing(editing === p.id ? null : p.id)}
              onClose={() => setEditing(null)}
              onDelete={() => {
                const msg = p.salesCount
                  ? `Archive "${p.title}"? It has sales, so it will be hidden from the store but buyers keep their downloads.`
                  : `Delete "${p.title}" and its files permanently?`;
                if (window.confirm(msg)) remove.mutate(p.id);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRowGroup({ product: p, editing, onEdit, onClose, onDelete }) {
  return (
    <>
      <tr className="tabular-nums transition hover:bg-wash/70 [&>td:first-child]:rounded-l-[18px] [&>td:last-child]:rounded-r-[18px]">
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            <ProductImage product={p} className="h-12 w-16 shrink-0 rounded-xl" showIcon={false} />
            <div className="min-w-0">
              <Link to={`/products/${p.slug}`} className="line-clamp-1 font-medium hover:text-iris">{p.title}</Link>
              <p className="text-xs text-muted">Updated {timeAgo(p.updatedAt)} · {compact(p.viewCount)} views</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3"><StatusPill status={p.status} /></td>
        <td className="px-3 py-3">
          <button onClick={onEdit} className="group flex items-center gap-2 rounded-full px-2.5 py-1 ring-1 ring-line transition hover:bg-surface hover:ring-line-strong" aria-expanded={editing} aria-label={`Edit pricing for ${p.title}`}>
            <PriceTag price={p.price} size="sm" />
            {p.price.discountPercent > 0 && <span className="badge bg-lilac text-iris">−{p.price.discountPercent}%</span>}
            <Pencil className="size-3 text-muted opacity-0 transition group-hover:opacity-100" />
          </button>
        </td>
        <td className="px-3 py-3 text-right">{p.salesCount}</td>
        <td className="px-3 py-3 text-right numeral">{money(p.revenueCents)}</td>
        <td className="px-5 py-3">
          <div className="flex justify-end gap-1">
            <Link to={`/studio/products/${p.id}/edit`} className="btn-quiet btn-sm">Edit</Link>
            <button onClick={onDelete} className="btn-quiet btn-sm text-danger hover:text-danger" aria-label={`Delete ${p.title}`}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {editing && <PricingRow product={p} onClose={onClose} />}
    </>
  );
}

/* ───────────── Orders & reviews ───────────── */

function OrderRows({ orders, compact: isCompact }) {
  if (!orders.length) return <p className="py-4 text-sm text-muted">No orders yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id} className="flex items-center gap-3.5 py-3 text-sm">
          <Avatar name={o.buyer.name} src={o.buyer.avatarUrl} className="size-10 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 font-medium">{o.title}</p>
            <p className="text-xs text-muted">
              {o.buyer.name}
              {!isCompact && <> · {o.buyer.email}</>} · {timeAgo(o.paidAt)}
            </p>
          </div>
          {!isCompact && <span className="hidden font-mono text-xs text-muted sm:block">{o.receiptNumber}</span>}
          <span className="text-right numeral text-base">
            {o.priceCents ? money(o.priceCents) : 'Free'}
            {o.listPriceCents !== o.priceCents && o.priceCents > 0 && <span className="block text-[11px] text-muted line-through">{money(o.listPriceCents)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StudioOrders() {
  const orders = useQuery({ queryKey: ['seller-orders', 100], queryFn: () => api.get('/seller/orders', { limit: 100 }) });
  if (orders.isPending) return <PageLoader />;
  if (orders.isError) return <ErrorState error={orders.error} retry={orders.refetch} />;
  if (!orders.data.length) return <EmptyState icon={Receipt} title="No orders yet">When someone buys or claims one of your products, it shows up here.</EmptyState>;
  return (
    <div className="card px-6 py-3">
      <OrderRows orders={orders.data} />
    </div>
  );
}

function ReviewCard({ review: r, flat = false }) {
  return (
    <article className={flat ? 'tile p-4' : 'card p-6'}>
      <div className="flex items-center justify-between gap-2">
        <Rating value={r.rating} />
        <span className="text-xs text-muted">{date(r.createdAt)}</span>
      </div>
      {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
      {r.body && <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-ink-soft">{r.body}</p>}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        <Avatar name={r.author} src={r.avatarUrl} className="size-6 text-[9px]" />
        <span>{r.author} on <Link to={`/products/${r.product.slug}`} className="text-ink-soft underline-offset-2 hover:underline">{r.product.title}</Link></span>
      </p>
    </article>
  );
}

export function StudioReviews() {
  const reviews = useQuery({ queryKey: ['seller-reviews'], queryFn: () => api.get('/seller/reviews') });
  if (reviews.isPending) return <PageLoader />;
  if (reviews.isError) return <ErrorState error={reviews.error} retry={reviews.refetch} />;
  if (!reviews.data.length) return <EmptyState icon={MessageSquareText} title="No reviews yet">Customers who own your products can leave a rating and review.</EmptyState>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reviews.data.map((r) => <ReviewCard key={r.id} review={r} />)}</div>;
}
