---
title: Truegle Search Gateway
emoji: 🔎
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Keyless video, audio and social search behind a token.
---

# Truegle Search Gateway

Runs Truegle's keyless open-search providers (Sepia/PeerTube, Dailymotion, Internet Archive,
Audius, Openverse, Apple podcasts, Lemmy, Mastodon hashtags) from a **second IP address and
failure domain**. The Truegle backend (Vercel) calls it **only as a fallback**, for providers that
failed or are cooling down on its own network (shared-IP throttling, e.g. an HTTP 403 from one
provider). It is not on the AWS SearXNG box and adds no cost: free CPU Space, no API keys.

- `GET /health` — open; says only whether a token is configured.
- `POST /search/{video|audio|social}` — `Authorization: Bearer <SEARCH_GATEWAY_TOKEN>`, JSON body
  `{ "q": "...", "limit": 10, "safe": true, "providers": ["sepia"], "deadlineMs": 4500 }`.
- The query travels in the **body**, never a URL, and nothing in the request is logged.
- No token set => every search is refused (503). It will not run as an open proxy.

The code in this folder is only the shell (Dockerfile, entry point). The providers, pool and HTTP app
are **copied in** from `apps/backend/services/openSearch/` by `scripts/stage-search-gateway.sh`, so
there is one source of truth. Re-stage and re-upload whenever that folder changes.

## Deploy (about 5 minutes, from the repo root, with the `hf` CLI)

```bash
hf auth login                                   # once; a token with WRITE access
bash scripts/stage-search-gateway.sh            # assembles /tmp/truegle-search-gateway-space
hf repos create YOURUSER/truegle-search-gateway --type space --sdk docker --public
hf upload YOURUSER/truegle-search-gateway /tmp/truegle-search-gateway-space . --repo-type space
```

Generate the shared token locally and put it on the Space without typing it anywhere:

```bash
export SEARCH_GATEWAY_TOKEN="$(openssl rand -hex 32)"
hf spaces secrets add YOURUSER/truegle-search-gateway -s SEARCH_GATEWAY_TOKEN   # reads it from your env
```

Give the same two values to the Vercel **backend** project (Production), then redeploy:

```bash
printf %s "$SEARCH_GATEWAY_TOKEN" | vercel env add SEARCH_GATEWAY_TOKEN production
printf %s "https://YOURUSER-truegle-search-gateway.hf.space" | vercel env add SEARCH_GATEWAY_URL production
```

Check it: `curl https://YOURUSER-truegle-search-gateway.hf.space/health` should say `"configured": true`.
Until both Vercel variables are set, the backend ignores the gateway completely.

## Operating notes

- **Free Spaces sleep after ~48h idle** and take about a minute to wake. The daily feed cron pings
  `/health` so it stays warm; if it is asleep the backend's call just times out and is ignored.
- **Rotate the token:** generate a new one, `hf spaces secrets add` it, update the Vercel variable, redeploy.
- **Turn a provider off everywhere:** set `OPEN_SEARCH_DISABLE=sepia,lemmy` on the Space
  (`hf spaces variables add YOURUSER/truegle-search-gateway -e OPEN_SEARCH_DISABLE=sepia,lemmy`) and/or on Vercel.
- Names of the env vars live in `docs/SECRETS-MAP.md`. Never commit a token value.
