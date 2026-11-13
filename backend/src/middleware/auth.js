import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const JWKS = createRemoteJWKSet(new URL(`${config.neonAuthUrl}/.well-known/jwks.json`));
const ISSUER = new URL(config.neonAuthUrl).origin;

async function verify(token) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
  return payload;
}

const syncedRecently = new Map();

async function ensureProfile(claims) {
  const last = syncedRecently.get(claims.sub);
  if (last && Date.now() - last < 5 * 60_000) return;

  let identity = { email: claims.email ?? null, name: claims.name ?? null, image: claims.image ?? null };
  try {
    const { rows } = await query('SELECT email, name, image FROM neon_auth."user" WHERE id::text = $1', [claims.sub]);
    if (rows[0]) identity = rows[0];
  } catch (e) {
  }

  await query(
    `INSERT INTO profiles (id, email, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email,
         name = COALESCE(EXCLUDED.name, profiles.name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
         updated_at = now()`,
    [claims.sub, identity.email, identity.name || identity.email?.split('@')[0] || 'Member', identity.image]
  );

  syncedRecently.set(claims.sub, Date.now());
}

function bearer(req) {
  const header = req.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function optionalAuth(req, _res, next) {
  const token = bearer(req);
  if (!token) return next();
  try {
    const claims = await verify(token);
    await ensureProfile(claims);
    req.user = { id: claims.sub, email: claims.email };
  } catch {
  }
  next();
}

export async function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const claims = await verify(token);
    await ensureProfile(claims);
    req.user = { id: claims.sub, email: claims.email };
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

export async function requireSeller(req, res, next) {
  const { rows } = await query('SELECT is_seller FROM profiles WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_seller) return res.status(403).json({ error: 'Open your seller studio first.' });
  next();
}

