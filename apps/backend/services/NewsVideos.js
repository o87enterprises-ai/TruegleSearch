/**
 * Video coverage for the landing page's News and Markets cards — straight
 * from YouTube, as thumbnails that play in the Truegle player.
 *
 * WHY A SEARCH AND NOT A LIST OF CHANNELS. Deciding which outlets count as
 * "the news" is exactly the editorial thumb on the scale Truegle exists to
 * avoid, so nothing here names a channel. The route asks our own index for
 * YouTube videos about today's news (or today's markets), and this module only
 * cleans what comes back. The trade is real and the cards say so: it is what
 * the index has, not an endorsement.
 *
 * Pure on purpose — no network, no express — so scripts/verify-news-videos.mjs
 * can check the shaping with canned rows.
 */

const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i;

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const youtubeId = (url) => YT_ID.exec(String(url || ''))?.[1] || null;

/** "Title - YouTube" is how the index labels it; the suffix is not the title. */
const cleanTitle = (t) => String(t || '')
  .replace(/\s+[-–|]\s*YouTube\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200);

// A bulletin republished daily shows up as five near-identical rows that differ
// only by their date. Comparing with the date and punctuation removed keeps
// one and lets other stories in.
const titleKey = (t) => cleanTitle(t)
  .toLowerCase()
  .replace(/\b\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/** A running livestream is a channel, not a report — YouTube titles them LIVE. */
const isLivestream = (t) => /\bLIVE\b/.test(t) || /\b24\/7\b/.test(t);

/** "3:23" / "1:02:03" / seconds → seconds, or null. */
function seconds(d) {
  if (typeof d === 'number') return Number.isFinite(d) ? d : null;
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(d || '').trim());
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2]) * 60) + Number(m[3]);
}

/**
 * Search rows → the videos worth showing, newest first.
 * @param {object[]} rows  results from SearchService (title, url, date, duration…)
 * @param {{ now?: number, limit?: number }} [opts]
 * @returns {{ id: string, title: string, url: string, thumbnail: string, at: number|null, duration: number|null }[]}
 */
function shapeVideos(rows, { now = Date.now(), limit = 12, english = false, drop = null } = {}) {
  const seenIds = new Set();
  const seenTitles = new Set();
  const out = [];

  for (const r of Array.isArray(rows) ? rows : []) {
    const id = youtubeId(r?.url);
    if (!id || seenIds.has(id)) continue;
    const title = cleanTitle(r.title);
    if (!title || isLivestream(title)) continue;
    // An English region gets English titles: no Tamil, Bengali, Devanagari…
    // (owner, 2026-10-06: "Lots of the results are in Hindi" with US chosen).
    if (english && !isLatinScript(title)) continue;
    if (drop && drop.test(title)) continue;

    const at = r.date || r.publishedDate ? Date.parse(r.date || r.publishedDate) || null : null;
    if (at && now - at > MAX_AGE_MS) continue;       // stale for a "today" card
    if (at && at - now > 24 * 60 * 60 * 1000) continue; // a future date is a bad row

    const tk = titleKey(title);
    if (tk && seenTitles.has(tk)) continue;

    seenIds.add(id);
    if (tk) seenTitles.add(tk);
    out.push({
      id,
      title,
      // Derived, not the index's proxied thumbnail: hqdefault exists for every
      // video and is served straight from YouTube's image host, which the CSP
      // already allows (the player uses it too).
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
      at,
      duration: seconds(r.duration),
    });
  }

  // Dated rows first, newest first; undated ones keep their relevance order
  // behind them rather than being guessed a date.
  const dated = out.filter((v) => v.at).sort((a, b) => b.at - a.at);
  const undated = out.filter((v) => !v.at);
  return [...dated, ...undated].slice(0, limit);
}

// ── language by region ──────────────────────────────────────────────────────
// Regions whose news Truegle shows in English. The search is ASKED for English
// (filters.language) and what slips through is dropped by script below — the
// index's language tags are a hint, not a guarantee.
const ENGLISH_REGIONS = new Set(['US', 'GB', 'CA', 'AU', 'IE', 'NZ', 'ZA']);
const languageFor = (country) => (ENGLISH_REGIONS.has(String(country || '').toUpperCase()) ? 'en' : null);

/** Every letter in the title is Latin script (punctuation, digits, emoji ignored). */
function isLatinScript(title) {
  const letters = String(title || '').match(/\p{L}/gu) || [];
  return letters.every((ch) => /\p{Script=Latin}/u.test(ch));
}

// The US markets card is about US markets. Indian market shows dominate the
// index's "stock market today" (Nifty, Sensex, "share bazaar" — mostly written
// in English letters, so the script check alone keeps them). This names
// MARKETS, not channels: the editorial line stays "which market", not "whose".
const NOT_US_MARKETS = /\b(nifty|sensex|bank\s*nifty|share\s*bazaar|share\s*market|bse|nse|dalal\s*street)\b/i;

/** Region-specific shaping for a card: { language, english, drop }. */
function regionRules(kind, country) {
  const language = languageFor(country);
  return {
    language,
    english: !!language,
    drop: kind === 'markets' && String(country || '').toUpperCase() === 'US' ? NOT_US_MARKETS : null,
  };
}

/** What to ask the index for. `region` is a display name ("Canada") or ''. */
function queryFor(kind, scope, region) {
  if (kind === 'markets') {
    // Markets of the chosen region, when there is one.
    if (region === 'United States') return 'US stock market today Wall Street analysis';
    return region ? `${region} stock market today analysis` : 'stock market today analysis';
  }
  if (scope === 'local' && region) return `${region} news today`;
  return 'world news today';
}

module.exports = { shapeVideos, queryFor, youtubeId, cleanTitle, isLivestream, isLatinScript, languageFor, regionRules };
