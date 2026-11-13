import express, { Router } from 'express';
import { config } from '../config.js';
import { fulfillCheckoutSession, stripe } from '../services/stripe.js';

const router = Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !config.stripe.webhookSecret) return res.status(404).end();

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), config.stripe.webhookSecret);
  } catch (err) {
    console.warn('Rejected Stripe webhook:', err.message);
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const result = await fulfillCheckoutSession(event.data.object.id);
    if (!result.ok) console.warn(`Stripe session ${event.data.object.id} not fulfilled: ${result.reason}`);
  }

  res.json({ received: true });
});

export default router;
