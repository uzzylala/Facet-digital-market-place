import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-markdown';
import { FileArchive, ImagePlus, Info, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { cx, fileSize, money } from '../../lib/format.js';
import { FacetCover } from '../../components/FacetCover.jsx';
import { ErrorState, PageLoader, Spinner } from '../../components/ui.jsx';

const EMPTY = {
  title: '',
  tagline: '',
  categorySlug: '',
  price: '',
  discountPercent: '0',
  discountEndsAt: '',
  description: '',
  features: '',
  tags: [],
  targetAudience: '',
  seoTitle: '',
  seoDescription: '',
  version: '1.0.0',
  status: 'draft',
};

function fromProduct(p) {
  return {
    title: p.title ?? '',
    tagline: p.tagline ?? '',
    categorySlug: p.category?.slug ?? '',
    price: (p.price.listCents / 100).toFixed(2),
    discountPercent: String(p.price.discountPercent ?? 0),
    discountEndsAt: p.price.discountEndsAt ? p.price.discountEndsAt.slice(0, 10) : '',
    description: p.description ?? '',
    features: (p.features ?? []).join('\n'),
    tags: p.tags ?? [],
    targetAudience: p.targetAudience ?? '',
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    version: p.version ?? '1.0.0',
    status: p.status,
  };
}

function Field({ label, htmlFor, hint, count, max, children, className }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <label className="field-label" htmlFor={htmlFor}>{label}</label>
        {max && <span className={cx('font-mono text-[11px]', count > max ? 'text-danger' : 'text-muted')}>{count}/{max}</span>}
      </div>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function TagInput({ tags, onChange }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const next = raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (next.length) onChange([...new Set([...tags, ...next])].slice(0, 15));
    setDraft('');
  };
  return (
    <div className="input flex flex-wrap items-center gap-1.5 py-2">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-wash py-0.5 pl-2.5 pr-1 text-[13px] text-ink">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-line" aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id="tags"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={tags.length ? '' : 'react, dashboard, saas'}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
    </div>
  );
}

function FileDrop({ id, accept, file, existing, onFile, icon: Icon, label, hint }) {
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
      }}
      className={cx(
        'flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition',
        over ? 'border-iris bg-wash' : 'border-line-strong bg-paper hover:border-iris/50',
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-iris shadow-sm"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file ? file.name : existing ?? label}</span>
        <span className="block text-xs text-muted">{file ? fileSize(file.size) : existing ? 'Choose a file to replace it' : hint}</span>
      </span>
      <span className="btn-ghost btn-sm pointer-events-none">{file || existing ? 'Replace' : 'Choose'}</span>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
    </label>
  );
}

// function ImagePreview({ file, url, onRemove, label }) {
//   const src = useMemo(() => (file ? URL.createObjectURL(file) : url), [file, url]);
//   useEffect(() => () => file && URL.revokeObjectURL(src), [file, src]);
//   return (
//     <div className="group relative overflow-hidden rounded-xl border border-line">
//       <img src={src} alt={label} className="aspect-[4/3] w-full object-cover" />
//       {onRemove && (
//       <button type="button" onClick={onRemove} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/70 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label={`Remove ${label}`}>
//         <X className="size-3.5" />
//       </button>
//       )}
//     </div>
//   );
// }

function ImagePreview({ file, url, onRemove, label }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const src = file ? objectUrl : url;
  if (!src) return null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-line">
      <img src={src} alt={label} className="aspect-[4/3] w-full object-cover" />
      {onRemove && (
      <button type="button" onClick={onRemove} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/70 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label={`Remove ${label}`}>
        <X className="size-3.5" />
      </button>
      )}
    </div>
  );
}


/* ───────── AI listing generator ───────── */

