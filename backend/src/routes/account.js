import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { PRODUCT_COLUMNS, PRODUCT_JOINS, serializeProduct } from '../services/serialize.js';

const router = Router();

const profileOut = (r) => ({
  id: r.id,
  email: r.email,
  name: r.name,
  avatarUrl: r.avatar_url,
  isSeller: r.is_seller,
  storeName: r.store_name,
  bio: r.bio,
  createdAt: r.created_at,
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
  res.json(profileOut(rows[0]));
});

const profilePatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  storeName: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(400).optional(),
  becomeSeller: z.boolean().optional(),
});

router.patch('/me', requireAuth, async (req, res) => {
  const body = profilePatch.parse(req.body);
  const { rows } = await query(
    `UPDATE profiles SET
       name = COALESCE($2, name),
       store_name = COALESCE($3, store_name),
       bio = COALESCE($4, bio),
       is_seller = is_seller OR COALESCE($5, false),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [req.user.id, body.name, body.storeName, body.bio, body.becomeSeller]
  );
  res.json(profileOut(rows[0]));
});

router.get('/wishlist', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_JOINS}
     JOIN wishlist_items w ON w.product_id = p.id
     WHERE w.user_id = $1 AND p.status = 'published'
     ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json(rows.map((r) => ({ ...serializeProduct(r), wishlisted: true })));
});

router.put('/wishlist/:productId', requireAuth, async (req, res) => {
  await query('INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, req.params.productId]);
  res.status(204).end();
});

router.delete('/wishlist/:productId', requireAuth, async (req, res) => {
  await query('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  res.status(204).end();
});

const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().default(''),
  body: z.string().trim().max(3000).optional().default(''),
});

router.post('/products/:id/reviews', requireAuth, async (req, res) => {
  const body = reviewBody.parse(req.body);
  const productId = req.params.id;

  const { rows: owned } = await query(
    `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = $1 AND o.buyer_id = $2 AND o.status = 'paid' LIMIT 1`,
    [productId, req.user.id]
  );
    if (!owned.length) return res.status(403).json({ error: 'Only customers who own this product can review it.' });

  await query(
    `INSERT INTO reviews (product_id, user_id, rating, title, body) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body, created_at = now()`,
    [productId, req.user.id, body.rating, body.title, body.body]
  );

  await query(
    `UPDATE products SET
       rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = $1),
       rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1)
     WHERE id = $1`,
    [productId]
  );

  res.status(201).json({ ok: true });
});

export default router;
