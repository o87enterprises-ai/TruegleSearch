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

// ── 2. the servers list is honest about what cannot work ───────────────────
// THIS MOVED. It used to read the arrival screen's provider grid, but the
// arrival screen is no longer a gate: the keyless sources default on, so there
// is always a feed and nothing to gate. The full provider list — including the
// ones that cannot work and why — now lives in the Servers dropdown, and the
// same honesty has to hold there or it holds nowhere.
await page.click('[data-feed-servers-toggle]');
await until(() => page.locator('[data-feed-server]').count().then((n) => n > 0),
  { what: 'the servers menu to open' });

// Queried by data attribute rather than by visible text: the X row's label is
// one character and its note contains every other provider's words, so any
// prose-matching filter either misses it or matches everything.
const pills = await page.evaluate(() => [...document.querySelectorAll('[data-feed-server]')]
  .map((b) => ({ id: b.dataset.feedServer, ready: b.dataset.usable, text: (b.textContent || '').trim(), disabled: b.disabled })));

check(pills.length >= 6, 'every provider is listed as a server', `${pills.length} listed`);

// EVERY PROVIDER IS READABLE NOW, so this no longer asserts that specific ones
// are greyed — it asserts the RULE that survives either way.
//
// The four checks this replaces pinned a roster: "Reddit is disabled", "its
// note says moderation", "some provider is un-pressable". All were true while
// the feed read platforms through their own APIs and most of those APIs were
// shut. The feed reads public pages through our own search index now, so there
// is no API to be shut out of and nothing is greyed. A test asserting that
// something MUST be broken is a test that fights the fix.
//
// What still has to hold: anything that cannot work says so and cannot be
// pressed, and anything selectable carries a real explanation rather than a
// placeholder.
const locked = pills.filter((p) => p.ready === 'no');
check(locked.every((p) => p.disabled),
  'any provider that cannot serve a feed is un-pressable',
  locked.length ? locked.map((p) => `${p.id}:${p.disabled}`).join(' ') : 'none are locked today');
check(pills.every((p) => (p.text || '').replace(/\s+/g, ' ').trim().length > 10),
  'every provider carries a real explanation, not a placeholder',
  pills.find((p) => (p.text || '').trim().length <= 10)?.id || 'all have one');

// Reddit specifically, because it is the one that has moved twice: it shipped
// connectable, went grey when Reddit closed the Data API, and is readable again
// now WITHOUT a credential because its posts are public pages like any other.
const reddit = pills.find((p) => p.id === 'reddit');
check(reddit && !reddit.disabled,
  'Reddit is selectable again — read as public pages, not through its API',
  reddit ? `disabled=${reddit.disabled}` : 'missing');

const github = pills.find((p) => p.id === 'github');
check(github && !github.disabled, 'GitHub is selectable', github ? `disabled=${github.disabled}` : 'missing');
await page.keyboard.press('Escape');

// ── 3. the feed fills on arrival, with nothing connected ───────────────────
// REVERSED DELIBERATELY, and this is the load-bearing change on the page.
// This used to be "switching on a source fills the feed": the arrival screen
// was a gate, and no feed was requested until somebody picked something. The
// spec's "Servers … Default all" replaced that — every keyless source is on
// from the first paint, so the feed is already loading before anybody clicks
// anything, and a first run is a feed rather than homework.
//
// What must NOT change is that this only ever defaults on sources needing no
// account. Silently switching on an account-based source would fetch nothing
// and report an error the visitor did not cause — §7 pins that.
calls.length = 0;
// CLEAR THE NEVER-REPEAT LEDGER FIRST. §1 and §2 already loaded this page, and
// the ledger persists in localStorage precisely so a reload does not re-offer
// what you have already been shown — so without this the stub's fixed posts
// are all correctly suppressed and §3 asserts against a legitimately empty
// feed. Clearing it is what makes this a FRESH browser rather than a returning
// one; §3b below covers what happens when the ledger does suppress everything.
await page.evaluate(() => localStorage.removeItem('truegle_feed_seen_v1'));
await openApp(page, `${BASE}/feed`);
await until(() => calls.some((c) => c.path === '/api/social/feed'),
  { what: 'the feed request that arriving alone triggers' });
await until(() => page.locator('text=Popular post 1-0').count().then((n) => n > 0),
  { what: 'the first page of posts' });

check(true, 'arriving on /feed requests a feed with nothing connected');
check(!calls.some((c) => c.path.includes('/social-auth/')),
  'and no handshake is involved at all', calls.map((c) => c.path).join(' '));

const firstFeed = calls.find((c) => c.path === '/api/social/feed');
check(!!firstFeed, 'the feed is requested');
check(firstFeed?.body?.platforms?.includes('github'), 'for the default-on servers',
  JSON.stringify(firstFeed?.body?.platforms));
check(await page.locator('text=Popular post 1-0').count() > 0, 'and the posts are on screen');
check(new URL(page.url()).pathname === '/feed', 'and you stay on /feed', page.url());

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
// The rule is unchanged; what counts as "asked for" is. With Servers defaulting
// to every keyless source, hackernews and github are both legitimately on — so
// the assertion is that the request carries EXACTLY the switched-on servers and
// nothing else. A source that cannot serve a feed (Reddit, today) must never
// appear, which is the half that actually caught the original bug.
// DERIVED FROM THE PAGE, not a hardcoded pair. This listed ['github',
// 'hackernews'] and broke the moment five more keyless sources were added —
// which is a test pinning today's provider roster rather than the rule. The
// rule is: the request carries exactly the servers that are switched on.
const usable = await page.evaluate(async () => {
  const open = () => document.querySelector('[data-feed-servers-toggle]');
  if (!document.querySelector('[data-feed-server]')) open()?.click();
  await new Promise((r) => setTimeout(r, 100));
  return [...document.querySelectorAll('[data-feed-server][data-usable="yes"]')]
    .map((b) => b.dataset.feedServer).sort();
});
await page.keyboard.press('Escape');
check(usable.length >= 5, 'the feed has more than a couple of keyless sources to draw on',
  `${usable.length}: ${usable.join(',')}`);
