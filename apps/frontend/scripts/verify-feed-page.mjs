/* The Feed page, end to end, in a browser.
 *
 * The backend half is covered by jest with axios stubbed. This is about the
 * things only a real browser can answer:
 *
 *   Does the page LOOK like the search page? That is the whole reason it was
 *     built on a shared shell instead of a seventh copy-paste, and geometry is
 *     the only honest way to check it — a screenshot diff would fail on a
 *     particle field that is different every frame.
 *   Are the providers that cannot work actually un-pressable?
 *   Does the connect handshake round-trip, cursor and all?
 *   Does paging ask for the NEXT page rather than the same one?
 *   Does typing search only the accounts somebody actually connected?
 *
 * The API is stubbed at the browser, so this needs no backend and no network.
 *
 * Run it:  npm run feedpage:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5173, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5173';

const browser = await launchChromium();

// Every /api/social* call, so the test can assert on what was ASKED rather
// than only on what appeared.
const calls = [];
// Flipped for the last section, which checks what a refused handshake looks
// like. The reason travels on the navigation now, not in the URL, so it is its
// own failure mode rather than a variation on the happy path.
let failExchange = false;
// A platform whose upstream REFUSES: the route still answers 200, with the
// reason in `errors`. Module-level, like failExchange, because the stub is
// installed once per context and the flag is flipped around a single case.
let feedUpstreamFails = false;

async function makeContext(opts = {}) {
  const ctx = await testContext(browser, opts);
  await ctx.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ path: url.pathname, body, search: url.search });
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });

    // The demo authorize leg: a 302 straight back to our own callback, which
    // is exactly what the real adapter does when it has no credentials.
    if (url.pathname.endsWith('/start')) {
      const provider = url.pathname.split('/')[3];
      return route.fulfill({
        status: 302,
        headers: { location: `${BASE}/feed/callback?provider=${provider}&code=demo_x&state=st_1` },
      });
    }
    // The handshake's return leg. Only the REFUSAL is exercised below, because
    // no provider has status 'demo' any more — the success branch is kept as
    // the shape the seam has to produce whenever one reopens.
    if (url.pathname.endsWith('/exchange')) {
      if (failExchange) return json({ error: 'Reddit turned that down.' }, 400);
      const provider = url.pathname.split('/')[3];
      return json({ success: true, connection: { provider, handle: 'demo_user', connectedAt: new Date().toISOString() } });
    }
    if (url.pathname === '/api/social/feed') {
      // A platform that REFUSED. The route answers 200 with an empty result
      // set and the reason in `errors` — which is exactly the shape that used
      // to render as a blank page with nothing to report.
      if (feedUpstreamFails) {
        return json({
          query: body?.query || '',
          results: [],
          platforms: { hackernews: [], github: [] },
          nextCursor: { github: null },
          errors: { github: 'HTTP 403 — GitHub refused this request' },
        });
      }
      const page = body?.cursor?.github ? 2 : 1;
      return json({
        query: body?.query || '',
        results: Array.from({ length: 6 }, (_, i) => ({
          id: `p${page}_${i}`,
          platform: 'GitHub',
          title: `${body?.query ? `Result for ${body.query}` : 'Popular post'} ${page}-${i}`,
          url: 'https://example.com/x',
          permalink: 'https://example.com/x',
          snippet: 'body text',
          author: 'someone',
          subreddit: null,
          date: '2026-01-01T00:00:00Z',
          score: 10,
          comments: 2,
        })),
        // Page two is the last one, so the feed can be seen to END.
        nextCursor: { github: page === 1 ? 'gh_next' : null },
        errors: { github: null },
      });
    }
    return json({ success: true, results: [] });
  });
  return ctx;
}

const errs = [];

// ── 1. layout parity with /search ───────────────────────────────────────────
// The check that stops this becoming the sixth dead fork of the search page.
const ctx1 = await makeContext();
const page = await ctx1.newPage();
page.on('pageerror', (e) => errs.push(e.message));

const geometry = async (p) => p.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width) };
  };
  return {
    // The two rails that define the layout.
    outer: box('.max-w-7xl'),
    inner: box('.max-w-4xl'),
    shell: !!document.querySelector('.relative.z-10.min-h-screen'),
  };
});

await openApp(page, `${BASE}/search`);
const searchGeo = await geometry(page);

await openApp(page, `${BASE}/feed`);
const feedGeo = await geometry(page);

check(!!searchGeo.outer && !!feedGeo.outer, 'both pages render the outer rail',
  `search ${JSON.stringify(searchGeo.outer)} · feed ${JSON.stringify(feedGeo.outer)}`);
check(JSON.stringify(searchGeo.outer) === JSON.stringify(feedGeo.outer),
  '/feed and /search put the outer rail in exactly the same place',
  `search ${JSON.stringify(searchGeo.outer)} vs feed ${JSON.stringify(feedGeo.outer)}`);
check(JSON.stringify(searchGeo.inner) === JSON.stringify(feedGeo.inner),
  '…and the search-bar rail too',
  `search ${JSON.stringify(searchGeo.inner)} vs feed ${JSON.stringify(feedGeo.inner)}`);
check(feedGeo.shell, 'the feed uses the shared page shell');

// ── 2. the arrival state is honest about what cannot work ───────────────────
// Queried by data-provider rather than by visible text: the X pill's label is
// one character and its note contains every other provider's words, so any
// prose-matching filter either misses it or matches everything.
const pills = await page.evaluate(() => [...document.querySelectorAll('[data-provider]')]
  .map((b) => ({ id: b.dataset.provider, ready: b.dataset.ready, text: (b.textContent || '').trim(), disabled: b.disabled })));

check(pills.length >= 6, 'every provider gets a pill', `${pills.length} pills`);
// REDDIT IS SHUT, AND THE PILL HAS TO SAY SO.
// It shipped as the connectable one, described as "the one that fully works".
// Reddit then closed new Data API registration to everything except moderation
// tools (r/reddit.com/wiki/api), so there is no application to make and no tier
// to buy. A pill still promising free OAuth would be a lie on screen, and the
// kind somebody only discovers after connecting and getting an empty feed.
const reddit = pills.find((p) => p.id === 'reddit');
check(reddit && reddit.disabled, 'Reddit is no longer offered as connectable',
  reddit ? `disabled=${reddit.disabled}` : 'missing');
check(/moderation/i.test(reddit?.text || ''),
  '…and names the real reason rather than a vague "coming soon"',
  reddit?.text.replace(/\s+/g, ' ').slice(0, 90));

// The connectable one is now a PUBLIC SOURCE: no account, no handshake.
const github = pills.find((p) => p.id === 'github');
check(github && !github.disabled, 'GitHub is connectable', github ? `disabled=${github.disabled}` : 'missing');
const locked = pills.filter((p) => p.ready === 'no');
check(locked.length > 0 && locked.every((p) => p.disabled),
  'every provider that cannot serve a feed is un-pressable',
  locked.map((p) => `${p.id}:${p.disabled}`).join(' '));
check(locked.every((p) => /Coming soon/i.test(p.text)),
  '…and says so, with the real reason rather than a placeholder',
  locked[0]?.text.replace(/\s+/g, ' ').slice(0, 80));

// ── 3. switching on a source fills the feed ─────────────────────────────────
// NO HANDSHAKE IS EXERCISED HERE ANY MORE, and that is the point rather than a
// gap: with Reddit closed, every provider left is either 'soon' or a public
// source needing no account. The OAuth route and the Reddit adapter stay in the
// tree as the seam for whenever a provider reopens — but nothing in the UI can
// reach them, so a test asserting the handshake would be testing a path no
// visitor can take.
calls.length = 0;
await page.click('[data-provider="github"]');
// `attached`, not the default `visible` — the marker is a `hidden` div, so it
// is by definition never visible and the default state waits forever on an
// element that is already there and already correct.
await page.waitForSelector('[data-feed-state="connected"]', { state: 'attached', timeout: 20000 });
// Wait for the feed request the connection triggers, not for a guess at how
// long it takes to arrive.
await until(() => calls.some((c) => c.path === '/api/social/feed'), { what: 'the first feed request' });
await until(() => page.locator('text=Popular post 1-0').count().then((n) => n > 0), { what: 'the first page of posts' });

check(!calls.some((c) => c.path.includes('/social-auth/')),
  'a public source needs no handshake at all', calls.map((c) => c.path).join(' '));
check(await page.evaluate(() => JSON.parse(localStorage.getItem('truegle_feed_connections') || '[]').length) === 1,
  'the connection is remembered');
check(new URL(page.url()).pathname === '/feed', 'and you stay on /feed', page.url());

const firstFeed = calls.find((c) => c.path === '/api/social/feed');
check(!!firstFeed, 'the feed is requested once connected');
check(firstFeed?.body?.platforms?.includes('github'), 'for the connected provider',
  JSON.stringify(firstFeed?.body?.platforms));
check(await page.locator('text=Popular post 1-0').count() > 0, 'and the posts are on screen');

// It must NOT claim to be a personal feed, because it cannot be one yet.
check(await page.locator('text=Popular right now').count() > 0,
  'the page says what this actually is rather than calling it "your feed"');

// ── 4. the next page is asked for with the NEXT cursor ──────────────────────
// Deliberately NOT "scroll, then assert a request": six cards are shorter than
// the viewport, so the sentinel is already inside its 600px margin and page two
// loads without anybody scrolling. That is the correct behaviour — a feed that
// does not fill the screen has to keep going — and it is the same code path a
// real scroll takes, so this asserts on the requests themselves.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await until(() => calls.filter((c) => c.path === '/api/social/feed').length > 1,
  { what: 'a second page to be requested' });
await until(() => page.locator('text=Popular post 2-0').count().then((n) => n > 0),
  { what: 'the second page to append' });
const more = calls.filter((c) => c.path === '/api/social/feed');
check(more.length > 1, 'a feed shorter than the screen keeps paging on its own', `${more.length} requests`);
check(more.some((c) => c.body?.cursor?.github === 'gh_next'),
  '…carrying the cursor the last page handed back, not starting over',
  more.map((c) => JSON.stringify(c.body?.cursor)).join(' '));
// One connect is one page-one fetch. Two meant the page was remounting on the
// callback→/feed hop and re-fetching everything it had just loaded.
check(more.filter((c) => !Object.keys(c.body?.cursor || {}).length).length === 1,
  '…and page one is fetched once per connect, not again on the way back',
  `${more.filter((c) => !Object.keys(c.body?.cursor || {}).length).length} cursorless requests`);
check(await page.locator('text=Popular post 2-0').count() > 0, 'and the second page appends');
check(await page.locator('text=Popular post 1-0').count() > 0, '…without replacing the first');

// The stub says page two is the last. The feed must stop rather than spin.
calls.length = 0;
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
// THE ONE HONEST SLEEP. This asserts a request does NOT happen, and there is no
// event for "nothing is going to arrive" — the only way to test a negative is to
// give it long enough to have arrived and then look. Kept short and kept
// explained, so it does not get copied as the house style.
await page.waitForTimeout(1200);
check(calls.filter((c) => c.path === '/api/social/feed').length === 0,
  'an exhausted feed stops asking instead of spinning on a dead cursor');

// ── 5. typing searches only the connected accounts ──────────────────────────
calls.length = 0;
await page.fill('textarea', 'raspberry pi');
await page.keyboard.press('Enter');
await until(() => calls.some((c) => c.path === '/api/social/feed' && c.body?.query === 'raspberry pi'),
  { what: 'the typed query to reach the feed' });
const searched = calls.filter((c) => c.path === '/api/social/feed');
check(searched.length > 0, 'typing searches the feed', `${searched.length} requests`);
check(searched[0]?.body?.query === 'raspberry pi', '…for what was typed', searched[0]?.body?.query);
// REPORTED: "Feed (reddit) is pulling GitHub results." It was. Connecting one
// source used to send platforms: ['reddit','hackernews','github'], on the
// reasoning that the keyless two may as well ride along — which padded the feed
// with things nobody asked for and gave no way to switch them off, because they
// were not pills. One source connected means one source searched. Reddit is the
// provider that is shut now, but the rule is the rule whichever way round it is.
check(searched.every((c) => JSON.stringify(c.body.platforms) === JSON.stringify(['github'])),
  '…and only across what is connected — one source connected is one source searched',
  JSON.stringify(searched[0]?.body?.platforms));

// ── 5b. a public source is switched on, not signed into ─────────────────────
// Hacker News and GitHub are keyless and accountless. Sending them round the
// OAuth handshake would be theatre, and the kind that teaches people to expect
// Truegle to ask for logins it does not need.
calls.length = 0;
// Reachable from the CONNECTED state: the arrival pills are gone by now, and
// "you can only add one, ever" would be a dead end. ConnectedRow carries the
// not-yet-added ones. Hacker News is the second source here because GitHub is
// already on from §3 — adding a source must not replace the one before it.
await page.click('[data-provider="hackernews"]');
await until(() => calls.some((c) => (c.body?.platforms || []).includes('hackernews')),
  { what: 'Hacker News to reach the feed request' });
check(!calls.some((c) => c.path.includes('/social-auth/hackernews')),
  'switching on a public source involves no handshake',
  calls.map((c) => c.path).join(' '));
const withHn = calls.filter((c) => c.path === '/api/social/feed');
check(withHn.some((c) => (c.body.platforms || []).includes('hackernews')),
  '…and it does reach the feed request', JSON.stringify(withHn[0]?.body?.platforms));
check(withHn.every((c) => (c.body.platforms || []).includes('github')),
  '…alongside the source already connected, not instead of it',
  JSON.stringify(withHn[0]?.body?.platforms));

// ── 6. the mode pill cycles rather than navigating ──────────────────────────
// It shipped navigating on the click, which meant one press threw you off the
// feed into /chat and blue/green/red were unreachable from here — you cannot
// walk a cycle if the first step leaves the page. Every other page cycles on
// click and decides where a submit goes at submit time.
const pillText = () => page.locator('.relative.z-20 button').first().innerText();
const before = await pillText();
await page.locator('.relative.z-20 button').first().click();
await until(async () => (await pillText()).trim() !== before.trim(), { what: 'the pill to advance' });
check(new URL(page.url()).pathname === '/feed',
  'clicking the mode pill stays on the feed instead of navigating away', page.url());
check((await pillText()).trim() !== before.trim(),
  '…and advances the mode, so the whole cycle is reachable',
  `${before.trim()} → ${(await pillText()).trim()}`);

// Submitting is what carries the query to the mode now selected.
await page.fill('textarea', 'hello');
await page.keyboard.press('Enter');
await until(() => new URL(page.url()).pathname !== '/feed', { what: 'the submit to navigate' });
check(new URL(page.url()).pathname !== '/feed',
  'submitting on a cycled pill is what leaves the page', page.url());
await openApp(page, `${BASE}/feed`);

// ── 7. a fresh browser is back to the arrival state ─────────────────────────
const ctx2 = await makeContext();
const clean = await ctx2.newPage();
clean.on('pageerror', (e) => errs.push(e.message));
await openApp(clean, `${BASE}/feed`);
check(await clean.locator('text=Your feeds, in one place').count() > 0,
  'a browser that has connected nothing sees the sign-in state');
check(await clean.evaluate(() => performance.getEntriesByType('resource').filter((r) => /social\/feed/.test(r.name)).length) === 0,
  '…and asks for no feed at all until something is connected');

// ── 8. a refused handshake says so, on /feed ────────────────────────────────
// The failure reason is handed over on the navigation rather than left in the
// URL, so it has to survive a route change to be seen at all — and a refusal
// must not leave a connection behind.
//
// DRIVEN BY THE ROUTE, NOT A PILL. No provider has status 'demo' any more, so
// there is no pill that starts a handshake — but /feed/callback is still a live
// route anything can land on: a stale link, a Back button, or a provider
// redirect arriving for a source that has since shut. Reddit is exactly that
// case, which is why it is the provider on the URL.
failExchange = true;
const ctx3 = await makeContext();
const sad = await ctx3.newPage();
sad.on('pageerror', (e) => errs.push(e.message));
await sad.goto(`${BASE}/feed/callback?provider=reddit&code=demo_x&state=st_1`, { waitUntil: 'domcontentloaded' });
await sad.waitForSelector('[data-feed-state]', { state: 'attached', timeout: 20000 });
await until(() => sad.locator('text=Reddit turned that down.').count().then((n) => n > 0),
  { what: 'the refusal to be shown' });

check(new URL(sad.url()).pathname === '/feed', 'a refused handshake still lands on /feed', sad.url());
check(await sad.locator('text=Reddit turned that down.').count() > 0,
  '…and shows the provider’s actual reason rather than failing silently');
check(await sad.evaluate(() => JSON.parse(localStorage.getItem('truegle_feed_connections') || '[]').length) === 0,
  '…and records no connection for a handshake that did not succeed');

// ── an upstream that refuses says so ────────────────────────────────────────
//
// This is the bug behind "the feed won't load". The route answers 200 with an
// empty list and the reason in `errors`; the hook fetched that field and threw
// it away, so a BLOCKED platform and a platform with nothing to show rendered
// identically — a blank page. Worse, a failed platform reports a null cursor
// exactly like an exhausted one, so the feed marked itself finished on page
// one and the sentinel never asked again.
feedUpstreamFails = true;
const ctxErr = await makeContext();
const errPage = await ctxErr.newPage();
errPage.on('pageerror', (e) => errs.push(e.message));
await errPage.addInitScript(() => {
  localStorage.setItem('truegle_feed_connections', JSON.stringify([
    { provider: 'github', handle: null, connectedAt: new Date().toISOString() },
  ]));
});
await openApp(errPage, `${BASE}/feed`);

// Wait for the PANEL, not for the page. openApp returns as soon as the app has
// rendered, which is well before the seeded connection's feed request has gone
// out and come back — so reading this straight away caught an empty document
// about one run in three. The old four-second sleep hid that by being longer
// than the round trip, which is exactly the kind of thing a fixed sleep hides
// until the day it does not.
const reported = await until(async () => errPage.evaluate(() => {
  const box = document.querySelector('[data-feed-upstream-errors]');
  return box ? box.innerText.replace(/\s+/g, ' ').trim() : null;
}), { what: 'the upstream error panel' }).catch(() => null);
check(!!reported, 'a refused upstream is reported on the page, not swallowed');
// `GitHub`, not `Github`. The panel used to `capitalize` the raw platform id,
// which produced "Github" and "Hackernews" — machine-generated-looking, and
// wrong in a way people notice.
check(/GitHub/.test(reported || ''), '…naming the platform, spelled the way the platform spells it',
  reported?.slice(0, 60));
check(/403|refused/i.test(reported || ''),
  '…and giving the upstream\'s actual reason', reported?.slice(0, 90));

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
