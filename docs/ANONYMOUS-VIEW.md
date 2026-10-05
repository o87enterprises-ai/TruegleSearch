# Anonymous View (proxied page views)

> **RETIRED 2026-10-05.** The Morty proxy never went live over HTTPS: production
> results carried `http://44.236.219.63:3001/?mortyurl=…` links to a port that
> did not answer, advertising the server's bare IP in every search response.
> The code (`buildResultProxyUrl`, `attachProxyUrls`, `SEARXNG_RESULT_PROXY_*`)
> and `scripts/setup-morty.sh` were removed. Morty is unmaintained and strips
> JavaScript, so it is not coming back. Protected browsing is now planned in
> `docs/TRUEGLE-BROWSER-BLUEPRINT.md`. Kept below for history only.


Truegle's answer to Startpage's "Anonymous View" / DuckDuckGo's proxied results:
open any search result **through a proxy** so the destination site never sees the
user's IP address or browser fingerprint. We reuse the SearXNG result-proxy
mechanism we already self-host on AWS — no new service in the Truegle app.

## How it works

SearXNG's JSON API (which the Truegle backend consumes) returns **raw** result
URLs — proxification only happens in SearXNG's own HTML template. So the backend
replicates SearXNG's `proxify()` to attach a signed proxy link (`proxyUrl`) to
each SearXNG result:

- `apps/backend/services/SearchService.js` → `buildResultProxyUrl(url)` builds
  `{<proxy>}?mortyurl=<url>&mortyhash=<hmac-sha256(key, url)>` (the Morty contract).
- `proxyUrl` is attached in `formatSearXNGResults` and `formatSearXNGCategoryResults`.
- Frontend (`apps/frontend/src/pages/UniversalSearch.jsx` → `ResultCard`):
  - adds a **"View anonymously"** link (opens `proxyUrl` in a new tab), and
  - routes the in-app iframe preview through `proxyUrl` when present. This also
    fixes the common "This page can't be embedded" failure, because the proxy
    strips `X-Frame-Options`.

The feature is **off by default**. It only activates when the env vars below are
set, so there is no behavior change until the AWS host is configured.

## Enable it (two parts)

### 1. On the AWS SearXNG host — run a result proxy

**Fastest path — use the helper script.** On the EC2 host that runs SearXNG:

```bash
chmod +x scripts/setup-morty.sh
./scripts/setup-morty.sh        # generates the key, runs Morty in Docker, prints the config to paste
```

It generates the shared HMAC key, starts Morty on `127.0.0.1:3000`, and prints
the exact `settings.yml` block + Vercel env vars. Then front it with TLS
(nginx/caddy) at `anon.truegle.info`. Manual steps below if you'd rather not use
the script.

SearXNG delegates result proxying to [Morty](https://github.com/asciimoo/morty).
Deploy Morty alongside SearXNG (same docker-compose network) and point SearXNG at
it in `settings.yml`:

```yaml
# searxng/settings.yml
result_proxy:
  url: https://anon.truegle.info/        # public URL of the Morty instance
  key: !!binary "<BASE64_KEY>"           # raw HMAC key, base64-encoded

# (optional but recommended) also proxy image thumbnails:
server:
  image_proxy: true
```

Generate the key once and keep the **same base64 string** for both SearXNG and
the Truegle backend:

```bash
openssl rand -base64 33
```

Start Morty with the matching key (Morty decodes the same base64 to raw bytes):

```bash
morty -key "<BASE64_KEY>" -listen 0.0.0.0:3000
```

### 2. On the Vercel backend — set the env vars

| Var | Value |
| --- | --- |
| `SEARXNG_RESULT_PROXY_URL` | Public Morty URL, e.g. `https://anon.truegle.info/` |
| `SEARXNG_RESULT_PROXY_KEY` | The **same** base64 key from `result_proxy.key` |

Redeploy the backend. SearXNG results will now include a `proxyUrl`, and the
frontend will show "View anonymously" + use the proxy for in-app previews.

> The key is stored base64 (matching SearXNG's `!!binary`) and decoded to raw
> bytes for the HMAC — see `SearchService` constructor. If the key encodings don't
> match between Morty, SearXNG, and the backend, the proxy will reject links.

## Verify

1. `curl`-free check (anti-scraping blocks header-less requests): run a real
   query in the browser at `https://truegle.info/search` and confirm each web
   result shows a **"View anonymously"** action.
2. Click it — the page should load via the proxy domain, not the origin.
3. Click **"Open in app"** — pages that previously showed "can't be embedded"
   should now render inside the iframe (proxy strips `X-Frame-Options`).

## Fallback providers are proxied too

All providers carry a `proxyUrl`, not just SearXNG. `SearchService.attachProxyUrls()`
runs once over the merged result set and signs a proxy link for any result that
doesn't already have one (Brave / Google / Bing / News / SerpAPI), skipping image
results. So anonymous view works regardless of which provider served the result.

## Image thumbnails

Image thumbnails use SearXNG's built-in `image_proxy` (host-side, `server.image_proxy: true`),
independent of this result proxy.

---

# Related: YouTube transcript extraction & datacenter-IP blocking

The `/extract` transcript feature hits the **same class of problem** the result
proxy solves: YouTube blocks datacenter IPs (Vercel/AWS) with a captcha wall, so
transcript fetches fail in production with a misleading "captions disabled" error.

What changed:
- `apps/backend/services/TranscriptService.js` replaces the unmaintained
  `youtube-transcript` package. It loads the watch page, reads `captionTracks`
  from `ytInitialPlayerResponse` (brace-matched, not regex), and parses the
  timedtext XML. Errors are classified (`RATE_LIMITED` / `NO_CAPTIONS` /
  `AGE_RESTRICTED` / `UNAVAILABLE` / `FETCH_FAILED`) so `/api/extract/transcript`
  returns an **honest** message + status code.
- It supports an **outbound proxy** so the fetch can leave from a non-blocked IP.

To actually fix transcripts in production, set a (ideally residential/rotating)
proxy on the Vercel backend:

```
TRANSCRIPT_PROXY_URL = http://user:pass@host:port
```

Unset → direct fetch (works locally / from non-blocked IPs, will be rate-limited
from Vercel). A plain datacenter proxy will likely be blocked too; residential or
rotating proxies are what reliably bypass YouTube's IP wall.
