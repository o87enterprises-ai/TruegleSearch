# 🔴 AD POLICY — Truegle carries no advertising

**Current rule, and the only one: Truegle serves no third-party ads.**
Removed in full on 2026-08-24. `npm run check:ads` enforces this and runs on
every `npm run build` — reintroducing an ad network fails the build.

---

## The decision

Truegle is no longer run on a profit/loss basis. It exists to give people an
alternative to the search monopoly. Advertising was the last thing pulling in
the other direction, so it is gone: no networks, no house ads, no smartlinks, no
affiliate ad units, no cookie banner asking permission to meter any of it.

This is not a pause. The previous policy tried to make advertising *safe* by
constraining it — no ads on the landing page, no popunders, mandatory iframe
sandboxing. That work succeeded on its own terms and the constraints held. But
the constraints existed because the underlying product was hostile, and the
revenue never justified continuing to manage it: at removal, Adsterra was
producing roughly **56 ad impressions per week** across all zones and cents per
month, while costing the incidents listed below.

## What was removed

| Layer | Gone |
| --- | --- |
| Frontend components | `AdsterraBanner`, `SponsoredAd`, `AdSlot`, `RewardAdSlot`, `AdColorWrapper`, `AdBanner` (×2), `AdCard` |
| Config | `config/ads.js`, `config/adNetworks.js`, `context/AdGeoContext.jsx` |
| Ad frame | `public/adframe.html` (the sandboxed same-origin tag host) |
| Consent UI | `ui/CookieConsent.jsx`, `ui/AdultConsentGate.jsx` |
| Backend | `routes/ads.js`, `services/GeoAdService.js`, `config/ad_zones.json`, the `/api/ads` mount |
| Seller declaration | `public/ads.txt` (a stale AdSense entry — AdSense itself was dropped 2026-06-17) |
| Tooling | `scripts/ad-verify.mjs` (Adsterra fill verification) |
| Pages | `/revenue-calc` (ad-revenue projection calculator) |
| CSP | every ad-network origin dropped from `public/_headers` |

`docs/AD-NETWORK-SIGNUP.md` and `tools/ad-distributor-cli/` are left in place as
historical reference. They are not wired to anything.

## Why it is enforced rather than just documented

The history is the argument. Each of these was a real production incident:

| Date | What happened |
| --- | --- |
| 2026-06-17 | Google rejected AdSense — display ads aren't allowed on search results |
| 2026-07-05 | An ungated zone served adult creative |
| 2026-07-20 | It happened again; zones pulled and reissued |
| 2026-08-01 | A landing-page tag hijacked the top window (redirect to `bulsis.net/go/…`). The site was unusable for every visitor until it was cut. CSP did not stop this — only the iframe sandbox did |
| ongoing | Adsterra has **no delete function for ad units, ever**. A zone that starts serving adult creative cannot be fixed, only abandoned |

A network reintroduced quietly, as a one-line import, brings all of that back.
The guard makes it a visible decision instead.

## What the guard checks

`apps/frontend/scripts/check-ads.mjs` fails the build if:

1. Any ad-network domain or tag plumbing appears in `src/` or `public/` —
   Adsterra's serving domains, AdSense, other networks, `window.atOptions`,
   `/invoke.js`, smartlinks, popunders, social bars.
2. Any of the deleted ad modules reappears on disk.

Comment lines are ignored, so documenting this history (as this file does) never
trips it.

## If advertising ever comes back

That is a product decision, not a code change. It would mean editing this file
and `check-ads.mjs` deliberately. If it happens, the two rules that were written
in blood still apply and should be restored first: **never** grant an ad iframe
`allow-same-origin` or `allow-top-navigation*`, and **never** put an ad on the
landing page.

## What replaced it

Nothing, on the revenue side. On the measurement side, Truegle now carries
Cloudflare Web Analytics (`src/utils/analytics.js`) — cookieless, no
fingerprinting, inert unless `VITE_CF_BEACON_TOKEN` is set, and skipped entirely
for visitors sending Do Not Track or Global Privacy Control.

Truegle now sets **zero cookies** and runs **zero ad tech**. That is why there is
no cookie-consent banner any more: there is nothing left to consent to.
