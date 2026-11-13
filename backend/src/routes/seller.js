import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { PRODUCT_COLUMNS, PRODUCT_JOINS, serializeProduct, serializeProductDetail } from '../services/serialize.js';
import { deleteObjects, keys, putObject } from '../services/storage.js';

const router = Router();
router.use(requireAuth, requireSeller);

const productUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'screenshots', maxCount: 6 },
]);

const jsonArray = z.preprocess((v) => (typeof v === 'string' ? (v ? JSON.parse(v) : []) : v), z.array(z.string().trim().min(1)).max(20));
const intString = (min, max) => z.coerce.number().int().min(min).max(max);

const productFields = z.object({
  title: z.string().trim().min(3).max(90),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(20000),
  features: jsonArray,
  tags: jsonArray,
  categorySlug: z.string(),
  priceCents: intString(0, 99_900),
  discountPercent: intString(0, 90),
  discountEndsAt: z.string().transform((v) => (v ? new Date(v) : null)),
  targetAudience: z.string().trim().max(400),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
  version: z.string().trim().max(20),
  status: z.enum(['draft', 'published', 'archived']),
}).partial();

const createFields = productFields.required({ title: true, priceCents: true });
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);

async function uniqueSlug(title) {
  const base = slugify(title) || 'product';
  const { rows } = await query('SELECT 1 FROM products WHERE slug = $1', [base]);
  return rows.length ? `${base}-${randomBytes(2).toString('hex')}` : base;
}

async function categoryId(slug) {
  if (!slug) return null;
  const { rows } = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
  return rows[0]?.id ?? null;
}

async function storeUploads(productId, files = {}) {
  const out = {};
  const file = files.file?.[0];
  if (file) {
    out.file = { key: await putObject(keys.file(productId, file.originalname), file.buffer, file.mimetype), name: file.originalname, size: file.size };
  }
  const thumb = files.thumbnail?.[0];
  if (thumb) out.thumbnailKey = await putObject(keys.media(productId, thumb.originalname), thumb.buffer, thumb.mimetype);
  out.screenshotKeys = await Promise.all(
    (files.screenshots ?? []).map((s) => putObject(keys.media(productId, s.originalname), s.buffer, s.mimetype)),
  );
  return out;
}
const normTags = (tags) => [...new Set(tags.map((t) => t.toLowerCase()))].slice(0, 15);

async function loadOwn(productId, sellerId) {
  const { rows } = await query(
    `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.id AS seller_id, COALESCE(s.store_name, s.name) AS seller_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id JOIN profiles s ON s.id = p.seller_id
     WHERE p.id = $1 AND p.seller_id = $2`,
    [productId, sellerId],
  );
  return rows[0];
}

router.get('/products', async (req, res) => {
  const { rows } = await query(
    `SELECT ${PRODUCT_COLUMNS}, p.view_count,
            COALESCE((SELECT SUM(oi.unit_price_cents) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                      WHERE oi.product_id = p.id AND o.status = 'paid'), 0)::int AS revenue_cents
     ${PRODUCT_JOINS}
     WHERE p.seller_id = $1
     ORDER BY p.updated_at DESC`,
    [req.user.id],
  );
  res.json(rows.map((r) => ({ ...serializeProduct(r), viewCount: r.view_count, revenueCents: r.revenue_cents })));
});

