# Reaching YouTube from a datacenter IP

YouTube blocks datacenter IPs. Vercel and AWS are datacenter IPs. This is what
we do about it, and — just as importantly — what we deliberately don't.

## The three paths, and which one actually breaks

| Path | Where | Blockable? |
|---|---|---|
| `googleapis.com/youtube/v3/*` | `routes/creators.js` (`*ViaDataApi`), `SearchService` | **No.** Keyed, quota-limited (10k units/day), never sees a captcha. |
| `youtube.com/feeds/videos.xml` | `routes/creators.js` → `fetchViaRss` | Rarely. Tolerant and unauthenticated. |
| `youtube.com/watch`, `/@handle`, `/channel/…` | `TranscriptService`, `routes/creators.js` | **Yes.** `/sorry/` + reCAPTCHA from cloud hosts. |

Only the third column is a real problem, and it is the one that silently
degrades: a captcha page parses as "no captions" or "channel not found", so the
feature looks broken rather than blocked.

## What we do: `services/YouTubeGateway.js`

A pool of public **Invidious** instances. Each one fetches YouTube from its own
IP and returns clean JSON, so a pool is a rotating proxy chain in effect — a
different IP per request — at no cost and with nothing routed through a party
that can read it.

Three properties that matter:

- **Rotation.** A cursor advances per request, so consecutive calls start at
  different instances. Without this the first healthy instance takes every
  request and earns its own rate limit — the exact failure the pool exists to
  prevent.
- **Cooldown.** A failure (timeout, 5xx, 429, or the captcha wall) buys an
  exponential rest: 2 → 4 → 8 minutes, capped at an hour. One success clears it
  completely. Before this, a dead instance was rediscovered on every single
  request, at the cost of its full timeout each time.
- **Shared.** Transcripts and the creator feed use one pool, so a captcha
  discovered on one path is known to the other.

Direct youtube.com is still tried first where it is cheap and usually works
(RSS, the channel page). `direct()` returns `null` rather than the captcha
page, so a block falls through to the pool instead of being parsed as data.

### Health

```
GET /api/health/youtube   →  { ready, total, pool: [{ base, ready, fails, cooldownMs, lastOk }] }
```

Public instance base URLs only — no credentials, nothing per-user. "Transcripts
are slow" and "nine of twelve instances are cooling down" look identical
without this, and the second one is the answer.

### Configuration

| Variable | Effect |
|---|---|
| `TRANSCRIPT_INVIDIOUS_INSTANCES` | Comma-separated list; **replaces** the built-in pool wholesale. |
| `TRANSCRIPT_PROXY_URL` | Optional single HTTP(S) proxy for every gateway request. Unset by default. |

## What we deliberately do NOT do

**We do not buy rotating proxies.** Residential pools run $50–300/mo, which
breaks the $0 budget, and the free pools are worse than the problem: for a
product whose entire pitch is privacy, sending requests through an unknown
third party that can read and log them is a regression, not a workaround.

**None of this touches the embed.** When a visitor sees *"Sign in to confirm
you're not a bot"* inside the player, that is YouTube's anti-bot served to
**their** IP by an iframe **their** browser opened. Our server is not in that
path, so no amount of server-side rotation changes it. Usual causes are a VPN,
a shared mobile-carrier NAT, or many embed loads in quick succession from one
address. It clears on its own; signing into YouTube in that browser clears it
immediately.
