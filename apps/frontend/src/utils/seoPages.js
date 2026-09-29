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

// ── A creator's real uploads ──────────────────────────────────────────────
// The roster's taglines are blank on purpose ("fill with the creator's own
// words rather than a guess"), so a creator page has almost nothing of its own
// to say. What is real and fresh is the channel's public upload feed, which
// YouTube serves free and keyless. The edge function reads it (cached an hour)
// and this puts the titles and dates in the page and the structured data.

const decode = (t) => String(t || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

const tag = (block, name) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? decode(m[1]).trim() : '';
};

/**
 * YouTube's channel Atom feed → { channelTitle, videos }. Total: bad or empty
 * input gives no videos rather than throwing, since it runs on the edge for a
 * page that must render either way.
 * @returns {{ channelTitle: string, videos: {id:string,title:string,published:string,thumbnail:string,description:string}[] }}
 */
export function parseVideoFeed(xml, limit = 10) {
  const text = String(xml || '');
  const head = text.split('<entry>')[0];
  const videos = [];
  for (const block of text.split('<entry>').slice(1)) {
    const id = tag(block, 'yt:videoId');
    const title = tag(block, 'title').replace(/\s+/g, ' ').slice(0, 200);
    if (!/^[\w-]{11}$/.test(id) || !title) continue;
    const published = tag(block, 'published');
    videos.push({
      id,
      title,
      published: Number.isNaN(Date.parse(published)) ? '' : new Date(published).toISOString(),
      // Derived from the id, like everywhere else: hqdefault exists for every
      // video and comes from the image host the site already allows.
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      description: tag(block, 'media:description').replace(/\s+/g, ' ').slice(0, 300),
    });
    if (videos.length >= limit) break;
  }
  return { channelTitle: tag(head, 'title').slice(0, 100), videos };
}

/** A creator page with their latest uploads added — or unchanged when there are none. */
export function withVideos(page, feed) {
  const videos = feed?.videos || [];
  if (!page?.creator || !videos.length) return page;
  const c = page.creator;
  // Google shows about 155 characters of a description, so the title that leads
  // it is kept short enough for the rest to fit.
  const first = videos[0].title.length > 70 ? `${videos[0].title.slice(0, 69).trim()}\u2026` : videos[0].title;
  const lead = `Latest: \u201c${first}\u201d`;
  const more = videos.length > 1 ? ` and ${videos.length - 1} more` : '';
  return {
    ...page,
    videos,
    description: `${lead}${more} from ${c.name}. Watch in True Tube, no tracking, no ads. The creator keeps every view.`,
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
  // Plain text, not links: playing happens in the app, and a list of links
  // into shareable player URLs would hand a crawler thousands of near-copies.
  const uploads = page.videos?.length
    ? `<h2>Latest uploads</h2><ul>${page.videos.map((v) => `<li>${esc(v.title)}${v.published ? ` <time datetime="${esc(v.published)}">${esc(v.published.slice(0, 10))}</time>` : ''}</li>`).join('')}</ul>`
    : '';
  return `<main id="seo-static"><h1>${esc(page.h1)}</h1><p>${esc(page.text)}</p>${uploads}<nav><ul>${links}</ul></nav></main>`;
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

/** VideoObject list for a creator page that has uploads; the page itself plays them. */
export function videosSchema(page) {
  if (!page?.videos?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${page.creator.name} \u2014 latest videos`,
    itemListElement: page.videos.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'VideoObject',
        name: v.title,
        ...(v.description ? { description: v.description } : { description: v.title }),
        thumbnailUrl: v.thumbnail,
        ...(v.published ? { uploadDate: v.published } : {}),
        embedUrl: `https://www.youtube.com/embed/${v.id}`,
        url: page.canonical,
      },
    })),
  };
}
