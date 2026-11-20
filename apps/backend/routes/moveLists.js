/**
 * Short links for "Move to another device" (Settings). The client encrypts its
 * saved-lists code (AES-GCM) and keeps the key in the link's #fragment, so this
 * route only ever sees ciphertext: it cannot read, index or link it to anyone.
 *
 *   POST   /api/move       { blob }  -> { id }    store ciphertext, 1 year life
 *   GET    /api/move/:id             -> { blob }  fetch it — as many times as you like
 *   DELETE /api/move/:id                          no-op (kept so older apps don't error). Links are
 *                                                 reusable on purpose; they only age out.
 *
 * Host-neutral (Render and Vercel): plain Express + the shared Postgres pool.
 * Fail-soft: no database just means 503 and the client falls back to the long link.
 */
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const router = express.Router();
const TTL_HOURS = 24 * 365; // a share link works for a year, any number of times
const MAX_BLOB = 200000;                 // chars of base64url ciphertext
const BLOB_RE = /^[A-Za-z0-9_-]+$/;
const ID_RE = /^[A-Za-z0-9_-]{12}$/;

const db = () => require('../db/connection').query;

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many links created. Try again later.' },
});

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/', writeLimiter, async (req, res) => {
  const blob = req.body && req.body.blob;
  if (typeof blob !== 'string' || !blob || blob.length > MAX_BLOB || !BLOB_RE.test(blob)) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }
  try {
    const id = crypto.randomBytes(9).toString('base64url');
    await db()(`DELETE FROM move_links WHERE created_at < now() - interval '${TTL_HOURS} hours'`);
    await db()('INSERT INTO move_links (id, blob) VALUES ($1, $2)', [id, blob]);
    return res.json({ id });
  } catch (err) {
    logger.warn('move link create failed', { error: err && err.message });
    return res.status(503).json({ error: 'Short links are unavailable right now.' });
  }
});

router.get('/:id', async (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'Link not found or expired.' });
  try {
    const { rows } = await db()(
      `SELECT blob FROM move_links WHERE id = $1 AND created_at > now() - interval '${TTL_HOURS} hours'`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Link not found or expired.' });
    return res.json({ blob: rows[0].blob });
  } catch (err) {
    logger.warn('move link read failed', { error: err && err.message });
    return res.status(503).json({ error: 'Short links are unavailable right now.' });
  }
});

// Links are reusable, and the id is the only thing protecting a link from being deleted by a
// stranger, so this no longer deletes anything (older app versions still call it after importing).
router.delete('/:id', (req, res) => res.status(204).end());

module.exports = router;
