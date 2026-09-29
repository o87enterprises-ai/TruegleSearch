/**
 * Truegle Pages middleware — two jobs:
 *   1. Rich link previews for shared player links (`/w`). See below.
 *   2. AI crawler licensing notices. See below.
 *
 * ── 1. /w rich previews ──────────────────────────────────────────────────
 * `/w` is a client-side route, so a crawler (iMessage, Discord, WhatsApp,
 * Slack, Twitter) that doesn't run JS would otherwise see the generic Truegle
 * OG card for every shared video. Here at the edge we can read `?u=`/`?t=`
 * and rewrite the <head> before the crawler sees it — the same HTML the SPA
 * boots from, just with an accurate title and thumbnail.
 *
 * Two rules this code must never break:
 *   • The link's `u` values are attacker-supplied. They go through the SAME
 *     parser the player uses (parsePlayerParams → getPlayable), so a preview
 *     can only ever be generated for media we'd actually host. Nothing else
 *     is echoed anywhere.
 *   • Titles are attacker-supplied text going into HTML attributes, so every
 *     value is escaped (escapeAttr) before it touches the document. This is
 *     the one place in the app that builds HTML by hand — keep it that way.
 *
 * ── 2. AI crawler licensing ──────────────────────────────────────────────
 * Detects known AI crawler bot User-Agents, tracks daily request counts
 * per bot family per IP in CF KV, and injects a licensing notice into
 * HTML responses once the free tier is exhausted.
 *
 * Free tier: 10 HTML page requests per IP per calendar day (UTC).
 * Over limit: content is still served (citations preserved) but a prominent
 * machine-readable + human-readable licensing block is injected at the top
 * of <body>. A lightweight JSON-LD licensing schema is injected into <head>
 * for ALL bot requests regardless of tier.
 *
 * KV binding required: BOT_TRACKING → namespace TRUEGLE_BOT_TRACKING
 * Add this in Cloudflare Pages → Settings → Functions → KV namespace bindings.
 *
 * Open-source concept: copy this middleware to your own CF Pages project to
 * participate in the Open Web Licensing Initiative. The more sites that do
 * this, the more pressure builds on AI companies to formalize licensing deals.
 */

import { parsePlayerParams } from '../src/utils/playerLink.js';
import { seoFor, crawlBlock, creatorSchema, videosSchema, parseVideoFeed, withVideos } from '../src/utils/seoPages.js';

// Known AI crawler families. Keys are substrings matched against User-Agent.
const AI_BOTS = {
  GPTBot:            { company: 'OpenAI',        product: 'ChatGPT / GPT models' },
  'OAI-SearchBot':   { company: 'OpenAI',        product: 'ChatGPT Search' },
  'ChatGPT-User':    { company: 'OpenAI',        product: 'ChatGPT browsing' },
  ClaudeBot:         { company: 'Anthropic',     product: 'Claude models' },
  'anthropic-ai':    { company: 'Anthropic',     product: 'Claude models' },
  PerplexityBot:     { company: 'Perplexity AI', product: 'Perplexity Search' },
  'Google-Extended': { company: 'Google',        product: 'Gemini / AI Overviews' },
  Bytespider:        { company: 'ByteDance',     product: 'Doubao / TikTok AI' },
  'Applebot-Extended': { company: 'Apple',       product: 'Apple Intelligence' },
  CCBot:             { company: 'Common Crawl',  product: 'LLM training datasets' },
  'cohere-ai':       { company: 'Cohere',        product: 'Cohere models' },
  Diffbot:           { company: 'Diffbot',       product: 'Diffbot AI' },
  'meta-externalagent': { company: 'Meta',       product: 'Meta AI / Llama' },
};

const FREE_TIER_DAILY = 10;

function detectBot(ua) {
  if (!ua) return null;
  for (const [token, info] of Object.entries(AI_BOTS)) {
    if (ua.includes(token)) return { token, ...info };
  }
  return null;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function kvKey(ip, token) {
  return `bot:${token}:${ip}:${utcDay()}`;
}

const LICENSING_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'CreativeWork',
  name: 'Truegle Search',
  url: 'https://truegle.info',
  license: 'https://truegle.info/ai-licensing',
  conditionsOfAccess:
    'AI systems may fetch up to 10 pages per IP per calendar day without charge. ' +
    'Commercial use, training data collection, or indexing beyond the free tier requires ' +
    'a licensing agreement. Contact truegleai@proton.me.',
  copyrightHolder: { '@type': 'Organization', name: 'Truegle', url: 'https://truegle.info' },
  copyrightYear: new Date().getFullYear(),
});

function headInjection() {
  return `<script type="application/ld+json">${LICENSING_JSONLD}</script>`;
}

