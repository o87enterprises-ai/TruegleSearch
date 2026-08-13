# OSINT service — scope

Written 2026-08-13. The plan for giving the agent a genuinely robust OSINT
toolkit, on a $0 budget, without pretending constraints away.

## Why a second service at all

The Node toolbelt (`OsintToolbelt` / `OsintLookups`) covers what Node can do
keylessly: RDAP, DNS, certificate transparency, Wayback, Gravatar, GitHub, and
a 14-site handle check. The ceiling is the ecosystem — the serious OSINT
libraries are Python (`holehe`, `maigret`, `dnstwist`, `phonenumbers`), and
they are not worth reimplementing.

So: a small Python service the backend calls. Not a rewrite, an addition. Every
Node lookup stays exactly where it is.

## The constraint that decides the architecture

**The people-search sites do not block scrapers, they block datacenter IPs.**
TruePeopleSearch, FastPeopleSearch, ThatsThem, Nuwber and Spokeo all sit behind
Cloudflare and 403 anything from AWS/GCP/Render/HF. That is why they are links
in the debrief rather than fetches, and it is why adding a free cloud box does
not fix them — it adds a second datacenter IP to be blocked from.

Only a residential connection changes that. Hence two tiers.

---

## Tier 1 — free cloud, always-on

**Host: Hugging Face Spaces (Docker SDK), free CPU tier.**

| Why not the others | |
|---|---|
| Render free | 512MB and sleeps — Chromium will not fit, and you already know the ~50s cold start from TrueCode |
| Fly.io / Cloud Run | Require a card on file. Against a $0 budget that is a real risk, not a formality |
| PythonAnywhere free | Outbound HTTP is whitelist-only — fatal for OSINT |
| Oracle always-free | Already used up (permanent fact) |

HF free CPU is roughly 2 vCPU / 16GB, Docker, no card. It sleeps after extended
inactivity, so expect a cold start on the first call after a quiet period —
same class of problem as TrueCode, and handled the same way (generous timeout,
never on the critical path).

### What it runs

| Endpoint | Library | Value over what Node already does |
|---|---|---|
| `POST /email` | `holehe` | Account existence across ~120 sites from one address. Node checks none of these |
| `POST /username` | `maigret` | Hundreds of sites vs the 14 hand-written ones |
| `POST /phone` | `phonenumbers` | **Carrier and city-level geocoding**, which `libphonenumber-js` does not ship. Fully offline |
| `POST /domain` | `dnstwist` | Typosquat / lookalike domain generation and resolution |

`theHarvester` is deliberately out of v1: it is CLI-shaped, heavy, and leans on
search engines that rate-limit a datacenter fast.

### Non-negotiables

- **Bearer token.** The Space URL is public. Without auth it is a free OSINT
  API for the whole internet, and the abuse lands on our IP reputation.
- **Per-request budget.** `maigret` across every known site takes minutes.
  Every endpoint takes a millisecond budget, returns what finished, and flags
  `partial: true`. A partial answer beats a timeout.
- **Concurrency of one per upstream.** These endpoints ban fast.
- **Cache.** Same discipline as the news feed: TTL per type, serve stale on
  upstream failure.

---

## Tier 2 — the spare PC, opportunistic

**Status: designed, not scheduled.** The box is up "most of the time", which
decides its role: the backend may *try* it and must never *depend* on it.

- **Residential IP fetcher** — the people-search sites, and anything with a JS
  challenge.
- **Headless Chromium** (Playwright) — serves the existing open thread
  `headless-osint`.

**Reached over a Cloudflare Tunnel, never a port-forward.** The tunnel is
outbound-only, so the machine is never exposed and a dynamic IP stops
mattering. Tailscale is the alternative if it should stay private.

Because it is intermittent, the Node side treats it as one more settled promise
alongside the rest — when it is down the debrief degrades to today's behaviour
rather than erroring. That pattern is already in place per-source.

### Explicitly NOT on the plan

- **Kali on free hosting.** Every free host's ToS forbids scanning tooling; you
  will lose the account. You also do not need the distro — the tools are
  pip-installable. Active scanning belongs on your own hardware pointed at your
  own assets, which is what the pentest phase is for anyway.
- **A local model.** No discrete GPU, so an 8B on CPU is a few tokens a second:
  fine for batch work, not for chat. Nephesh self-hosting stays deferred.

---

## Legal / operational reality

The people-search sites forbid scraping in their terms and rate-limit hard.
Self-lookup and authorised testing is one thing; volume is another, and at
volume you will be blocked regardless of which IP you use. Cache aggressively,
keep concurrency at one, and treat every one of them as best-effort.

---

## Tomorrow, in order

1. **Create the Space** — `huggingface.co/new-space`, SDK **Docker**, private.
2. **Push `services/osint-python/`** to it (it is a complete Space: Dockerfile,
   `app.py`, `requirements.txt`, README frontmatter with `app_port: 7860`).
3. **Set `OSINT_SERVICE_TOKEN`** in the Space's Settings → Secrets.
4. **Verify** — `curl -H "Authorization: Bearer <token>" <space>/health`, then
   one `POST /phone` (offline, so it answers instantly and proves the wiring
   without waiting on any upstream).
5. **Then** the Node adapter: `OsintServiceClient`, inert until
   `OSINT_SERVICE_URL` is set, wired into `gather()` as additional settled
   promises. Same shape as `TrueCodeService` — that pattern is proven, and
   keeping it inert until configured means merging it changes nothing.

Step 5 is deliberately last. The contract below is ours, but it should be
confirmed against a running Space before the backend depends on it — the
TrueCode probe is the precedent for why guessing a contract is worse than
measuring one.

## Contract

All routes take `Authorization: Bearer <OSINT_SERVICE_TOKEN>`.

```
GET  /health                 -> { ok, version, tools: {holehe, maigret, dnstwist, phonenumbers} }
POST /email     { email, budget_ms? }             -> { ok, found: [{site, exists, ...}], checked, partial }
POST /username  { username, limit?, budget_ms? }  -> { ok, found: [{site, url}], checked, partial }
POST /phone     { phone, region? }                -> { ok, valid, e164, country, carrier, location, line_type }
POST /domain    { domain, limit?, budget_ms? }    -> { ok, registered: [{domain, dns_a, dns_ns}], checked, partial }
```

Every response carries `ok`. A failure is `{ ok: false, error }` with HTTP 200
where the request itself was well-formed, so the Node caller treats it as one
more settled promise rather than an exception.
