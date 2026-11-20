/**
 * Store-and-forward mailbox for Nearby internet messages. Carries ciphertext only.
 *
 *   POST   /api/mailbox/:handle   { id, blob }        drop an envelope for a handle (no sign-in)
 *   GET    /api/mailbox                (signed)       the caller's pending envelopes
 *   DELETE /api/mailbox                (signed)       { ids: [...] } acknowledge = delete them
 *   GET    /api/mailbox/stream         (signed)       Server-Sent Events: new envelopes as they arrive
 *
 * The blob is an end-to-end encrypted, sender-signed envelope (frontend mesh/seal.js). We cannot
 * read it, and we do not store who sent it. Recipients prove who they are with an ECDSA signature
 * (utils/handleAuth.js). Envelopes live until acknowledged, 7 days at most, and each handle holds
 * at most MAX_PENDING of them, so the box cannot be flooded.
 *
 * Streaming is in-process, so it only reaches connections held by THIS instance. That is right on
 * Render (one long-lived process) and harmlessly absent on Vercel serverless, where the client
 * falls back to polling GET /api/mailbox. Host-neutral Express code.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { validHandle, requireHandle } = require('../utils/handleAuth');

const router = express.Router();
const db = () => require('../db/connection').query;

const TTL_DAYS = 7;
const MAX_BLOB = 12000;            // base64url chars (a sealed message is ~300; this leaves room for long text)
const MAX_PENDING = 200;           // envelopes a handle can hold
const BLOB_RE = /^[A-Za-z0-9_-]+$/;
const ID_RE = /^[A-Za-z0-9_-]{6,24}$/;
const MAX_STREAMS_PER_HANDLE = 3;
const MAX_STREAMS = 500;
const HEARTBEAT_MS = 25000;

const lim = (windowMs, max, error) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error } });
const dropLimiter = lim(60 * 1000, 40, 'Too many messages. Slow down.');
const readLimiter = lim(60 * 1000, 90, 'Too many requests. Slow down.');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const getRow = async (handle) => {
  const { rows } = await db()('SELECT handle, ecdh_pub, sign_pub, searchable FROM handles WHERE handle = $1', [handle]);
  return rows[0] || null;
};
const signed = requireHandle(getRow);
const unavailable = (res, err, what) => {
  logger.warn(`mailbox ${what} failed`, { error: err && err.message });
  return res.status(503).json({ error: 'Messages are unavailable right now.' });
};

// ── live connections (this process only) ─────────────────────────────────────────────────
const streams = new Map(); // handle -> Set<res>
let streamCount = 0;
const push = (handle, payload) => {
  for (const res of streams.get(handle) || []) res.write(`event: msg\ndata: ${JSON.stringify(payload)}\n\n`);
};

const purge = () => db()(`DELETE FROM mailbox WHERE created_at < now() - interval '${TTL_DAYS} days'`).catch(() => {});

// Declared before '/:handle'.
router.get('/stream', readLimiter, signed, (req, res) => {
  const handle = req.handle.handle;
  const set = streams.get(handle) || new Set();
  if (set.size >= MAX_STREAMS_PER_HANDLE || streamCount >= MAX_STREAMS) return res.status(429).json({ error: 'Too many open connections.' });
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  res.write('event: ready\ndata: {}\n\n');
  set.add(res); streams.set(handle, set); streamCount += 1;
  const beat = setInterval(() => res.write(': hb\n\n'), HEARTBEAT_MS);
  beat.unref?.();
  req.on('close', () => {
    clearInterval(beat);
    set.delete(res); streamCount -= 1;
    if (!set.size) streams.delete(handle);
  });
  return undefined;
});

router.get('/', readLimiter, signed, async (req, res) => {
  try {
    await purge();
    const { rows } = await db()(
      'SELECT msg_id, blob, created_at FROM mailbox WHERE recipient = $1 ORDER BY id LIMIT 100',
      [req.handle.handle],
    );
    return res.json({ messages: rows.map((r) => ({ id: r.msg_id, blob: r.blob, at: r.created_at })) });
  } catch (e) { return unavailable(res, e, 'read'); }
});

router.delete('/', readLimiter, signed, async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter((i) => typeof i === 'string' && ID_RE.test(i)).slice(0, 200) : [];
  if (!ids.length) return res.status(400).json({ error: 'No ids.' });
  try {
    await db()('DELETE FROM mailbox WHERE recipient = $1 AND msg_id = ANY($2)', [req.handle.handle, ids]);
    return res.status(204).end();
  } catch (e) { return unavailable(res, e, 'ack'); }
});

router.post('/:handle', dropLimiter, async (req, res) => {
  const to = String(req.params.handle || '').toLowerCase();
  const { id, blob } = req.body || {};
  if (!validHandle(to)) return res.status(404).json({ error: 'No such handle.' });
  if (typeof id !== 'string' || !ID_RE.test(id) || typeof blob !== 'string' || !blob || blob.length > MAX_BLOB || !BLOB_RE.test(blob)) {
    return res.status(400).json({ error: 'Invalid message.' });
  }
  try {
    if (!(await getRow(to))) return res.status(404).json({ error: 'No such handle.' });
    purge();
    const { rows: [{ n }] } = await db()('SELECT count(*)::int AS n FROM mailbox WHERE recipient = $1', [to]);
    if (n >= MAX_PENDING) return res.status(429).json({ error: 'Their mailbox is full.' });
    const { rows } = await db()(
      'INSERT INTO mailbox (recipient, msg_id, blob) VALUES ($1, $2, $3) ON CONFLICT (recipient, msg_id) DO NOTHING RETURNING msg_id',
      [to, id, blob],
    );
    if (rows.length) push(to, { id, blob });
    return res.status(rows.length ? 201 : 200).json({ ok: true }); // a repeat of the same id is a no-op (safe to retry)
  } catch (e) { return unavailable(res, e, 'drop'); }
});

module.exports = router;
module.exports._streams = streams; // tests only