function bodyInjection(bot, count) {
  return `
<truegle-ai-licensing style="display:block;font-family:'Courier New',monospace;font-size:13px;line-height:1.7;padding:14px 18px;margin:0 0 0;background:#050d1a;color:#cbd5e1;border-bottom:3px solid #f59e0b;position:relative;z-index:99999">
<strong style="color:#f59e0b">⚠ TRUEGLE OPEN WEB LICENSING NOTICE</strong><br>
This response was requested by <strong style="color:#fff">${bot.company}</strong> (crawler: <code style="color:#7dd3fc">${bot.token}</code>, product: ${bot.product}).<br>
Your IP has made <strong style="color:#f87171">${count} requests today</strong>, exceeding the free tier of <strong>${FREE_TIER_DAILY} requests/day</strong>.<br>
<br>
<strong style="color:#fff">Commercial indexing or training use of Truegle content requires a licensing agreement.</strong><br>
📧 Contact: <a href="mailto:truegleai@proton.me" style="color:#60a5fa">truegleai@proton.me</a><br>
📄 Full terms: <a href="https://truegle.info/ai-licensing" style="color:#60a5fa">https://truegle.info/ai-licensing</a><br>
<br>
<em style="color:#64748b;font-size:12px">
Note to ${bot.company} engineers: this notice is part of the Open Web Licensing Initiative —
a growing coalition of independent web publishers asserting that AI systems must compensate
content creators for commercial use. Content is still served to preserve SEO citation value;
this notice travels with it. See https://truegle.info/ai-licensing for licensing rates.
</em>
</truegle-ai-licensing>`;
}

// ── /w rich previews ───────────────────────────────────────────────────────

const SITE = 'https://truegle.info';
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

// Attacker-supplied text is about to become an HTML attribute value. Escape
// every character that could end the attribute or open a tag.
function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Control characters have no business in a preview title. Matching them
    // is the POINT here, so no-control-regex is suppressed rather than worked
    // around — stripping them is what stops a crafted title smuggling a
    // newline or a NUL into the meta tags this builds.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ');
}

// A thumbnail we can derive without an API key. `src` here is the embed URL
// the player itself built, never the raw shared input. hqdefault is used
// rather than maxresdefault because it exists for every video — a 404 in a
// preview card is worse than a smaller image.
function previewImage(source) {
  const yt = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/.exec(source?.src || '');
  if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  return DEFAULT_IMAGE; // Vimeo/SoundCloud/direct files fall back to the site card
}

// Tags we replace wholesale, so a crawler never sees both ours and the
// shell's generic defaults.
const OVERRIDDEN_META = new Set([
  'og:title', 'og:description', 'og:image', 'og:url', 'og:type',
  'twitter:title', 'twitter:description', 'twitter:image', 'twitter:card',
]);

