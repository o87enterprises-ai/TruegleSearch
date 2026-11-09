// What the "top posts" cache covers. KEPT IN SYNC BY HAND with the frontend's
// Top tab (apps/frontend/src/hooks/useFeedTabs.js TOP_NETWORKS and FALLBACK_SEEDS);
// apps/frontend/scripts/verify-landing-cards.mjs fails if the landing's real
// request drifts from PREWARM_REQUEST below.
//
// Only SOCIAL-NETWORK requests with an empty query (or one of the fixed
// fallback seed words the Top tab re-asks with) are cacheable: that is "what is
// on top right now". A typed search, a news or markets lane, a creators or
// podcasts lane, or an account's own feed is never cached.
const TOP_NETWORKS = ['instagram', 'facebook', 'tiktok', 'x', 'reddit', 'bluesky',
  'mastodon', 'lemmy', 'truthsocial', 'rumble', 'pinterest'];
const FALLBACK_SEEDS = ['viral', 'trending', 'breaking', 'funny', 'video', 'news', 'music', 'sports'];

// The one request every landing visit and /feed Home makes first. Pre-built
// each morning so almost nobody waits for it.
const PREWARM_REQUEST = Object.freeze({
  platforms: TOP_NETWORKS,
  query: '',
  cursor: {},
  limit: 20,
  adult: false,
});

module.exports = { TOP_NETWORKS, FALLBACK_SEEDS, PREWARM_REQUEST };
