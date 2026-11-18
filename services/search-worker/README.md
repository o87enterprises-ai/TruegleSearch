# Truegle Search Gateway (Cloudflare Worker)

Free, always-on replacement for the Hugging Face Space (Docker Spaces now require a paid plan).
Same HTTP contract as `apps/backend/services/openSearch/gatewayServer.js`; the backend's `gateway.js`
client needs no change. It imports the pool and adapters straight from the backend source (no copy);
`wrangler.toml` aliases `axios` and the logger to the stand-ins in `shims/`.

Live: https://truegle-search-gateway.o87enterprises.workers.dev  (`GET /health`)

Deploy / redeploy (from this folder, wrangler logged in):

    npx wrangler@4 deploy
    npx wrangler@4 secret put SEARCH_GATEWAY_TOKEN     # first time or to rotate

Vercel backend (Production) needs `SEARCH_GATEWAY_URL` (the URL above) and the same `SEARCH_GATEWAY_TOKEN`; redeploy after changing.
Verified from Cloudflare IPs: archive, dailymotion, sepia, audius, mastodon, lemmy answer; itunes (429) and openverse (timeout) may fail there, which is fine because the gateway is only asked about providers that already failed on Vercel.
