import { getPlayable } from './videoEmbed.js';

/* ── Short player links, for free, with nothing stored ──────────────────────
 *
 * THE PROBLEM. A shared queue is built by repeating `u` and `t` for every
 * item, so a 25-track playlist link runs to roughly 3,900 characters. That is
 * past the point where a link survives being pasted: SMS splits it, several
 * chat apps truncate the visible portion, and it looks like something a person
 * should not click.
 *
 * WHY NOT A SHORTENER. Two options were available and both were rejected:
 *
 *   A third-party shortener (bit.ly and friends) is free in money and
 *   expensive in the only currency this product has. Every Truegle link
 *   somebody shares would be a record, held by someone else, of what they
 *   listen to and who they sent it to.
 *
 *   A short-code table on our own backend keeps that private, but it makes
 *   sharing a link require a database write, which means a shared link can
 *   expire, break on a bad deploy, or vanish with the row. A share link that
 *   stops working later is worse than a long one.
 *
 * WHAT THIS DOES INSTEAD. Nearly every item in a real queue is a video on one
 * of a handful of hosts, and what identifies it is a short id — the other ~50
 * characters are the same boilerplate every time. So the link carries the ids
 * and a one-character host code, and rebuilds the URLs on arrival:
 *
 *   before  …/tube?u=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DhvGT0Z9hdh8&t=…
 *   after   …/tube?p=1yhvGT0Z9hdh8.yio3ncomDCtk.yJRcos8kQ4dI…
 *
 * That is ~13 characters per track against ~115, and it is self-contained:
 * nothing is stored, nothing expires, and the link works offline-forever the
 * way the long one did.
 *
 * THE TRADE, stated plainly: the packed form carries no TITLES. They are the
 * other half of the length and cannot be derived from an id. So packing is for
 * QUEUES, where the player shows each title as it plays anyway, and the long
 * titled form stays the default for sharing a single track — where the URL was
 * never the problem and the title is the whole point of the preview.
 */

export const PACK_PARAM = 'p';
const VERSION = '1';
const SEP = '.';
const MAX_ITEMS = 50;

// One character per host. Chosen from [a-z] so the packed string stays free of
// anything a URL, a chat client or a shell would want to escape.
const HOSTS = {
  y: {                      // YouTube video
    test: (u) => (u.hostname.endsWith('youtube.com') || u.hostname === 'youtu.be'
      || u.hostname.endsWith('youtube-nocookie.com')),
    id: (u) => (u.hostname === 'youtu.be'
      ? u.pathname.slice(1)
      : (u.searchParams.get('v')
        || (u.pathname.startsWith('/shorts/') && u.pathname.split('/')[2])
        || (u.pathname.startsWith('/embed/') && u.pathname.split('/')[2])
        || null)),
    url: (id) => `https://www.youtube.com/watch?v=${id}`,
  },
  l: {                      // YouTube playlist
    test: () => false,      // never auto-detected; emitted explicitly below
    url: (id) => `https://www.youtube.com/playlist?list=${id}`,
  },
  s: {                      // YouTube Short — kept distinct so it stays vertical
    test: (u) => u.hostname.endsWith('youtube.com') && u.pathname.startsWith('/shorts/'),
    id: (u) => u.pathname.split('/')[2] || null,
    url: (id) => `https://www.youtube.com/shorts/${id}`,
  },
  v: {                      // Vimeo
    test: (u) => u.hostname === 'vimeo.com' || u.hostname.endsWith('.vimeo.com'),
    id: (u) => u.pathname.split('/').filter(Boolean)[0] || null,
    url: (id) => `https://vimeo.com/${id}`,
  },
  d: {                      // Dailymotion
    test: (u) => u.hostname.endsWith('dailymotion.com') || u.hostname === 'dai.ly',
    id: (u) => (u.hostname === 'dai.ly' ? u.pathname.slice(1) : /\/video\/([a-z0-9]+)/i.exec(u.pathname)?.[1]) || null,
    url: (id) => `https://www.dailymotion.com/video/${id}`,
  },
  r: {                      // Rumble
    test: (u) => u.hostname.endsWith('rumble.com'),
    id: (u) => /^\/(v[a-z0-9]+)/i.exec(u.pathname)?.[1] || null,
    url: (id) => `https://rumble.com/${id}`,
  },
};

// Ids we are willing to interpolate back into a URL. Anything outside this
// alphabet is packed as a raw URL instead — an id is only a shortcut, and a
// shortcut must never become a way to smuggle a different destination in.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

// The escape hatch: a host we have no code for is carried whole, encoded so it
// cannot contain the separator. Longer, but it means packing never has to
// refuse an item and silently drop it from somebody's shared queue.
const RAW = '~';

/** Pack one URL into its short form, or null if it isn't worth/able to pack. */
function packOne(url) {
  let u;
  try { u = new URL(url); } catch { return null; }

  // Shorts first — it is also a youtube.com host, and the order decides which
  // code wins. A Short packed as 'y' comes back as a /watch URL and loses the
  // vertical flag the player needs to frame it 9:16.
  for (const code of ['s', 'y', 'v', 'd', 'r']) {
    const h = HOSTS[code];
    if (!h.test(u)) continue;
    const id = h.id(u);
    if (id && SAFE_ID.test(id)) return `${code}${id}`;
  }
  // A bare playlist keeps its own code so it rebuilds as a playlist.
  if (u.hostname.endsWith('youtube.com') && u.pathname === '/playlist') {
    const id = u.searchParams.get('list');
    if (id && SAFE_ID.test(id)) return `l${id}`;
  }
  return `${RAW}${encodeURIComponent(url)}`;
}

/** Rebuild one packed entry into a URL, or null if it is unreadable. */
function unpackOne(entry) {
  if (!entry) return null;
  const code = entry[0];
  const rest = entry.slice(1);
  if (!rest) return null;
  if (code === RAW) {
    try { return decodeURIComponent(rest); } catch { return null; }
  }
  const h = HOSTS[code];
  if (!h || !SAFE_ID.test(rest)) return null;
  return h.url(rest);
}

/**
 * Pack a list of items into a single `p` value.
 * @param {{url?: string, pageUrl?: string}[]} items
 * @returns {string|null} the packed value, or null if nothing was packable
 */
export function packSources(items) {
  const parts = [];
  for (const it of (items || []).slice(0, MAX_ITEMS)) {
    const url = it?.pageUrl || it?.url;
    // Only pack what the player can actually host — the same rule
    // buildPlayerLink enforces, applied here so a packed link can't become a
    // way to carry an unplayable URL past that check.
    if (!url || !getPlayable(url)) continue;
    const packed = packOne(url);
    if (packed) parts.push(packed);
  }
  return parts.length ? `${VERSION}${parts.join(SEP)}` : null;
}

/**
 * Unpack a `p` value into source URLs.
 * @returns {string[]} URLs, already filtered to what the player can host.
 */
export function unpackSources(value) {
  const raw = String(value || '');
  if (!raw) return [];
  // Unknown version → refuse rather than guess. A future format misread as v1
  // would produce plausible-looking wrong URLs, which is worse than an error.
  if (raw[0] !== VERSION) return [];
  return raw.slice(1)
    .split(SEP)
    .map(unpackOne)
    .filter((u) => u && getPlayable(u))
    .slice(0, MAX_ITEMS);
}
