/* What Google sees for the app's own surfaces.
 *
 * Search Console, 2026-09-28: /green, /red, /feed, /chat, /creators and every
 * /creator/<slug> were served the SPA shell — whose title and canonical name
 * the HOMEPAGE — so Google treated each as a duplicate of "/" and indexed none
 * of them. functions/_middleware.js now rewrites the head at the edge.
 *
 * This runs that function itself, against the real index.html, and checks:
 *   - each surface gets its OWN title, description, and a single canonical
 *     pointing at itself (never "/"), plus a crawlable h1 and links in #root
 *   - creator pages carry ProfilePage JSON-LD, and only real roster slugs
 *   - creator pages carry the channel's REAL latest uploads (title, date,
 *     VideoObject data) from YouTube's public feed — and fall back to the plain
 *     page, untouched, when that feed is slow, down or garbage
 *   - an unknown slug, "/", "/search" and the other routes are left alone
 *   - /tube and /w still get their own previews (no regression)
 *   - nothing in the URL is echoed into the page
 *   - the retired pages are gone from the sitemap and redirected
 *
 * No browser, no network. Run it:  npm run seo:test
 */
import fs from 'node:fs';
import { createServer } from 'vite';

let pass = 0; let fail = 0;
const ok = (c, l, d = '') => { if (c) { pass++; console.log(`PASS ${l}${d ? ` — ${d}` : ''}`); } else { fail++; console.error(`FAIL ${l}${d ? ` — ${d}` : ''}`); } };

// The shell a client route is really served: the PRERENDERED homepage, whose
// #root already holds the homepage's static body between markers. The plain
// dev index.html (empty root) is checked separately below.
const PLAIN = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SHELL = PLAIN.replace('<div id="root"></div>',
  '<div id="root"><!--truegle-static--><div id="seo-home"><h1>Truegle \u2014 Unbiased, Transparent &amp; Secure Search</h1><p>HOME BODY</p></div><!--/truegle-static--></div>');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { onRequest } = await server.ssrLoadModule('/functions/_middleware.js');
const { CREATORS } = await server.ssrLoadModule('/src/content/creators.js');
const { parseVideoFeed } = await server.ssrLoadModule('/src/utils/seoPages.js');

// A channel feed in YouTube's Atom shape. `&amp;`-style escapes are how the real
// one carries an ampersand or an angle bracket in a title.
const entry = (id, title, published, desc = '') => `<entry><id>yt:video:${id}</id><yt:videoId>${id}</yt:videoId>`
  + `<title>${title}</title><published>${published}</published><media:group><media:title>${title}</media:title>`
  + `<media:thumbnail url="https://i3.ytimg.com/vi/${id}/hqdefault.jpg"/><media:description>${desc}</media:description></media:group></entry>`;
const FEED = (entries) => `<?xml version="1.0"?><feed><yt:channelId>UCx</yt:channelId><title>True Story718</title><author><name>True Story718</name></author>${entries.join('')}</feed>`;
const VIDEOS = [
  entry('aaaaaaaaa01', 'Coincidences &amp; patterns: what is really going on?', '2026-09-25T00:37:37+00:00', 'A description &lt;here&gt;'),
  entry('aaaaaaaaa02', 'Second video', '2026-09-20T10:00:00+00:00'),
  entry('aaaaaaaaa03', '&lt;script&gt;alert(1)&lt;/script&gt; hostile title', '2026-09-19T10:00:00+00:00'),
];

// YouTube is stubbed: `feedMode` is 'ok' | 'down' | 'garbage' | 'hang'.
let feedMode = 'down';
let feedAsked = [];
globalThis.fetch = async (url, opts) => {
  feedAsked.push(String(url));
  if (feedMode === 'hang') return new Promise((_, reject) => { opts?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); });
  if (feedMode === 'down') return new Response('nope', { status: 503 });
  if (feedMode === 'garbage') return new Response('<html>not a feed</html>', { status: 200 });
  return new Response(FEED(VIDEOS), { status: 200 });
};