router.get('/products/:id', async (req, res) => {
  const row = await loadOwn(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json(serializeProductDetail(row));
});
router.post('/products', productUpload, async (req, res) => {
  const f = createFields.parse(req.body);
  f.status ??= 'draft';
  if (f.status === 'published' && !req.files?.file?.[0]) {
    return res.status(400).json({ error: 'Attach the product file before publishing, or save as a draft.' });
  }

  const { rows } = await query(
    `INSERT INTO products (seller_id, category_id, slug, title, tagline, description, features, tags, target_audience,
                           seo_title, seo_description, price_cents, discount_percent, discount_ends_at, version, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [
      req.user.id, await categoryId(f.categorySlug), await uniqueSlug(f.title), f.title, f.tagline ?? '', f.description ?? '',
      f.features ?? [], normTags(f.tags ?? []), f.targetAudience ?? '', f.seoTitle ?? '', f.seoDescription ?? '', f.priceCents,
      f.discountPercent ?? 0, f.discountEndsAt ?? null, f.version || '1.0.0', f.status,
    ],
  );
  const id = rows[0].id;

  const stored = await storeUploads(id, req.files);
  await query(
    `UPDATE products SET file_key = $2, file_name = $3, file_size = $4, thumbnail_key = $5, screenshot_keys = $6 WHERE id = $1`,
    [id, stored.file?.key ?? null, stored.file?.name ?? null, stored.file?.size ?? null, stored.thumbnailKey ?? null, stored.screenshotKeys],
  );

  res.status(201).json(serializeProductDetail(await loadOwn(id, req.user.id)));
});

router.patch('/products/:id', productUpload, async (req, res) => {
  const existing = await loadOwn(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const f = productFields.parse(req.body);
  const removeScreenshots = req.body.removeScreenshots ? jsonArray.parse(req.body.removeScreenshots) : [];
  const stored = await storeUploads(existing.id, req.files);
  const hasFile = Boolean(stored.file || existing.file_key);
  if (f.status === 'published' && !hasFile) {
    return res.status(400).json({ error: 'Attach the product file before publishing.' });
  }

  const screenshots = existing.screenshot_keys.filter((k) => !removeScreenshots.includes(k)).concat(stored.screenshotKeys).slice(0, 8);
  const set = (value, fallback) => (value === undefined ? fallback : value);

  await query(
    `UPDATE products SET
       title = $2, tagline = $3, description = $4, features = $5, tags = $6, target_audience = $7,
       seo_title = $8, seo_description = $9, price_cents = $10, discount_percent = $11, discount_ends_at = $12,
       version = $13, status = $14, category_id = $15,
       file_key = $16, file_name = $17, file_size = $18, thumbnail_key = $19, screenshot_keys = $20,
       updated_at = now()
     WHERE id = $1`,
    [
      existing.id,
      set(f.title, existing.title), set(f.tagline, existing.tagline), set(f.description, existing.description),
      set(f.features, existing.features), f.tags ? normTags(f.tags) : existing.tags, set(f.targetAudience, existing.target_audience),
      set(f.seoTitle, existing.seo_title), set(f.seoDescription, existing.seo_description),
      set(f.priceCents, existing.price_cents), set(f.discountPercent, existing.discount_percent),
      'discountEndsAt' in req.body ? f.discountEndsAt : existing.discount_ends_at,
      set(f.version, existing.version), set(f.status, existing.status),
      f.categorySlug !== undefined ? await categoryId(f.categorySlug) : existing.category_id,
      stored.file?.key ?? existing.file_key, stored.file?.name ?? existing.file_name, stored.file?.size ?? existing.file_size,
      stored.thumbnailKey ?? existing.thumbnail_key, screenshots,
    ],
  );

  const garbage = [...removeScreenshots.filter((k) => existing.screenshot_keys.includes(k))];
  if (stored.thumbnailKey && existing.thumbnail_key) garbage.push(existing.thumbnail_key);
  if (stored.file && existing.file_key && existing.sales_count === 0) garbage.push(existing.file_key);
  deleteObjects(garbage);

  res.json(serializeProductDetail(await loadOwn(existing.id, req.user.id)));
});
router.patch('/products/:id/pricing', async (req, res) => {
  const body = z
    .object({
      priceCents: z.number().int().min(0).max(99_900).optional(),
      discountPercent: z.number().int().min(0).max(90).optional(),
      discountEndsAt: z.string().nullable().optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
    })
    .parse(req.body);

  const existing = await loadOwn(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  if (body.status === 'published' && !existing.file_key) return res.status(400).json({ error: 'Attach the product file before publishing.' });

  await query(
    `UPDATE products SET price_cents = $2, discount_percent = $3, discount_ends_at = $4, status = $5, updated_at = now() WHERE id = $1`,
    [
      existing.id,
      body.priceCents ?? existing.price_cents,
      body.discountPercent ?? existing.discount_percent,
      body.discountEndsAt !== undefined ? (body.discountEndsAt ? new Date(body.discountEndsAt) : null) : existing.discount_ends_at,
      body.status ?? existing.status,
    ],
  );

  res.json(serializeProductDetail(await loadOwn(existing.id, req.user.id)));
});

router.delete('/products/:id', async (req, res) => {
  const existing = await loadOwn(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  if (existing.sales_count > 0) {
    await query(`UPDATE products SET status = 'archived', updated_at = now() WHERE id = $1`, [existing.id]);
    return res.json({ archived: true });
  }
  await query('DELETE FROM products WHERE id = $1', [existing.id]);
  deleteObjects([existing.file_key, existing.thumbnail_key, ...existing.screenshot_keys]);
  res.json({ deleted: true });
});
router.get('/stats', async (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const sellerId = req.user.id;

  const [totals, series, top, catalog] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(oi.unit_price_cents), 0)::int AS revenue_cents,
              COUNT(*)::int AS sales,
              COUNT(DISTINCT o.buyer_id)::int AS customers,
              COALESCE(SUM(oi.unit_price_cents) FILTER (WHERE o.paid_at >= now() - make_interval(days => $2::int)), 0)::int AS period_revenue_cents,
              COUNT(*) FILTER (WHERE o.paid_at >= now() - make_interval(days => $2::int))::int AS period_sales,
              COALESCE(SUM(oi.unit_price_cents) FILTER (WHERE o.paid_at >= now() - make_interval(days => $2::int * 2)
                                                        AND o.paid_at < now() - make_interval(days => $2::int)), 0)::int AS prev_period_revenue_cents
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.seller_id = $1 AND o.status = 'paid'`,
      [sellerId, days],
    ),
    query(
      `WITH sold AS (
         SELECT o.paid_at::date AS day, oi.unit_price_cents
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.seller_id = $1 AND o.status = 'paid' AND o.paid_at >= current_date - ($2::int - 1)
       )
       SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(sold.unit_price_cents), 0)::int AS revenue_cents, COUNT(sold.day)::int AS sales
       FROM generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d
       LEFT JOIN sold ON sold.day = d::date
       GROUP BY d ORDER BY d`,
      [sellerId, days],
    ),
    query(
      `SELECT p.id, p.slug, p.title, p.view_count, p.rating_avg, p.rating_count,
              COUNT(oi.id) FILTER (WHERE o.status = 'paid')::int AS sales,
              COALESCE(SUM(oi.unit_price_cents) FILTER (WHERE o.status = 'paid'), 0)::int AS revenue_cents
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id
       WHERE p.seller_id = $1
       GROUP BY p.id ORDER BY revenue_cents DESC, sales DESC LIMIT 6`,
      [sellerId],
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE status = 'published')::int AS published,
              COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
              COALESCE(SUM(view_count), 0)::int AS views,
              COALESCE(AVG(NULLIF(rating_avg, 0)), 0)::numeric(3,2) AS avg_rating
       FROM products WHERE seller_id = $1`,
      [sellerId],
    ),
  ]);

  const t = totals.rows[0];
  const c = catalog.rows[0];
  res.json({
    days,
    revenueCents: t.revenue_cents,
    sales: t.sales,
    customers: t.customers,
    periodRevenueCents: t.period_revenue_cents,
    periodSales: t.period_sales,
    previousPeriodRevenueCents: t.prev_period_revenue_cents,
    published: c.published,
    drafts: c.drafts,
    views: c.views,
    avgRating: Number(c.avg_rating),
    conversionRate: c.views ? t.sales / c.views : 0,
    series: series.rows.map((r) => ({ day: r.day, revenueCents: r.revenue_cents, sales: r.sales })),
    topProducts: top.rows.map((r) => ({
      id: r.id, slug: r.slug, title: r.title, views: r.view_count, rating: Number(r.rating_avg), ratingCount: r.rating_count, sales: r.sales, revenueCents: r.revenue_cents,
    })),
  });
});

router.get('/orders', async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 25);
  const { rows } = await query(
    `SELECT oi.id, oi.title, oi.unit_price_cents, oi.list_price_cents, o.receipt_number, o.paid_at, p.slug,
            pr.name AS buyer_name, pr.email AS buyer_email, pr.avatar_url AS buyer_avatar
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
     JOIN profiles pr ON pr.id = o.buyer_id
     JOIN products p ON p.id = oi.product_id
     WHERE oi.seller_id = $1
     ORDER BY o.paid_at DESC LIMIT $2`,
    [req.user.id, limit],
  );
  res.json(rows.map((r) => ({
    id: r.id, title: r.title, slug: r.slug, priceCents: r.unit_price_cents, listPriceCents: r.list_price_cents,
    receiptNumber: r.receipt_number, paidAt: r.paid_at, buyer: { name: r.buyer_name, email: r.buyer_email, avatarUrl: r.buyer_avatar },
  })));
});

router.get('/reviews', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.title, r.body, r.created_at, pr.name AS author, pr.avatar_url AS author_avatar, p.title AS product_title, p.slug
     FROM reviews r JOIN products p ON p.id = r.product_id JOIN profiles pr ON pr.id = r.user_id
     WHERE p.seller_id = $1 ORDER BY r.created_at DESC LIMIT 30`,
    [req.user.id],
  );
  res.json(rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, createdAt: r.created_at, author: r.author, avatarUrl: r.author_avatar, product: { title: r.product_title, slug: r.slug } })));
});

export default router;

