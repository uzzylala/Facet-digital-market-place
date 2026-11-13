import { Router } from 'express';
import { query } from '../db/pool.js';
import { optionalAuth } from '../middleware/auth.js';
import { EFFECTIVE_PRICE_SQL } from '../services/pricing.js';
import { PRODUCT_COLUMNS, PRODUCT_JOINS, serializeProduct, serializeProductDetail } from '../services/serialize.js';
import { isPublicMediaKey, signedMediaUrl } from '../services/storage.js';

const router = Router();

router.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `SELECT c.slug, c.name, c.description,
            COUNT(p.id) FILTER (WHERE p.status = 'published')::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.sort_order, c.name`,
  );
  res.json(rows.map((r) => ({ slug: r.slug, name: r.name, description: r.description, productCount: r.product_count })));
});

router.get('/stats', async (_req, res) => {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS products,
            COUNT(DISTINCT seller_id)::int AS sellers,
            COALESCE(SUM(sales_count), 0)::int AS sales,
            COALESCE(AVG(NULLIF(rating_avg, 0)), 0)::numeric(3,2) AS avg_rating,
            COUNT(*) FILTER (WHERE price_cents = 0)::int AS free
     FROM products WHERE status = 'published'`,
  );
  const r = rows[0];
  res.json({ products: r.products, sellers: r.sellers, sales: r.sales, avgRating: Number(r.avg_rating), free: r.free });
});

const SORTS = {
  popular: 'p.sales_count DESC, p.rating_avg DESC',
  rating: 'p.rating_avg DESC, p.rating_count DESC',
  newest: 'p.created_at DESC',
  price_asc: `${EFFECTIVE_PRICE_SQL} ASC, p.sales_count DESC`,
  price_desc: `${EFFECTIVE_PRICE_SQL} DESC, p.sales_count DESC`,
};

router.get('/products', optionalAuth, async (req, res) => {
  const { q, category, sort = 'popular', minPrice, maxPrice, minRating, free, onSale, tag, seller } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));

  const where = [`p.status = 'published'`];
  const params = [];
  const add = (value) => (params.push(value), `$${params.length}`);

  if (q?.trim()) {
    const term = add(q.trim());
    where.push(`(p.search @@ websearch_to_tsquery('english', ${term}) OR p.title ILIKE '%' || ${term} || '%')`);
  }
  if (category) where.push(`c.slug = ${add(category)}`);
  if (tag) where.push(`${add(String(tag).toLowerCase())} = ANY(p.tags)`);
  if (seller) where.push(`p.seller_id = ${add(seller)}`);
  if (minPrice) where.push(`${EFFECTIVE_PRICE_SQL} >= ${add(Math.round(Number(minPrice) * 100))}`);
  if (maxPrice) where.push(`${EFFECTIVE_PRICE_SQL} <= ${add(Math.round(Number(maxPrice) * 100))}`);
  if (minRating) where.push(`p.rating_avg >= ${add(Number(minRating))}`);
  if (free === 'true') where.push(`${EFFECTIVE_PRICE_SQL} = 0`);
  if (onSale === 'true') where.push(`p.discount_percent > 0 AND (p.discount_ends_at IS NULL OR p.discount_ends_at > now())`);

  const whereSql = where.join(' AND ');
  const orderSql = q?.trim() && sort === 'relevance'
    ? `ts_rank(p.search, websearch_to_tsquery('english', $1)) DESC, p.sales_count DESC`
    : SORTS[sort] ?? SORTS.popular;

  const filterParams = [...params];
  const pageSql = `LIMIT ${add(limit)} OFFSET ${add((page - 1) * limit)}`;

  const [{ rows }, { rows: countRows }] = await Promise.all([
        query(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_JOINS} WHERE ${whereSql} ORDER BY ${orderSql} ${pageSql}`, params),
    query(`SELECT COUNT(*)::int AS total ${PRODUCT_JOINS} WHERE ${whereSql}`, filterParams),
  ]);

  let wishlisted = new Set();
  if (req.user && rows.length) {
    const w = await query('SELECT product_id FROM wishlist_items WHERE user_id = $1 AND product_id = ANY($2)', [
      req.user.id,
      rows.map((r) => r.id),
    ]);
    wishlisted = new Set(w.rows.map((r) => r.product_id));
  }

  const total = countRows[0].total;
  res.json({
    items: rows.map((r) => ({ ...serializeProduct(r), wishlisted: wishlisted.has(r.id) })),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

router.get('/products/:slug', optionalAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, c.slug AS category_slug, c.name AS category_name,
            s.id AS seller_id, COALESCE(s.store_name, s.name) AS seller_name, s.bio AS seller_bio, s.avatar_url AS seller_avatar
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN profiles s ON s.id = p.seller_id
     WHERE p.slug = $1`,
    [req.params.slug],
  );
  const row = rows[0];
  if (!row || (row.status !== 'published' && row.seller_id !== req.user?.id)) {
    return res.status(404).json({ error: 'This product is not available.' });
  }

    query('UPDATE products SET view_count = view_count + 1 WHERE id = $1', [row.id]).catch(() => {});

  const [breakdown, related, viewer] = await Promise.all([
    query('SELECT rating, COUNT(*)::int AS count FROM reviews WHERE product_id = $1 GROUP BY rating', [row.id]),
    query(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_JOINS}
       WHERE p.status = 'published' AND p.id <> $1 AND (p.category_id = $2 OR p.tags && $3)
       ORDER BY (p.category_id = $2)::int + cardinality(ARRAY(SELECT unnest(p.tags) INTERSECT SELECT unnest($3::text[]))) DESC,
                p.sales_count DESC
       LIMIT 4`,
      [row.id, row.category_id, row.tags],
    ),
    req.user
      ? query(
          `SELECT
             EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                     WHERE oi.product_id = $1 AND o.buyer_id = $2 AND o.status = 'paid') AS owned,
             EXISTS (SELECT 1 FROM wishlist_items WHERE product_id = $1 AND user_id = $2) AS wishlisted,
             EXISTS (SELECT 1 FROM reviews WHERE product_id = $1 AND user_id = $2) AS reviewed`,
          [row.id, req.user.id],
        )
      : null,
  ]);

  const ratingBreakdown = Object.fromEntries([5, 4, 3, 2, 1].map((n) => [n, 0]));
  breakdown.rows.forEach((r) => (ratingBreakdown[r.rating] = r.count));
  const v = viewer?.rows[0];

  res.json({
    ...serializeProductDetail(row),
    ratingBreakdown,
    related: related.rows.map(serializeProduct),
    viewer: {
      owned: Boolean(v?.owned) || row.seller_id === req.user?.id,
      wishlisted: Boolean(v?.wishlisted),
      reviewed: Boolean(v?.reviewed),
      isSeller: row.seller_id === req.user?.id,
      reviewed: Boolean(v?.reviewed),
    },
  });
});

