# Ad Network Signup & Wiring Checklist

Scaffolding to A/B test additional ad networks alongside Adsterra. This is the
**developer-prep** half — the config registry (`apps/frontend/src/config/adNetworks.js`)
is in place and A/B-ready, but **nothing is wired into rendering and nothing is
deployed.** Each network stays dark until its account is approved, its codes are
pasted into the env vars below, and it's enabled.

## What the AI dev can and can't do

- ✅ **Done:** `config/adNetworks.js` with format-specific keys per network,
  env-driven, disabled-by-default, plus readiness + A/B-bucket helpers.
- ✅ **Done:** this checklist (env-var map + per-network steps).
- ❌ **Cannot be automated — owner action:** creating the publisher accounts.
  Signup requires your identity/email confirmation, KYC + payment details, and
  accepting each network's terms; the real ad codes are only issued after a
  human approves the account. There is no honest way to pre-fill those codes.

## Signup facts to reuse

- **Site URL:** `truegle.info`
- **Description:** privacy-focused search engine + alternative news/research platform
- **Monthly visitors (current):** ~3,000
- **Contact email:** `truegleai@proton.me`
- **Live pages to cite:** `/about`, `/privacy`, `/terms`, `/advertise`, `/blog`

## Priority order

| # | Network | Traffic req | Why | Signup |
|---|---------|-------------|-----|--------|
| 1 | HilltopAds | ~500/day | Approves edge content, fast approval, good CPM | hilltopads.com → Sign Up → Publisher |
| 2 | Ghost | none | Privacy-first, 75% rev share, on-brand (beta: 100% for 3mo) | ghostads.io/signup (early access) |
| 3 | PropellerAds | none | Beginner-friendly, wide formats (KYC before payout) | propellerads.com → I am a Publisher |
| 4 | Media.net | ~5–10k/mo | Contextual (Yahoo/Bing), US/UK/CA English traffic | media.net → Publishers → Apply |
| 5 | EthicalAds | 50k+ pv | Contextual, no tracking, dev audience (long-term) | ethicalads.io/publishers |

> Ezoic (~1k+ sessions) and RevContent (50k+) are on the roadmap but need GA4
> history / more traffic first — not scaffolded yet. Add them the same way when
> they're in reach.

## After approval: paste codes into these env vars

Set on the frontend host (Cloudflare Pages / Vercel build env). A network only
serves when `VITE_<NET>_ENABLED=true` **and** the relevant zone value is set.
Leave both unset to keep it dark.

### 1. HilltopAds
```
VITE_HILLTOPADS_ENABLED=true
VITE_HILLTOPADS_POPUNDER_URL=   # full <script src> URL
VITE_HILLTOPADS_NATIVE_URL=
VITE_HILLTOPADS_PUSH_URL=
VITE_HILLTOPADS_BANNER_URL=
```

### 2. Ghost
```
VITE_GHOST_ENABLED=true
VITE_GHOST_SCRIPT_URL=          # the single <2KB script tag src
VITE_GHOST_PUBLISHER_ID=
```

### 3. PropellerAds
```
VITE_PROPELLERADS_ENABLED=true
VITE_PROPELLERADS_POPUNDER_URL=
VITE_PROPELLERADS_PUSH_ZONE=    # zone id
VITE_PROPELLERADS_NATIVE_URL=
VITE_PROPELLERADS_INTERSTITIAL_ZONE=
```

### 4. Media.net
```
VITE_MEDIANET_ENABLED=true
VITE_MEDIANET_CID=              # customer id
VITE_MEDIANET_DISPLAY_CRID=     # per-slot crid
```

### 5. EthicalAds
```
VITE_ETHICALADS_ENABLED=true
VITE_ETHICALADS_PUBLISHER_ID=
```

## Wiring a network into rendering (separate, later step)

When you're ready to actually A/B test a network in production (not part of this
prep):

1. Confirm readiness in code: `isNetworkReady('hilltopads', 'native')`.
2. Pick a network per slot with `pickNetworkForSlot('native', sessionId)` (stable
   per visitor) — or hard-assign a % split.
3. Render its zone by type: `script` → inject `<script src>`; `key`/`id` →
   the network's documented embed. Keep it behind the same ad-consent gate
   Adsterra uses (`window.__truegle_ad_consent !== false`).
4. Compare eCPM against Adsterra before shifting more traffic.

## Cost / privacy notes

- All networks above are **free to join** — no spend, consistent with the $0 budget.
- Ghost and EthicalAds are cookieless/no-tracking and fit the brand best; prefer
  them for in-content/display. HilltopAds/PropellerAds popunders are higher-CPM
  but aggressive — gate them like the existing Adsterra popunder
  (`VITE_ENABLE_POPUNDER`) and watch for off-brand/adult creative.
