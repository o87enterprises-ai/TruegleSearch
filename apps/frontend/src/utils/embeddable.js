// Which sites can be shown INSIDE Truegle, and which can only be opened away.
//
// ── WHY A LIST AND NOT A CHECK ──────────────────────────────────────────────
//
// A page refuses to be framed with `X-Frame-Options: DENY|SAMEORIGIN` or
// `Content-Security-Policy: frame-ancestors`. Both are enforced by the browser
// on the RESPONSE, and the parent page is told nothing: no error event fires,
// `onLoad` still runs, and the frame simply stays blank. That is the point of
// the header — it exists to stop clickjacking, so leaking "you were blocked"
// back to the framing page would defeat it.
//
// So there is no way to ask "can I embed this?" from here. The old code tried
// anyway:
//
//     onLoad={(e) => { try {
//       if (!e.target.contentDocument || …) setIframeBlocked(true);
//     } catch { setIframeBlocked(true); } }}
//
// `contentDocument` is null for EVERY cross-origin frame by specification,
// embeddable or not — so that branch fired on every external result and the
// preview reported "This page can't be embedded" about pages that embed fine.
// It was not detection, it was a coin that always landed the same way.
//
// What can be known ahead of time is which hosts are *known* to refuse. That
// is this file. It is deliberately a list of ones worth being sure about
// rather than a guess at the whole web:
//
//   WRONG IN THE "BLOCKS" DIRECTION costs a preview that would have worked —
//     the reader still gets the link, one press away.
//   WRONG IN THE OTHER DIRECTION costs exactly what was reported: a press, a
//     wait, and a blank rectangle.
//
// Only the second one wastes anybody's time, so an entry is added when the
// site is known to refuse, and left out when it is merely suspected.
//
// ── THE OTHER HALF: WHAT THE READER SEES ────────────────────────────────────
//
// A host on this list is not offered an in-page preview at all. The card shows
// "Opens on <site>" instead, which is honest and costs no press to discover.

/**
 * Hosts that refuse to be framed by a third party.
 *
 * Matched on the registrable host and any subdomain, so `google.com` covers
 * `www.google.com`, `news.google.com` and `docs.google.com` alike.
 *
 * Grouped by why, because the reasons age differently: a paywall may drop, a
 * platform's stance on framing rarely does.
 */
const REFUSES_FRAMING = [
  // ── The big platforms. Framing is a clickjacking vector against a logged-in
  //    session, so every one of these has denied it for a decade or more.
  'google.com', 'google.co.uk', 'gmail.com', 'youtube.com', 'youtu.be',
  'facebook.com', 'instagram.com', 'threads.net', 'whatsapp.com',
  'x.com', 'twitter.com',
  'linkedin.com',
  'reddit.com',
  'tiktok.com',
  'pinterest.com',
  'snapchat.com',
  'discord.com',
  'twitch.tv',
  'quora.com',

  // ── Accounts and money. These deny framing as a security control and are
  //    the last places anyone should be shown inside another site's chrome.
  'paypal.com', 'stripe.com',
  'apple.com', 'icloud.com',
  'microsoft.com', 'live.com', 'outlook.com', 'office.com',
  'yahoo.com',
  'amazon.com', 'amazon.co.uk', 'amazon.de',
  'ebay.com',
  'walmart.com', 'target.com', 'bestbuy.com',

  // ── Developer and reference platforms that allow same-origin framing only.
  'github.com', 'gitlab.com',
  'stackoverflow.com', 'stackexchange.com', 'superuser.com', 'serverfault.com',
  'imdb.com',

  // ── Streaming and media apps: the player is the product and the page is
  //    built to be the top-level document.
  'netflix.com', 'spotify.com', 'hulu.com', 'disneyplus.com',

  // ── Marketplaces and booking, all of which deny framing.
  'airbnb.com', 'booking.com', 'expedia.com', 'yelp.com',
  'indeed.com', 'glassdoor.com', 'craigslist.org',

  // ── News that denies framing outright (separate from merely paywalling).
  'nytimes.com', 'wsj.com', 'washingtonpost.com', 'ft.com', 'bloomberg.com',

  // ── AI products, which are single-page apps that refuse to be nested.
  'openai.com', 'chatgpt.com', 'claude.ai', 'anthropic.com',
];

const refused = new Set(REFUSES_FRAMING);

/** The host, lowercased, without a leading `www.`. */
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Is this host on the refusal list, as itself or as a subdomain of one?
 *
 * Suffix matching is done on LABEL boundaries. A bare `endsWith('google.com')`
 * would also match `notgoogle.com` — the same hole that was found and fixed in
 * getVideoEmbed's host test, where it meant an attacker's host could be iframed
 * as a trusted embed. Not repeating it here.
 */
export function refusesFraming(url) {
  const host = hostOf(url);
  if (!host) return false;
  if (refused.has(host)) return true;
  return [...refused].some((known) => host.endsWith(`.${known}`));
}

/**
 * Can this result be previewed inside Truegle?
 *
 * `false` means the reader should be offered the link and nothing else — no
 * preview button, no spinner, no blank rectangle.
 *
 * A VIDEO EMBED IS A DIFFERENT QUESTION and is not decided here. YouTube and
 * TikTok both refuse to frame their watch pages while publishing a dedicated
 * embed path; getPlayable/getVideoEmbed build those URLs, and a card holding
 * one plays it regardless of what this says about the watch page.
 */
export const canPreview = (url) => !!url && !refusesFraming(url);

/** "Opens on nytimes.com" — the label a card shows instead of a dead button. */
export const opensOnLabel = (url) => {
  const host = hostOf(url);
  return host ? `Opens on ${host}` : 'Opens in a new tab';
};

/** Exported for the test, and for anyone auditing what is on the list. */
export const REFUSED_HOSTS = REFUSES_FRAMING;