router.get('/products/:id/reviews', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.title, r.body, r.created_at, pr.name AS author, pr.avatar_url
     FROM reviews r JOIN profiles pr ON pr.id = r.user_id
     WHERE r.product_id = $1
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [req.params.id],
  );
  res.json(rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, createdAt: r.created_at, author: r.author, avatarUrl: r.avatar_url })));
});

router.get('/sellers/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT pr.id, COALESCE(pr.store_name, pr.name) AS name, pr.bio, pr.avatar_url, pr.created_at,
            COUNT(p.id) FILTER (WHERE p.status = 'published')::int AS product_count,
            COALESCE(SUM(p.sales_count), 0)::int AS sales
     FROM profiles pr LEFT JOIN products p ON p.seller_id = pr.id
     WHERE pr.id = $1 AND pr.is_seller
     GROUP BY pr.id`,
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Seller not found.' });
  const r = rows[0];
  res.json({ id: r.id, name: r.name, bio: r.bio, avatarUrl: r.avatar_url, joinedAt: r.created_at, productCount: r.product_count, sales: r.sales });
});

router.get('/media/*key', async (req, res) => {
  const key = [].concat(req.params.key).join('/');
  if (!isPublicMediaKey(key)) return res.status(404).end();
  const url = await signedMediaUrl(key, 3600);
  res.set('Cache-Control', 'private, max-age=1800');
  res.redirect(302, url);
});

export default router;