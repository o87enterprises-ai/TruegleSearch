/**
 * Find the video (or audio) a web page offers for embedding — on ANY site.
 *
 * Owner, 2026-10-08: "If there's a free embed code listed on a site I want
 * Truegle to be able to play it, period." The player used to know twelve
 * platforms by name and nothing else, so a clip on a news site, a college
 * archive or a small video host that hands out its own embed code fell
 * through to "can't play that here".
 *
 * Sites announce their embeds in a handful of standard ways. In the order we
 * trust them:
 *   1. oEmbed discovery — <link type="application/json+oembed">: the site's
 *      own "here is my embed code", the exact thing a Share → Embed box gives
 *   2. Open Graph video — og:video:secure_url / og:video (a player page or a file)
 *   3. Twitter player card — twitter:player (by that spec, always embeddable)
 *   4. Schema.org VideoObject — embedUrl / contentUrl in JSON-LD
 *   5. an embed already ON the page — an <iframe> player, including one
 *      written out in an "embed code" text box
 *   6. a plain <video>/<audio>/<source> file on the page
 *
 * A known platform found this way (a news story wrapping a YouTube clip) comes
 * back as that platform, with its proper controllable player. Anything else is
 * kind 'embed': the site's own player in Truegle's sandboxed frame.
 *
 * A player the site has FORBIDDEN other sites to frame (X-Frame-Options, CSP
 * frame-ancestors) is skipped for the next candidate — it would only ever
 * render as a blank box.
 *
 * Reads pages through utils/safeFetch, which refuses anything that is not the
 * public internet.
 */
const { safeFetch } = require('../utils/safeFetch');

const MEDIA_FILE = /\.(mp4|webm|mov|m4v|m3u8|mp3|m4a|aac|ogg|oga|wav|flac)(\?|#|$)/i;
const AUDIO_FILE = /\.(mp3|m4a|aac|ogg|oga|wav|flac)(\?|#|$)/i;
// What a player's address looks like, so an ad slot or a comment widget on
// the same page is not mistaken for the video.
const PLAYERISH = /(embed|player|video|watch|media|iframe|clip|stream|vod|play)/i;
const NOT_A_PLAYER = /(doubleclick|googlesyndication|googletagmanager|google-analytics|adservice|amazon-adsystem|facebook\.com\/plugins\/(like|share|comments|page)|disqus|recaptcha|hcaptcha|challenges\.cloudflare|accounts\.google|\/ads?\/|outbrain|taboola|newsletter|consent)/i;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/' };
const decode = (s) => String(s || '').replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m);

function attrs(tag) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '');
  return out;
}

function tags(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return (html.match(re) || []).map(attrs);
}

function absolute(href, base) {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol === 'http:') u.protocol = 'https:';  // a secure page cannot frame http
    return u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

function meta(html) {
  const out = {};
  for (const a of tags(html, 'meta')) {
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && out[key] == null) out[key] = a.content;
  }
  return out;
}

function jsonLdVideos(html) {
  const found = [];
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const t = [].concat(node['@type'] || []).join(' ');
    if (/VideoObject|AudioObject/i.test(t)) found.push(node);
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  };
  while ((m = re.exec(html))) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* malformed block — skip it */ }
  }
  return found;
}

/**
 * Every embed a page offers, best first. Pure: no network.
 * @returns {{ candidates: Array<{type:'oembed'|'frame'|'file', url:string, from:string}>, title, poster }}
 */
