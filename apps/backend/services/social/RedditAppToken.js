// Reddit app-only OAuth — one token for the whole server, no user attached.
//
// WHY THIS EXISTS: /api/social/feed's Reddit leg 403s from the deployment.
// Reddit blocks keyless reads from datacenter IP ranges, so host-walking and
// User-Agent tuning cannot get past it (CONFIRMED IN PRODUCTION 2026-08-18,
// see routes/social.js upstreamReason). An authenticated request is the
// sanctioned fix, not a way around the block — Reddit hands out the token
// itself, on the free tier, to any registered app.
//
// APP-ONLY, NOT PER-USER. This is `grant_type=client_credentials`: the server
// proves it is our app and gets a token that can read PUBLIC listings. There
// is no user, no redirect, no consent screen and no refresh token. That is
// exactly right for an aggregated feed, which has to work for a visitor who
// has never heard of Reddit and will never log into it.
//
// It is therefore NOT the adapter in providers/reddit.js. That one is the
// three-legged authorization_code flow — authorizeUrl, state, exchange(code) —
// for the later "connect YOUR Reddit and see YOUR home feed" feature. The two
// grants share nothing but a hostname, so they stay separate files.
//
// NO REQUIRES, ON PURPOSE. Node builtins and global fetch only. That is what
// lets scripts/verify-reddit-auth.mjs drive the real thing on a machine where
// `npm install` has not run — and, more to the point, from a machine that can
// actually reach Reddit, which the agent sandbox cannot.
//
// If credentials are absent this returns null rather than throwing, and the
// caller falls back to the keyless path. Free-first: a missing key degrades a
// feature, it never takes the server down.

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

// Refresh this far before the stated expiry. Reddit's tokens last an hour, and
// a request that leaves here with 3 seconds left on the clock can still land
// after it has died — the round trip is not free.
const EARLY_REFRESH_MS = 60 * 1000;

// A token that somehow arrives without an expires_in is treated as short-lived
// rather than trusted forever; re-minting costs one request, a stale token
// costs every request until someone notices.
const FALLBACK_TTL_MS = 10 * 60 * 1000;

/**
 * Build a token holder for one set of credentials.
 *
 * `fetchImpl` and `now` are injected so the unit test can drive expiry and
 * concurrency without mocking a module or waiting an hour.
 */
function createRedditAppToken({
  clientId,
  clientSecret,
  userAgent,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const configured = Boolean(clientId && clientSecret && userAgent);

  let token = null;
  let expiresAt = 0;
  // THE STAMPEDE GUARD. Every request to /api/social/feed asks for a token. On
  // a cold start they all miss the cache at the same instant, and without this
  // each one POSTs to the token endpoint — which rate-limits authentication
  // itself, so the fix for "Reddit is refusing us" becomes the cause of it.
  // One in-flight mint, shared by everyone waiting.
  let inFlight = null;

  async function mint() {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Reddit 429s a default agent almost immediately, and rejects some
        // outright. This header is not optional.
        'User-Agent': userAgent,
      },
      body: 'grant_type=client_credentials',
    });

    // The body carries Reddit's own reason on a failure; the status alone
    // cannot tell a wrong secret (401) from a suspended app (403).
    let payload = null;
    try { payload = await res.json(); } catch { /* non-JSON error page */ }

    if (!res.ok) {
      const reason = payload?.error || payload?.message || `HTTP ${res.status}`;
      throw new Error(`Reddit refused the app-only token: ${reason}`);
    }
    if (!payload?.access_token) {
      throw new Error(`Reddit returned no access_token (error: ${payload?.error || 'none given'})`);
    }

    const ttl = Number.isFinite(payload.expires_in)
      ? payload.expires_in * 1000
      : FALLBACK_TTL_MS;

    token = payload.access_token;
    // Never let the early-refresh margin push the deadline into the past on a
    // token that was already shorter than the margin.
    expiresAt = now() + Math.max(ttl - EARLY_REFRESH_MS, 0);
    return token;
  }

  return {
    get mode() { return configured ? 'app-only' : 'unconfigured'; },

    get configured() { return configured; },

    /**
     * The current bearer token, minting or refreshing as needed.
     * Returns null — never throws — when there are no credentials to use.
     */
    async get() {
      if (!configured) return null;
      if (token && now() < expiresAt) return token;
      if (inFlight) return inFlight;

      inFlight = mint().finally(() => { inFlight = null; });
      return inFlight;
    },

    /** Drop the cached token so the next get() re-mints. Used after a 401. */
    reset() {
      token = null;
      expiresAt = 0;
    },
  };
}

/** Build one from the environment. The verify script's entry point. */
function fromEnv(env = process.env) {
  return createRedditAppToken({
    clientId: env.REDDIT_CLIENT_ID,
    clientSecret: env.REDDIT_CLIENT_SECRET,
    userAgent: env.REDDIT_USER_AGENT || 'TruegleSearch/1.0 (aggregated feed; +https://truegle.info)',
  });
}

module.exports = { createRedditAppToken, fromEnv, TOKEN_URL, EARLY_REFRESH_MS };
