/**
 * Anonymous handles for Nearby / relay messaging.
 *
 *   GET    /api/handles/available/:handle   -> { valid, available }
 *   POST   /api/handles  { handle, ecdh, sign, searchable? } -> 201 { handle }   claim a handle
 *   GET    /api/handles/search?q=pre         -> { results: [handle] }   ONLY handles that opted in
 *   GET    /api/handles/:handle              -> { handle, ecdh, sign }  exact lookup (public keys only)
 *   PATCH  /api/handles/:handle  (signed)    { searchable?, ecdh?, sign? }  change visibility / rotate keys
 *   DELETE /api/handles/:handle  (signed)    release the handle
 *
 * The server stores a handle and two PUBLIC keys. No email, account, IP or device id. A handle is
 * not browsable: it is found by typing it exactly, scanning its QR, or (opt-in) prefix search of
 * 3+ letters, so the list of users cannot be walked. Writes are proved by an ECDSA signature
 * (utils/handleAuth.js); there is no password and no session.
 *
 * Host-neutral (Render and Vercel): plain Express + the shared Postgres pool.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { validHandle, canonicalPublicJwk, requireHandle } = require('../utils/handleAuth');

const router = express.Router();
const db = () => require('../db/connection').query;
const lim = (windowMs, max, error) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error } });

const claimLimiter = lim(60 * 60 * 1000, 20, 'Too many handles claimed. Try again later.');
const readLimiter = lim(60 * 1000, 120, 'Too many lookups. Slow down.');
const searchLimiter = lim(60 * 1000, 30, 'Too many searches. Slow down.');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const getRow = async (handle) => {
  const { rows } = await db()('SELECT handle, ecdh_pub, sign_pub, searchable FROM handles WHERE handle = $1', [handle]);
  return rows[0] || null;
};
const signed = requireHandle(getRow);
const unavailable = (res, err, what) => {
  logger.warn(`handles ${what} failed`, { error: err && err.message });
  return res.status(503).json({ error: 'Handles are unavailable right now.' });
};

router.get('/available/:handle', readLimiter, async (req, res) => {
  const h = String(req.params.handle || '').toLowerCase();
  if (!validHandle(h)) return res.json({ valid: false, available: false });
  try { return res.json({ valid: true, available: !(await getRow(h)) }); } catch (e) { return unavailable(res, e, 'check'); }
});

// Declared BEFORE '/:handle' so "search" is never read as a handle.
router.get('/search', searchLimiter, async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(q)) return res.status(400).json({ error: 'Type at least 3 letters.' });
  try {
    const { rows } = await db()(
      'SELECT handle FROM handles WHERE searchable AND handle LIKE $1 ORDER BY handle LIMIT 10',
      [`${q}%`],
    );
    return res.json({ results: rows.map((r) => r.handle) });
  } catch (e) { return unavailable(res, e, 'search'); }
});

router.get('/:handle', readLimiter, async (req, res) => {
  const h = String(req.params.handle || '').toLowerCase();
  if (!validHandle(h)) return res.status(404).json({ error: 'No such handle.' });
  try {
    const row = await getRow(h);
    if (!row) return res.status(404).json({ error: 'No such handle.' });
    return res.json({ handle: row.handle, ecdh: JSON.parse(row.ecdh_pub), sign: JSON.parse(row.sign_pub) });
  } catch (e) { return unavailable(res, e, 'lookup'); }
});

router.post('/', claimLimiter, async (req, res) => {
  const b = req.body || {};
  const handle = String(b.handle || '').toLowerCase();
  const ecdh = canonicalPublicJwk(b.ecdh);
  const sign = canonicalPublicJwk(b.sign);
  if (!validHandle(handle)) return res.status(400).json({ error: 'Handles are 3-24 letters, numbers and single hyphens, starting with a letter.' });
  if (!ecdh || !sign) return res.status(400).json({ error: 'Invalid keys.' });
  try {
    const { rows } = await db()(
      'INSERT INTO handles (handle, ecdh_pub, sign_pub, searchable) VALUES ($1, $2, $3, $4) ON CONFLICT (handle) DO NOTHING RETURNING handle',
      [handle, ecdh, sign, b.searchable === true],
    );
    if (!rows.length) return res.status(409).json({ error: 'That handle is taken.' });
    return res.status(201).json({ handle });
  } catch (e) { return unavailable(res, e, 'claim'); }
});

router.patch('/:handle', readLimiter, signed, async (req, res) => {
  if (req.handle.handle !== String(req.params.handle || '').toLowerCase()) return res.status(403).json({ error: 'Not your handle.' });
  const b = req.body || {};
  const searchable = typeof b.searchable === 'boolean' ? b.searchable : null;
  const ecdh = b.ecdh ? canonicalPublicJwk(b.ecdh) : null;
  const sign = b.sign ? canonicalPublicJwk(b.sign) : null;
  if ((b.ecdh && !ecdh) || (b.sign && !sign)) return res.status(400).json({ error: 'Invalid keys.' });
  try {
    await db()(
      `UPDATE handles SET searchable = COALESCE($2, searchable), ecdh_pub = COALESCE($3, ecdh_pub),
              sign_pub = COALESCE($4, sign_pub), last_seen = now() WHERE handle = $1`,
      [req.handle.handle, searchable, ecdh, sign],
    );
    return res.json({ ok: true });
  } catch (e) { return unavailable(res, e, 'update'); }
});

router.delete('/:handle', readLimiter, signed, async (req, res) => {
  if (req.handle.handle !== String(req.params.handle || '').toLowerCase()) return res.status(403).json({ error: 'Not your handle.' });
  try {
    await db()('DELETE FROM handles WHERE handle = $1', [req.handle.handle]);
    return res.status(204).end();
  } catch (e) { return unavailable(res, e, 'delete'); }
});

module.exports = router;
