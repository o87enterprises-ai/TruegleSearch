import { CREATORS, getCreator } from '../content/creators.js';

// WHAT GOOGLE SEES FOR THE APP'S OWN SURFACES.
//
// /green, /red, /feed, /chat, /creators and /creator/<slug> are client-side
// routes: the server sends the one SPA shell, whose <title> and canonical name
// the HOMEPAGE. Search Console (2026-09-28) showed the result — Google took
// each of them as a duplicate of "/" and indexed none, so the creator pages,
// which were shown 30 times anyway, could never build on it.
//
// functions/_middleware.js calls seoFor() at the edge and rewrites the shell's
// head (title, description, canonical, og:*) and puts a short block of real
// text and links inside #root, which the app replaces on mount — the same
// trick scripts/prerender.mjs plays for the static pages, without having to
// render 1200-line canvas pages in Node.
//
// PURE and dependency-light on purpose: it runs in a Cloudflare Worker. Every
// value here is ours; nothing from the URL is echoed except a creator slug that
// matched the roster exactly.

export const SITE = 'https://truegle.info';

const PAGES = {
  '/green': {
    title: 'Green Mode — Search With No AI | Truegle',
    description:
      'Web search with no AI at all: no summary, no answer card, no assistant. Nothing is generated and no model runs on your query — just the results, with no tracking.',
    h1: 'Green Mode: search with no AI',
    text:
      'Green is Truegle’s zero-AI search. Nothing is generated, so no model ever sees your query. You get the results, the source of each, and nothing else.',
    links: [['/', 'Truegle home'], ['/red', 'Red Mode'], ['/blog/how-to-search-privately/', 'How to search privately']],
  },
  '/red': {
    title: 'Rabbit Hole (Red Mode) — Independent & Alternative Sources | Truegle',
    description:
      'Independent voices, contrarian takes and sources that challenge the official narrative, ahead of the mainstream ones. Includes Wonderland: isolate results by political, faith, societal or economic lens.',
    h1: 'Rabbit Hole: independent and alternative sources',
    text:
      'Red Mode surfaces independent voices and sources that question consensus. Inside it, Wonderland takes the results you already have and isolates them by one perspective at a time — political, faith, societal or economic.',
    links: [['/', 'Truegle home'], ['/green', 'Green Mode'], ['/blog/bias-free-search-results-perspective-modes/', 'How perspective modes work']],
  },
  '/feed': {
    title: 'Feed — Reddit, Bluesky, Mastodon & News in One Timeline | Truegle',
    description:
      'Reddit, Mastodon, Bluesky, news and partner creators interleaved into one timeline, never the same post twice. No account needed for the public sources, and video plays in Truegle’s own player.',
    h1: 'Feed: one timeline for the public web',
    text:
      'The Feed interleaves Reddit, Mastodon, Bluesky, news and the creators Truegle partners with into a single scroll. Video posts play in True Tube without leaving the page.',
    links: [['/', 'Truegle home'], ['/tube', 'True Tube'], ['/creators', 'Creators']],
  },
  '/chat': {
    title: 'Chat — Ask TrueGLE, an Unbiased AI With Multiple Lenses | Truegle',
    description:
      'Ask TrueGLE a question and pick the lenses it answers through — mainstream, independent, Green, Rabbit Hole or Privacy/OSINT. Blend several to see how each frames the answer.',
    h1: 'Chat with TrueGLE',
    text:
      'TrueGLE is the model behind Truegle’s answers. Choose one lens or stack several to see how the same question looks from different perspectives.',
    links: [['/', 'Truegle home'], ['/blog/unbiased-search-engine-how-truegle-works/', 'How Truegle works'], ['/developers/', 'API']],
  },
  '/creators': {
    title: 'Creators on Truegle — Independent Video Channels | True Tube',
    description:
      'The independent YouTube creators hosted on Truegle. Their latest uploads play in True Tube through YouTube’s official embed, so the creator keeps every view.',
    h1: 'Creators on Truegle',
    text:
      'Independent channels whose latest uploads play in True Tube. Playback uses YouTube’s official embed, so every view and every ad dollar stays with the creator.',
    links: [['/', 'Truegle home'], ['/tube', 'True Tube'], ...CREATORS.map((c) => [`/creator/${c.slug}`, c.name])],
  },
};

const clean = (path) => String(path || '').replace(/\/+$/, '') || '/';

/**
 * @param {string} pathname
 * @returns {null | { title, description, canonical, h1, text, links: [href, label][], creator?: object }}
 */
export function seoFor(pathname) {
  const p = clean(pathname);
  if (PAGES[p]) return { ...PAGES[p], canonical: `${SITE}${p}` };

  const m = /^\/creator\/([a-z0-9-]{1,60})$/.exec(p);
  const creator = m ? getCreator(m[1]) : null;
  if (!creator) return null; // an unknown slug keeps the shell — it is a "not found", not a page
  return {
    creator,
    title: `${creator.name} — Videos on Truegle | True Tube`,
    description:
      `Watch the latest videos from ${creator.name} in True Tube, with no tracking and no ads. `
      + 'Plays through YouTube’s official embed, so the creator keeps every view.',
    canonical: `${SITE}${p}`,
    h1: `${creator.name} on Truegle`,
    text: `The latest uploads from ${creator.name}, playing in True Tube.`,
    links: [
      ['/creators', 'All creators'], ['/tube', 'True Tube'],
      [creator.channelUrl, `${creator.name} on YouTube`],
    ],
  };
}

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Text and links a crawler can read without running the app. Replaced on mount. */
export function crawlBlock(page) {
  const links = page.links
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join('');
  return `<main id="seo-static"><h1>${esc(page.h1)}</h1><p>${esc(page.text)}</p><nav><ul>${links}</ul></nav></main>`;
}

/** JSON-LD for a creator page: who they are and where they are on the web. */
export function creatorSchema(page) {
  const c = page.creator;
  if (!c) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: page.canonical,
    name: page.title,
    mainEntity: {
      '@type': 'Person',
      name: c.name,
      url: page.canonical,
      sameAs: (c.socials || []).map((s) => s.url).filter(Boolean),
    },
  };
}
