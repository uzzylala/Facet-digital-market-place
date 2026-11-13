import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Check, Sparkles, Star, Wand2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { compact } from '../lib/format.js';
import { CategoryIcon } from '../components/CategoryIcon.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import { ProductImage } from '../components/FacetCover.jsx';
import { PriceTag, SectionHeader, SkeletonCard } from '../components/ui.jsx';

const EXAMPLES = ['React admin for a SaaS app', 'Film presets for weddings', 'A free serif font', 'Notion system for founders'];

function Stat({ value, label }) {
  return (
    <div>
      <p className="numeral text-[34px] leading-none sm:text-[40px]">{value}</p>
      <p className="mt-1.5 text-[13px] text-muted">{label}</p>
    </div>
  );
}

function HeroSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const ask = (text) => text.trim() && navigate(`/assistant?q=${encodeURIComponent(text.trim())}`);

  return (
    <>
      <form
        className="mt-8 flex items-center gap-2 rounded-full bg-wash p-1.5 pl-5 transition focus-within:bg-surface focus-within:ring-4 focus-within:ring-iris/10 focus-within:shadow-[var(--shadow-pop)]"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <Sparkles className="size-[18px] shrink-0 text-iris" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe what you’re building…"
          aria-label="Describe what you need"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted"
        />
        <button className="grid size-11 shrink-0 place-items-center rounded-full bg-night text-white transition hover:bg-iris" aria-label="Find products">
          <ArrowRight className="size-[18px]" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => ask(ex)} className="chip">
            {ex}
          </button>
        ))}
      </div>
    </>
  );
}

function Hero({ stats, featured }) {
  return (
    <section className="container-page grid gap-5 pt-4 lg:grid-cols-12">
      {/* Main hero card */}
      <div className="card animate-rise p-7 sm:p-10 lg:col-span-7 lg:row-span-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-lilac px-3 py-1.5 text-[13px] font-medium text-iris">
          <Sparkles className="size-3.5" /> AI-assisted marketplace
        </span>
        <h1 className="mt-6 text-[44px] leading-[1.02] tracking-[-0.045em] sm:text-[64px] xl:text-[76px]">
          Digital goods for people who <span className="text-opal">build</span>.
        </h1>
        <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-soft">
          UI kits, code templates, type and sound from independent studios. Tell the assistant what you’re making — it finds the pieces that fit.
        </p>
        <HeroSearch />
        {stats && (
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-7">
            <Stat value={stats.products} label="Products" />
            <Stat value={compact(stats.sales)} label="Downloads sold" />
            <Stat value={stats.avgRating.toFixed(1)} label="Average rating" />
          </div>
        )}
      </div>

      {/* Assistant promo — solid brand block */}
      <Link to="/assistant" className="card-brand group relative flex min-h-[260px] flex-col overflow-hidden p-7 lg:col-span-5">
        <div className="hatch pointer-events-none absolute -right-10 -top-10 size-56 rounded-full text-white opacity-15" />
        <div className="relative flex items-start justify-between gap-4">
          <h2 className="max-w-[16ch] text-[30px] leading-[1.05] text-white">Describe it. We’ll find it.</h2>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 transition group-hover:bg-white group-hover:text-iris">
            <ArrowUpRight className="size-5" />
          </span>
        </div>
        {/* a sample exchange, to show what the assistant does */}
        <div className="relative mt-5 space-y-2">
          <p className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-md bg-white/15 px-4 py-2.5 text-sm text-white backdrop-blur">
            A React admin template for my SaaS, under $100
          </p>
          <p className="flex w-fit max-w-[85%] items-center gap-2 rounded-[18px] rounded-bl-md bg-white px-4 py-2.5 text-sm text-ink">
            <Sparkles className="size-4 shrink-0 text-iris" /> Orbit fits — React 19 with billing and team pages
          </p>
        </div>
        <div className="relative mt-auto flex items-end gap-3 pt-8">
          <span className="numeral text-[76px] leading-[0.8] text-white">{stats?.sellers ?? '—'}</span>
          <span className="pb-1 text-sm leading-tight text-white/75">independent studios,<br />one search away</span>
        </div>
      </Link>

      {/* Featured product — dark contrast block */}
      {featured ? (
        <Link to={`/products/${featured.slug}`} className="card-dark group flex items-center gap-5 p-4 lg:col-span-5">
          <ProductImage product={featured} className="aspect-square w-[42%] max-w-48 shrink-0 rounded-[22px]" />
          <div className="min-w-0 flex-1 py-2 pr-2">
            <p className="flex items-center gap-1.5 text-[13px] text-white/50">
              <Star className="size-3.5 fill-amber text-amber" strokeWidth={0} /> Top rated
            </p>
            <p className="mt-2 line-clamp-2 font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-white">{featured.title}</p>
            <p className="mt-1 text-[13px] text-white/50">by {featured.seller.name}</p>
            <div className="mt-4 flex items-center justify-between">
              <PriceTag price={featured.price} tone="light" />
              <span className="grid size-10 place-items-center rounded-full bg-white/10 text-white transition group-hover:bg-white group-hover:text-ink">
                <ArrowUpRight className="size-4" />
              </span>
            </div>
          </div>
        </Link>
      ) : (
        <div className="card-dark min-h-48 animate-pulse lg:col-span-5" />
      )}
    </section>
  );
}

