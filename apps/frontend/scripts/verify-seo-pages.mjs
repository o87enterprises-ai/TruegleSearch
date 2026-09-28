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

const SHELL = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { onRequest } = await server.ssrLoadModule('/functions/_middleware.js');
const { CREATORS } = await server.ssrLoadModule('/src/content/creators.js');

async function fetchAs(path, ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile') {
  const res = await onRequest({
    request: new Request(`https://truegle.info${path}`, { headers: { 'user-agent': ua } }),
    next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: {},
  });
  return res.text();
}
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
