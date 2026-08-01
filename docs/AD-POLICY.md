# 🔴 AD POLICY — permanent rules (read before touching anything ad-related)

Written 2026-08-01 after the landing page became completely unusable: the
Adsterra tag redirected the top window to `https://bulsis.net/go/1740870?...`
the moment a visitor loaded `truegle.info`. Nobody could search, click, or read
anything. This document exists so it cannot happen again.

These are **rules, not preferences**. `npm run check:ads` enforces rules 1–3 and
runs automatically on `npm run build` — a violation fails the build.

---

## Rule 1 — NO ADS ON THE LANDING PAGE. Ever.

`src/pages/LandingPage.jsx` (route `/`, plus `/de` `/es` `/fr` `/nl` `/pt`)
renders **zero** third-party ads. Not a banner, not a native slot, not a
smartlink, not "just a small one in the footer".

The landing page is the first thing a new visitor sees and the page every SEO
link points at. One bad creative there costs the entire first impression, and
historically it has. Revenue comes from `/search`, `/chat`, `/extract`,
`/settings`, and the rewards pages — pages a visitor has already chosen to use.

Do not import `AdSlot`, `AdsterraBanner`, `SponsoredAd`, `RewardAdSlot`,
`AdColorWrapper`, `config/ads`, or `config/adNetworks` into `LandingPage.jsx`
**or into any component it renders**. The guard walks the whole import tree, so
hiding an ad inside `FeaturedCreator` or `ModesAndTrending` will still fail.

## Rule 2 — NO POPUNDERS, NO SOCIAL BARS, NO PUSH, NO INTERSTITIALS. Ever.

Banned on every page, from every network, forever:

| Format | Why it is banned |
| --- | --- |
| Popunder / popup | Opens windows the user did not ask for; has served scareware |
| Social Bar / in-page push | Sticky overlay that covers the UI and cannot be dismissed |
| Browser push notifications | Follows the user off-site |
| Interstitial / full-page | Blocks the content the user came for |
| Top-window redirect | What broke the site on 2026-08-01 |

Only two formats are permitted:

1. **In-content native banner** (Adsterra `nativeBanner`), inside the sandboxed
   iframe described in Rule 3.
2. **Smartlink**, as a plain `<a href>` the user chooses to click.

If a network only pays well on a banned format, we do not use that network.
Do not add `VITE_*_POPUNDER_URL`, `VITE_POP_SCRIPT_URL`,
`VITE_SOCIAL_BAR_SCRIPT_URL`, `VITE_*_PUSH_*`, or any equivalent — not to
`.env.example`, not to Cloudflare/Vercel env settings, not "temporarily to test".

## Rule 3 — EVERY ad iframe stays sandboxed.

This is the fix that actually stopped the 2026-08-01 hijack, and it is the one
most likely to be undone by accident.

Ads run inside `<iframe src="/adframe.html?...">`. `/adframe.html` is
**same-origin**, so without a sandbox the ad network's `invoke.js` has full
access to our page: it can set `window.top.location` (the bulsis.net redirect),
inject a Social Bar into the parent DOM, and attach click listeners to the
*whole site* so any click anywhere fires a popunder. A CSP does not stop any of
that — `default-src 'none'` on `/adframe.html` was already in place and the
hijack happened anyway.

`src/components/ads/AdsterraBanner.jsx`:

```js
const AD_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
```

| Granted | Why |
| --- | --- |
| `allow-scripts` | The tag has to run to draw an ad |
| `allow-popups` | A real click on the creative opens the advertiser — this is how we get paid. Safe, because the frame only sees clicks inside its own ~250px box; it cannot see clicks on the rest of the site |
| `allow-popups-to-escape-sandbox` | The advertiser's own page loads normally |

| **Never granted** | What it would let the ad do |
| --- | --- |
| `allow-same-origin` | Reach `window.parent`'s DOM → inject a Social Bar, listen for clicks site-wide, read our storage |
| `allow-top-navigation` / `-by-user-activation` | Set `window.top.location` → redirect the whole tab, which is exactly what broke the site |
| `allow-modals` | `alert`/`confirm` spam from the ad frame |

Every `<iframe>` in `AdsterraBanner.jsx` must carry `sandbox={AD_SANDBOX}`. If
you add a new ad component, it renders through `AdsterraBanner` — do not create
a second, unsandboxed path.

## Rule 4 — the fastest rollback is deleting a key.

If a zone starts serving something bad, delete its line from
`src/config/ads.js` and redeploy. Adsterra has no delete function for ad units
(confirmed by their support), so a zone that goes bad can only be abandoned,
never repaired. Request a fresh zone to replace it.

---

## If it happens again — 60-second triage

1. **Confirm the vector.** Does the URL bar change (top-nav hijack), or does a
   new tab/window appear (popunder), or does an overlay cover the page
   (social bar)? The redirect URL itself (`bulsis.net`, etc.) identifies the
   offending campaign.
2. **Kill it at the source.** Delete the offending zone key from
   `src/config/ads.js`, run `npm run check:ads`, redeploy. Minutes, not hours.
3. **Then** work out which zone/network it was in the Adsterra dashboard.

Do **not** "fix" it by loosening the sandbox or by moving the ad somewhere else
on the landing page.

## Checks

```bash
cd apps/frontend
npm run check:ads     # rules 1–3; also runs on npm run build
```

The check lives in `apps/frontend/scripts/check-ads.mjs`. If you legitimately
need to change what it enforces, change the rules in this document first and
say why — the script is downstream of this file, not the other way around.