async function fetchAs(path, ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile') {
  const res = await onRequest({
    request: new Request(`https://truegle.info${path}`, { headers: { 'user-agent': ua } }),
    next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: {},
  });
  return res.text();
}
const ok_ = ok;
const one = (html, re) => (html.match(re) || []).length;
const canon = (html) => [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map((m) => m[1]);
const title = (html) => /<title>([^<]*)<\/title>/.exec(html)?.[1];
const descs = (html) => [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"/g)].map((m) => m[1]);

// ── each surface: own title, own canonical, real text ──────────────────────
const SURFACES = {
  '/green': /Green Mode/, '/red': /Rabbit Hole/, '/feed': /Feed/, '/chat': /Chat/, '/creators': /Creators/,
};
for (const [path, re] of Object.entries(SURFACES)) {
  const html = await fetchAs(path);
  ok(re.test(title(html) || ''), `${path}: has its own title`, title(html));
  ok(canon(html).length === 1 && canon(html)[0] === `https://truegle.info${path}`, `${path}: exactly one canonical, pointing at itself`, canon(html).join(' '));
  ok(descs(html).length === 1 && descs(html)[0].length > 60 && !descs(html)[0].startsWith('Truegle —'), `${path}: one description, not the shell's`, `${descs(html).length} found`);
  ok(one(html, /<h1>/g) === 1 && /<div id="root"><main id="seo-static">/.test(html), `${path}: crawlable h1 inside #root`);
  ok(!html.includes('HOME BODY') && !html.includes('id="seo-home"'), `${path}: the homepage's static body is gone, not left underneath`);
  ok(one(html, /<a href="/g) >= 3, `${path}: real links a crawler can follow`, `${one(html, /<a href="/g)} links`);
  ok(new RegExp(`property="og:url" content="https://truegle.info${path}"`).test(html), `${path}: og:url matches`);
}

// ── /creators lists every creator ──────────────────────────────────────────
{
  const html = await fetchAs('/creators');
  ok(CREATORS.every((c) => html.includes(`href="/creator/${c.slug}"`)), '/creators links to all of the roster', `${CREATORS.length} creators`);
}

// ── every creator page ─────────────────────────────────────────────────────
for (const c of CREATORS) {
  const html = await fetchAs(`/creator/${c.slug}`);
  const good = title(html)?.startsWith(c.name) && canon(html).length === 1 && canon(html)[0] === `https://truegle.info/creator/${c.slug}`;
  ok(good, `/creator/${c.slug}: own title + self canonical`, title(html));
}
{
  const html = await fetchAs('/creator/true-story/');
  // The shell has JSON-LD of its own; find the creator's among them.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  const data = blocks.find((b) => b?.['@type'] === 'ProfilePage') || null;
  ok(data?.['@type'] === 'ProfilePage' && data.mainEntity?.name === 'True Story' && data.mainEntity.sameAs?.length > 0,
    'a creator page carries ProfilePage JSON-LD with their channel', data?.mainEntity?.sameAs?.[0]);
  ok(canon(html)[0] === 'https://truegle.info/creator/true-story', 'a trailing slash does not change the canonical');
}

// ── a creator's real uploads ────────────────────────────────────────────────
{
  const parsed = parseVideoFeed(FEED(VIDEOS));
  ok_(parsed.channelTitle === 'True Story718' && parsed.videos.length === 3, 'the feed parses: channel name and every entry', `${parsed.channelTitle} · ${parsed.videos.length}`);
  ok_(parsed.videos[0].title === 'Coincidences & patterns: what is really going on?', 'XML entities in a title are decoded');
  ok_(parsed.videos[0].thumbnail === 'https://i.ytimg.com/vi/aaaaaaaaa01/hqdefault.jpg' && parsed.videos[0].published === '2026-09-25T00:37:37.000Z', 'thumbnail and date are derived, not trusted');
  ok_(parseVideoFeed('').videos.length === 0 && parseVideoFeed('<html>').videos.length === 0 && parseVideoFeed(null).videos.length === 0, 'empty and garbage input give no videos rather than an error');
  ok_(parseVideoFeed(FEED(Array.from({ length: 30 }, (_, i) => entry(`bbbbbbbb${String(i).padStart(3, '0')}`, `Video ${i}`, '2026-09-01T00:00:00+00:00')))).videos.length === 10, 'at most ten uploads');
  ok_(parseVideoFeed(FEED([entry('short', 'Bad id', '2026-09-01T00:00:00+00:00')])).videos.length === 0, 'an entry without a valid video id is dropped');

  feedMode = 'ok'; feedAsked = [];
  const html = await fetchAs('/creator/true-story');
  ok_(feedAsked.length === 1 && feedAsked[0] === 'https://www.youtube.com/feeds/videos.xml?channel_id=UCQT9VG5hpLKp8of41fvDdtw', 'the edge asks YouTube for THAT creator\'s channel, taken from the roster', feedAsked.join(' '));
  ok_(/<h2>Latest uploads<\/h2>/.test(html) && html.includes('Coincidences &amp; patterns: what is really going on?') && html.includes('<time datetime="2026-09-25T00:37:37.000Z">2026-09-25</time>'), 'the page lists the latest uploads with dates');
  ok_(/name="description" content="Latest: \u201cCoincidences &amp; patterns/.test(html), 'the description leads with the latest upload');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  const list = blocks.find((b) => b?.['@type'] === 'ItemList');
  ok_(list?.itemListElement?.length === 3 && list.itemListElement[0].item['@type'] === 'VideoObject'
    && list.itemListElement[0].item.embedUrl === 'https://www.youtube.com/embed/aaaaaaaaa01' && list.itemListElement[0].item.uploadDate === '2026-09-25T00:37:37.000Z',
  'VideoObject data for each upload', `${list?.itemListElement?.length} items`);
  ok_(blocks.some((b) => b?.['@type'] === 'ProfilePage'), '…alongside the profile data');
  ok_(!html.includes('<script>alert(1)') && !/<script>\s*alert/.test(html) && html.includes('&lt;script&gt;alert(1)&lt;/script&gt; hostile title'), 'a hostile title is escaped, never markup');
  ok_(canon(html).length === 1 && canon(html)[0] === 'https://truegle.info/creator/true-story', 'the canonical is still the creator\'s own page');

  // A feed that is down, garbage or hanging costs the video list, never the page.
  const plain = (await (async () => { feedMode = 'down'; return fetchAs('/creator/true-story'); })());
  for (const mode of ['down', 'garbage']) {
    feedMode = mode;
    const h = await fetchAs('/creator/true-story');
    ok_(h === plain && !h.includes('Latest uploads') && title(h)?.startsWith('True Story'), `YouTube ${mode}: the page is exactly the plain creator page`);
  }
  feedMode = 'hang';
  const t0 = Date.now();
  const hung = await fetchAs('/creator/true-story');
  ok_(Date.now() - t0 < 3500 && hung === plain, 'YouTube hanging is cut off in under two seconds and the page still renders', `${Date.now() - t0}ms`);

  // Only creator pages talk to YouTube.
  feedMode = 'ok'; feedAsked = [];
  await fetchAs('/green'); await fetchAs('/creators'); await fetchAs('/'); await fetchAs('/creator/not-a-real-creator');
  ok_(feedAsked.length === 0, 'no other page, and no unknown slug, ever asks YouTube', feedAsked.join(' ') || 'none');
}

// ── what must NOT change ───────────────────────────────────────────────────
for (const path of ['/creator/not-a-real-creator', '/creator/TRUE-STORY', '/creator/true-story/extra', '/', '/search', '/s/abc', '/onboarding']) {
  const html = await fetchAs(path);
  ok(html === SHELL, `${path}: left exactly as the shell`);
}
{
  const evil = await fetchAs('/creator/true-story"><script>alert(1)</script>');
  ok(evil === SHELL, 'a slug carrying markup matches nothing and is never echoed');
  const html = await fetchAs('/green?q=%3Cscript%3E');
  ok(!html.includes('<script>alert') && !/q=%3C|<script>[^{]*q=/.test(html), 'a query string is never reflected into the page');
}

// ── the existing previews still work ───────────────────────────────────────
{
  const tube = await fetchAs('/tube');
  ok(/True Tube — watch and queue/.test(title(tube) || '') && canon(tube)[0] === 'https://truegle.info/tube', '/tube still gets its own card');
  const w = await fetchAs('/w?u=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ');
  ok(/Truegle Player/.test(title(w) || '') && /ytimg\.com\/vi\/dQw4w9WgXcQ/.test(w), '/w still previews the shared clip');
}

// ── a crawler that is also an AI bot gets both ─────────────────────────────
{
  const html = await fetchAs('/green', 'Mozilla/5.0 (compatible; GPTBot/1.1)');
  ok(canon(html)[0] === 'https://truegle.info/green' && /"license":"https:\/\/truegle\.info\/ai-licensing"/.test(html), 'AI crawlers get the page meta AND the licensing schema');
}

// ── an unprerendered shell (empty root) still works ─────────────────────────
{
  const res = await onRequest({
    request: new Request('https://truegle.info/green', { headers: { 'user-agent': 'Mozilla/5.0' } }),
    next: async () => new Response(PLAIN, { status: 200, headers: { 'content-type': 'text/html' } }),
    env: {},
  });
  const html = await res.text();
  ok(/<div id="root"><main id="seo-static">/.test(html) && one(html, /<h1>/g) === 1, 'an empty-root shell gets the block too');
}

// ── every SPA route is served as HTML ───────────────────────────────────────
// _headers matches the ORIGINALLY REQUESTED path, so each rewrite in
// _redirects needs its own Content-Type rule or the shell is served as
// application/octet-stream with nosniff — /red shipped that way, and the edge
// function skips anything that is not text/html.
{
  const redirects = fs.readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  const headers = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const rules = new Set([...headers.matchAll(/^(\/\S*)\s*\n((?:[ \t]+.*\n?)+)/gm)]
    .filter((m) => /Content-Type:\s*text\/html/i.test(m[2])).map((m) => m[1]));
  const rewrites = [...redirects.matchAll(/^(\/\S+)\s+\/_index\s+200/gm)].map((m) => m[1]);
  const missing = rewrites.filter((r) => !rules.has(r));
  ok(rewrites.length > 10 && missing.length === 0, 'every _redirects rewrite has a text/html rule in _headers', missing.join(' ') || `${rewrites.length} routes`);
}

// ── retired and cleaned up ─────────────────────────────────────────────────
{
  const sitemap = fs.readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const redirects = fs.readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  ok(!/\/advertise/.test(sitemap), 'the sitemap no longer lists /advertise');
  ok(/^\/advertise\/?\s+\/about\/\s+301/m.test(redirects), '/advertise redirects permanently to /about/');
  ok(CREATORS.every((c) => sitemap.includes(`/creator/${c.slug}<`)) && sitemap.includes('/creators<') && sitemap.includes('/chat<'), 'the sitemap lists every creator, /creators and /chat');
  ok(['test.html', 'quick-test.html', 'test-cameras.html', 'test-cors.html'].every((f) => !fs.existsSync(new URL(`../public/${f}`, import.meta.url))), 'the public test pages are gone');
  const llms = fs.readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
  ok(!/Rewards Program|watching an ad|advertise\//i.test(llms), 'llms.txt no longer describes the discontinued Rewards Program or ad page');
}

console.log(`\n${pass} passed, ${fail} failed`);
await server.close();
process.exit(fail ? 1 : 0);
