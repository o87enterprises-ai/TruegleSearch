const express = require('express');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { PROVIDERS, getProvider } = require('../services/social/providers');

const router = express.Router();

// Connecting a social account — the OAuth handshake, in demo.
//
// ── WHY THIS IS A REDIRECT AND NOT AN IFRAME ────────────────────────────────
//
// Every provider here (Reddit, X, Meta, TikTok, Pinterest) serves its login
// page with `X-Frame-Options: DENY` or `frame-ancestors 'none'`, specifically
// to stop a third party framing a login box and harvesting what is typed into
// it. That is not a quirk to work around; it is the defence working. A
// provider login can only ever happen at the top level, in their own address
// bar, which is what the redirect below does.
//
// And it is emphatically NOT an email/password box. Asking somebody for their
// Reddit password would mean Truegle holding credentials to accounts it does
// not own — against every one of those platforms' terms, and the precise
// opposite of what this product claims to be.
//
// ── WHAT IS FAKE, AND WHAT IS NOT ───────────────────────────────────────────
//
// The demo accepts any code. Everything AROUND that is the real handshake:
// a `state` parameter minted here, checked on the way back, and burned after
// one use; an authorize redirect; a code exchanged server-side rather than in
// the browser. When a provider's credentials arrive, its adapter starts
// returning a real authorize URL and doing a real exchange, and nothing on
// this route or in the client has to change shape.
//
// ── WHY IT IS NOT MOUNTED UNDER /api/auth ───────────────────────────────────
//
// `/api/auth` is blanketed by `authLimiter` — 15 minutes, 5 requests. That is
// right for sign-in attempts and wrong for an OAuth callback, which can
// legitimately be retried by a browser or repeated across several providers in
// a row. Five would be hit by anyone connecting three accounts and changing
// their mind once.

// Pending `state` values. In-memory and short-lived on purpose: this is CSRF
// protection, not a session store, and a value that outlives the redirect it
// was minted for is a liability rather than a feature.
//
// NOTE for the real thing: this does not survive a restart and does not work
// across instances, exactly like `tokenDenylist`. On serverless that means a
// callback can land on a box that never saw the start. Real OAuth wants this
// in a signed cookie or Redis — writing it down here so it is a known cost
// rather than a surprise.
const pending = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function mintState(provider) {
  const state = crypto.randomBytes(24).toString('base64url');
  pending.set(state, { provider, at: Date.now() });
  return state;
}

function burnState(state, provider) {
  const found = pending.get(state);
  if (!found) return false;
  pending.delete(state);                                    // one use only
  if (found.provider !== provider) return false;
  return Date.now() - found.at < STATE_TTL_MS;
}

// Cheap sweep so a long-running process cannot grow this map forever. Unref'd
// so it never holds the event loop open.
const sweep = setInterval(() => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [k, v] of pending) if (v.at < cutoff) pending.delete(k);
}, 60_000);
sweep.unref?.();

const FRONTEND = () => process.env.FRONTEND_URL || 'http://localhost:5173';

/** Only ever our own origin. A `return` parameter is attacker-controlled, and
 *  redirecting to whatever it says is an open redirect. */
function safeReturn(raw) {
  const path = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/feed';
  return path;
}

/** GET /api/social-auth/providers — what can be connected, and what cannot. */
router.get('/providers', (req, res) => {
  res.json({ success: true, providers: PROVIDERS.map((p) => ({ id: p.id, mode: p.mode })) });
});

/**
 * GET /api/social-auth/:provider/start?return=/feed
 * Begins the handshake. Redirects — it does not return JSON — because the
 * whole point is that the browser leaves for the provider.
 */
router.get('/:provider/start', (req, res) => {
  const adapter = getProvider(req.params.provider);
  if (!adapter) return res.status(404).json({ error: 'Unknown provider' });

  const state = mintState(adapter.id);
  const back = safeReturn(req.query.return);
  const callback = `${FRONTEND()}/feed/callback`;

  try {
    return res.redirect(adapter.authorizeUrl({ state, callback, back }));
  } catch (err) {
    logger.warn(`social-auth start failed for ${adapter.id}:`, err.message);
    // The house idiom for an optional provider that has no credentials yet.
    return res.status(503).json({ error: `${adapter.id} is not configured on this server` });
  }
});

/**
 * POST /api/social-auth/:provider/exchange  { code, state }
 * The code is exchanged HERE, not in the browser: in the real flow that
 * exchange needs a client secret, and a secret that reaches the client is not
 * a secret.
 */
router.post('/:provider/exchange', async (req, res) => {
  const adapter = getProvider(req.params.provider);
  if (!adapter) return res.status(404).json({ error: 'Unknown provider' });

  const { code, state } = req.body || {};
  if (!code || !state) return res.status(400).json({ error: 'code and state are required' });
  if (!burnState(state, adapter.id)) {
    // Wrong, expired, or already used. All three mean the same thing to the
    // caller and saying which would help somebody probing.
    return res.status(400).json({ error: 'That sign-in link has expired. Try again.' });
  }

  try {
    const connection = await adapter.exchange({ code });
    // DEMO holds no token, so there is nothing here worth protecting and
    // nothing is stored server-side. A real adapter returns an access token
    // too, and that is the moment this route needs an encrypted store and an
    // account to hang it off — see migration notes in the plan.
    return res.json({ success: true, connection });
  } catch (err) {
    logger.warn(`social-auth exchange failed for ${adapter.id}:`, err.message);
    return res.status(502).json({ error: 'Could not complete the connection' });
  }
});

module.exports = router;
