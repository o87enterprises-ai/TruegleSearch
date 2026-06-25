# Anti-Scraping & Attribution

Truegle layers several defenses so that scraped content is watermarked,
traceable, and (for obvious bots) blocked outright. None of these break
legitimate search-engine crawlers, so SEO indexing is unaffected.

## The layers

| Layer | File | What it does | Can a scraper strip it? |
|---|---|---|---|
| Attribution header | `apps/backend/middleware/attribution.js` | `X-Truegle-Attribution` + `X-Truegle-Trace-Id` on every response | n/a (always present) |
| Attribution JSON field | `apps/backend/middleware/attribution.js` | `attribution` block + `traceId` in every JSON body | Easily (delete a key) |
| Invisible canary | `apps/backend/utils/watermark.js` | Zero-width-unicode marker woven into result snippets | Hard — it's inside the text |
| Visible badge | `apps/frontend/src/components/SearchResults.jsx` | "Results from Truegle" under the results | Only by re-styling the page |
| Bot detection / blocking | `apps/backend/middleware/botDetection.js` | Flags & blocks automation, tightens rate limits | No — server-side |

## Per-request trace IDs

`attributionMiddleware` generates a short `traceId` per request and exposes it
as `req.truegleTraceId`. It appears in the response header, the JSON
`attribution` block, **and** inside the invisible snippet watermark. If scraped
content turns up elsewhere, the trace ID ties it back to a specific request.

### Detecting the watermark in suspect text

```bash
node apps/backend/scripts/check-watermark.js "<paste suspect text>"
cat suspected-scrape.json | node apps/backend/scripts/check-watermark.js
```

Prints the trace IDs found, or "No Truegle watermark found." Exit code 0 on a
hit, 1 otherwise (useful in scripts/CI).

## Bot detection

`botDetection` annotates every request with `req.botInfo`:

- **Good bots** (Googlebot, Bingbot, DuckDuckBot, social unfurlers, …) — always
  allowed so indexing/link previews keep working.
- **Bad bots** (curl, wget, python-requests, scrapy, headless browsers, …) —
  `blockBadBots` returns `403` on `/api/search`.
- **Suspicious** requests (no User-Agent, missing `Accept-Language`) — not
  blocked, but subject to `suspiciousBotLimiter` (5 req/min) so a scraper that
  slips past UA matching still hits a hard ceiling.

The threshold is intentionally conservative (score ≥ 50) to avoid false
positives on real, slightly-unusual browsers.

Disable the whole bot layer with `BOT_DETECTION_DISABLED=true` if needed.

## Cloudflare (zone-side) — recommended

The app reads these Cloudflare headers automatically when present:

- `cf-connecting-ip` / `true-client-ip` — real client IP for accurate rate
  limiting (preferred over `req.ip`).
- `cf-verified-bot: true` — Cloudflare-verified good bot → allow-listed.
- `cf-threat-score` — folded into the bot score (Enterprise Bot Management).

To get the strongest protection, enable these in the Cloudflare dashboard for
the Truegle zone:

1. **Security → Bots → Bot Fight Mode** (free) or **Super Bot Fight Mode** /
   **Bot Management** (paid) — challenges/blocks definitely-automated traffic
   before it reaches the origin.
2. **Security → WAF → Rate limiting rules** — add a rule on `/api/search`
   (e.g. > 60 req/min per IP → managed challenge). This complements the
   app-layer limiter and runs at the edge.
3. **Managed Transform → Add visitor location / bot headers** — ensures
   `cf-connecting-ip` and bot headers are forwarded to the origin.

> Edge (Cloudflare) defenses stop load before it reaches the server;
> app-layer defenses (this code) are the backstop and provide the
> watermark/attribution that edge rules cannot. Use both.

## Limitations (be honest)

- Visible markers (header, JSON field, badge) can be stripped by anyone who
  bothers. Their value is branding + deterrence.
- The invisible canary survives copy/paste and most extraction, but **not**
  paraphrasing/summarization — if an AI rewrites a snippet, the zero-width
  marks don't carry through.
- UA-based blocking is defeated by spoofing a browser UA. That's why there's a
  suspicious-request rate limiter and why Cloudflare edge rules matter.

This stack makes casual and automated scraping costly and traceable; it is not
a cryptographic guarantee against a determined, well-resourced adversary.
