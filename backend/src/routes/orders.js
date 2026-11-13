import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { charge } from '../services/payments.js';
import { markPaid } from '../services/fulfillment.js';
import { createCheckoutSession, fulfillCheckoutSession, STRIPE_MIN_CENTS, stripeEnabled, stripeTestMode } from '../services/stripe.js';
import { effectivePrice } from '../services/pricing.js';
import { mediaUrl } from '../services/serialize.js';
import { signedDownloadUrl } from '../services/storage.js';

const router = Router();

const receiptNumber = () => `FCT-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;

async function ownedProductIds(userId, productIds) {
  const { rows } = await query(
    `SELECT DISTINCT oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.buyer_id = $1 AND o.status = 'paid' AND oi.product_id = ANY($2)`,
    [userId, productIds],
  );
  return new Set(rows.map((r) => r.product_id));
}

router.post('/checkout', requireAuth, async (req, res) => {
  const { productIds } = z.object({ productIds: z.array(z.string().uuid()).min(1).max(25) }).parse(req.body);
  const ids = [...new Set(productIds)];

  const { rows: products } = await query(
    `SELECT id, title, seller_id, price_cents, discount_percent, discount_ends_at
     FROM products WHERE id = ANY($1) AND status = 'published'`,
    [ids],
  );
  if (products.length !== ids.length) return res.status(409).json({ error: 'Some items are no longer available. Refresh your cart.' });
  if (products.some((p) => p.seller_id === req.user.id)) return res.status(400).json({ error: "You can't buy your own product." });

  const owned = await ownedProductIds(req.user.id, ids);
  if (owned.size) return res.status(409).json({ error: 'You already own some of these items — they are in your library.', ownedIds: [...owned] });

  const lines = products.map((p) => ({ ...p, ...effectivePrice(p) }));
  const subtotal = lines.reduce((s, l) => s + l.listCents, 0);
  const total = lines.reduce((s, l) => s + l.finalCents, 0);

  const order = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO orders (receipt_number, buyer_id, subtotal_cents, discount_cents, total_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [receiptNumber(), req.user.id, subtotal, subtotal - total, total],
    );
    for (const l of lines) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, title, unit_price_cents, list_price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rows[0].id, l.id, l.seller_id, l.title, l.finalCents, l.listCents],
      );
    }
    return rows[0];
  });

  res.status(201).json({ orderId: order.id, totalCents: order.total_cents, subtotalCents: subtotal, discountCents: subtotal - total });
});

router.get('/payments/config', (_req, res) => {
  res.json({ provider: stripeEnabled() ? 'stripe' : 'demo', testMode: stripeEnabled() ? stripeTestMode() : true });
});

async function loadOwnOrder(orderId, userId) {
  const { rows } = await query('SELECT * FROM orders WHERE id = $1 AND buyer_id = $2', [orderId, userId]);
  return rows[0];
}

router.post('/checkout/:orderId/stripe', requireAuth, async (req, res) => {
  if (!stripeEnabled()) return res.status(400).json({ error: 'Stripe is not configured on the server.' });
  const order = await loadOwnOrder(req.params.orderId, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'paid') return res.json({ status: 'paid', orderId: order.id });

  if (order.total_cents === 0) {
    await markPaid(order.id, { provider: 'free', reference: `free_${order.id}` });
    return res.json({ status: 'paid', orderId: order.id });
  }
  if (order.total_cents < STRIPE_MIN_CENTS) return res.status(400).json({ error: "Orders under $0.50 can't be paid by card." });

  const { rows: items } = await query('SELECT title, unit_price_cents, list_price_cents FROM order_items WHERE order_id = $1 ORDER BY title', [order.id]);
  const session = await createCheckoutSession({ order, items, email: req.user.email });
  res.json({ url: session.url });
});

router.post('/checkout/:orderId/confirm', requireAuth, async (req, res) => {
  const { sessionId } = z.object({ sessionId: z.string().startsWith('cs_') }).parse(req.body);
  const order = await loadOwnOrder(req.params.orderId, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'paid') return res.json({ status: 'paid', orderId: order.id });
  if (!stripeEnabled()) return res.status(400).json({ error: 'Stripe is not configured on the server.' });

  const result = await fulfillCheckoutSession(sessionId);
  if (!result.ok || result.orderId !== order.id) return res.status(402).json({ error: result.reason ?? 'Payment could not be confirmed.' });
  res.json({ status: 'paid', orderId: order.id });
});

router.post('/checkout/:orderId/pay', requireAuth, async (req, res) => {
  const { card } = z.object({ card: z.object({ number: z.string(), name: z.string().optional() }).optional() }).parse(req.body);

  const order = await loadOwnOrder(req.params.orderId, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'paid') return res.json({ status: 'paid', orderId: order.id });
  if (stripeEnabled() && order.total_cents > 0) return res.status(400).json({ error: 'Pay for this order with Stripe.' });

  const result = await charge({ amountCents: order.total_cents, card });
  if (result.status !== 'succeeded') {
    await query(`UPDATE orders SET status = 'failed' WHERE id = $1 AND status = 'pending'`, [order.id]);
    return res.status(402).json({ error: result.reason });
  }

  await markPaid(order.id, { provider: order.total_cents === 0 ? 'free' : 'demo', reference: result.reference, last4: result.last4 });
  res.json({ status: 'paid', orderId: order.id, receiptNumber: order.receipt_number });
});

router.post('/products/:id/claim', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, seller_id, price_cents, discount_percent, discount_ends_at FROM products WHERE id = $1 AND status = 'published'`,
    [req.params.id],
  );
  const product = rows[0];
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const price = effectivePrice(product);
  if (price.finalCents !== 0) return res.status(400).json({ error: 'This product is not free.' });
  if ((await ownedProductIds(req.user.id, [product.id])).size) return res.status(200).json({ status: 'owned' });

  const order = await withTransaction(async (db) => {
    const { rows: o } = await db.query(
      `INSERT INTO orders (receipt_number, buyer_id, subtotal_cents, discount_cents, total_cents)
       VALUES ($1, $2, $3, $3, 0) RETURNING *`,
      [receiptNumber(), req.user.id, price.listCents],
    );
    await db.query(
      `INSERT INTO order_items (order_id, product_id, seller_id, title, unit_price_cents, list_price_cents) VALUES ($1, $2, $3, $4, 0, $5)`,
      [o[0].id, product.id, product.seller_id, product.title, price.listCents],
    );
    return o[0];
  });
  await markPaid(order.id, { provider: 'free', reference: `free_${order.id}` });
  res.status(201).json({ status: 'paid', orderId: order.id });
})

