import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-markdown';
import { ArrowUpRight, BadgeCheck, Check, Download, FileArchive, Pencil, ShieldCheck, ShoppingBag, Star, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { useRequireAuth } from '../lib/session.js';
import { useDownload } from '../lib/downloads.js';
import { useToast } from '../lib/toast.jsx';
import { compact, cx, date, fileSize, timeAgo } from '../lib/format.js';
import { FacetCover } from '../components/FacetCover.jsx';
import { WishlistButton, ProductGrid } from '../components/ProductCard.jsx';
import { Avatar, DiscountBadge, ErrorState, PageLoader, PriceTag, Rating, SectionHeader, Spinner } from '../components/ui.jsx';
import { CategoryIcon } from '../components/CategoryIcon.jsx';

function Gallery({ product }) {
  const images = [
    product.thumbnailUrl ? { url: product.thumbnailUrl, key: 'thumb' } : { cover: true, key: 'cover' },
    ...product.screenshots,
  ];
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="card p-2.5">
      <div className="relative overflow-hidden rounded-[var(--radius-inner)]">
        {current.cover ? (
          <FacetCover seed={product.id} category={product.category?.slug} className="aspect-[4/3]" size="lg" title={product.title} />
        ) : (
          <img src={current.url} alt={`${product.title} preview`} className="aspect-[4/3] w-full bg-wash object-cover" />
        )}
        <DiscountBadge percent={product.price.discountPercent} className="absolute left-4 top-4 text-xs" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto p-2.5 pb-1">
          {images.map((img, i) => (
            <button
              key={img.key}
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              className={cx('relative w-24 shrink-0 overflow-hidden rounded-2xl ring-2 ring-offset-2 transition', i === active ? 'ring-iris' : 'ring-transparent opacity-65 hover:opacity-100')}
            >
              {img.cover ? (
                <FacetCover seed={product.id} category={product.category?.slug} className="aspect-[4/3]" showIcon={false} />
              ) : (
                <img src={img.url} alt="" className="aspect-[4/3] w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseBox({ product }) {
  const cart = useCart();
  const navigate = useNavigate();
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const download = useDownload();
  const { viewer, price } = product;
  const inCart = cart.has(product.id);

  const claim = useMutation({
    mutationFn: () => api.post(`/products/${product.id}/claim`),
    onSuccess: () => {
      toast('Added to your library');
      qc.invalidateQueries({ queryKey: ['product', product.slug] });
      qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  });

  return (
    <div className="card-dark relative overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full opacity-40 blur-3xl" style={{ background: 'var(--gradient-brand)' }} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-white/45">{price.isFree ? 'Price' : 'You pay'}</p>
          <PriceTag price={price} size="lg" tone="light" className="mt-2" />
        </div>
        {price.discountPercent > 0 && price.discountEndsAt && (
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80">Sale ends {date(price.discountEndsAt)}</span>
        )}
      </div>

      <div className="relative mt-6 grid gap-2.5">
        {viewer.isSeller ? (
          <>
            <Link to={`/studio/products/${product.id}/edit`} className="btn-primary btn-lg">
              <Pencil className="size-4" /> Edit listing
            </Link>
            <button className="btn btn-lg bg-white/10 text-white hover:bg-white/15" onClick={() => download.mutate(product.id)} disabled={download.isPending}>
              {download.isPending ? <Spinner className="size-4 text-white" /> : <Download className="size-4" />} Download your file
            </button>
          </>
        ) : viewer.owned ? (
          <>
            <button className="btn-primary btn-lg" onClick={() => download.mutate(product.id)} disabled={download.isPending}>
              {download.isPending ? <Spinner className="size-4 text-white" /> : <Download className="size-4" />} Download
            </button>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-sm text-[#7ef0bd]">
              <BadgeCheck className="size-4" /> In your <Link to="/library" className="underline underline-offset-2">library</Link>
            </p>
          </>
        ) : price.isFree ? (
          <button className="btn-primary btn-lg" disabled={claim.isPending} onClick={() => requireAuth(() => claim.mutate())}>
            {claim.isPending ? <Spinner className="size-4 text-white" /> : <Download className="size-4" />} Get it free
          </button>
        ) : (
          <>
            <button
              className="btn-primary btn-lg"
              onClick={() => {
                cart.add(product);
                navigate('/cart');
              }}
            >
              Buy now
            </button>
            <button
              className="btn btn-lg bg-white text-ink hover:bg-white/90"
              onClick={() => {
                if (inCart) return navigate('/cart');
                cart.add(product);
                toast('Added to cart');
              }}
            >
              {inCart ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
              {inCart ? 'In your cart — view' : 'Add to cart'}
            </button>
          </>
        )}
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-2.5 text-sm">
        {product.file && (
          <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
            <FileArchive className="size-4 shrink-0 text-white/50" />
            <dt className="sr-only">File</dt>
            <dd className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="truncate text-white/80">{product.file.name}</span>
              <span className="shrink-0 text-xs text-white/45">{fileSize(product.file.size)}</span>
            </dd>
          </div>
        )}
        <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
          <dt className="text-xs text-white/45">Version</dt>
          <dd className="mt-0.5 font-medium text-white">{product.version}</dd>
        </div>
        <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
          <dt className="text-xs text-white/45">Updated</dt>
          <dd className="mt-0.5 font-medium text-white">{date(product.updatedAt)}</dd>
        </div>
      </dl>
      <p className="relative mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-white/50">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-white/70" />
        Delivered through expiring download links once your purchase is confirmed. Re-download any time from your library.
      </p>
    </div>
  );
}

function ReviewForm({ product, onDone }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const toast = useToast();
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: () => api.post(`/products/${product.id}/reviews`, { rating, title, body }),
    onSuccess: () => {
      toast('Review published');
      qc.invalidateQueries({ queryKey: ['product', product.slug] });
      qc.invalidateQueries({ queryKey: ['reviews', product.id] });
      onDone?.();
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  });

  return (
    <form
      className="tile space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <p className="font-semibold">Review {product.title}</p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <Star className={cx('size-7 transition', n <= (hover || rating) ? 'fill-amber text-amber' : 'text-line-strong')} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <input className="input bg-surface" placeholder="Sum it up in a few words" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <textarea className="input min-h-28 bg-surface" placeholder="What did you build with it? What would you tell another buyer?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
      <button className="btn-ink" disabled={submit.isPending}>
        {submit.isPending && <Spinner className="size-4 text-white" />} Publish review
      </button>
    </form>
  );
}

function Reviews({ product }) {
  const reviews = useQuery({ queryKey: ['reviews', product.id], queryFn: () => api.get(`/products/${product.id}/reviews`) });
  const [writing, setWriting] = useState(false);
  const total = product.ratingCount;
  const canReview = product.viewer.owned && !product.viewer.isSeller;

  return (
    <section className="mt-20" id="reviews">
      <SectionHeader eyebrow="From verified buyers" title="Reviews" />
      <div className="card grid gap-8 p-6 sm:p-8 lg:grid-cols-[300px_1fr]">
        <div>
          <div className="flex items-end gap-3">
            <p className="numeral text-[72px] leading-[0.85]">{product.rating ? product.rating.toFixed(1) : '—'}</p>
            <p className="pb-1 text-sm text-muted">{total} {total === 1 ? 'review' : 'reviews'}</p>
          </div>
          <div className="mt-3"><Rating value={product.rating} size="lg" showValue={false} /></div>
          <div className="mt-6 space-y-2.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = product.ratingBreakdown[n] ?? 0;
              return (
                <div key={n} className="flex items-center gap-3 text-xs">
                  <span className="w-3 font-medium text-ink-soft">{n}</span>
                  <div className="hatch relative h-2.5 flex-1 overflow-hidden rounded-full bg-wash text-line-strong">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-night" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted">{count}</span>
                </div>
              );
            })}
          </div>
          {canReview && !writing && (
            <button className="btn-ink mt-7 w-full" onClick={() => setWriting(true)}>
              <Pencil className="size-3.5" /> {product.viewer.reviewed ? 'Update your review' : 'Write a review'}
            </button>
          )}
          {!product.viewer.owned && <p className="mt-7 text-xs text-muted">Only customers who own this product can review it.</p>}
        </div>

        <div className="space-y-3">
          {writing && <ReviewForm product={product} onDone={() => setWriting(false)} />}
          {reviews.isPending ? (
            <Spinner />
          ) : reviews.data?.length === 0 ? (
            <p className="tile p-6 text-sm text-muted">No reviews yet.</p>
          ) : (
            reviews.data?.map((r) => (
              <article key={r.id} className="tile p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={r.author} src={r.avatarUrl} className="size-10 text-xs" />
                  <div>
                    <p className="text-sm font-semibold">{r.author}</p>
                    <p className="text-xs text-muted">{timeAgo(r.createdAt)}</p>
                  </div>
                  <span className="ml-auto"><Rating value={r.rating} /></span>
                </div>
                {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{r.body}</p>}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: product, isPending, isError, error, refetch } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.get(`/products/${slug}`),
  });

  useEffect(() => {
    if (product) document.title = `${product.seoTitle || product.title} — Facet`;
    return () => (document.title = 'Facet — Digital goods, cut to fit');
  }, [product]);

  if (isPending) return <PageLoader />;
  if (isError) return <div className="container-page pt-16"><ErrorState error={error} retry={refetch} /></div>;

  return (
    <div className="container-page pt-4">
      <nav className="mb-5 flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/browse" className="hover:text-ink">Explore</Link>
        {product.category && (
          <>
            <span className="text-line-strong">/</span>
            <Link to={`/browse?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link>
          </>
        )}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0 space-y-5">
          <Gallery product={product} />

          {product.features.length > 0 && (
            <section className="card p-6 sm:p-8">
              <h2 className="text-2xl">What you get</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {product.features.map((f) => (
                  <li key={f} className="tile flex items-start gap-3 p-4 text-sm text-ink-soft">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-iris text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {product.description && (
            <section className="card p-6 sm:p-8">
              <h2 className="text-2xl">About this product</h2>
              <div className="prose-facet mt-2">
                <Markdown>{product.description}</Markdown>
              </div>
              {product.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-6">
                  {product.tags.map((t) => (
                    <Link key={t} to={`/browse?q=${encodeURIComponent(t)}`} className="rounded-full bg-wash px-3 py-1.5 text-[13px] text-ink-soft hover:bg-lilac hover:text-iris">#{t}</Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <div>
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="card p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {product.category && (
                    <Link to={`/browse?category=${product.category.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-lilac px-3 py-1.5 text-[13px] font-medium text-iris">
                      <CategoryIcon slug={product.category.slug} className="size-3.5" /> {product.category.name}
                    </Link>
                  )}
                  {product.status !== 'published' && <span className="badge bg-warn-soft px-2.5 py-1 text-warn">{product.status} — only you can see this</span>}
                </div>
                {!product.viewer.isSeller && <WishlistButton product={{ ...product, wishlisted: product.viewer.wishlisted }} />}
              </div>
              <h1 className="mt-5 text-[34px] leading-[1.05] tracking-[-0.04em] sm:text-[42px]">{product.title}</h1>
              {product.tagline && <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">{product.tagline}</p>}

              <div className="mt-6 grid grid-cols-3 gap-2.5">
                <a href="#reviews" className="tile p-4 transition hover:bg-lilac">
                  <p className="text-xs text-muted">Rating</p>
                  <p className="numeral mt-1 flex items-center gap-1.5 text-2xl">
                    {product.rating ? product.rating.toFixed(1) : '—'}
                    <Star className="size-4 fill-amber text-amber" strokeWidth={0} />
                  </p>
                </a>
                <div className="tile p-4">
                  <p className="text-xs text-muted">Sales</p>
                  <p className="numeral mt-1 text-2xl">{compact(product.salesCount)}</p>
                </div>
                <div className="tile p-4">
                  <p className="text-xs text-muted">Reviews</p>
                  <p className="numeral mt-1 text-2xl">{product.ratingCount}</p>
                </div>
              </div>

              <Link to={`/browse?seller=${product.seller.id}`} className="group mt-3 flex items-center gap-3 rounded-[var(--radius-inner)] border border-line p-3 transition hover:border-line-strong">
                <Avatar name={product.seller.name} src={product.seller.avatarUrl} className="size-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{product.seller.name}</p>
                  {product.seller.bio && <p className="line-clamp-1 text-xs text-muted">{product.seller.bio}</p>}
                </div>
                <span className="icon-btn size-9 shadow-none ring-1 ring-line group-hover:bg-night group-hover:text-white">
                  <ArrowUpRight className="size-4" />
                </span>
              </Link>
            </div>

            <PurchaseBox product={product} />

            {product.targetAudience && (
              <section className="card flex gap-4 p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lilac text-iris">
                  <Users className="size-[18px]" />
                </span>
                <div>
                  <h2 className="font-sans text-sm font-semibold tracking-normal">Made for</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{product.targetAudience}</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <Reviews product={product} />

      {product.related.length > 0 && (
        <section className="mt-20">
          <SectionHeader eyebrow="Keep looking" title="You might also like" />
          <ProductGrid products={product.related} />
        </section>
      )}
    </div>
  );
}