function AiPanel({ file, categorySlug, onApply }) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(null);
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => api.get('/ai/status'), staleTime: Infinity });

  const generate = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('name', name);
      form.set('notes', notes);
      if (categorySlug) form.set('categoryHint', categorySlug);
      if (file) form.set('file', file);
      return api.postForm('/ai/listing', form);
    },
    onSuccess: (data) => {
      setResult(data);
      onApply(data);
    },
  });

  return (
    <aside className="card relative overflow-hidden p-2">
      <div className="relative">
        <div className="card-brand relative overflow-hidden rounded-[22px] p-5">
          <div className="hatch pointer-events-none absolute -right-8 -top-8 size-32 rounded-full text-white opacity-15" />
          <p className="relative flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em] text-white">
            <span className="grid size-8 place-items-center rounded-full bg-white/20"><Wand2 className="size-4" /></span>
            Draft with AI
          </p>
          <p className="relative mt-2 text-[13px] leading-relaxed text-white/80">
          {status.data?.enabled
            ? 'Gemini reads your notes and the product file (archive contents and README included) and fills in the listing.'
            : 'No GEMINI_API_KEY on the server — drafts use basic keyword rules until one is added.'}
          </p>
        </div>
        <div className="px-3 pb-3">

        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Working name, e.g. Aurora admin" value={name} onChange={(e) => setName(e.target.value)} aria-label="Working name" />
          <textarea
            className="input min-h-28"
            placeholder="A few notes: what it is, what's inside, the stack or format, who it's for."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Notes for the AI"
          />
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <FileArchive className="size-3.5" />
            {file ? <>Will read <span className="font-medium text-ink-soft">{file.name}</span></> : 'Attach the product file below and it will be read too.'}
          </p>
          <button type="button" className="btn-primary w-full" disabled={generate.isPending || (!name && !notes && !file)} onClick={() => generate.mutate()}>
            {generate.isPending ? <Spinner className="size-4 text-white" /> : <Sparkles className="size-4" />}
            {generate.isPending ? 'Writing your listing…' : result ? 'Generate again' : 'Generate listing'}
          </button>
          {generate.isError && <p className="text-sm text-danger">{generate.error.message}</p>}
        </div>

        {result && (
          <div className="mt-5 animate-rise space-y-3 border-t border-line pt-4 text-sm">
            <p className="font-medium text-success">Applied to the form — edit anything you like.</p>
            {result.notice && <p className="text-xs text-warn">{result.notice}</p>}
            <div className="tile p-4">
              <p className="eyebrow">Suggested price</p>
              <p className="mt-1 numeral text-3xl">{result.suggestedPriceCents ? money(result.suggestedPriceCents) : 'Free'}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{result.pricingRationale}</p>
            </div>
            <div className="tile p-4">
              <p className="eyebrow">Target audience</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{result.targetAudience}</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </aside>
  );
}

/* ───────── Editor ───────── */

export default function ProductEditor() {
  const { id } = useParams();
  const existing = useQuery({ queryKey: ['seller-product', id], queryFn: () => api.get(`/seller/products/${id}`), enabled: Boolean(id) });

  if (id && existing.isPending) return <PageLoader />;
  if (id && existing.isError) return <ErrorState error={existing.error} />;
  return <EditorForm key={id ?? 'new'} id={id} product={id ? existing.data : null} />;
}

function EditorForm({ id, product: p }) {
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories') });

  const [form, setForm] = useState(() => (p ? fromProduct(p) : EMPTY));
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [removeShots, setRemoveShots] = useState([]);
  const [previewMd, setPreviewMd] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const applyAi = (ai) =>
    setForm((f) => ({
      ...f,
      title: ai.title,
      tagline: ai.tagline,
      description: ai.description,
      features: ai.features.join('\n'),
      tags: ai.tags,
      categorySlug: ai.categorySlug,
      seoTitle: ai.seoTitle,
      seoDescription: ai.seoDescription,
      targetAudience: ai.targetAudience,
      price: (ai.suggestedPriceCents / 100).toFixed(2),
    }));

  const save = useMutation({
    mutationFn: (status) => {
      const body = new FormData();
      body.set('title', form.title);
      body.set('tagline', form.tagline);
      body.set('description', form.description);
      body.set('features', JSON.stringify(form.features.split('\n').map((s) => s.trim()).filter(Boolean)));
      body.set('tags', JSON.stringify(form.tags));
      body.set('categorySlug', form.categorySlug);
      body.set('priceCents', String(Math.round(Number(form.price || 0) * 100)));
      body.set('discountPercent', String(Number(form.discountPercent) || 0));
      body.set('discountEndsAt', form.discountEndsAt ? new Date(`${form.discountEndsAt}T23:59:59`).toISOString() : '');
      body.set('targetAudience', form.targetAudience);
      body.set('seoTitle', form.seoTitle);
      body.set('seoDescription', form.seoDescription);
      body.set('version', form.version);
      body.set('status', status);
      if (file) body.set('file', file);
      if (thumbnail) body.set('thumbnail', thumbnail);
      screenshots.forEach((s) => body.append('screenshots', s));
      if (removeShots.length) body.set('removeScreenshots', JSON.stringify(removeShots));
      return isEdit ? api.patchForm(`/seller/products/${id}`, body) : api.postForm('/seller/products', body);
    },
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      qc.invalidateQueries({ queryKey: ['seller-product', product.id] });
      qc.invalidateQueries({ queryKey: ['seller-stats'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product', product.slug] });
      toast(product.status === 'published' ? 'Published' : 'Draft saved');
      navigate(product.status === 'published' ? `/products/${product.slug}` : '/studio/products');
    },
    onError: (err) => toast(err.message, { tone: 'error' }),
  });

  const keptShots = (p?.screenshots ?? []).filter((s) => !removeShots.includes(s.key));
  const finalCents = Math.round(Number(form.price || 0) * 100 * (1 - (Number(form.discountPercent) || 0) / 100));
  const hasFile = Boolean(file || p?.file);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate('published');
      }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/studio/products" className="text-sm text-muted hover:text-ink">← Products</Link>
          <h2 className="mt-1 text-2xl font-semibold">{isEdit ? `Edit ${p.title}` : 'New product'}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" disabled={save.isPending || !form.title} onClick={() => save.mutate('draft')}>
            {isEdit && p.status === 'published' ? 'Unpublish to draft' : 'Save draft'}
          </button>
          <button className="btn-primary" disabled={save.isPending || !hasFile}>
            {save.isPending && <Spinner className="size-4 text-white" />}
            {isEdit && p.status === 'published' ? 'Save changes' : 'Publish'}
          </button>
        </div>
      </div>
      {!hasFile && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-wash px-4 py-2.5 text-sm text-ink-soft">
          <Info className="size-4 text-iris" /> Attach the product file to publish. You can save a draft without it.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <section className="card space-y-5 p-6">
            <h3 className="font-sans text-base font-semibold tracking-normal">Files</h3>
            <FileDrop
              id="product-file"
              file={file}
              existing={p?.file && `${p.file.name} · ${fileSize(p.file.size)}`}
              onFile={setFile}
              icon={Upload}
              label="Product file"
              hint="ZIP, PDF, font or any file up to 150 MB — stored privately, delivered only to buyers"
            />
            <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
              <div>
                <p className="field-label">Cover image</p>
                {thumbnail || p?.thumbnailUrl ? (
                  <ImagePreview file={thumbnail} url={p?.thumbnailUrl} label="cover image" onRemove={thumbnail ? () => setThumbnail(null) : undefined} />
                ) : (
                  <FacetCover seed={p?.id ?? form.title ?? 'new'} category={form.categorySlug} className="aspect-[4/3] rounded-xl" />
                )}
                <label className="btn-ghost btn-sm mt-2 w-full cursor-pointer">
                  <ImagePlus className="size-3.5" /> {thumbnail || p?.thumbnailUrl ? 'Replace' : 'Upload cover'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" onChange={(e) => e.target.files[0] && setThumbnail(e.target.files[0])} />
                </label>
                {!thumbnail && !p?.thumbnailUrl && <p className="field-hint">Without one, a cover is generated for you.</p>}
              </div>
              <div>
                <p className="field-label">Screenshots</p>
                <div className="grid grid-cols-3 gap-2">
                  {keptShots.map((s) => (
                    <ImagePreview key={s.key} url={s.url} label="screenshot" onRemove={() => setRemoveShots((r) => [...r, s.key])} />
                  ))}
                  {screenshots.map((s, i) => (
                    <ImagePreview key={`${s.name}-${i}`} file={s} label={s.name} onRemove={() => setScreenshots((all) => all.filter((_, j) => j !== i))} />
                  ))}
                  {keptShots.length + screenshots.length < 6 && (
                    <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong text-muted transition hover:border-iris hover:text-iris">
                      <ImagePlus className="size-5" />
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                        className="sr-only"
                        onChange={(e) => setScreenshots((all) => [...all, ...Array.from(e.target.files)].slice(0, 6 - keptShots.length))}
                      />
                    </label>
                  )}
                </div>
                <p className="field-hint">Up to 6 images shown in the product gallery.</p>
              </div>
            </div>
          </section>

          <section className="card space-y-5 p-6">
            <h3 className="font-sans text-base font-semibold tracking-normal">Listing</h3>
            <Field label="Title" htmlFor="title" count={form.title.length} max={90}>
              <input id="title" className="input" required minLength={3} value={form.title} onChange={set('title')} />
            </Field>
            <Field label="Tagline" htmlFor="tagline" count={form.tagline.length} max={160}>
              <input id="tagline" className="input" value={form.tagline} onChange={set('tagline')} placeholder="One sentence on what it does for the buyer" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" htmlFor="category">
                <select id="category" className="input" value={form.categorySlug} onChange={set('categorySlug')}>
                  <option value="">Choose a category</option>
                  {categories.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Version" htmlFor="version">
                <input id="version" className="input font-mono" value={form.version} onChange={set('version')} />
              </Field>
            </div>
            <Field label="Description" htmlFor="description" hint="Markdown supported: ### headings, - bullet lists, **bold**.">
              <div className="mb-2 flex gap-1">
                {['Write', 'Preview'].map((t, i) => (
                  <button key={t} type="button" onClick={() => setPreviewMd(i === 1)} className={cx('chip', previewMd === (i === 1) && 'chip-active')}>{t}</button>
                ))}
              </div>
              {previewMd ? (
                <div className="prose-facet min-h-48 rounded-xl border border-line bg-paper px-4 py-2">
                  <Markdown>{form.description || '_Nothing to preview yet._'}</Markdown>
                </div>
              ) : (
                <textarea id="description" className="input min-h-48 font-mono text-[13px] leading-6" value={form.description} onChange={set('description')} />
              )}
            </Field>
            <Field label="Features" htmlFor="features" hint="One per line — shown as “What you get”.">
              <textarea id="features" className="input min-h-28" value={form.features} onChange={set('features')} />
            </Field>
            <Field label="Tags" htmlFor="tags" hint="Press Enter or comma to add. Used for search and recommendations.">
              <TagInput tags={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
            </Field>
            <Field label="Who it’s for" htmlFor="audience">
              <textarea id="audience" className="input min-h-20" value={form.targetAudience} onChange={set('targetAudience')} />
            </Field>
          </section>

          <section className="card space-y-5 p-6">
            <h3 className="font-sans text-base font-semibold tracking-normal">Pricing</h3>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Price (USD)" htmlFor="price" hint="0 makes it free">
                <input id="price" type="number" min="0" max="999" step="0.01" required className="input font-mono" value={form.price} onChange={set('price')} />
              </Field>
              <Field label="Discount %" htmlFor="discount">
                <input id="discount" type="number" min="0" max="90" className="input font-mono" value={form.discountPercent} onChange={set('discountPercent')} />
              </Field>
              <Field label="Discount ends" htmlFor="ends" hint="Leave empty to run until you stop it">
                <input id="ends" type="date" className="input" value={form.discountEndsAt} onChange={set('discountEndsAt')} />
              </Field>
            </div>
            <p className="text-sm text-muted">
              Buyers pay <span className="numeral text-ink">{finalCents ? money(finalCents) : 'nothing — free product'}</span>
            </p>
          </section>

          <section className="card space-y-5 p-6">
            <h3 className="font-sans text-base font-semibold tracking-normal">Search appearance</h3>
            <Field label="SEO title" htmlFor="seo-title" count={form.seoTitle.length} max={60}>
              <input id="seo-title" className="input" value={form.seoTitle} onChange={set('seoTitle')} />
            </Field>
            <Field label="Meta description" htmlFor="seo-desc" count={form.seoDescription.length} max={155}>
              <textarea id="seo-desc" className="input min-h-20" value={form.seoDescription} onChange={set('seoDescription')} />
            </Field>
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="text-xs text-muted">facet.market › products</p>
              <p className="mt-0.5 line-clamp-1 text-lg text-[#1a0dab]">{form.seoTitle || form.title || 'Your product title'}</p>
              <p className="line-clamp-2 text-sm text-ink-soft">{form.seoDescription || form.tagline || 'Your meta description shows here in search results.'}</p>
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <AiPanel file={file} categorySlug={form.categorySlug} onApply={applyAi} />
        </div>
      </div>
    </form>
  );
}
