# Session handoff — 2026-11-28 — put the Android APK on the owner's phone (adb), then auto-update

Start the new LOCAL session in this repo (`o87enterprises-ai/TruegleSearch`, branch from `main`). Read `CLAUDE.md`
and the top of `HANDOFF.md` first (memory digest auto-loads). This file is the brief for the one task below.

## The task (owner's words, 2026-11-28)
"We were working on an autoupdate feature for the android apk and I'd like to adb it to the phone that's
currently plugged into the laptop."

The cloud session could NOT do this: `adb` has to run on the laptop the phone is plugged into, and the laptop
(ChelleShock; folders `optimo-dash`, `o87DevMobile`) was listed but "not available to cloud sessions". A local
session has the phone and `adb` directly.

## Step 1 — install the newest published APK on the phone (no code needed)
- Newest release: **`android-v0.2.3`** (2026-11-21), asset `truegle.apk`. App id **`info.truegle.app`**,
  `versionName 0.2.3`, `versionCode 203` (`apps/android/android/app/build.gradle`).
- DEBUG-signed. A fresh install is fine. If an older Truegle build from a different signing key is on the phone,
  `adb install -r` fails with a signature mismatch: `adb uninstall info.truegle.app` first (this wipes app data).
- Needs: USB debugging on, phone authorised (tap Allow on the phone's prompt if `adb devices` says `unauthorized`).

```bash
adb devices
curl -L -o truegle.apk https://github.com/o87enterprises-ai/TruegleSearch/releases/download/android-v0.2.3/truegle.apk
adb install -r truegle.apk
adb shell monkey -p info.truegle.app -c android.intent.category.LAUNCHER 1
```

To install a build from the CURRENT `main` instead (newer than 0.2.3), build it locally (needs JDK 21, Android SDK):
```bash
npm ci && npm --prefix apps/frontend run build
npm --prefix apps/android install --no-audit --no-fund
(cd apps/android && npx cap sync android)
(cd apps/android/android && chmod +x gradlew && ./gradlew assembleDebug)
adb install -r apps/android/android/app/build/outputs/apk/debug/app-debug.apk
```
(Same steps as `.github/workflows/android.yml`.) Bump `versionCode`/`versionName` in `build.gradle` if you
want Android to treat it as an update.

## Step 2 — the "auto-update feature": it does NOT exist in the repo
Checked 2026-11-28 against `origin/main` `7294cd1`: no update-check code anywhere, no branch, no PR. The only
update-adjacent file is `apps/frontend/src/utils/apk.js` (a download link: `APK_URL` =
`.../releases/latest/download/truegle.apk`). Merged Android work: #172 shell, #186/#187 download offer + icon,
#189 PiP + encyclopedia save fix, #193 version 0.2.3. So whatever was started earlier never got pushed.
Ask the owner what they remember before building. Options, smallest first:
1. **Obtainium** (no code): the owner/phone add the GitHub repo; it polls Releases and installs updates. The
   workflow already attaches `truegle.apk` to `android-v*` tags for this.
2. **In-app "update available" prompt** (small): on launch compare `versionName` (via the Capacitor App plugin)
   with `https://api.github.com/repos/o87enterprises-ai/TruegleSearch/releases/latest` (`tag_name`
   `android-vX.Y.Z`), and offer to open `APK_URL`. Android does NOT allow silent installs for a sideloaded
   app: the user always confirms the system installer (and must allow "install unknown apps" for the app).
3. **Web-layer banner**: same comparison in the frontend using `window.Capacitor` (see how `apk.js` and
   `AppOffer.jsx` detect the native app), no native code.
Constraints to respect: updates only install over the same signing key. The APK is DEBUG-signed; making a
release keystore later forces everyone to reinstall once (HANDOFF line on APK; add its SHA-256 to
`public/.well-known/assetlinks.json`). Privacy rules apply (CLAUDE.md): no tracking; a GitHub Releases poll sends
no user data but say so.

## Known problems to be aware of
- **GitHub Actions is billing-locked**: the "Android APK" workflow runs on pushes/tags show `failure` with no
  failed step (the job never runs). Releases are therefore built by hand and uploaded. Do not "fix" the
  workflow; the cause is billing, not code.
- The Vercel status check fails on every PR ("Account is blocked"); not code, ignore it. Live backend is
  **Render** (`api.truegle.info`); Vercel is blocked standby. Repo rule: new env vars go on BOTH hosts and in the
  HANDOFF switch-back checklist.
- Not yet verified on a device (from HANDOFF): voice-note audio round trip, the new icon / landing modal on
  phones. A local session with the phone plugged in can check these while it is there.

## Other open items from this cloud session (not Android)
- **Search free tiers:** PR #143 (merged) added Wikipedia (key-free), Linkup and Firecrawl to
  `apps/backend/services/freeSearchApis.js`. Owner added `LINKUP_API_KEY` and `FIRECRAWL_API_KEY` on Render
  ("Save only"); PR #202 (merged 2026-11-28) was the deploy trigger. NOT yet confirmed from outside that the
  Render deploy finished or that the keys load; Linkup/Firecrawl/Wikipedia were never seen live in production
  (they only run when a page is thin and Serper > Tavily > Exa leave it short). Vercel does NOT have these keys.
  Tavily is already live on Render.
- **Search ranking:** #140/#141 (joined-brand search, brand domain first), #139 (accent folding, rarity
  weighting, video cap) are live. "rapid api sign up" now returns rapidapi.com pages first.
- **Guide offer:** #142 replaced the landing install popup with the Survivor's Encyclopedia offer (play Trail or
  sign in). Live.
- **Provider health:** the owner planned to run `node scripts/upstream-health.mjs` (needs DB access) or
  `GET /api/admin/upstream-health` (admin key) to see why Brave / Google CSE / NewsAPI / YouTube fail. On Render
  the Brave/Bing/SERP/Google keys are deliberately unset. Not read yet.
- Never put API keys in chat or commits; names only.