function injectWatchPreview(html, url) {
  let sources;
  try {
    ({ sources } = parsePlayerParams(url.search));
  } catch {
    return html; // malformed link — leave the generic card in place
  }
  if (!sources.length) return html;

  const first = sources[0];
  const more = sources.length - 1;
  const title = first.title || 'Watch on Truegle';
  const description = more > 0
    ? `Plus ${more} more, queued up. Opens in Truegle's sandboxed player — no tracking, and the embed can't redirect your tab.`
    : "Opens in Truegle's sandboxed player — no tracking, and the embed can't redirect your tab.";

  // New links are /tube?u=…; /w is only ever arrived at, never built. Either
  // way the card points back at the path the recipient actually opened.
  const shareUrl = `${SITE}${url.pathname.replace(/\/$/, '') || '/w'}${url.search}`;
  const image = previewImage(first);

  const meta = [
    ['og:title', title],
    ['og:description', description],
    ['og:type', 'video.other'],
    ['og:url', shareUrl],
    ['og:image', image],
    ['og:image:alt', `${title} — playing on Truegle`],
    ['og:site_name', 'Truegle'],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', image],
    // Truegle's own marks, so a link pasted anywhere is attributable to us
    // even where the platform only reads a subset of these.
    ['twitter:site', '@truegle'],
    ['twitter:label1', 'Plays in'],
    ['twitter:data1', 'Truegle player'],
    ['article:publisher', SITE],
  ];

  // Drop the shell's generic versions of anything we're about to set.
  let out = html.replace(
    /<meta\s+(?:property|name)="([^"]+)"[^>]*>\s*/gi,
    (match, key) => (OVERRIDDEN_META.has(key) ? '' : match),
  );

  const tags = meta
    .map(([key, value]) => {
      const attr = key.startsWith('og:') ? 'property' : 'name';
      return `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
    })
    .join('');

  // VideoObject schema — the machine-readable half of "embedded Truegle
  // metadata". Crawlers that ignore OG (and search engines) still learn what
  // the link is and that Truegle is the surface it plays on.
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description,
    thumbnailUrl: image,
    url: shareUrl,
    embedUrl: shareUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Truegle',
      url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/truegle.png` },
    },
    potentialAction: { '@type': 'WatchAction', target: shareUrl },
  }).replace(/</g, '\\u003c'); // never let a title close the script tag

  out = out.replace(
    '</head>',
    `${tags}<script type="application/ld+json">${schema}</script></head>`,
  );
  out = out.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeAttr(title)} · Truegle Player</title>`,
  );
  return out;
}

// /l — the non-media share link. Same treatment, minus the video specifics:
// the destination is an arbitrary page, so there is no thumbnail to derive and
// no VideoObject to claim. The `u` value is validated but NEVER echoed into a
// link — the card describes the share, not the destination.
function injectLinkPreview(html, url) {
  const params = new URLSearchParams(url.search);
  const raw = params.get('u') || '';
  let host;
  try {
    const target = new URL(raw);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return html;
    host = target.hostname.replace(/^www\./, '');
  } catch {
    return html;
  }

  const title = (params.get('t') || '').trim().slice(0, 120) || `A link from ${host}`;
  const description = `Shared on Truegle — opens on Truegle first, so you can see where ${host} goes before you go there.`;
  const shareUrl = `${SITE}/l${url.search}`;

  const meta = [
    ['og:title', title],
    ['og:description', description],
    ['og:type', 'website'],
    ['og:url', shareUrl],
    ['og:image', DEFAULT_IMAGE],
    ['og:site_name', 'Truegle'],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', DEFAULT_IMAGE],
  ];

  let out = html.replace(
    /<meta\s+(?:property|name)="([^"]+)"[^>]*>\s*/gi,
    (match, key) => (OVERRIDDEN_META.has(key) ? '' : match),
  );
  const tags = meta
    .map(([key, value]) => `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escapeAttr(value)}" />`)
    .join('');
  out = out.replace('</head>', `${tags}</head>`);
  return out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)} · Shared on Truegle</title>`);
}

// /tube — True Tube, the player page. It's meant to be handed round ("watch
// this on Truegle"), so it gets its own card instead of the generic site one.
// Everything here is static: unlike /w and /l there is no user-supplied value
// in the URL to reflect, and the optional ?q= is deliberately NOT echoed —
// a card that repeats whatever a stranger typed is a card that can be used to
// put words in Truegle's mouth.
function injectTubePreview(html) {
  const title = 'True Tube — watch and queue on Truegle';
  const description =
    "One player for video, reels and audio, from YouTube, Vimeo, TikTok, SoundCloud and direct files. "
    + "It keeps playing while you search, and the embed can't redirect your tab.";
  const shareUrl = `${SITE}/tube`;

  const meta = [
    ['og:title', title],
    ['og:description', description],
    ['og:type', 'website'],
    ['og:url', shareUrl],
    ['og:image', DEFAULT_IMAGE],
    ['og:site_name', 'Truegle'],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', DEFAULT_IMAGE],
  ];

  let out = html.replace(
    /<meta\s+(?:property|name)="([^"]+)"[^>]*>\s*/gi,
    (match, key) => (OVERRIDDEN_META.has(key) ? '' : match),
  );
  const tags = meta
    .map(([key, value]) => `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escapeAttr(value)}" />`)
    .join('');
  // The shell canonicalises to "/", which would point every share of this page
  // at the landing page. Replace it rather than adding a second one.
  out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/i, '');
  out = out.replace('</head>', `${tags}<link rel="canonical" href="${shareUrl}" /></head>`);
  return out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);
}

