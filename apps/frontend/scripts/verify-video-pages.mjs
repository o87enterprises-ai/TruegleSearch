/* /v/<id>, sitemap-videos.xml, and real titles on share-link previews.
 *
 * Search Console, 2026-10-23: of ~5,000 roster videos (content/creators.js),
 * 3 were indexed — Google credits a page with ONE video at most, and every
 * creator page carries about ten embeds. This gives each cached video its
 * own page, so there are as many indexable pages as there are videos. Same
 * report, same fix: a packed queue link (/tube?p=…) carries no titles, so its
 * share-preview card showed the raw embed URL instead of the clip's name —
 * now resolved from the roster index or, for anything else, a cached,
 * keyless oEmbed call.
 *
 * No browser, no real network: YouTube's oEmbed endpoint is stubbed. Run it:
 *   npm run videopages:test
 */
import { createServer } from 'vite';

let pass = 0; let fail = 0;
const ok = (c, l, d = '') => { if (c) { pass++; console.log(`PASS ${l}${d ? ` — ${d}` : ''}`); } else { fail++; console.error(`FAIL ${l}${d ? ` — ${d}` : ''}`); } };

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { onRequest } = await server.ssrLoadModule('/functions/_middleware.js');
const { SLUGS, VIDEOS } = await server.ssrLoadModule('/src/content/videoIndex.generated.js');
const { getCreator } = await server.ssrLoadModule('/src/content/creators.js');

const SHELL = '<!doctype html><html><head><title>Truegle</title><link rel="canonical" href="https://truegle.info/" /></head>'
  + '<body><div id="root"><!--truegle-static--><div id="seo-home"><h1>Home</h1></div><!--/truegle-static--></div></body></html>';

// A real entry from the committed index — this IS the data /v/<id> reads, so
// there is nothing to fake for the roster-id cases.
const [REAL_ID, [REAL_SLUG_IDX, REAL_TITLE]] = Object.entries(VIDEOS)[0];
const REAL_CREATOR = getCreator(SLUGS[REAL_SLUG_IDX]);
const UNKNOWN_ID = 'zzzzzzzzzz9'; // right shape, guaranteed absent (not real base64url YouTube form)

let oembedCalls = [];
globalThis.fetch = async (url) => {
  const href = String(url);
  if (href.includes('youtube.com/oembed')) {
    oembedCalls.push(href);
    if (href.includes(UNKNOWN_ID)) return new Response(JSON.stringify({ title: 'A Title From oEmbed' }), { status: 200 });
    return new Response('not found', { status: 404 });
  }
  return new Response('nope', { status: 503 });
};

async function fetchAs(path) {
  const res = await onRequest({
    request: new Request(`https://truegle.info${path}`, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile' } }),
    next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: {},
  });
  return res;
}
const html = async (path) => (await fetchAs(path)).text();
const title = (h) => /<title>([^<]*)<\/title>/.exec(h)?.[1];
const canon = (h) => [...h.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map((m) => m[1]);
const ldBlocks = (h) => [...h.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]
  .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });

// ── a roster video's own page ───────────────────────────────────────────────
{
  const h = await html(`/v/${REAL_ID}`);
  ok(title(h)?.includes(REAL_TITLE) && title(h)?.includes(REAL_CREATOR.name), 'own title carries the video and creator name', title(h));
  ok(canon(h).length === 1 && canon(h)[0] === `https://truegle.info/v/${REAL_ID}`, 'exactly one canonical, pointing at itself', canon(h).join(' '));
  ok(!h.includes('noindex'), 'a roster video is NOT noindexed');

  const video = ldBlocks(h).find((b) => b?.['@type'] === 'VideoObject');
  ok(video?.name === REAL_TITLE, 'VideoObject name matches the title');
  ok(video?.embedUrl === `https://www.youtube-nocookie.com/embed/${REAL_ID}`, 'VideoObject embedUrl is the nocookie embed', video?.embedUrl);
  ok(video?.url === `https://truegle.info/v/${REAL_ID}`, 'VideoObject url is this page, not the creator page');
  ok(typeof video?.thumbnailUrl === 'string' && video.thumbnailUrl.includes(REAL_ID), 'VideoObject has a thumbnail derived from the id');
  ok(typeof video?.description === 'string' && video.description.length > 20, 'VideoObject has a real description');

  const iframes = [...h.matchAll(/<iframe[^>]*src="([^"]*)"/g)].map((m) => m[1]);
  ok(iframes.length === 1 && iframes[0] === `https://www.youtube-nocookie.com/embed/${REAL_ID}`,
    'exactly one real iframe, the video itself — the page has an actual player, not just schema', iframes.join(' '));

  ok(h.includes(`href="/creator/${REAL_CREATOR.slug}"`) && h.includes('href="/creators"') && h.includes('href="/tube"'),
    'links back to the creator page, all creators, and True Tube');
  ok(new RegExp(`property="og:video" content="https://www.youtube-nocookie.com/embed/${REAL_ID}"`).test(h), 'og:video is set');
}

