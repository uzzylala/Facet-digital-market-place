import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { ZodError } from 'zod';

import { config } from './config.js';
import { ensureBucket } from './services/storage.js';
import accountRoutes from "./routes/account.js";
import catalogRoutes from "./routes/catalog.js";
import sellerRoutes from "./routes/seller.js"
import orderRoutes from "./routes/orders.js";
import stripeWebhook from "./routes/stripe-webhook.js";
import { stripeEnabled, stripeTestMode } from './services/stripe.js';
import aiRoutes from "./routes/ai.js";
import { aiEnabled, aiModel } from './services/ai.js';

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use("/api/webhooks/stripe", stripeWebhook);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use("/api", accountRoutes);
app.use("/api", catalogRoutes)
app.use("/api/seller", sellerRoutes);
app.use("/api", orderRoutes);
app.use("/api/ai", aiRoutes)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.') || 'Input'}: ${issue.message}`, issues: err.issues });
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Files must be 150 MB or smaller.' : err.message });
  }
  if (err?.code === '22P02') return res.status(404).json({ error: 'Not found.' });
  if (err?.type?.startsWith?.('Stripe')) {
    console.error('Stripe error:', err.message);
    return res.status(502).json({ error: `Stripe: ${err.message}` });
  }
  if (err?.status && err.status < 500) return res.status(err.status).json({ error: err.message });

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again in a moment.' });
});

try {
 await ensureBucket();    
} catch (error) {
    console.warn(`Could not verify storage bucket "${config.s3.bucket}": ${error.message}" `);
}

console.log(`AI: ${aiEnabled() ? `Gemini . ${aiModel()}` : 'heurestic fallback'}`);
console.log(`Payments: ${stripeEnabled() ? `Stripe${stripeTestMode() ? ' (test mode)' : ''}${config.stripe.webhookSecret ? ' + webhook' : ''}` : 'demo provider'}`);

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Facet-marketplace Api running on -> http://localhost:${config.port}`);
  });
}

export default app;
