// Short-form video (Shorts / Reels / TikToks) detection.
//
// What Truegle can actually aggregate AND play, for free, with no API key:
//   • YouTube Shorts — /shorts/<id>, plays through the normal YouTube embed.
//   • TikTok         — keyless /embed/v2/<id> player.
// What it can aggregate but NOT play inline:
//   • Instagram / Facebook Reels — Meta gates oEmbed behind app review, so
//     these stay link-out cards. Detected here so they can still be labelled
//     and filtered rather than silently dropped.
// Everything else short is caught by duration.

// YouTube Shorts run to 3 minutes now and Reels to 90s, but a plain duration
// cap that high sweeps in ordinary short videos. URL signals are authoritative;
// duration is only the fallback, so it stays tight.
export const SHORT_FORM_MAX_SECONDS = 90;

/**
 * Normalize the assorted duration shapes the search backends return —
 * "0:45", "1:02:03", 45, "45", null — to seconds. Returns null if unknown.
 */
export function parseDurationSeconds(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return parseInt(text, 10);
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(text)) return null;
  return text.split(':').reduce((acc, part) => acc * 60 + parseInt(part, 10), 0);
}

/** The platform a short-form item came from, or null if it isn't short-form. */
export function shortFormPlatform(url) {
  if (!url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;

  if ((host === 'youtube.com' || host.endsWith('.youtube.com')) && path.startsWith('/shorts/')) {
    return 'YouTube Shorts';
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'TikTok';
  if ((host === 'instagram.com' || host.endsWith('.instagram.com'))
    && (path.startsWith('/reel/') || path.startsWith('/reels/'))) {
    return 'Instagram Reels';
  }
  if ((host === 'facebook.com' || host.endsWith('.facebook.com'))
    && (path.startsWith('/reel/') || path.includes('/reels/'))) {
    return 'Facebook Reels';
  }
  return null;
}

/**
 * True when a search result is short-form: an explicit Shorts/Reels/TikTok URL,
 * or a video short enough to behave like one.
 */
export function isShortForm(result) {
  if (!result) return false;
  if (shortFormPlatform(result.url)) return true;
  const seconds = parseDurationSeconds(result.duration);
  return seconds != null && seconds > 0 && seconds <= SHORT_FORM_MAX_SECONDS;
}

/** Short-form we can actually play inside Truegle (vs. merely link out to). */
export function isPlayableShortForm(result) {
  const platform = shortFormPlatform(result?.url);
  if (platform === 'Instagram Reels' || platform === 'Facebook Reels') return false;
  return isShortForm(result);
}