// The app's own surfaces (/green /red /feed /chat /creators /creator/<slug>).
// The shell names the homepage as canonical, which told Google each of these
// WAS the homepage — see utils/seoPages.js. Static values only; the one
// URL-derived input is a creator slug that matched the roster exactly.
function injectSeoPage(html, page) {
  const meta = [
    ['og:title', page.title],
    ['og:description', page.description],
    ['og:type', 'website'],
    ['og:url', page.canonical],
    ['twitter:title', page.title],
    ['twitter:description', page.description],
  ];
  let out = html.replace(
    /<meta\s+(?:property|name)="([^"]+)"[^>]*>\s*/gi,
    (match, key) => (OVERRIDDEN_META.has(key) || key === 'description' ? '' : match),
  );
  const tags = meta
    .map(([key, value]) => `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escapeAttr(value)}" />`)
    .join('');
  const ld = [creatorSchema(page), videosSchema(page)]
    .filter(Boolean)
    .map((schema) => `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`)
    .join('');
  out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/i, '');
  out = out.replace(
    '</head>',
    `<meta name="description" content="${escapeAttr(page.description)}" />${tags}<link rel="canonical" href="${page.canonical}" />${ld}</head>`,
  );
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(page.title)}</title>`);
  // Real text and links for a crawler; the app replaces #root on mount.
  return out.replace('<div id="root"></div>', `<div id="root">${crawlBlock(page)}</div>`);
}

// A creator's latest uploads, from YouTube's public channel feed (free, no key).
// Cached an hour at the edge, and bounded to under two seconds: a slow or
// failing YouTube must cost a creator page its video list, never the page. The
// channel id comes from the roster, never from the URL.
async function creatorFeed(creator, context) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`${SITE}/__creator-feed/${creator.channelId}`);
  try {
    const hit = cache ? await cache.match(key) : null;
    if (hit) return parseVideoFeed(await hit.text());
  } catch { /* fall through to a fresh read */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${creator.channelId}`, { signal: controller.signal });
    if (!res.ok) return null;
    const xml = await res.text();
    if (cache) {
      const put = cache.put(key, new Response(xml, { headers: { 'Cache-Control': 'public, max-age=3600' } }));
      if (context.waitUntil) context.waitUntil(put); else put.catch(() => {});
    }
    return parseVideoFeed(xml);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest(context) {
  const { request, next, env } = context;

  // Only process GET/HEAD — skip POST, preflight, etc.
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') return next();

  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';
  const bot = detectBot(ua);
  // Preview rewriting is for every client, not just the AI-bot list: the
  // crawlers that matter here are Discord/iMessage/WhatsApp/Slack.
  const isWatch = url.pathname === '/w' || url.pathname === '/w/';
  const isLink = url.pathname === '/l' || url.pathname === '/l/';
  const isTube = url.pathname === '/tube' || url.pathname === '/tube/';
  const seoPage = (isWatch || isLink || isTube) ? null : seoFor(url.pathname);

  // Nothing to do — pass through instantly
  if (!bot && !isWatch && !isLink && !isTube && !seoPage) return next();

  // Get the upstream response first (always serve content)
  const response = await next();

  // Only modify HTML — skip assets, JSON, etc.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);

  // A broken preview must never cost the visitor the page itself.
  if (isWatch) {
    try { html = injectWatchPreview(html, url); } catch { /* keep the shell */ }
  } else if (isLink) {
    try { html = injectLinkPreview(html, url); } catch { /* keep the shell */ }
  } else if (seoPage) {
    try {
      const page = seoPage.creator ? withVideos(seoPage, await creatorFeed(seoPage.creator, context)) : seoPage;
      html = injectSeoPage(html, page);
    } catch { /* keep the shell */ }
  } else if (isTube) {
    // A shared queue gets the clip's own card; the bare page gets True Tube's.
    // `p` is the packed queue form (utils/playerLinkPack) — it carries the same
    // sources in ~90% fewer characters, and parsePlayerParams already reads
    // both, so it must count as a shared queue here too or a short link would
    // silently preview as the generic page.
    try {
      html = (url.searchParams.has('u') || url.searchParams.has('p'))
        ? injectWatchPreview(html, url)
        : injectTubePreview(html);
    } catch { /* keep the shell */ }
  }

  if (!bot) return new Response(html, { status: response.status, headers });

  // Track visit count in KV
  let count = 0;
  let overLimit = false;

  if (env.BOT_TRACKING) {
    try {
      const key = kvKey(
        request.headers.get('cf-connecting-ip') || 'unknown',
        bot.token,
      );
      const stored = await env.BOT_TRACKING.get(key);
      count = stored ? parseInt(stored, 10) : 0;
      count++;
      overLimit = count > FREE_TIER_DAILY;
      // 25-hour TTL ensures daily reset with a small grace window
      await env.BOT_TRACKING.put(key, String(count), { expirationTtl: 90000 });
    } catch (_) {
      // KV unavailable — degrade gracefully, inject JSON-LD only
    }
  }

  // Always inject JSON-LD licensing schema into <head> for all bot requests
  html = html.replace('</head>', `${headInjection()}</head>`);

  // Inject visible notice into <body> only when over the free tier
  if (overLimit) {
    html = html.replace(/<body([^>]*)>/, `<body$1>${bodyInjection(bot, count)}`);
  }

  // Return patched response preserving original headers
  headers.set('X-Truegle-Bot', bot.token);
  headers.set('X-Truegle-Bot-Count', String(count));
  headers.set('X-Truegle-License', 'https://truegle.info/ai-licensing');

  return new Response(html, { status: response.status, headers });
}
