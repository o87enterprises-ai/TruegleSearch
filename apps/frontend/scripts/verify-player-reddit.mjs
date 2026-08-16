/* Reddit search in the Tube player, driven in a browser.
 *
 * WHAT WAS BROKEN. The Reddit chip (and the !reddit bang) sent the query to
 * /api/search with category 'social'. That category is served by two OPTIONAL
 * things — the self-hosted SearXNG box and a Google CSE key — and when neither
 * is configured the backend queues no providers at all and answers with an
 * empty list. So Reddit search failed for reasons that had nothing to do with
 * Reddit, and failed silently, which is the worst combination: the UI just
 * said "no results".
 *
 * Reddit's own search.json is public, keyless and always up, and the backend
 * already speaks it for the feed page. The fix asks Reddit about Reddit and
 * keeps the index as the fallback rather than the only route.
 *
 * THE PERMALINK IS THE POINT, and this is the trap the fix had to avoid: a
 * Reddit post's `url` is whatever it LINKS TO — an i.redd.it image, a news
 * site, a v.redd.it blob — and none of those is something the redditmedia
 * embed can play. Only `permalink` is the /r/<sub>/comments/<id> form
 * getPlayable() accepts. So the stub below deliberately gives every post a
 * `url` the player CANNOT play: if the wrong field were read, the list would
 * be empty and these checks would fail.
 *
 * Run it:  npm run reddit:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5195, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5195';
const browser = await launchChromium();

const REDDIT_POSTS = [
  {
    id: 'abc123', platform: 'Reddit', title: 'A cat video',
    // NOT playable. The permalink beside it is.
    url: 'https://i.redd.it/abc123.jpg',
    permalink: 'https://reddit.com/r/cats/comments/abc123/a_cat_video/',
    subreddit: 'r/cats', author: 'u/someone',
    thumbnail: 'https://b.thumbs.redditmedia.com/x.jpg',
  },
  {
    id: 'def456', platform: 'Reddit', title: 'Another cat',
    url: 'https://example.com/news/story',
    permalink: 'https://reddit.com/r/cats/comments/def456/another_cat/',
    subreddit: 'r/cats', author: 'u/other', thumbnail: null,
  },
];

/** One page load, with the social feed either answering or failing. */
async function run(query, { feedWorks = true } = {}) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route('**/api/**', (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const body = req.postData() ? (() => { try { return JSON.parse(req.postData()); } catch { return null; } })() : null;
    calls.push({ path: u.pathname, body });
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname.includes('/social/feed')) {
      if (!feedWorks) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' });
      return json({
        query: body?.query || '', results: [],
        platforms: { reddit: REDDIT_POSTS, hackernews: [], github: [] },
        nextCursor: {}, errors: {},
      });
    }
    // The index path — the old route, kept as the fallback. It answers with a
    // DIFFERENT post so the two sources can be told apart in the list.
    if (u.pathname.includes('/api/search')) {
      return json({ results: [
        { title: 'Indexed cat thread', url: 'https://www.reddit.com/r/cats/comments/zzz999/indexed_cat_thread/' },
      ] });
    }
    return json({ success: true, data: [], results: [] });
  });
  await ctx.route('**/*.mapbox.com/**', (r) => r.abort());
  await ctx.route('**/tile.openstreetmap.org/**', (r) => r.abort());

  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/tube?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  // The search is debounced and the ladder has several rungs; poll for a row
  // rather than guessing a duration.
  await page.waitForFunction(
    () => /cat/i.test(document.body.innerText),
    null, { timeout: 25000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  await ctx.close();
  return { calls, text, errs };
}

// ── 1. Reddit is asked about Reddit ─────────────────────────────────────────
const a = await run('!reddit cats');
const feedCall = a.calls.find((c) => c.path.includes('/social/feed'));
check(!!feedCall, 'a Reddit search reaches Reddit\'s own keyless endpoint');
check(feedCall?.body?.platforms?.length === 1 && feedCall.body.platforms[0] === 'reddit',
  '…for Reddit only, not the whole social feed', JSON.stringify(feedCall?.body?.platforms));
check(feedCall?.body?.query === 'cats',
  '…carrying the words, with the !reddit bang stripped', JSON.stringify(feedCall?.body?.query));

// The rows only exist if the PERMALINK was read; every stub `url` is
// unplayable on purpose.
check(/A cat video/.test(a.text),
  'the post appears in the player list, so the permalink was used and not the link target');
check(/Another cat/.test(a.text), '…and so does the second one');

// ── 2. the index is the fallback, not the only route ────────────────────────
// It used to be the only route, which is why an unconfigured SearXNG was
// indistinguishable from Reddit having nothing.
const b = await run('!reddit cats', { feedWorks: false });
check(b.calls.some((c) => c.path.includes('/api/search')),
  'when Reddit is unreachable the search still falls through to the index');
check(/Indexed cat thread/.test(b.text),
  '…and what the index found is shown rather than an empty list');

// ── 3. everything else is left alone ────────────────────────────────────────
// The Reddit rung must not fire for a query nobody pointed at Reddit — it
// would be a request per keystroke against an endpoint that cannot answer.
const c = await run('!yt lofi beats');
check(!c.calls.some((x) => x.path.includes('/social/feed')),
  'a YouTube search never asks the Reddit endpoint',
  c.calls.filter((x) => x.path.includes('/social')).map((x) => x.path).join(' · ') || 'none');

check([...a.errs, ...b.errs, ...c.errs].length === 0, 'nothing threw',
  [...a.errs, ...b.errs, ...c.errs].slice(0, 3).join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
