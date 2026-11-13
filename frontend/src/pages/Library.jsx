import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, Heart, Library as LibraryIcon, Receipt, Star } from 'lucide-react';
import { api } from '../lib/api.js';
import { useDownload } from '../lib/downloads.js';
import { date, fileSize } from '../lib/format.js';
import { ProductImage } from '../components/FacetCover.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui.jsx';

export function Library() {
  const library = useQuery({ queryKey: ['library'], queryFn: () => api.get('/library') });
  const download = useDownload();

  return (
    <div className="container-page pt-10">
      <p className="eyebrow mb-2">Account</p>
      <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Library</h1>
      <p className="mt-2 text-ink-soft">Everything you own. Download links are generated fresh each time and expire after five minutes.</p>

      <div className="mt-8">
        {library.isPending ? (
          <PageLoader />
        ) : library.isError ? (
          <ErrorState error={library.error} retry={library.refetch} />
        ) : library.data.length === 0 ? (
          <EmptyState icon={LibraryIcon} title="Your library is empty" action={<Link to="/browse?free=true" className="btn-primary">Start with something free</Link>}>
            Products you buy or claim show up here, ready to download.
          </EmptyState>
        ) : (
          <div className="grid gap-4">
            {library.data.map((p) => (
              <article key={p.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <Link to={`/products/${p.slug}`} className="shrink-0">
                  <ProductImage product={p} className="aspect-[4/3] w-full rounded-xl sm:w-32" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${p.slug}`} className="text-lg font-semibold hover:text-iris">{p.title}</Link>
                  <p className="text-sm text-muted">
                    {p.seller} · v{p.version} · purchased {date(p.purchasedAt)}
                  </p>
                  {p.file && <p className="mt-1 font-mono text-xs text-muted">{p.file.name} · {fileSize(p.file.size)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!p.reviewed && (
                    <Link to={`/products/${p.slug}#reviews`} className="btn-quiet btn-sm">
                      <Star className="size-3.5" /> Review
                    </Link>
                  )}
                  <Link to={`/orders/${p.orderId}`} className="btn-quiet btn-sm">
                    <Receipt className="size-3.5" /> Receipt
                  </Link>
                  <button className="btn-primary btn-sm" onClick={() => download.mutate(p.id)} disabled={download.isPending || !p.file}>
                    {download.isPending && download.variables === p.id ? <Spinner className="size-3.5 text-white" /> : <Download className="size-3.5" />}
                    {p.file ? 'Download' : 'File coming soon'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Wishlist() {
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: () => api.get('/wishlist') });

  return (
    <div className="container-page pt-10">
      <p className="eyebrow mb-2">Account</p>
      <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Wishlist</h1>
      <div className="mt-8">
        {wishlist.isPending ? (
          <PageLoader />
        ) : wishlist.isError ? (
          <ErrorState error={wishlist.error} retry={wishlist.refetch} />
        ) : wishlist.data.length === 0 ? (
          <EmptyState icon={Heart} title="Nothing saved yet" action={<Link to="/browse" className="btn-primary">Browse products</Link>}>
            Tap the heart on any product to keep it here for later.
          </EmptyState>
        ) : (
          <ProductGrid products={wishlist.data} />
        )}
      </div>
    </div>
  );
}