function extractCandidates(html, baseUrl) {
  const page = String(html || '');
  const m = meta(page);
  const candidates = [];
  const add = (type, url, from) => {
    const abs = absolute(url, baseUrl);
    if (!abs || candidates.some((c) => c.url === abs)) return;
    if (type === 'frame' && NOT_A_PLAYER.test(abs)) return;
    candidates.push({ type: type === 'frame' && MEDIA_FILE.test(abs) ? 'file' : type, url: abs, from });
  };

  for (const l of tags(page, 'link')) {
    if (/json\+oembed/i.test(l.type || '') && l.href) add('oembed', l.href, 'oEmbed');
  }
  const ogType = (m['og:video:type'] || '').toLowerCase();
  const og = m['og:video:secure_url'] || m['og:video:url'] || m['og:video'];
  if (og) add(/^(video|audio)\//.test(ogType) || MEDIA_FILE.test(og) ? 'file' : 'frame', og, 'Open Graph');
  if (m['twitter:player']) add('frame', m['twitter:player'], 'Twitter card');
  for (const v of jsonLdVideos(page)) {
    if (typeof v.embedUrl === 'string') add('frame', v.embedUrl, 'VideoObject');
  }
  // Embed codes written out for copying are HTML-escaped text; decode them
  // so their <iframe> is seen like any other.
  const unescaped = page.replace(/&lt;iframe[\s\S]*?&gt;/gi, (s) => decode(s));
  for (const f of tags(unescaped, 'iframe')) {
    const src = f.src || f['data-src'] || f['data-lazy-src'];
    if (src && PLAYERISH.test(src)) add('frame', src, 'embed on the page');
  }
  if (m['twitter:player:stream']) add('file', m['twitter:player:stream'], 'Twitter card');
  for (const v of jsonLdVideos(page)) {
    if (typeof v.contentUrl === 'string') add('file', v.contentUrl, 'VideoObject');
  }
  for (const name of ['video', 'audio', 'source']) {
    for (const a of tags(page, name)) {
      const src = a.src || a['data-src'];
      if (src && (name !== 'source' || /^(video|audio)\//i.test(a.type || '') || MEDIA_FILE.test(src))) add('file', src, `<${name}> on the page`);
    }
  }
  const titleTag = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(page)?.[1];
  return {
    candidates,
    title: (m['og:title'] || m['twitter:title'] || decode(titleTag) || '').trim().slice(0, 200) || null,
    poster: absolute(m['og:image'] || m['twitter:image'], baseUrl),
  };
}

// Would the browser refuse to put this page in a frame on truegle.info?
function framingForbidden(headers = {}) {
  const xfo = String(headers['x-frame-options'] || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return true;
  const fa = /frame-ancestors([^;]*)/i.exec(String(headers['content-security-policy'] || ''))?.[1];
  if (fa != null) {
    const allowed = fa.trim().split(/\s+/).filter(Boolean);
    if (!allowed.length || allowed.includes("'none'")) return true;
    if (!allowed.some((s) => s === '*' || s === 'https:' || /truegle\.info/i.test(s))) return true;
  }
  return false;
}

const iframeSrcIn = (html) => {
  const f = tags(String(html || ''), 'iframe')[0];
  return f && f.src;
};

/**
 * @param {string} pageUrl  a public web page
 * @param {object} deps     { classify(url) → known-platform media | null, fetch }
 * @returns {Promise<object|null>} { kind, src, title, poster, pageUrl, platform, via }
 */
async function discoverEmbed(pageUrl, { classify = () => null, fetch = safeFetch } = {}) {
  const page = await fetch(pageUrl);
  // The link WAS the file (a .mp4 behind a clean URL).
  if (/^(video|audio)\//i.test(page.type || '')) {
    return { kind: /^audio/i.test(page.type) ? 'audio' : 'video', src: page.url, pageUrl, title: null, poster: null, via: 'direct file' };
  }
  const { candidates, title, poster } = extractCandidates(page.body, page.url);
  const host = (() => { try { return new URL(page.url).hostname.replace(/^www\./, ''); } catch { return null; } })();
  const base = { pageUrl, title, poster, platform: host };

  let framesTried = 0;
  for (const c of candidates) {
    let target = c.url;
    let via = c.from;
    if (c.type === 'oembed') {
      try {
        const res = await fetch(c.url, { accept: 'application/json', maxBytes: 256 * 1024 });
        const j = JSON.parse(res.body);
        const src = iframeSrcIn(j.html);
        if (!src) continue;
        target = absolute(src, c.url);
        if (!target) continue;
        base.title = base.title || (typeof j.title === 'string' ? j.title.slice(0, 200) : null);
        base.poster = base.poster || absolute(j.thumbnail_url, c.url);
      } catch { continue; }
    }
    if (c.type === 'file') {
      return { ...base, kind: AUDIO_FILE.test(target) ? 'audio' : 'video', src: target, via };
    }
    // A known platform behind the page's embed: play it the proper way.
    const known = classify(target);
    if (known) return { ...base, ...known, title: base.title, poster: base.poster || known.poster || null, via };
    // Anything else: the site's own player — if the site allows framing it.
    if (framesTried >= 3) continue;
    framesTried += 1;
    try {
      const probe = await fetch(target, { maxBytes: 64 * 1024 });
      if (framingForbidden(probe.headers)) continue;
    } catch { continue; }
    return { ...base, kind: 'embed', src: target, via };
  }
  return null;
}

module.exports = { discoverEmbed, extractCandidates, framingForbidden };