check(searched.every((c) => JSON.stringify([...c.body.platforms].sort()) === JSON.stringify(usable)),
  '…and only across the servers that are switched on, with nothing smuggled in',
  `sent ${JSON.stringify(searched[0]?.body?.platforms)} vs usable ${JSON.stringify(usable)}`);
// The rule this replaces was "never send reddit", which was right while Reddit
// was the one source that could not answer and is wrong now that it can. The
// durable version: never send a platform the page does not list as usable —
// which catches a source being smuggled into the request whichever source it is.
check(searched.every((c) => (c.body.platforms || []).every((pl) => usable.includes(pl))),
  '…and never a platform the page does not offer',
  `sent ${JSON.stringify(searched[0]?.body?.platforms)}`);

// ── 5b. a public source is switched on, not signed into ─────────────────────
// Hacker News and GitHub are keyless and accountless. Sending them round the
// OAuth handshake would be theatre, and the kind that teaches people to expect
// Truegle to ask for logins it does not need.
//
// REWRITTEN for default-all. This used to click the pill and WAIT for the feed
// request that switching the source on triggered — but every keyless source is
// already on from the first paint now, so that request never comes and the wait
// could only ever time out. What is still worth pinning is the rule the section
// was named for: touching a public source must not start a handshake.
calls.length = 0;
await page.click('[data-provider="hackernews"]');
// A negative needs a moment to have failed to happen; there is no event for
// "no request was made". Kept short and kept explained.
await page.waitForTimeout(800);
check(!calls.some((c) => c.path.includes('/social-auth/')),
  'switching on a public source involves no handshake at all',
  calls.map((c) => c.path).join(' ') || '(no calls)');
check(await page.evaluate(() => JSON.parse(localStorage.getItem('truegle_feed_connections') || '[]')
  .some((c) => c.provider === 'hackernews')),
  '…and is recorded locally, with no account anywhere');
// It was already in the feed request before the click, because it is keyless
// and therefore on by default — which is the whole point of default-all.
check(searched.every((c) => (c.body.platforms || []).includes('hackernews')),
  '…having already been in the feed request, since a keyless source needs no permission',
  JSON.stringify(searched[0]?.body?.platforms));

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

// ── 7. a fresh browser gets a feed, and no account switched on for it ──────
// REVERSED, for the same reason as §3. This asserted that a browser which had
// connected nothing saw a sign-in screen and asked for no feed at all. That was
// right while every source needed an account and became wrong the moment the
// keyless ones defaulted on.
//
// The half that still matters — and is arguably the more important half — is
// the last check. "Default all" must mean "all the sources that need nothing
// from you", never "we quietly connected some accounts on your behalf". If
// that ever regresses, a fresh visitor would appear to have connections they
// never made.
const ctx2 = await makeContext();
const clean = await ctx2.newPage();
clean.on('pageerror', (e) => errs.push(e.message));
calls.length = 0;
await openApp(clean, `${BASE}/feed`);
await until(() => calls.some((c) => c.path === '/api/social/feed'),
  { what: 'the fresh browser to ask for a feed on its own' }).catch(() => {});
const freshCalls = [...calls];
check(await clean.locator('[data-feed-state="connected"]').count() > 0,
  'a browser that has connected nothing still lands on a feed, not a gate');
// COUNTED AT THE ROUTE, NOT VIA performance.getEntriesByType. These requests
// are fulfilled by the route handler and never become resource timings, so the
// entry list is empty whatever happens — which means the assertion this
// replaced ("=== 0") passed vacuously and could not have caught a regression in
// either direction.
check(freshCalls.some((c) => c.path === '/api/social/feed'),
  '…and asks for that feed without being told to',
  freshCalls.map((c) => c.path).join(' ') || '(no calls)');
check(await clean.evaluate(() => JSON.parse(localStorage.getItem('truegle_feed_connections') || '[]').length) === 0,
  '…while connecting no account on its behalf');

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

// ── 9. a fully-seen feed repeats rather than rendering blank ───────────────
// LAST, deliberately. It reloads the page, and the page-one request counts in
// the paging section are only meaningful if nothing reloads underneath them.
// The upstream-failure section above leaves the stub refusing, so put it back
// first — otherwise this asserts against a feed that is empty for a different
// reason entirely.
feedUpstreamFails = false;
// The never-repeat ledger is persistent by design, so a reload legitimately
// suppresses everything the stub has. Honouring that strictly renders nothing,
// and a blank feed is worse than a familiar one: it looks broken and explains
// nothing — the same unreportable failure the upstream-errors panel exists to
// prevent. So repeats are served as a LAST RESORT, flagged as such on screen.
// Found by running this suite, not by reading the code.
await openApp(page, `${BASE}/feed`);
await until(() => page.locator('text=Popular post 1-0').count().then((n) => n > 0),
  { what: 'the feed to fall back to already-seen posts rather than go blank' });
check(true, 'a feed whose posts have all been seen repeats them instead of rendering empty');
check(await page.locator('[data-feed-all-seen]').count() > 0,
  '…and says so, rather than passing them off as new');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
