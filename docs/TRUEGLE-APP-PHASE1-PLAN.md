# Truegle App — Phase 1 Plan (native app + protected browser tab)

**Status:** PLANNED, not started. Owner, 2026-10-05: "do the plan and store it, don't execute yet."
**Parent:** `docs/TRUEGLE-BROWSER-BLUEPRINT.md` (Phase 1). Memory thread: `truegle-browser`.
**Planning assumption (owner, 2026-10-05):** Truegle is starting the process
to become a **registered non-profit**. The plan assumes the Apple Developer
fee waiver will be granted. Until it is, the iOS milestone waits; Android does
not depend on it.

---

## 1. Goal, in one sentence

When a result can't be shown inside Truegle, it opens in **Truegle's own
protected browser tab** instead of the user's normal browser, so people never
have to leave Truegle's protection to read a page.

**Out of scope for Phase 1:**
- Hiding the user's IP address (Phase 3).
- Remote isolation servers (Phase 2).
- Google Play listing.
- Any paid service.

## 2. Cost

| Item | Cost |
|---|---|
| Capacitor, Android SDK, Gradle, Xcode tools | $0 (open source / free) |
| Building the app: GitHub Actions | **$0**. The repo is public, and public repos get free build minutes, including macOS runners for iOS. |
| Android distribution: direct APK download (GitHub Releases + a link on truegle.info) | $0 |
| Google Play | **Not used** ($25). Can be added later. |
| Apple Developer Program | $0 **if** the non-profit fee waiver is granted; otherwise $99/yr (owner decision, flagged per the $0 budget). |
| Blocklists (EasyList / EasyPrivacy / similar) | $0. Check each list's licence (EasyList is GPL-3 / CC BY-SA). |
| Servers | **$0.** Browsing happens on the user's device. |

## 3. Key design decisions (recommended, with the reasoning)

### D1. The app loads the live site (`https://truegle.info`), not a bundled copy
Capacitor can either bundle the built frontend inside the app or point the
app's main view at the live site. **Recommended: point at the live site.**
- **YouTube keeps working.** YouTube embeds check the page's origin and
  referrer. A bundled app runs from `https://localhost` or `capacitor://localhost`,
  and YouTube refuses those (Error 153). The live site already works.
- **No backend changes.** The backend only accepts calls from `truegle.info`
  (CORS allow list in `apps/backend/server.js`). A bundled app would need
  `localhost` origins added.
- **Every fix ships instantly.** A Cloudflare Pages deploy updates the app;
  no new APK is needed except for native changes.
- **Cost:** the app needs internet to start, which a search engine needs anyway.
- **Risk (iOS only):** Apple can reject "a website in a wrapper" (App Review
  guideline 4.2). The native protected tab, share target and deep links are
  the real native features that answer this. If Apple still objects, iOS
  switches to bundled mode and the YouTube-origin problem gets solved then.

### D2. The protected tab is the system WebView, not a bundled browser engine
- **Android:** a native screen (Activity) with Android's WebView.
- **iOS:** `WKWebView`.

That gives small downloads (roughly 5–10 MB) and security updates delivered by
the phone's OS. GeckoView (Firefox's engine, with its tracking protection
built in) is the fallback if the WebView proves too limited. It costs a
roughly 60–80 MB app, and Truegle would have to ship engine updates itself.

### D3. Links are caught in one place, not edited across the code
There are around 33 files with `target="_blank"` links and around 16
`window.open(…)` calls. Instead of editing each one, add **one small module**,
active only inside the app:
- A click listener catches any link that leaves truegle.info.
- `window.open` is replaced.

Both send the URL to the protected tab. On the web, nothing changes.

### D4. What "protected" means in the tab, stated exactly (for the privacy page)
| Protection | Android | iOS |
|---|---|---|
| Tracker/ad requests blocked (domain blocklist) | `shouldInterceptRequest` returns an empty response for listed hosts | `WKContentRuleList` (Apple's built-in content blocker) |
| Third-party cookies off | `CookieManager.setAcceptThirdPartyCookies(false)` | Default in WebKit (Intelligent Tracking Prevention) |
| Everything wiped when the tab closes | Clear cookies, storage and cache on close | `WKWebsiteDataStore.nonPersistent()`: never written to disk |
| Tracking parameters stripped (`utm_*`, `fbclid`, `gclid`, `mc_eid`, …) | Rewritten before load | Same |
| HTTPS upgrade | `http://` upgraded to `https://`; a warning page if HTTPS fails | Same |
| Global Privacy Control / DNT signal | Header on the top-level request (WebView limitation: not on every sub-request) | Same limitation |
| **Not** provided: hiding the user's IP | The site sees the user's IP, and the privacy page must say so | Same |

### D5. Google Safe Browsing inside the WebView: **owner decision**
Android's WebView has Google Safe Browsing **on** by default. It warns on
known malware and phishing pages by checking URL hash prefixes with Google.
- **Safety:** it catches dangerous pages.
- **Privacy:** it is a Google lookup, though a hashed and partial one.

Options:
- (a) Leave it on and disclose it.
- (b) Turn it off.
- (c) A setting, default on.

**Recommended: (c)**, disclosed on the privacy page.

## 4. Milestones (each one ends in something testable)

### M1. App shell (Android): opens Truegle
- Add Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) to `apps/frontend`, with `server.url = https://truegle.info`.
- App ID `info.truegle.app`; name "Truegle". Icons and splash screen from the existing brand assets (`design` skill: brand continuity).
- Android back button goes back in history and leaves the app at the landing page.
- **Done when:** the APK installs on a phone, opens Truegle, search and the Tube player work, and the back button behaves.

