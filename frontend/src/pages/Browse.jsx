import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PackageSearch, SlidersHorizontal, Star, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { cx } from '../lib/format.js';
import { CategoryIcon } from '../components/CategoryIcon.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui.jsx';

const SORTS = [
  ['popular', 'Most popular'],
  ['rating', 'Highest rated'],
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
];

const PRICE_BANDS = [
  ['', '', 'Any price'],
  ['', '20', 'Under $20'],
  ['20', '50', '$20 – $50'],
  ['50', '100', '$50 – $100'],
  ['100', '', '$100 and up'],
];

function Filters({ params, set, categories }) {
  const category = params.get('category') ?? '';
  const minRating = params.get('minRating') ?? '';
  const band = `${params.get('minPrice') ?? ''}-${params.get('maxPrice') ?? ''}`;

  return (
    <div className="card space-y-7 p-5">
      <div>
        <p className="eyebrow mb-3 px-1">Category</p>
        <div className="grid gap-1">
          {[{ slug: '', name: 'All categories' }, ...(categories ?? [])].map((c) => (
            <button
              key={c.slug}
              onClick={() => set({ category: c.slug })}
              className={cx(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition',
                category === c.slug ? 'bg-night font-medium text-white' : 'text-ink-soft hover:bg-wash hover:text-ink',
              )}
            >
              <CategoryIcon slug={c.slug} className="size-4 shrink-0 opacity-80" />
              <span className="flex-1">{c.name}</span>
              {c.productCount !== undefined && <span className="text-xs opacity-55">{c.productCount}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3 px-1">Price</p>
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map(([min, max, label]) => (
            <button key={label} onClick={() => set({ minPrice: min, maxPrice: max })} className={cx('chip', band === `${min}-${max}` && 'chip-active')} aria-pressed={band === `${min}-${max}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3 px-1">Rating</p>
        <div className="flex flex-wrap gap-2">
          {['', '4.5', '4', '3'].map((r) => (
            <button key={r} onClick={() => set({ minRating: r })} className={cx('chip', minRating === r && 'chip-active')} aria-pressed={minRating === r}>
              {r ? (
                <>
                  <Star className="size-3 fill-current" strokeWidth={0} /> {r}+
                </>
              ) : (
                'Any'
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3 px-1">Offers</p>
        <div className="grid gap-2">
          {[
            ['free', 'Free only'],
            ['onSale', 'On sale'],
          ].map(([key, label]) => {
            const on = params.get(key) === 'true';
            return (
              <button
                key={key}
                onClick={() => set({ [key]: on ? '' : 'true' })}
                aria-pressed={on}
                className="flex items-center justify-between rounded-2xl bg-wash px-4 py-3 text-sm text-ink-soft transition hover:text-ink"
              >
                {label}
                <span className={cx('relative h-6 w-10 rounded-full transition', on ? 'bg-iris' : 'bg-line-strong')}>
                  <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const query = Object.fromEntries(params);
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? (q ? 'relevance' : 'popular');

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories') });
  const sellerId = params.get('seller');
  const seller = useQuery({ queryKey: ['seller', sellerId], queryFn: () => api.get(`/sellers/${sellerId}`), enabled: Boolean(sellerId) });
  const products = useQuery({
    queryKey: ['products', { ...query, sort, limit: 12 }],
    queryFn: () => api.get('/products', { ...query, sort, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  const activeCategory = categories.data?.find((c) => c.slug === params.get('category'));
  const activeFilters = ['seller', 'category', 'minPrice', 'maxPrice', 'minRating', 'free', 'onSale', 'q'].filter((k) => params.get(k));
  const data = products.data;

  return (
    <div className="container-page pt-6">
      <header className="mb-8">
        <p className="eyebrow mb-2">{q ? 'Search results' : seller.data ? 'Store' : 'Explore'}</p>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[56px]">{q ? `“${q}”` : seller.data?.name ?? activeCategory?.name ?? 'Everything on the shelf'}</h1>
        {seller.data?.bio && !q ? (
          <p className="mt-2 max-w-2xl text-ink-soft">{seller.data.bio}</p>
        ) : (
          activeCategory?.description && !q && <p className="mt-2 text-ink-soft">{activeCategory.description}</p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={cx('lg:block', filtersOpen ? 'block' : 'hidden')}>
          <div className="lg:sticky lg:top-24">
            <Filters params={params} set={set} categories={categories.data} />
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface py-2 pl-5 pr-2 shadow-[var(--shadow-pop)]">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-ink btn-sm lg:hidden" onClick={() => setFiltersOpen((o) => !o)}>
                <SlidersHorizontal className="size-3.5" /> Filters
              </button>
              <p className="text-sm font-medium text-ink">
                {data ? `${data.total} ${data.total === 1 ? 'product' : 'products'}` : ' '}
              </p>
              {activeFilters.length > 0 && (
                <button className="btn-quiet btn-sm" onClick={() => setParams(new URLSearchParams())}>
                  <X className="size-3.5" /> Clear filters
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort
              <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="input w-auto rounded-full py-2 pr-9 font-medium">
                {q && <option value="relevance">Best match</option>}
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {products.isError ? (
            <ErrorState error={products.error} retry={products.refetch} />
          ) : !data ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}</div>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Nothing matches those filters"
              action={
                <button className="btn-ghost" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </button>
              }
            >
              Try a broader search, or describe what you need to the assistant.
            </EmptyState>
          ) : (
            <div className={cx('transition-opacity', products.isPlaceholderData && 'opacity-60')}>
              <ProductGrid products={data.items} columns="sm:grid-cols-2 xl:grid-cols-3" />
            </div>
          )}

          {data && data.pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              <button className="btn-ghost btn-sm" disabled={data.page <= 1} onClick={() => set({ page: String(data.page - 1) })}>
                <ChevronLeft className="size-4" /> Previous
              </button>
              <span className="px-3 text-sm font-medium text-muted">
                {data.page} / {data.pages}
              </span>
              <button className="btn-ghost btn-sm" disabled={data.page >= data.pages} onClick={() => set({ page: String(data.page + 1) })}>
                Next <ChevronRight className="size-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
