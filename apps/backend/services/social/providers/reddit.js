const crypto = require('crypto');
const config = require('../../../config/env');

// Reddit — the one provider that can genuinely serve somebody their own feed
// for free. A registered app costs nothing and allows 100 queries a minute.
//
// It runs in one of two modes, decided entirely by whether credentials exist:
//
//   DEMO (no credentials) — `authorizeUrl` points straight back at our own
//     callback with a fabricated code. The redirect, the state check and the
//     server-side exchange all really happen; only the other end is us. That
//     is what lets the page be built and tested before anybody has registered
//     an app.
//
//   LIVE (credentials set) — the same three steps against Reddit's real
//     endpoints. Nothing else in the route or the client changes.
//
// To go live: register an app at reddit.com/prefs/apps (type: web app), set
// REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET, and set the redirect URI to
// <FRONTEND_URL>/feed/callback. Then finish `exchange` below — it is marked.

const AUTHORIZE = 'https://www.reddit.com/api/v1/authorize';
// `identity` to know who connected, `read` and `mysubreddits` for the feed
// itself. Nothing that can post, vote or message — this is a reader.
const SCOPE = 'identity read mysubreddits';

const credentials = () => ({
  clientId: config.reddit?.clientId,
  clientSecret: config.reddit?.clientSecret,
});

const isLive = () => Boolean(credentials().clientId && credentials().clientSecret);

module.exports = {
  id: 'reddit',

  get mode() { return isLive() ? 'live' : 'demo'; },

  authorizeUrl({ state, callback }) {
    if (!isLive()) {
      // Demo: hand the browser straight back to our own callback. The code is
      // meaningless and the exchange below accepts it; the STATE is real and
      // is still checked, so the CSRF half of the handshake is exercised for
      // real rather than stubbed.
      const params = new URLSearchParams({
        provider: 'reddit',
        code: `demo_${crypto.randomBytes(8).toString('hex')}`,
        state,
      });
      return `${callback}?${params}`;
    }
    const params = new URLSearchParams({
      client_id: credentials().clientId,
      response_type: 'code',
      state,
      redirect_uri: callback,
      duration: 'permanent',      // we want a refresh token, not one hour
      scope: SCOPE,
    });
    return `${AUTHORIZE}?${params}`;
  },

  async exchange({ code }) {
    if (!isLive()) {
      // Any code is accepted, which is the whole point of demo mode. No token
      // is minted and nothing is stored, so there is nothing here to protect.
      return { provider: 'reddit', handle: 'demo_user', mode: 'demo', connectedAt: new Date().toISOString() };
    }
    // LIVE, and deliberately not written blind. Filling this in without being
    // able to run it against Reddit would produce code that has never once
    // executed and looks finished — POST https://www.reddit.com/api/v1/access_token
    // with HTTP Basic (client_id:client_secret), grant_type=authorization_code,
    // the code and the same redirect_uri, then GET /api/v1/me for the handle.
    // The access token must go to an encrypted server-side store at that
    // point; it cannot live in the browser like a demo connection does.
    throw new Error('Reddit credentials are set but the live exchange is not implemented yet');
  },
};