### M2. Protected tab (Android)
- A native plugin `ProtectedTab` with `open(url)` and a small top bar:
  - back / close
  - the page's address (read-only) plus a 🔒 "Protected" badge that explains what is and isn't protected
  - "Open in my browser" (honest fallback, e.g. Google sign-in refuses WebViews)
  - share
- Everything in D4 for Android. The blocklist is bundled in the APK and refreshed when the app updates.
- **Done when:**
  - A frame-blocked result (e.g. a news site) opens inside the tab.
  - A known tracker domain is blocked (visible in a debug counter).
  - Cookies are gone after close.
  - `utm_` parameters are stripped.

### M3. Wire the web app to the tab
- `src/utils/nativeLinks.js` (D3): only active when `window.Capacitor?.isNativePlatform()`.
- `utils/embeddable.js` "Opens on <site>": inside the app, the label becomes "Open protected"; on the web it is unchanged.
- Video, Tube and Feed links keep going to the universal player, never to the tab.
- **Done when:** a Playwright test with a fake `window.Capacitor` proves:
  - every external link and `window.open` call goes to `ProtectedTab.open`;
  - player links still go to the player;
  - the web build behaves exactly as it does today.

### M4. Build and release pipeline (free)
- `.github/workflows/android.yml`, on a tag `app-v*`:
  1. Java 21 and the Android SDK (both preinstalled on GitHub's Ubuntu runners).
  2. `npm ci`, then `npx cap sync android`, then `./gradlew assembleRelease`.
  3. Sign the APK, then attach it to a GitHub Release.
- **Signing key:** generated once by the owner and stored as GitHub Actions secrets:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

  🔴 **The repo is public: the keystore must never be committed.** If it is lost, existing installs can never be updated. Keep an offline backup; add it to `docs/SECRETS-MAP.md` by *name only*.
- The build prints the APK's SHA-256 checksum, and the download page shows it so users can verify the file.
- **Done when:** pushing a tag produces a signed APK on a public Release.

### M5. Download page and deep links
- Add a `/app` page on truegle.info:
  - a download button pointing at the latest Release;
  - the checksum;
  - "how to install an APK" steps (Android asks once to allow installs from the browser);
  - the exact protection list from D4.
- Android App Links: `public/.well-known/assetlinks.json` (served free by Cloudflare Pages), so `truegle.info/...` links open in the app when it's installed.
- Share target: "Share → Truegle" from other apps (the PWA manifest already has a `share_target`; mirror it natively).
- Update the install modal (it already offers Set to Home / Default Search) to offer "Get the app" on Android.
- **Done when:** the page is live, App Links verify (`adb shell pm get-app-links info.truegle.app`), and sharing a link into Truegle works.

### M6. iOS, once the Apple waiver is granted
- Add `@capacitor/ios`, with the same `server.url` (D1).
- `ProtectedTab` on iOS: `WKWebView`, `nonPersistent()` data store, and a blocklist converted to WebKit content-blocker JSON (max 150,000 rules per list) at build time.
- A GitHub Actions macOS runner builds it and uploads to TestFlight. That needs App Store Connect API key secrets, which the owner creates.
- App Review notes explain the native features (D1 risk).
- **Done when:** a TestFlight build installs on an iPhone and passes the M2/M3 checks.

### M7. Truthfulness pass (with every milestone, not at the end)
- The privacy policy, `llms.txt`, About, Settings and the `/app` page each state D4 exactly, including what is **not** protected (IP address) and the D5 Safe Browsing choice.
- `npm run check:ads` must keep passing. Blocklists must never be "acceptable ads" lists.
- Memory and HANDOFF updated.

## 5. Order and size (rough)

| Milestone | Depends on | Rough effort |
|---|---|---|
| M1 shell | — | small |
| M2 protected tab (Android) | M1 | **largest** (native Kotlin/Java) |
| M3 web wiring + tests | M1 | small–medium |
| M4 build pipeline | M1 + owner keystore | small |
| M5 download page, deep links, share | M4 | small–medium |
| M6 iOS | Apple waiver | medium |
| M7 truthfulness | each milestone | small, ongoing |

**Testing limits in the cloud container:** the Android build can run here or
in CI, but there is no phone emulator with real touch here. Every milestone
ends with a **real-device check by the owner**, given 2–3 steps at a time.

## 6. Owner tasks (given 2–3 at a time when the time comes)

1. **Before M4:** create the signing keystore (one `keytool` command, which will be provided) and add the four GitHub secrets. Keep an offline backup.
2. **Non-profit track:**
   - register the organisation;
   - get a free D-U-N-S number;
   - enrol in the Apple Developer Program and request the fee waiver.
3. **Decisions:**
   - D5, Safe Browsing (recommended: a setting, default on);
   - the in-product name: "Protected tab" / "Truegle Browser" / "Surf safely".

## 7. Risks

| Risk | Mitigation |
|---|---|
| Lost signing key: the app can never be updated | Offline backup; documented in SECRETS-MAP (name only) |
| Sideloaded APK looks scary to users ("unknown sources") | Clear install guide plus checksum; Play Store later if wanted |
| Google sign-in and some banks refuse WebViews | "Open in my browser" button, labelled honestly |
| Apple rejects as a web wrapper (4.2) | Native features (protected tab, share, deep links); bundled-mode fallback |
| WebView blocklist is coarser than uBlock Origin | Domain-level blocking catches most trackers; GeckoView is the upgrade path |
| Over-claiming protection | D4 table is the single source for all copy; M7 on every milestone |

## 8. Start command (for the session that executes this)

When the owner says go, start at **M1**. Work on the session branch, push it, and
fast-forward `main` as usual. Each milestone is its own commit, with its
test, and its owner check given 2–3 steps at a time.
