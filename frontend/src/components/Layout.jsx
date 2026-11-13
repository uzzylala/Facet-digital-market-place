import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Heart, Library, LogOut, Menu, Receipt, Search, ShoppingBag, Sparkles, Store, X } from 'lucide-react';
import { useCart } from '../lib/cart.jsx';
import { signOut, useSession } from '../lib/session.js';
import { cx } from '../lib/format.js';
import { Avatar } from './ui.jsx';

export function Logo({ className = '', light = false }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)} aria-label="Facet home">
      <span className="grid size-9 place-items-center rounded-xl" style={{ background: 'var(--gradient-brand)' }}>
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M16 3 28 11.5 23.5 28h-15L4 11.5Z" fill="#fff" fillOpacity=".95" />
          <path d="M16 3 12 12.5h8Zm-4 9.5L16 28l4-15.5Z" fill="#6a4cff" fillOpacity=".35" />
        </svg>
      </span>
      <span className={cx('font-display text-[20px] font-semibold tracking-[-0.04em]', light && 'text-white')}>facet</span>
    </Link>
  );
}

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/browse', label: 'Explore' },
  { to: '/assistant', label: 'Assistant', icon: Sparkles },
  { to: '/studio', label: 'Sell' },
];

function SearchBox({ className = '', onDone }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const [q, setQ] = useState(location.pathname === '/browse' ? params.get('q') ?? '' : '');

  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/browse?q=${encodeURIComponent(q.trim())}&sort=relevance`);
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search products…"
        aria-label="Search products"
        className="h-11 w-full rounded-full bg-surface pl-11 pr-4 text-sm shadow-[var(--shadow-pop)] outline-none transition placeholder:text-muted focus:ring-4 focus:ring-iris/10"
      />
    </form>
  );
}

function UserMenu() {
  const { user, profile } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const items = [
    { to: '/library', label: 'Library', icon: Library },
    { to: '/orders', label: 'Purchase history', icon: Receipt },
    { to: '/wishlist', label: 'Wishlist', icon: Heart },
    { to: '/studio', label: profile?.isSeller ? 'Seller studio' : 'Start selling', icon: Store },
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center rounded-full p-0.5 shadow-[var(--shadow-pop)] transition hover:ring-4 hover:ring-iris/15" aria-expanded={open} aria-label="Account menu">
        <Avatar name={profile?.name ?? user.name ?? user.email} src={user.image} className="size-10 text-xs" />
      </button>
      {open && (
        <div className="card absolute right-0 top-14 z-50 w-72 animate-rise p-2">
          <div className="flex items-center gap-3 rounded-[20px] bg-wash p-3">
            <Avatar name={profile?.name ?? user.name ?? user.email} src={user.image} className="size-10 text-xs" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.name ?? user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="py-1.5">
            {items.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-ink-soft hover:bg-wash hover:text-ink">
                <Icon className="size-4" /> {label}
              </Link>
            ))}
          </div>
          <button
            onClick={async () => {
              setOpen(false);
              await signOut(qc);
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-ink-soft hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { count } = useCart();
  const { isSignedIn, isPending } = useSession();
  const location = useLocation();
  // Remember which path the menu was opened on; navigating anywhere closes it.
  const [openedAt, setOpenedAt] = useState(null);
  const mobileOpen = openedAt === location.pathname;
  const setMobileOpen = (open) => setOpenedAt(open ? location.pathname : null);

  return (
    <header className="no-print sticky top-0 z-40 bg-paper/75 backdrop-blur-xl">
      <div className="container-page flex h-[76px] items-center gap-3 lg:gap-6">
        <Logo className="rounded-full bg-surface py-1 pl-1 pr-4 shadow-[var(--shadow-pop)]" />
        <nav className="segmented hidden md:inline-flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('segment flex items-center gap-1.5', isActive && 'segment-active')}>
              {Icon && <Icon className="size-3.5" />}
              {label}
            </NavLink>
          ))}
        </nav>
        <SearchBox className="ml-auto hidden w-full max-w-[280px] lg:block" />
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {isSignedIn && (
            <Link to="/wishlist" className="icon-btn hidden sm:grid" aria-label="Wishlist">
              <Heart className="size-[18px]" />
            </Link>
          )}
          <Link to="/cart" className="icon-btn" aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="size-[18px]" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-iris text-[10px] font-semibold text-white ring-2 ring-paper">
                {count}
              </span>
            )}
          </Link>
          {isPending ? (
            <span className="size-11 animate-pulse rounded-full bg-surface" />
          ) : isSignedIn ? (
            <UserMenu />
          ) : (
            <Link to="/sign-in" className="btn-ink">
              Sign in
            </Link>
          )}
          <button className="icon-btn md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="container-page animate-rise pb-5 md:hidden">
          <div className="card space-y-3 p-3">
            <SearchBox onDone={() => setMobileOpen(false)} />
            <nav className="grid gap-1">
              {NAV.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('rounded-2xl px-4 py-3 text-[15px] font-medium', isActive ? 'bg-night text-white' : 'hover:bg-wash')}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const groups = [
    ['Shop', [['Explore all', '/browse'], ['Free products', '/browse?free=true'], ['On sale', '/browse?onSale=true'], ['Ask the assistant', '/assistant']]],
    ['Sell', [['Open a store', '/studio'], ['List a product', '/studio/products/new'], ['Seller dashboard', '/studio']]],
    ['Account', [['Library', '/library'], ['Purchase history', '/orders'], ['Wishlist', '/wishlist']]],
  ];
  return (
    <footer className="no-print container-page mt-24 pb-6">
      <div className="card-dark grid gap-10 p-8 sm:p-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Templates, kits, type and sound from independent studios — bought once, yours to build with.
          </p>
          <Link to="/studio" className="btn mt-6 bg-white text-ink hover:bg-white/90">
            Start selling <ArrowUpRight className="size-4" />
          </Link>
        </div>
        {groups.map(([title, links]) => (
          <div key={title}>
            <p className="mb-4 text-[13px] font-medium text-white/40">{title}</p>
            <ul className="space-y-3 text-sm">
              {links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-white/75 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="px-2 pt-5 text-xs text-muted">Demo marketplace. Payments are simulated — no real charges are made.</p>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
