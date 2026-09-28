// Short-form video (Shorts / Reels / TikToks) detection.
//
// What Truegle can actually aggregate AND play, for free, with no API key:
//   • YouTube Shorts — /shorts/<id>, plays through the normal YouTube embed.
//   • TikTok         — keyless /embed/v2/<id> player.
// What it can aggregate but NOT play inline:
//   • Instagram / Facebook Reels — Meta gates oEmbed behind app review, so
//     these stay link-out cards. Detected here so they can still be labelled
//     and filtered rather than silently dropped.
// Nothing else qualifies. Membership is decided by the URL form, never by
// duration — see isShortForm below for why.

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

// The ceiling on a reel, in seconds.
//
// Short-form URL forms are NOT a length guarantee, which is how full-length
// videos got into the feed. TikTok now allows uploads up to sixty minutes, and
// a tiktok.com/…/video/… link is a reel by URL form no matter how long it runs;
// the submitted pool takes anything that classifies, so one pasted hour-long
// TikTok sat in the feed as a "reel". A reel is a thing you watch in a breath,
// so length is now an actual condition rather than an assumption.
export const REEL_MAX_SECONDS = 180;

/**
 * Is this result a REEL — genuinely short-form content from a short-form
 * surface — rather than merely a short video?
 *
 * Duration alone is NOT enough and used to be the bug: a 90-second trailer,
 * lyric video or news clip is a short video, not a Short. The feed filled up
 * with ordinary YouTube uploads that happened to be brief. So membership is
 * decided by the URL form, which is definitive:
 *   youtube.com/shorts/…  ·  tiktok.com/…/video/…  ·  instagram.com/reel/…
 *   facebook.com/reel/…
 *
 * But the URL form is a floor, not a ceiling: it says WHERE this came from,
 * not how long it is. So a KNOWN duration over REEL_MAX_SECONDS now
 * disqualifies it. Note the asymmetry, which is deliberate — an UNKNOWN
 * duration still passes, because most search rows carry no duration at all and
 * requiring one would empty the feed to punish the providers that are stingy
 * with metadata. We drop what we can prove is too long, not what we can't
 * prove is short.
 */
export function isShortForm(result) {
  if (!shortFormPlatform(result?.url)) return false;
  const seconds = parseDurationSeconds(result?.duration);
  if (seconds != null && seconds > REEL_MAX_SECONDS) return false;
  return true;
}

// A YouTube Short is reachable at BOTH /shorts/<id> and /watch?v=<id>, so a
// Short surfaced by a search engine as a watch URL is indistinguishable from
// an ordinary video by URL alone. When the uploader tagged it (#shorts is the
// near-universal convention) AND it is short enough to be one, we can promote
// it to its canonical /shorts/ form — at which point it is definitively a reel.
//
// Both conditions are required. The tag without the duration catches videos
// *about* Shorts; the duration without the tag is the bug we just removed.
const SHORTS_TAG = /#shorts?\b/i;
const YOUTUBE_SHORT_MAX_SECONDS = REEL_MAX_SECONDS; // one ceiling, not two

function youtubeVideoId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize a search result into a reel, or return null if it isn't one.
 * Promotes tagged, short-enough YouTube watch URLs to their /shorts/ form so
 * the rest of the app sees one canonical shape.
 */
export function asReel(result) {
  if (!result?.url) return null;
  if (shortFormPlatform(result.url)) return result;

  const id = youtubeVideoId(result.url);
  if (!id) return null;
  const seconds = parseDurationSeconds(result.duration);
  const tagged = SHORTS_TAG.test(`${result.title || ''} ${result.snippet || ''}`);
  if (!tagged || seconds == null || seconds <= 0 || seconds > YOUTUBE_SHORT_MAX_SECONDS) return null;

  return { ...result, url: `https://www.youtube.com/shorts/${id}` };
}

/** Short-form we can actually play inside Truegle (vs. merely link out to). */
export function isPlayableShortForm(result) {
  const platform = shortFormPlatform(result?.url);
  if (platform === 'Instagram Reels' || platform === 'Facebook Reels') return false;
  return isShortForm(result);
}
