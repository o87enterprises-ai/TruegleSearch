// Explicit .js extension: this module is also imported by the Cloudflare Pages
// middleware, which is bundled outside Vite's resolver.
import { getPlayable } from './videoEmbed.js';

// ── Truegle player links (/tube) ───────────────────────────────────────────
// A Truegle player link is a share URL that opens the recipient straight into
// Truegle's own sandboxed player instead of the source site:
//
//   https://truegle.info/tube?u=<source url>&t=<title>
//
// Repeat `u` (and `t`) to share a whole queue; the first plays, the rest line
// up behind it.
//
// SECURITY — this is the boundary that makes "a Truegle link is a safe link"
// true, so it is enforced in one place, here:
//   • A `u` value is only ever accepted if getPlayable() recognizes it, and
//     what gets rendered is getPlayable's OUTPUT, not the raw input — an
//     embed URL we build ourselves on the provider's own host
//     (youtube-nocookie / player.vimeo / w.soundcloud) or a direct media file
//     played by a native <audio>/<video>.
//   • A `u` we don't recognize is shown to the recipient as inert text. It is
//     never navigated to, never iframed, never auto-opened — so a player link
//     can't be dressed up as an open redirect or a drive-by page load.
//   • Titles are attacker-supplied text. They are rendered as text nodes and
//     length-capped; never as markup, never as a URL.

// New links land on True Tube — the full player page, which is also what
// truegle.info/tube is on its own. /w is the ORIGINAL player-link path: every
// link already shared points there, so it stays readable forever even though
// nothing builds one any more.
export const PLAYER_LINK_PATH = '/tube';
export const LEGACY_PLAYER_LINK_PATH = '/w';

const MAX_ITEMS = 25;
const MAX_TITLE = 120;

const cleanTitle = (t) => (typeof t === 'string' ? t.trim().slice(0, MAX_TITLE) : '');

/**
 * Build a shareable Truegle player link.
 * @param {{url: string, title?: string}[]|{url: string, title?: string}} items
 * @param {string} [origin] defaults to the current site origin
 * @returns {string|null} absolute URL, or null if nothing was playable
 */
export function buildPlayerLink(items, origin) {
  const list = (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, MAX_ITEMS);
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://truegle.info');
  const params = new URLSearchParams();
  for (const it of list) {
    const url = it.pageUrl || it.url;
    if (!url || !getPlayable(url)) continue; // only share what our player can actually host
    params.append('u', url);
    params.append('t', cleanTitle(it.title));
  }
  return params.has('u') ? `${base}${PLAYER_LINK_PATH}?${params.toString()}` : null;
}

/**
 * Turn `?u=…&t=…` search params into player sources.
 * @returns {{sources: object[], rejected: string[]}} rejected = the `u` values
 *   that aren't playable, kept so the page can say so instead of silently
 *   dropping them. They are strings for display only.
 */
export function parsePlayerParams(search) {
  const params = new URLSearchParams(search || '');
  const urls = params.getAll('u').slice(0, MAX_ITEMS);
  const titles = params.getAll('t');
  const sources = [];
  const rejected = [];
  urls.forEach((url, i) => {
    const playable = getPlayable(url);
    if (!playable) { rejected.push(String(url).slice(0, 200)); return; }
    sources.push({ ...playable, title: cleanTitle(titles[i]) || titleFromUrl(url), pageUrl: url });
  });
  return { sources, rejected };
}

/**
 * Resolve pasted text into player sources. Accepts either a Truegle player
 * link (so a shared link can be dropped straight into the queue) or any single
 * URL our player can host. Returns [] when there's nothing playable.
 */
export function resolveShareInput(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  let u;
  try { u = new URL(raw); } catch { return []; }
  const path = u.pathname.replace(/\/$/, '') || '/';
  if (path === PLAYER_LINK_PATH || path === LEGACY_PLAYER_LINK_PATH) {
    return parsePlayerParams(u.search).sources;
  }
  const playable = getPlayable(raw);
  return playable ? [{ ...playable, title: titleFromUrl(raw), pageUrl: raw }] : [];
}

/** Last-resort label for a source with no title: host + trimmed path. */
export function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname).replace(/\/$/, '');
    return (u.hostname.replace(/^www\./, '') + path).slice(0, MAX_TITLE);
  } catch {
    return String(url).slice(0, MAX_TITLE);
  }
}

/**
 * The Truegle link for ANY result, media or not.
 *   • playable  → /tube (opens in True Tube, Truegle's sandboxed player)
 *   • otherwise → /l  (lands on Truegle showing where the link goes)
 *
 * Every share surface routes through here, so a Truegle share link always
 * brings the recipient back to Truegle first rather than handing them
 * straight to an outside site.
 */
export function buildShareLink({ url, title }, origin) {
  if (!url) return null;
  const player = buildPlayerLink({ url, title }, origin);
  if (player) return player;
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://truegle.info');
  const params = new URLSearchParams({ u: url });
  const clean = cleanTitle(title);
  if (clean) params.set('t', clean);
  return `${base}/l?${params.toString()}`;
}
