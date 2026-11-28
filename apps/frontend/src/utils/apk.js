// The Truegle Android app (APK). Hosted as a GitHub Release asset — free, no size limit that
// matters here, and the "latest" address always serves the newest release.
export const APK_URL = 'https://github.com/o87enterprises-ai/TruegleSearch/releases/latest/download/truegle.apk';
export const APK_RELEASES_URL = 'https://github.com/o87enterprises-ai/TruegleSearch/releases/latest';

export const LATEST_RELEASE_API = 'https://api.github.com/repos/o87enterprises-ai/TruegleSearch/releases/latest';

/** True when dotted version `a` is higher than `b` (numeric, so 0.2.10 > 0.2.9). */
export function isNewer(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/** The newer released version than `current`, or null. Never throws: offline just means no prompt. */
export async function findUpdate(current) {
  try {
    if (!current) return null;
    const res = await fetch(LATEST_RELEASE_API, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const latest = String((await res.json()).tag_name || '').match(/^android-v(\d+(?:\.\d+)*)$/)?.[1];
    return latest && isNewer(latest, current) ? latest : null;
  } catch { return null; }
}

/** Offer the download only to an Android browser that isn't already running the app. */
export function showApkLink() {
  try {
    if (!/Android/i.test(navigator.userAgent || '')) return false;
    if (window.Capacitor?.isNativePlatform?.()) return false;
    return true;
  } catch { return false; }
}
