import { Link } from 'react-router';
import { Heart } from 'lucide-react';
import { ProductImage } from './FacetCover.jsx';
import { DiscountBadge, PriceTag, RatingChip } from './ui.jsx';
import { useRequireAuth, useWishlistToggle } from '../lib/session.js';
import { useToast } from '../lib/toast.jsx';
import { compact, cx } from '../lib/format.js';

export function WishlistButton({ product, className = '' }) {
  const toggle = useWishlistToggle();
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const on = Boolean(product.wishlisted);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      disabled={toggle.isPending}
      onClick={() => {
        requireAuth(() =>
          toggle.mutate(
            { productId: product.id, on: !on },
            { onSuccess: () => toast(on ? 'Removed from wishlist' : 'Saved to wishlist') },
          ),
        );
      }}
      className={cx(
        'grid size-10 place-items-center rounded-full bg-white/90 shadow-[var(--shadow-pop)] backdrop-blur-md transition hover:scale-105',
        on ? 'text-blush' : 'text-ink-soft hover:text-blush',
        className,
      )}
    >
      <Heart className={cx('size-[18px]', on && 'fill-current')} />
    </button>
  );
}

export function ProductCard({ product, reason }) {
  return (
    <article className="group card relative flex flex-col p-2.5 transition duration-300 focus-within:shadow-[var(--shadow-lift)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="relative overflow-hidden rounded-[var(--radius-inner)]">
        <ProductImage product={product} className="aspect-[4/3] transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute right-3 top-3 z-10">
          <WishlistButton product={product} />
        </div>
        <DiscountBadge percent={product.price.discountPercent} className="absolute left-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-4">
        <p className="text-[13px] text-muted">
          {product.category?.name ?? 'Digital product'}
        </p>
        <h3 className="mt-1 line-clamp-2 text-[17px] leading-snug tracking-[-0.02em]">
          {/* stretched link: the whole card is clickable without nesting the wishlist button in a link */}
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none">
            {product.title}
          </Link>
        </h3>
        <p className="mt-1 text-[13px] text-muted">by {product.seller?.name}</p>
        {reason && <p className="mt-3 rounded-2xl bg-lilac px-3 py-2 text-[13px] leading-snug text-ink-soft">{reason}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <PriceTag price={product.price} />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">{compact(product.salesCount)} sold</span>
            <RatingChip value={product.rating} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, columns = 'sm:grid-cols-2 lg:grid-cols-4' }) {
  return (
    <div className={cx('grid gap-5', columns)}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
