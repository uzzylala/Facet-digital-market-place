import Stripe from 'stripe';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { markPaid } from './fulfillment.js';

export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
export const stripeEnabled = () => Boolean(stripe);
export const stripeTestMode = () => Boolean(config.stripe.secretKey?.startsWith('sk_test_'));

export const STRIPE_MIN_CENTS = 50;

export async function createCheckoutSession({ order, items, email }) {
  const paidItems = items.filter((i) => i.unit_price_cents > 0);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: order.id,
    customer_email: email ?? undefined,
    metadata: { orderId: order.id, receiptNumber: order.receipt_number },
    payment_intent_data: { metadata: { orderId: order.id } },
    line_items: paidItems.map((i) => ({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: i.unit_price_cents,
        product_data: {
          name: i.title,
          description: i.list_price_cents > i.unit_price_cents ? `Sale price (was $${(i.list_price_cents / 100).toFixed(2)})` : undefined,
        },
      },
    })),
    success_url: `${config.clientOrigin}/orders/${order.id}?new=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.clientOrigin}/cart?canceled=1`,
  });

  await query(`UPDATE orders SET payment_provider = 'stripe', payment_ref = $2 WHERE id = $1 AND status <> 'paid'`, [order.id, session.id]);
  return session;
}

export async function fulfillCheckoutSession(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.payment_method'] });
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return { ok: false, reason: 'Session has no order.' };

  const { rows } = await query('SELECT id, status, total_cents FROM orders WHERE id = $1', [orderId]);
  const order = rows[0];
  if (!order) return { ok: false, reason: 'Order not found.' };
  if (order.status === 'paid') return { ok: true, orderId, alreadyPaid: true };

  if (session.payment_status !== 'paid') return { ok: false, reason: 'Payment has not completed yet.' };
  if (session.currency !== 'usd' || session.amount_total !== order.total_cents) {
    console.error(`Stripe amount mismatch for order ${orderId}: ${session.amount_total} vs ${order.total_cents}`);
    return { ok: false, orderId, reason: 'Payment amount does not match the order.' };
  }

  const pm = session.payment_intent?.payment_method;
  await markPaid(orderId, {
    provider: 'stripe',
    reference: session.payment_intent?.id ?? session.id,
    last4: pm?.card?.last4 ?? null,
  });
  return { ok: true, orderId };
}