// ── an id that is not a roster video ────────────────────────────────────────
{
  const h = await html(`/v/${UNKNOWN_ID}`);
  ok(/<meta name="robots" content="noindex/.test(h), 'an unknown id is noindexed');
  ok(!ldBlocks(h).some((b) => b?.['@type'] === 'VideoObject'), 'no VideoObject schema is fabricated for it');
  ok(title(h) === 'Truegle', 'the shell\'s own title is left alone otherwise');
}

// ── malformed ids never match the route at all ──────────────────────────────
for (const path of ['/v/short', '/v/toolongforavalididxxxx', '/v/has$bad*chars', '/v']) {
  const h = await html(path);
  ok(h === SHELL, `${path}: not a video route, shell untouched`);
}
{
  const h = await html(`/v/${REAL_ID}/`);
  ok(/<meta name="robots" content="noindex/.test(h) === false && h.includes(REAL_TITLE), 'a trailing slash still resolves the same page');
}

// ── sitemap-videos.xml ──────────────────────────────────────────────────────
{
  const res = await fetchAs('/sitemap-videos.xml');
  const xml = await res.text();
  ok(res.headers.get('content-type')?.includes('application/xml'), 'served as XML');
  ok(xml.startsWith('<?xml') && xml.includes('xmlns:video='), 'well-formed video sitemap header');
  const urlCount = (xml.match(/<url>/g) || []).length;
  ok(urlCount === Object.keys(VIDEOS).length, 'one <url> per cached video', `${urlCount} of ${Object.keys(VIDEOS).length}`);
  ok(xml.includes(`<loc>https://truegle.info/v/${REAL_ID}</loc>`), 'lists the video\'s own page');
  ok(xml.includes(`<video:player_loc allow_embed="yes">https://www.youtube-nocookie.com/embed/${REAL_ID}</video:player_loc>`),
    'player_loc is the nocookie embed, with allow_embed');
  ok(xml.includes(`<video:title>${REAL_TITLE.replace(/&/g, '&amp;')}</video:title>`), 'title is carried, escaped');
}

// ── robots.txt points at it ──────────────────────────────────────────────────
{
  const fs = await import('node:fs');
  const robots = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  ok(/Sitemap:\s*https:\/\/truegle\.info\/sitemap-videos\.xml/.test(robots), 'robots.txt lists the video sitemap');
  const redirects = fs.readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  const headers = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  ok(/^\/v\/\*\s+\/_index\s+200/m.test(redirects), '/v/* is rewritten to the SPA shell');
  ok(/^\/v\/\*\n(?:[ \t]+.*\n?)*[ \t]+Content-Type:\s*text\/html/m.test(headers), '/v/* is served as text/html');
}

// ── real titles on share-link cards (packed queues carry none) ─────────────
{
  oembedCalls = [];
  const packed = `1y${REAL_ID}`; // utils/playerLinkPack's own format: version "1", host "y" (YouTube), the id
  const h = await html(`/tube?p=${packed}`);
  ok((title(h) || '').includes(REAL_TITLE), 'a packed roster video gets its real title on the /tube card', title(h));
  ok(oembedCalls.length === 0, 'a roster video never needs the oEmbed fallback — the index already has its title');
}
{
  oembedCalls = [];
  const packed = `1y${UNKNOWN_ID}`;
  const h = await html(`/tube?p=${packed}`);
  ok((title(h) || '').includes('A Title From oEmbed'), 'a non-roster video falls back to a live, keyless oEmbed title', title(h));
  ok(oembedCalls.length === 1, 'exactly one oEmbed call for it');
}
{
  // /w still works the same way, and a share link that already carries a
  // title (?u=&t=) is untouched — the oEmbed path is for the untitled case.
  oembedCalls = [];
  const h = await html('/w?u=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&t=Rick%20Astley');
  ok((title(h) || '').includes('Rick Astley'), 'a link that already carries a title keeps it, no lookup needed', title(h));
  ok(oembedCalls.length === 0, 'no oEmbed call when a title was already given');
}

console.log(`\n${pass} passed, ${fail} failed`);
await server.close();
process.exit(fail ? 1 : 0);