router.get('/orders', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, o.receipt_number, o.status, o.total_cents, o.created_at, o.paid_at,
            json_agg(json_build_object('productId', oi.product_id, 'title', oi.title, 'priceCents', oi.unit_price_cents) ORDER BY oi.title) AS items
     FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE o.buyer_id = $1 AND o.status = 'paid'
     GROUP BY o.id ORDER BY o.created_at DESC`,
    [req.user.id],
  );
  res.json(rows.map((r) => ({ id: r.id, receiptNumber: r.receipt_number, status: r.status, totalCents: r.total_cents, createdAt: r.created_at, paidAt: r.paid_at, items: r.items })));
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT o.*, pr.name AS buyer_name, pr.email AS buyer_email FROM orders o JOIN profiles pr ON pr.id = o.buyer_id
     WHERE o.id = $1 AND o.buyer_id = $2`,
    [req.params.id, req.user.id],
  );
  //fixed to rows[0] from row
  const o = rows[0];
  if (!o) return res.status(404).json({ error: 'Receipt not found.' });
  const { rows: items } = await query(
    `SELECT oi.product_id, oi.title, oi.unit_price_cents, oi.list_price_cents, p.slug, p.thumbnail_key, c.slug AS category_slug,
            COALESCE(s.store_name, s.name) AS seller_name
     FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN profiles s ON s.id = oi.seller_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE oi.order_id = $1 ORDER BY oi.title`,
    [o.id],
  );
  res.json({
    id: o.id,
    receiptNumber: o.receipt_number,
    status: o.status,
    subtotalCents: o.subtotal_cents,
    discountCents: o.discount_cents,
    totalCents: o.total_cents,
    paymentProvider: o.payment_provider,
    paymentRef: o.payment_ref,
    last4: o.payment_last4,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    buyer: { name: o.buyer_name, email: o.buyer_email },
    items: items.map((i) => ({
      productId: i.product_id,
      slug: i.slug,
      title: i.title,
      seller: i.seller_name,
      priceCents: i.unit_price_cents,
      listPriceCents: i.list_price_cents,
      thumbnailUrl: mediaUrl(i.thumbnail_key),
      category: i.category_slug ? { slug: i.category_slug } : null,
    })),
  });
});

router.get('/library', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT ON (p.id) p.id, p.slug, p.title, p.tagline, p.thumbnail_key, p.file_name, p.file_size, p.version, p.updated_at,
            c.slug AS category_slug, c.name AS category_name, COALESCE(s.store_name, s.name) AS seller_name,
            o.paid_at, o.id AS order_id, o.receipt_number,
            EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = p.id AND r.user_id = $1) AS reviewed
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN profiles s ON s.id = p.seller_id
     WHERE o.buyer_id = $1
     ORDER BY p.id, o.paid_at DESC`,
    [req.user.id],
  );
  rows.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
  res.json(rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    thumbnailUrl: mediaUrl(r.thumbnail_key),
    category: r.category_slug ? { slug: r.category_slug, name: r.category_name } : null,
    seller: r.seller_name,
    file: r.file_name ? { name: r.file_name, size: r.file_size } : null,
    version: r.version,
    updatedAt: r.updated_at,
    purchasedAt: r.paid_at,
    orderId: r.order_id,
    receiptNumber: r.receipt_number,
    reviewed: r.reviewed,
  })));
});

router.post('/downloads/:productId', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.file_key, p.file_name, p.seller_id,
            EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id AND o.buyer_id = $2 AND o.status = 'paid') AS owned
     FROM products p WHERE p.id = $1`,
    [req.params.productId, req.user.id],
  );
  const p = rows[0];
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  if (!p.owned && p.seller_id !== req.user.id) return res.status(403).json({ error: 'Buy this product to download it.' });
  if (!p.file_key) return res.status(404).json({ error: "The seller hasn't uploaded a file for this product yet." });

  await query('INSERT INTO download_events (user_id, product_id) VALUES ($1, $2)', [req.user.id, p.id]);
  res.json({ url: await signedDownloadUrl(p.file_key, p.file_name ?? 'download'), expiresIn: 300 });
});

export default router;
