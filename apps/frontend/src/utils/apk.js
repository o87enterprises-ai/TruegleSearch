// The Truegle Android app (APK). Hosted as a GitHub Release asset — free, no size limit that
// matters here, and the "latest" address always serves the newest release.
export const APK_URL = 'https://github.com/o87enterprises-ai/TruegleSearch/releases/latest/download/truegle.apk';
export const APK_RELEASES_URL = 'https://github.com/o87enterprises-ai/TruegleSearch/releases/latest';

/** Offer the download only to an Android browser that isn't already running the app. */
export function showApkLink() {
  try {
    if (!/Android/i.test(navigator.userAgent || '')) return false;
    if (window.Capacitor?.isNativePlatform?.()) return false;
    return true;
  } catch { return false; }
}
