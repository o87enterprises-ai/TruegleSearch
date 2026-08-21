# SearXNG behind Cloudflare — DONE (2026-08-21)

**Why:** `http://44.236.219.63:8080` exposed SearXNG — an unauthenticated
metasearch proxy — to the whole internet. Anyone could drive queries through it
under our datacenter Elastic IP, which is exactly what pushes upstream engines
to CAPTCHA/403 us.

**End state (live):** backend calls `https://search.truegle.info` → Cloudflare
(TLS) → origin `44.236.219.63:8080` (SearXNG). Port **8080 is no longer open to
the public** — the security group only allows Cloudflare's published IP ranges,
so the open internet can't reach SearXNG directly, but Cloudflare still can.

## What was actually built

We did **not** use the nginx `search.truegle.info` vhost (that config never
loaded on the box, and fixing it needs EC2 Instance Connect). Instead we fronted
the already-working `:8080` listener directly with Cloudflare — no box access
required. All of this was done via the Cloudflare + AWS + Vercel APIs.

1. **Cloudflare DNS** — A record `search.truegle.info → 44.236.219.63`, Proxied.
2. **Cloudflare Configuration Rule** (`http_config_settings` phase) — for
   `http.host eq "search.truegle.info"`, set **SSL = flexible**. The zone is on
   SSL mode **Full**; without this per-hostname override CF tried the origin on
   `:443` (closed) and returned **522**. Flexible makes CF talk HTTP to origin.
3. **Cloudflare Origin Rule** (`http_request_origin` phase) — for the same
   hostname, route the origin to **port 8080** (ruleset id
   `b085336d1092497bb93ce44932612818`). This points CF at the working SearXNG.
4. **Vercel** — backend `SEARXNG_URL` = `https://search.truegle.info`
   (was `http://44.236.219.63:8080`), then redeployed production
   (aliased `api.truegle.info`). Verified a live query returns `source:"searxng"`.
5. **AWS security group `sg-063b58a4ed8289b4e`** — added the 15 Cloudflare IPv4
   CIDRs as allow rules on tcp/8080, then **revoked the `0.0.0.0/0` rule**.
   Verified: production search still 200s; a direct hit to `IP:8080` from a
   non-Cloudflare address now times out.

## Rollback
- Fastest: set Vercel `SEARXNG_URL` back to `http://44.236.219.63:8080` and
  redeploy — but that also needs 8080 reopened to Vercel's (dynamic) egress, so:
- Re-open the port: `aws ec2 authorize-security-group-ingress --group-id
  sg-063b58a4ed8289b4e --protocol tcp --port 8080 --cidr 0.0.0.0/0
  --region us-west-2 --profile truegle`.
- The Cloudflare rules are harmless to leave in place.

## Maintenance
- **Cloudflare IP ranges change occasionally.** If search suddenly 522/timeouts
  from the backend, re-sync the SG allow-list from
  `https://api.cloudflare.com/client/v4/ips` (ipv4_cidrs) against tcp/8080.
- IPv6 was not added (origin is IPv4-only); add `ipv6_cidrs` if the origin ever
  gets an AAAA record.
- The unused `scripts/searxng-nginx.conf` stays in the repo as the alternative
  (fully-close-8080) path if we ever get reliable box access and want CF hitting
  nginx on :80 instead of :8080.
