# Truegle — Deployment & Infrastructure Guide

This document covers the steps that **cannot be done in code** — they require access to your
domain registrar (IONOS), DNS host, Google Search Console, and Google AdSense dashboards.

The canonical production domain referenced throughout the app is now **`truegle.info`**
(bought & paid for via **IONOS**). It is wired into the CORS allowlist in `apps/backend/server.js`,
the OAuth redirect / `FRONTEND_URL` default in `apps/backend/routes/auth.js`, and the
canonical/OG/JSON-LD tags in `apps/frontend/index.html`.

**`trumpafi.online`** is kept as a **secondary** domain that also points at the Truegle site
(still in the CORS allowlist). The goal: as many owned domains as possible resolve to Truegle,
with `truegle.info` as the single SEO **canonical**.

**Hosting:** the public **frontend** is on **Cloudflare Pages** (`truegle-search.pages.dev`);
the **backend** is on **Vercel** (`backend-seven-khaki-60.vercel.app`). DNS below targets
Cloudflare Pages.

---

## 1. DNS — pointing `truegle.info` (IONOS) at Cloudflare Pages

You have IONOS login. There are two ways to do this; **Option A is strongly recommended** because
Cloudflare Pages needs apex (`@`) support that IONOS DNS does not cleanly provide (no CNAME
flattening at the apex).

> ✅ **DECIDED (2026-06-10): Option A — move nameservers to Cloudflare.** Option B is kept below
> only as a fallback. Deploy of the new canonical tags is **held until DNS resolves**.

### Option A (recommended) — move DNS to Cloudflare, keep the domain at IONOS
1. In the **Cloudflare** dashboard → *Add a site* → enter `truegle.info` (Free plan is fine).
2. Cloudflare gives you **two nameservers** (e.g. `xxx.ns.cloudflare.com`).
3. In **IONOS** → Domains → `truegle.info` → *Nameserver settings* → switch to **custom/external
   nameservers** and enter Cloudflare's two nameservers. (Leave the registration at IONOS.)
4. In **Cloudflare Pages** → your project → *Custom domains* → add `truegle.info` **and**
   `www.truegle.info`. Cloudflare auto-creates the proxied DNS records + TLS cert.
5. Propagation is usually minutes to a few hours.

### Option B — keep DNS at IONOS (more limited)
1. In **Cloudflare Pages** → *Custom domains* → add `www.truegle.info`; it will show a CNAME target
   (`truegle-search.pages.dev`).
2. In **IONOS** DNS for `truegle.info`:
   - `www`: **CNAME** → `truegle-search.pages.dev`
   - Apex `@`: IONOS cannot CNAME the apex. Use IONOS's **redirect** feature to forward
     `truegle.info` → `https://www.truegle.info` (HTTP 301), so the apex still works.
3. Add `www.truegle.info` as the custom domain in Cloudflare Pages and let TLS issue.

### Both options — finish up
- Set the backend env var on **Vercel**: `FRONTEND_URL=https://truegle.info` so OAuth redirects and
  the `/sitemap.xml` + `/robots.txt` routes use the right base URL. (Redeploy backend after.)
- Confirm `https://truegle.info/` loads the Truegle site and `https://www.truegle.info/` works too.

## 1b. Keep `trumpafi.online` pointing at Truegle (secondary)
Use the **same pattern** as above for `trumpafi.online` so it also resolves to the Truegle site:
- Easiest: in its registrar/DNS, **redirect** `trumpafi.online` + `www` → `https://truegle.info`
  (301). This keeps one SEO canonical while preserving the second domain.
- Or point it at Cloudflare Pages the same way as Option A/B. It's already in the CORS allowlist,
  so the app will accept it either way.

### ⚠️ Important clarification about "truegle search → truegle.info"
There is **no DNS setting** that makes a *search-engine query* for "truegle search" jump to your
site. DNS only resolves a domain you already typed. Getting your site to appear (and rank) when
people **search** "truegle search" on Google/Bing is an **SEO + Search Console** task — see §2.

---

## 2. Search visibility (SEO / AEO / GEO) & indexing

Code already shipped in this repo:
- `apps/frontend/public/robots.txt` (+ backend `/robots.txt` route)
- `apps/frontend/public/sitemap.xml` (+ backend `/sitemap.xml` route)
- Canonical, Open Graph, Twitter, and JSON-LD (`Organization` + `WebSite`/`SearchAction`) in `index.html`

Manual steps:
1. **Google Search Console** (search.google.com/search-console):
   - Add property `https://truegle.info`.
   - Verify ownership (DNS TXT record, or upload the HTML verification file to `apps/frontend/public/`).
   - Submit `https://truegle.info/sitemap.xml`.
   - Use **URL Inspection → Request Indexing** for `/` and `/search`.
2. **Bing Webmaster Tools** (bing.com/webmasters): add + verify the site, import from Search Console, submit sitemap.
3. **Brand ranking for "truegle search":** this builds over time once the site is indexed and the
   brand name appears in the title/OG/JSON-LD (already done). It is not instant.
4. **Add an OG image:** drop a 1200×630 PNG at `apps/frontend/public/og-image.png`
   (referenced by the meta + JSON-LD).

### SPA indexing caveat
The frontend is a **pure client-side SPA**, which crawlers index poorly (content only appears after
JS runs). For meaningful organic ranking, consider a follow-up to add **prerendering / SSG**
(`vite-plugin-ssr`, `react-snap`, or migrating to Next.js). Tracked as a future enhancement.

---

## 3. Ads / AdSense distributor approval

Code already shipped:
- `apps/frontend/public/ads.txt` →
  `google.com, pub-9542137900411519, DIRECT, f08c47fec0942fa0`
- AdSense loader is in `index.html`; real ad units render via `components/ui/AdSenseAd.jsx`.
  (`components/AdSlot.jsx` and `components/AdBanner.jsx` are placeholders.)

Manual steps:
1. Confirm `https://truegle.info/ads.txt` is reachable after deploy (required for serving/approval).
2. In the **AdSense dashboard**, ensure the site `truegle.info` is added and "Ready"/under review.
3. Replace any placeholder `AdSlot`/`AdBanner` instances with real `AdSenseAd` units (valid `adSlot` IDs)
   before requesting review — AdSense rejects sites with non-functional/placeholder ad boxes.
4. Ensure required pages exist for approval: Privacy Policy, Terms, About/Contact, and real content.
5. Verify the publisher ID in `ads.txt` and `index.html` match your AdSense account
   (`ca-pub-9542137900411519`). Update both if the account differs.

---

## 4. API health check

Run the backend and verify:
- `GET /api/health` → `{ status: "OK" }`
- `GET /api/search/health` → per-provider search health

Provider keys are configured in `apps/backend/config/env.js` (env vars). Confirm which of these are set
in production: Google CSE, Bing, Brave, SerpAPI, YouTube, News API, the AI providers, and payment
(Stripe/Square/PayPal). Missing keys degrade the corresponding feature gracefully but should be filled
for full functionality.
