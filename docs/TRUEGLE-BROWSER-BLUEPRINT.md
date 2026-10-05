# Truegle Browser — Protected Browsing Blueprint

**Version:** 1.1 · 2026-10-05 (cost research folded in — see §10)
**Purpose:** a self-contained brief for the owner and a cost-research AI.
It covers how Truegle can protect users when a site cannot be shown inside
Truegle and they would otherwise leave for their normal browser. It lays out
every realistic way to do this, what each one actually protects, what it costs
to run, and an order to build them in.

> **For the reviewing AI:** Truegle has a **$0 budget**. It earns no money: no
> ads (permanent policy), no revenue model. It is a privacy-first alternative
> to big-tech search. Any recurring cost must be justified. Your job is to find
> the cheapest *honest* way to do each phase below. Every price in this file is
> approximate and must be checked against the provider's current pricing
> before anyone pays anything. Section 9 lists the specific questions to
> answer.

---

## 1. The problem in one paragraph

Truegle shows search results, videos and pages **inside its own app**, using
iframes. Many sites refuse to be shown inside another site. They send an
`X-Frame-Options: DENY` header or a `Content-Security-Policy: frame-ancestors`
rule, and the browser then shows a blank box. The browser does not tell
Truegle this happened (that's deliberate: it prevents "clickjacking" attacks).
Google, YouTube pages, Facebook, Instagram, X, Reddit, TikTok, LinkedIn, most
banks and most big news sites all do this. Truegle keeps a list of them in
`apps/frontend/src/utils/embeddable.js` and shows "Opens on <site>" instead of
a broken preview. When the user taps it, they leave Truegle. From then on
they are in their ordinary browser, with that site's trackers, cookies,
fingerprinting and ads, which is exactly what Truegle exists to protect
them from.

**Goal:** the user never has to leave Truegle's protection to visit a page.

## 2. The key technical fact that shapes everything

`X-Frame-Options` and `frame-ancestors` **only apply to frames.** A page
loaded as the *main* page of a browser window, including the built-in
browser view inside a native phone or desktop app, is not a frame, so these
headers do not apply.

That means there are only three ways to show a "frame-blocked" site under
Truegle's protection:

| # | Approach | Where the page actually runs | Gets past frame-blocking because… |
|---|---|---|---|
| A | **Native Truegle app with a built-in browser** | On the user's own device | The page is a top-level page in the app's own WebView, not a frame |
| B | **Remote Browser Isolation (RBI)**, using Playwright/Puppeteer | On a Truegle server | The page runs in a real browser on the server; the user only receives a video/picture of it |
| C | **Rewriting proxy** | On the user's device, but fetched through a Truegle server that strips the blocking headers | The proxy deletes the headers before the browser sees them |

There is no fourth option. A website (PWA) alone cannot do this: the browser
enforces the rule, and a web page cannot turn it off.

## 3. What "protection" really means: be precise with users

No single approach protects against everything. Truegle's brand depends on
never over-claiming (see the privacy-truthfulness decision of 2026-09-29), so
the product copy must say exactly what each mode does.

| Threat | A. Native app browser | B. Remote isolation | C. Rewriting proxy |
|---|---|---|---|
| Ad/tracker scripts (Google Analytics, Meta Pixel…) | ✅ Blocked by blocklists | ✅ Blocked on the server | ⚠️ Partly; scripts may be stripped or broken |
| Third-party cookies / cross-site tracking | ✅ Per-site storage, cleared on exit | ✅ Throw-away browser per session | ⚠️ Cookies pass through the proxy |
| Browser fingerprinting (device, screen, fonts, GPU) | ⚠️ Can be reduced, not eliminated | ✅ Site sees the *server's* browser, not the user's device | ❌ Site sees the user's real browser |
| The site learning the user's **IP address / location** | ❌ Site sees the user's IP (unless a VPN/proxy is added) | ✅ Site sees Truegle's server IP | ✅ Site sees Truegle's server IP |
| Malware / exploit pages | ⚠️ Normal browser sandbox | ✅ Code never runs on the user's device | ❌ Runs on the user's device |
| Truegle itself seeing what the user does | ✅ Truegle sees nothing | ❌ **Truegle's server sees everything, including anything typed (passwords)** | ❌ Truegle's server sees all traffic |
| Works with logins, video, audio, captchas | ✅ Fully | ⚠️ Logins risky, video costly, many captchas (datacenter IP) | ❌ Often breaks modern sites |
| Server cost per user | **$0** | **Highest** (a whole browser per active user) | Low–medium (bandwidth) |

**Honest summary:**
- **A** protects against *tracking* at zero server cost, but not against the site knowing your IP.
- **B** is the strongest isolation, but it is expensive, and it moves trust *to Truegle*: the server sees everything.
- **C** is cheap but fragile, and its protection is weak.

## 4. Where Truegle stands today (verified 2026-10-05)

- **Frame-blocked sites:** listed in `utils/embeddable.js`. The UI honestly says "Opens on <site>" and sends users away.
- **"Anonymous View" (Morty proxy, an example of approach C): DEAD, but still wired up.**
  - The production backend has `SEARXNG_RESULT_PROXY_URL` / `_KEY` set, so **every** search result (133 of 133 in a test query) carries a `proxyUrl` of `http://44.236.219.63:3001/?mortyurl=…`.
  - That is **plain HTTP to the bare EC2 IP**: unencrypted, and it advertises the server address in every API response.
  - The port does not answer (20 s timeout), and `anon.truegle.info` was never set up.
  - The frontend stopped showing the "View anonymously" button, so no user is harmed; the links are dead weight.
  - Morty is also unmaintained, and it strips JavaScript, so most modern sites break through it anyway.
- **Hosting available at $0:**
  - Cloudflare Pages: frontend.
  - Vercel: backend. Serverless, so it **cannot** hold a long-running browser or a WebSocket.
  - AWS t3.micro running SearXNG. 1 GB RAM, too small for even one headless Chrome to be reliable.
  - Oracle's always-free tier is already used up. There is no home hardware.
- **Install today:** Truegle is a PWA (installable website). There is no app-store app.

## 5. The approaches in detail

### A. Native Truegle app with a built-in protected browser ⭐ recommended first

**What it is:** Truegle as a real app (Android, iOS, Windows/Mac/Linux). It
still shows the same truegle.info interface, but when a result can't be framed,
it opens in **Truegle's own browser tab inside the app** instead of kicking
the user out to Chrome or Safari.

**Protection built into that tab:**
- Ad and tracker blocking from EasyList and EasyPrivacy, which are free blocklists.
  - Android: intercept requests (`shouldInterceptRequest`), or use GeckoView's built-in Enhanced Tracking Protection.
  - iOS: Apple's native `WKContentRuleList` content blocker, which is fast and runs in the system.
  - Desktop: Brave's `adblock-rust` engine (MPL-2.0), or Electron's `session.webRequest`.
- Separate, throw-away storage per site, wiped when the tab closes ("Fire button" style).
- HTTPS-only mode, the referrer stripped, and tracking parameters (`utm_*`, `fbclid`, `gclid`…) removed from links.
- A Global Privacy Control signal sent, and third-party cookies blocked.
- Optional later: route the tab through a proxy or VPN to hide the IP (this costs money; see B and C).

**Ways to build it, cheapest first:**

| Option | Platforms | Engine | Effort | Notes |
|---|---|---|---|---|
| **Capacitor** (MIT) wrapping the existing site, plus a native "protected tab" plugin | Android + iOS | System WebView / WKWebView | Low–medium | Reuses 100% of the current React app. Most likely best fit. |
| **Tauri 2** (MIT/Apache) | Desktop + mobile | System WebView | Medium | Small downloads (a few MB); Rust back end. |
| **Electron** (MIT) | Desktop | Bundled Chromium | Low | Large downloads (~100 MB), but the most control over requests. |
| **GeckoView** (MPL-2.0) inside an Android app | Android | Firefox engine | Medium | Mozilla's tracking protection is built in. |
| **Fork an existing open-source privacy browser** | Varies | Varies | **High ongoing** | e.g. DuckDuckGo's apps (Apache-2.0), Cromite (GPL-3.0). Most features for free, but a *browser fork* needs security updates every few weeks, forever. Not recommended for a solo, $0 project. |

**Constraints to know:**
- **iOS:** outside the EU, every iOS browser *must* use Apple's WebKit engine. That's fine for this plan; it means using WKWebView.
- **A WebView is not a full browser.** No extensions; some sites (notably Google sign-in) refuse logins from embedded WebViews. For those, offer "Open in your browser" as an honest fallback.
- **Distribution:**
  - Google Play: ~$25 once (verify).
  - Apple App Store: ~$99 per year (verify).
  - Free routes: direct APK download from truegle.info, F-Droid (free, but requires fully open-source builds), GitHub Releases for desktop.
  - iOS has no free route for the public.
  - **Every one of these is a spend decision for the owner.**

**Server cost:** **$0.** Browsing happens on the user's device.

### B. Remote Browser Isolation (RBI): the Playwright / Puppeteer idea

**What it is:**
1. Truegle runs real Chromium or Firefox browsers on a server.
2. When the user opens a site, a fresh, throw-away browser on the server loads it.
3. The user sees a live **video stream** of that browser, and their taps and keystrokes are sent back to it.

The site never touches the user's device.

```
 User's phone/PC                  Truegle isolation server
┌──────────────────┐   WebRTC    ┌────────────────────────────────┐
│ truegle.info     │◀── video ───│ Throw-away browser (container) │──▶ the website
│  <video> viewer  │─── input ──▶│  • blocklists on               │
│                  │  (taps,     │  • no saved profile            │
└──────────────────┘   keys)     │  • killed after N min idle     │
                                 └────────────────────────────────┘
```

**Two ways to build it:**

1. **Use an existing open-source isolation server.**
   - **neko** (`m1k1o/neko`, Apache-2.0): Docker images of Chromium or Firefox, streamed over WebRTC with audio. This is the closest ready-made fit.
   - Kasm Workspaces Community Edition: free tier with a session limit; **check its licence and commercial terms.**
   - Browserless: source-available; **check its licence, because commercial use may need a paid licence.**
2. **Build it with Playwright or Puppeteer** (both Apache-2.0), using Chrome's DevTools protocol:
   - `Page.startScreencast` streams JPEG frames; `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent` send input.
   - Simple, but **there's no audio**, it's choppy for video, and it takes more bandwidth than WebRTC.
   - Fine for reading articles; poor for media.

**Illustrative skeleton (untested; shows the shape, not production code):**

```js
// rbi-server.mjs — one throw-away browser per WebSocket connection
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';

const browser = await chromium.launch({ args: ['--no-sandbox-is-NOT-ok-use-a-container'] });
new WebSocketServer({ port: 8080 }).on('connection', async (ws, req) => {
  const target = new URL(req.url, 'http://x').searchParams.get('u');
  if (!isPublicHttpsUrl(target)) return ws.close();          // SSRF guard, see below
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // no storage kept
  await ctx.route('**/*', (r) => (isBlocked(r.request().url()) ? r.abort() : r.continue())); // blocklists
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => { ws.send(data); cdp.send('Page.screencastFrameAck', { sessionId }); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 2 });
  await page.goto(target);
  ws.on('message', (m) => { const e = JSON.parse(m); if (e.t === 'tap') page.mouse.click(e.x, e.y); if (e.t === 'key') page.keyboard.press(e.k); });
  const kill = () => ctx.close().catch(() => {});
  ws.on('close', kill); setTimeout(kill, 10 * 60_000);       // hard session cap
});
```

**Resource sizing** (rule-of-thumb figures; the reviewing AI should confirm them):
- Each *active* session: roughly 300–600 MB RAM and 0.25–1 vCPU, more for video-heavy pages.
- Bandwidth: roughly 0.5–3 Mbps per active viewer while the screen changes.
- A 4 GB / 2 vCPU server therefore handles roughly **4–8 simultaneous users**. Idle users must be disconnected aggressively.
- A queue ("Isolated view is busy, you're #3") keeps cost fixed no matter how many people use it.

**Hard problems, which must be solved before launch, not after:**
1. **Server-side request forgery (SSRF).** Users can type *any* URL, including Truegle's own internal addresses and the cloud metadata service (`169.254.169.254`).
   - Block every private and reserved address range: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7.
   - Check **after DNS lookup**, because a hostname can resolve to an internal address (a "DNS rebinding" attack).
   - Run each browser in a network-isolated container whose only route out is the public internet.
2. **Abuse comes from Truegle's IP.** Anything a user does (spam, attacks, illegal content) appears to come from Truegle's server.
   - This needs rate limits, a domain blocklist, a terms-of-use page, and an abuse-contact address.
   - Hosting providers will suspend a server that generates abuse complaints.
3. **Datacenter IPs get captchas and blocks.** Google, Cloudflare-protected sites and many shops treat server IPs as bots. Expect frequent "verify you are human" pages.
4. **Logins and passwords.** Everything the user types passes through Truegle's server. Recommended: **disable or strongly warn on password fields** in isolated mode, and say so in the privacy policy.
5. **Copyright and site terms.** Streaming a rendered copy of a site is a grey area for some sites (especially paywalled ones). Do not use it to bypass paywalls.
6. **Container escape.** The browser is processing hostile pages. Run it as an unprivileged user in a container, never with `--no-sandbox` on the host, and keep Chromium updated weekly.

**Server cost:** this is the *only* approach with a real recurring cost that grows with users.
- A small VPS, for example a Hetzner-class 2 vCPU / 4 GB at roughly €4–8 per month (**verify**).
- Or Cloudflare's Browser Rendering, which has a small free daily allowance (**verify current limits**). That product is built for automation and screenshots, not interactive streaming, so it may not fit.
- **This is a spend decision for the owner.**

### C. Rewriting proxy

**What it is:** Truegle fetches the page on the user's behalf, deletes the
frame-blocking headers, rewrites every link to also go through Truegle, and
hands the result back. Morty, the dead "Anonymous View", was this.

**Modern open-source versions** use a Service Worker that rewrites
requests in the browser, plus a small relay server. Examples are Titanium
Network's Ultraviolet and Scramjet, and Wisp (**verify each licence**). They
handle far more of the modern web than Morty did.

**Why it is last:**
- Protection is weak. The site's JavaScript still runs on the user's device and can fingerprint it.
- It breaks logins, payments and many large sites.
- Removing anti-framing headers re-opens the clickjacking risk those headers exist to prevent.
- These tools are best known for dodging school and workplace filters, which attracts abuse traffic and hosting complaints.

**What it is good for:** a cheap "reader view" of simple pages (articles, docs, recipes) that hides the user's IP.

**Server cost:** low.
- Mostly bandwidth.
- Could run on the existing AWS box, or a Cloudflare Worker for the relay. **Check Cloudflare's terms on proxy use.**

## 6. Recommended build order

| Phase | What | Server cost | One-off cost | Solves |
|---|---|---|---|---|
| **0** ✅ DONE 2026-10-05 | Remove the dead Morty proxy links from the backend (or put Morty behind HTTPS and bring it back). Stop advertising the EC2 IP in every response. | $0 | $0 | Hygiene / honesty |
| **1** | **Truegle app** (Capacitor recommended), with a built-in protected browser tab: blocklists, wipe-on-close storage, HTTPS-only, tracking-parameter stripping. Frame-blocked results open *inside the app*. | **$0** | $0 sideload / ~$25 Play / ~$99/yr Apple (owner decides) | ~90% of "users have to leave Truegle" |
| **2** | **Isolated View pilot (RBI)**, opt-in only. One small server running neko or a Playwright build. Strict session caps, a queue, SSRF guard, passwords disabled. Offered on the web too, for people who won't install the app. | ~€4–8/mo (verify) | $0 | The strongest isolation, IP hiding, desktop-web users |
| **3** | Optional IP hiding for the app's browser tab (a relay or proxy). Scale isolation only if usage justifies it. | Grows with use | — | IP privacy without full isolation |

**Why this order:** Phase 1 costs nothing to run, fixes the actual complaint
(being forced to leave), and its protection claim is fully honest. Phase 2 is
the Playwright idea; it is genuinely valuable, but it is the only phase whose
bill grows with every user. So it should start as a capped, opt-in pilot.

## 7. What changes in the existing code (for whoever builds it)

- `apps/frontend/src/utils/embeddable.js`: today "refuses framing" means "send away". It becomes: in the app, open in the protected tab; on the web, offer "Isolated view" (Phase 2) or "Open on <site>".
- Add a platform check (`window.Capacitor?.isNativePlatform()`) to decide which option to offer.
- `apps/backend/services/SearchService.js`: `buildResultProxyUrl`, plus the `SEARXNG_RESULT_PROXY_*` environment variables. Removed in Phase 0.
- The privacy policy, `llms.txt` and the About page each gain an exact paragraph per mode (section 3's table, in plain words).
- `scripts/check-ads.mjs` keeps running. Blocklists in the app must never be paid "acceptable ads" lists.

## 8. Decisions only the owner can make

1. Which platforms come first? (Android only is cheapest and fastest.)
2. App store or not? Google Play is ~$25 once; Apple is ~$99/yr; a direct APK download is $0.
3. Is the Phase 2 isolation server worth a small monthly bill, and what is the hard monthly cap?
4. In isolated mode: block password fields entirely, or warn and allow?
5. What to call it in the product: "Truegle Browser", "Protected tab", "Isolated view", or "Surf safely"? (This fits "Surf Engine" under the logo.)

## 9. Questions for the cost-research AI

1. What is the cheapest reliable host (current prices) for **4–8 simultaneous** headless Chromium sessions? That is 2–4 vCPU, 4–8 GB RAM, and 1–5 TB of monthly traffic. Include any truly free tiers that allow a long-running process and WebSockets/WebRTC. (Oracle always-free is already used; AWS free tier's 1 GB is too small.)
2. Do Cloudflare Browser Rendering, Fly.io, Railway, Render or similar free tiers allow an *interactive* streamed browser session, and what are the exact limits?
3. What are the current licence terms of neko, Kasm Community Edition and Browserless for a non-profit public service? Which can be used at $0?
4. Is there any route to publish on Google Play or the Apple App Store for less than the standard fees (non-profit or fee-waiver programmes)?
5. For WebRTC streaming, is a TURN relay needed, and what does it cost? Are there free public options (for example, self-hosting `coturn` on the same box)?
6. What is the cheapest way to add IP hiding to the app's browser tab (Phase 3) without logging user traffic?
7. Are there grants, credits or open-source sponsorship programmes (cloud provider credits for non-profits or open source) that would cover Phase 2 hosting at $0?

---

*Maintained in `docs/TRUEGLE-BROWSER-BLUEPRINT.md`. Status and decisions are tracked in the agent memory thread `truegle-browser`.*

---

## 10. Cost research results (owner's research AI, 2026-10-05) and review

**Phase 0 is DONE (2026-10-05).** The proxy links were removed from all search
results (verified on production: 122 results, 0 proxy links). The code was
deleted, and a guard test was added (`apps/backend/__tests__/noDeadProxyLinks.test.js`).
The two Vercel settings were blanked and labelled RETIRED. The owner deletes them in
the dashboard; the Vercel connector cannot delete settings.

The research agrees with this blueprint's order: **native app first, isolation
server only as an optional, capped pilot.**

| Topic | Research finding | Review / correction |
|---|---|---|
| Isolation host | Hetzner CX22 (2 vCPU/4 GB) ~$5–7/mo for a few light sessions; 4–8 sessions needs 4 vCPU/8 GB, ~$12–20/mo. No free tier fits. | Agreed. Start on the smallest box with a hard cap of 2–3 sessions plus a queue. |
| Cloudflare / Fly / Railway / Render | Not viable (Cloudflare free: 10 browser-min/day, 3 concurrent). | Agreed. |
| neko | Apache-2.0, free for any use. | **Chosen** for Phase 2 if it happens. |
| Kasm CE / Browserless | Non-commercial terms and limits. | Skip: neko avoids the licence question entirely. |
| Apple $99/yr | Waived for non-profits. | ⚠️ The waiver is for a **legally registered** non-profit (with a D-U-N-S number), not just a project without revenue. Only applies if Truegle is incorporated as one. |
| Google Play $25 | Not waived. | Not needed at first: a direct APK download from truegle.info is $0. |
| TURN relay (Phase 2) | Self-host `coturn` (free), or Cloudflare TURN (1,000 GB/mo free). | `coturn` on the same box as neko: $0 extra. |
| IP hiding (Phase 3) | Free third-party SOCKS5 proxies (e.g. browser-extension proxies). | ❌ **Rejected.** A third party would see every user's traffic, which is the opposite of the product. Phase 3 is self-hosted only. |
| Credits | AWS Activate, Google for Startups, Azure OSS, Netlify OSS. | Useful only as a *temporary* subsidy, and credits expire. Netlify is irrelevant (Cloudflare Pages already hosts for free). Never build anything that only works while credits last. |
| Paid tier / donations for Phase 2 | Suggested. | Owner's call (product decision). Donations are compatible with the no-ads policy; ads are not. |

**Phase 1 build route, cost $0:**
- Capacitor wrapping the existing frontend.
- A native protected-tab plugin on Android.
- The APK built for free by GitHub Actions and offered as a direct download from truegle.info.
- iOS waits, for the waiver or a decision to pay.
