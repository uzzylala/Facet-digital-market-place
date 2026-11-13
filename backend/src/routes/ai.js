import { Router } from 'express';
import AdmZip from 'adm-zip';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { optionalAuth, requireAuth, requireSeller } from '../middleware/auth.js';
import { aiEnabled, aiModel, generateListing, heuristicListing, heuristicRecommend, keywords, recommendProducts } from '../services/ai.js';
import { EFFECTIVE_PRICE_SQL } from '../services/pricing.js';
import { PRODUCT_COLUMNS, PRODUCT_JOINS, serializeProduct } from '../services/serialize.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.get('/status', (_req, res) => res.json({ enabled: aiEnabled(), model: aiModel() }));

const TEXT_EXT = /\.(md|markdown|txt|json|js|jsx|ts|tsx|css|scss|html|vue|svelte|py|csv|yml|yaml)$/i;
const human = (bytes) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`);

function summarizeUpload(file) {
  if (!file) return null;
  const lines = [`${file.originalname} — ${file.mimetype}, ${human(file.size)}`];

  if (/\.zip$/i.test(file.originalname)) {
    try {
      const entries = new AdmZip(file.buffer).getEntries().filter((e) => !e.isDirectory && !/(^|\/)(__MACOSX|node_modules|\.git)\//.test(e.entryName));
      lines.push(`Archive contains ${entries.length} files. First entries:`);
      entries.slice(0, 80).forEach((e) => lines.push(`  ${e.entryName} (${human(e.header.size)})`));
      const readme = entries.find((e) => /(^|\/)readme(\.md|\.txt)?$/i.test(e.entryName));
      if (readme) lines.push(`\nReadme excerpt:\n${readme.getData().toString('utf8').slice(0, 4000)}`);
      const pkg = entries.find((e) => /(^|\/)package\.json$/i.test(e.entryName));
      if (pkg) lines.push(`\npackage.json excerpt:\n${pkg.getData().toString('utf8').slice(0, 1500)}`);
    } catch {
      lines.push('(Archive could not be read.)');
    }
  } else if (TEXT_EXT.test(file.originalname)) {
    lines.push(`\nContent excerpt:\n${file.buffer.toString('utf8').slice(0, 5000)}`);
  }
  return lines.join('\n');
}

const listingInput = z.object({
  name: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(6000).optional().default(''),
  categoryHint: z.string().optional(),
});

router.post('/listing', requireAuth, requireSeller, upload.single('file'), async (req, res) => {
  const input = listingInput.parse(req.body);
  if (!input.name && !input.notes && !req.file) {
    return res.status(400).json({ error: 'Add a working name, a few notes, or the product file so there is something to describe.' });
  }
  const { rows: categories } = await query('SELECT slug, name FROM categories ORDER BY sort_order');
  const payload = { ...input, fileSummary: summarizeUpload(req.file), categories };

  try {
    res.json(await generateListing(payload));
  } catch (err) {
    console.warn('AI listing failed, using heuristic:', err.message);
    res.json({ ...heuristicListing(payload), notice: 'The AI service was unavailable, so this draft was generated with basic rules.' });
  }
});

const assistantInput = z.object({
  message: z.string().trim().min(2).max(1000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(12).optional().default([]),
});

async function findCandidates(text) {
  const words = keywords(text).slice(0, 12);
  const tsquery = words.map((w) => w.replace(/[^a-z0-9]/g, '')).filter(Boolean).join(' | ');
  const select = `SELECT ${PRODUCT_COLUMNS}, p.description, ${EFFECTIVE_PRICE_SQL} AS final_cents ${PRODUCT_JOINS}`;

  const matched = tsquery
    ? (await query(
        `${select} WHERE p.status = 'published' AND (p.search @@ to_tsquery('english', $1) OR p.tags && $2)
         ORDER BY ts_rank(p.search, to_tsquery('english', $1)) DESC, p.sales_count DESC LIMIT 30`,
        [tsquery, words],
      )).rows
    : [];
  const filler = (await query(
    `${select} WHERE p.status = 'published' AND NOT (p.id = ANY($1)) ORDER BY p.sales_count DESC, p.rating_avg DESC LIMIT $2`,
    [matched.map((m) => m.id), Math.max(0, 40 - matched.length)],
  )).rows;

  return [...matched, ...filler];
}

router.post('/assistant', optionalAuth, async (req, res) => {
  const { message, history } = assistantInput.parse(req.body);
  const context = [...history.filter((h) => h.role === 'user').map((h) => h.content), message].join(' ');
  const candidates = await findCandidates(context);

  let result;
  try {
    result = await recommendProducts({ message, history, candidates });
  } catch (err) {
    console.warn('AI assistant failed, using heuristic:', err.message);
    result = heuristicRecommend({ message: context, candidates });
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  res.json({
    reply: result.reply,
    followUp: result.followUp || null,
    source: result.source,
    recommendations: result.picks.map((pick) => ({ reason: pick.reason, product: serializeProduct(byId.get(pick.productId)) })),
  });
});

export default router;