function Categories({ categories }) {
  return (
    <section className="container-page mt-20">
      <SectionHeader eyebrow="Shop by category" title="Find your shelf" to="/browse" action="Explore all" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
        {categories.map((c) => (
          <Link key={c.slug} to={`/browse?category=${c.slug}`} className="group card flex flex-col gap-6 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
            <span className="grid size-12 place-items-center rounded-full bg-wash text-ink transition group-hover:bg-iris group-hover:text-white">
              <CategoryIcon slug={c.slug} className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">{c.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{c.productCount} products</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductSection({ eyebrow, title, to, params }) {
  const { data, isPending } = useQuery({ queryKey: ['products', params], queryFn: () => api.get('/products', params) });
  if (!isPending && !data?.items.length) return null;
  return (
    <section className="container-page mt-20">
      <SectionHeader eyebrow={eyebrow} title={title} to={to} />
      {isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <ProductGrid products={data.items} />
      )}
    </section>
  );
}

function SellerBand() {
  return (
    <section className="container-page mt-20 grid gap-5 lg:grid-cols-12">
      <div className="card-dark relative flex flex-col overflow-hidden p-8 sm:p-10 lg:col-span-7">
        <div className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full opacity-50 blur-3xl" style={{ background: 'var(--gradient-brand)' }} />
        <p className="relative text-[13px] font-medium text-white/50">For sellers</p>
        <h2 className="relative mt-3 max-w-[18ch] text-[36px] leading-[1.05] text-white sm:text-[48px]">Upload the file. The listing writes itself.</h2>
        <p className="relative mt-4 max-w-md text-white/60">
          Drop in your zip and a few notes. Gemini drafts the title, description, tags, SEO copy and a suggested price — you edit and publish.
        </p>
        <div className="relative mt-auto flex flex-wrap gap-3 pt-10">
          <Link to="/studio/products/new" className="btn bg-white text-ink hover:bg-white/90">
            <Wand2 className="size-4" /> List a product
          </Link>
          <Link to="/studio" className="btn border border-white/15 text-white hover:bg-white/10">
            Seller dashboard
          </Link>
        </div>
      </div>

      {/* A sample of what the AI drafts, shown as a dashboard widget */}
      <div className="card p-6 sm:p-7 lg:col-span-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted">AI listing draft</p>
          <span className="badge-up"><Check className="size-3" strokeWidth={3} /> Ready</span>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">Orbit — SaaS Admin Dashboard</p>
        <p className="mt-1 text-sm text-muted">From orbit-admin.zip · 42 pages · README</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {['react', 'admin', 'saas', 'tailwind'].map((t) => (
            <span key={t} className="rounded-full bg-wash px-3 py-1 text-[13px] text-ink-soft">#{t}</span>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="tile p-4">
            <p className="text-xs text-muted">Suggested price</p>
            <p className="numeral mt-1 text-3xl">$79</p>
          </div>
          <div className="tile p-4">
            <p className="text-xs text-muted">Category</p>
            <p className="mt-2 text-sm font-semibold">Code Templates</p>
          </div>
        </div>
        <div className="mt-3 rounded-[var(--radius-inner)] bg-lilac p-4 text-[13px] leading-relaxed text-ink-soft">
          Similar admin kits sell for $59–$99 on established marketplaces.
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories') });
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/stats') });
  const featured = useQuery({ queryKey: ['products', { sort: 'rating', limit: 1 }], queryFn: () => api.get('/products', { sort: 'rating', limit: 1 }) });

  return (
    <>
      <Hero stats={stats.data} featured={featured.data?.items[0]} />
      {categories.data && <Categories categories={categories.data} />}
      <ProductSection eyebrow="Most bought" title="Selling well right now" to="/browse?sort=popular" params={{ sort: 'popular', limit: 8 }} />
      <ProductSection eyebrow="Limited time" title="On sale" to="/browse?onSale=true" params={{ onSale: true, limit: 4 }} />
      <SellerBand />
      <ProductSection eyebrow="$0" title="Free to download" to="/browse?free=true" params={{ free: true, limit: 4 }} />
    </>
  );
}
