# Truegle for Android

A Capacitor shell that bundles the web build (`apps/frontend/dist`), so it opens and works offline
(guide, Trail, Game Boy games, map tiles you've viewed, saved lists). No Google services, no Firebase,
no tracking. API calls go to `https://api.truegle.info` (the backend must allow the origin `https://localhost`).

Build (needs JDK 21 + Android SDK) — or just run the "Android APK" GitHub workflow:

    npm install
    npm run sync        # builds the web app and copies it into android/
    npm run apk         # android/app/build/outputs/apk/debug/app-debug.apk

Distribution, $0: GitHub Releases (Obtainium), IzzyOnDroid, then F-Droid (needs a release-signing key).
