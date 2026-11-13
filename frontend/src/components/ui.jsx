import { Link } from 'react-router';
import { ArrowUpRight, LoaderCircle, Star } from 'lucide-react';
import { cx, initials, moneyShort } from '../lib/format.js';

export function Rating({ value = 0, count, size = 'sm', showValue = true }) {
  const s = size === 'lg' ? 'size-[18px]' : 'size-3.5';
  return (
    <span className="inline-flex items-center gap-1.5" title={`${value.toFixed(1)} out of 5`}>
      <span className="relative inline-flex" aria-hidden>
        <span className="flex text-line-strong">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className={`${s} fill-current`} strokeWidth={0} />)}</span>
        <span className="absolute inset-0 flex overflow-hidden text-amber" style={{ width: `${(value / 5) * 100}%` }}>
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={`${s} shrink-0 fill-current`} strokeWidth={0} />)}
        </span>
      </span>
      {showValue && (
        <span className="text-xs font-medium text-ink-soft">
          {value ? value.toFixed(1) : '—'}
          {count !== undefined && <span className="font-normal text-muted"> ({count})</span>}
        </span>
      )}
    </span>
  );
}

/** Compact rating pill: ★ 4.6 */
export function RatingChip({ value, className = '' }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full bg-wash px-2.5 py-1 text-xs font-semibold text-ink', className)}>
      <Star className="size-3.5 fill-amber text-amber" strokeWidth={0} />
      {value ? value.toFixed(1) : 'New'}
    </span>
  );
}

export function PriceTag({ price, size = 'md', className = '', tone = 'ink' }) {
  const sizes = { sm: 'text-[15px]', md: 'text-lg', lg: 'text-[44px] leading-none' };
  const main = tone === 'light' ? 'text-white' : 'text-ink';
  const strike = tone === 'light' ? 'text-white/45' : 'text-muted';
  if (price.isFree) {
    return <span className={cx('numeral', sizes[size], tone === 'light' ? 'text-[#7ef0bd]' : 'text-success', className)}>Free</span>;
  }
  return (
    <span className={cx('inline-flex items-baseline gap-2', className)}>
      <span className={cx('numeral', sizes[size], main)}>{moneyShort(price.finalCents)}</span>
      {price.discountPercent > 0 && (
        <span className={cx('font-display font-medium line-through', strike, size === 'lg' ? 'text-xl' : 'text-[13px]')}>{moneyShort(price.listCents)}</span>
      )}
    </span>
  );
}

export function DiscountBadge({ percent, className = '' }) {
  if (!percent) return null;
  return <span className={cx('badge bg-night px-2.5 py-1 text-white', className)}>−{percent}%</span>;
}

/** Percentage change pill, green for up and red for down. */
export function Delta({ value, suffix = '' }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return <span className={up ? 'badge-up' : 'badge-down'}>{up ? '+' : ''}{Math.round(value * 100)}%{suffix}</span>;
}

export function Avatar({ name, src, className = 'size-8 text-xs' }) {
  if (src) return <img src={src} alt="" className={cx('rounded-full object-cover', className)} />;
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', className)} style={{ background: 'var(--gradient-brand)' }}>
      {initials(name)}
    </span>
  );
}

export function Spinner({ className = 'size-5' }) {
  return <LoaderCircle className={cx('animate-spin text-iris', className)} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <span className="mb-5 grid size-14 place-items-center rounded-full bg-lilac text-iris">
          <Icon className="size-6" strokeWidth={1.75} />
        </span>
      )}
      <h3 className="text-xl">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-medium text-ink">{error?.message ?? 'This page could not be loaded.'}</p>
      {retry && (
        <button onClick={retry} className="btn-ghost btn-sm mt-4">
          Try again
        </button>
      )}
    </div>
  );
}

/** Section title with an optional round "see all" link, like a dashboard widget header. */
export function SectionHeader({ eyebrow, title, action, to }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-[28px] leading-tight sm:text-[34px]">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="group flex shrink-0 items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
          <span className="hidden sm:inline">{action ?? 'See all'}</span>
          <span className="icon-btn size-10 group-hover:bg-night group-hover:text-white">
            <ArrowUpRight className="size-4" />
          </span>
        </Link>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-2.5">
      <div className="aspect-[4/3] animate-pulse rounded-[var(--radius-inner)] bg-wash" />
      <div className="space-y-2.5 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-wash" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-wash" />
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  const styles = {
    published: 'bg-success-soft text-success',
    draft: 'bg-wash text-ink-soft',
    archived: 'bg-line text-muted',
  };
  return (
    <span className={cx('badge px-2.5 py-1 capitalize', styles[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
