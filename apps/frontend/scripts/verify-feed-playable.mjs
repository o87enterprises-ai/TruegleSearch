/* Playable media in feed cards, in a real browser.
 *
 * The core invariant this whole feature rests on: SCROLLING PAST a card never
 * decodes its own video. Enlarging on focus is a CSS transform; the play
 * badge and the center play button are static overlays. That invariant does
 * NOT mean zero iframes ever, though — pressing play on the focused card
 * turns it into the app's ONE [data-player-slot], and the one shared media
 * node (mounted once in MiniPlayer, above <Routes>) docks directly into it.
 * So the real invariant, and what this suite actually enforces at every step,
 * is AT MOST ONE iframe anywhere on the page, and it only ever appears inside
 * the card that is both focused and actually playing.
 *
 * Also covers: the play badge on a playable card, the center play button
 * appearing only on the focused card, the tap-to-open action sheet's three
 * inline actions, a non-playable card being completely untouched, scrolling
 * the playing card out of focus HOLDING it, and the feed playing in the one
 * (Tube) player rather than a separate feed-only frame.
 *
 * SCROLLING NOTE: bringing a card into view is not enough to focus it —
 * Playwright's scrollIntoViewIfNeeded() only scrolls the minimum distance to
 * make an element merely visible, so a card already partly on screen (which
 * it usually is, on any reasonably tall feed) barely moves and never crosses
 * the mid-screen band useFeedFocus watches. `element.scrollIntoView({block:
 * 'center'})` is what actually centers it — the same call useFeedAutoplay's
 * advanceToNext() already makes for the identical reason.
 *
 * The API is stubbed at the browser, so this needs no backend and no network.
 *
 * Run it:  npm run feedplayable:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5178;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

// A YouTube URL — real, recognisable shape, so getPlayable() classifies it as
// playable exactly the way it would classify a real post. A GitHub repo sits
// alongside it so the suite can also prove a NON-playable card is untouched.
//
// FILLER POSTS ABOVE AND BELOW BOTH, ENOUGH TO SCROLL. A 2-card feed is
// shorter than the viewport once the page chrome (logo, pill, mode selector,
// servers dropdown) is accounted for — the browser has nowhere left to
// scroll, and centering either card the normal way (element.scrollIntoView({
// block:'center'})) silently clamps to whatever the max scroll position
// already offers. Real feeds are long; this pads the stub to behave like one
// rather than testing an edge case nothing in production actually hits.
const filler = (n) => ({
  id: `f${n}`, platform: 'GitHub', title: `Filler post ${n}`,
  url: `https://github.com/example/filler-${n}`, permalink: `https://github.com/example/filler-${n}`,
  snippet: null, author: 'someone', subreddit: null, date: '2026-01-01T00:00:00Z',
  score: null, comments: null, thumbnail: null, flair: null,
});

const POSTS = [
  ...Array.from({ length: 4 }, (_, i) => filler(i)),
  {
    id: 'yt1', platform: 'Community', title: 'A playable video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    permalink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    snippet: null, author: 'someone', subreddit: null, date: '2026-01-01T00:00:00Z',
    score: null, comments: null, thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', flair: null,
  },
  {
    id: 'gh1', platform: 'GitHub', title: 'A repo, not playable',
    url: 'https://github.com/example/repo', permalink: 'https://github.com/example/repo',
    snippet: 'not media', author: 'someone', subreddit: null, date: '2026-01-01T00:00:00Z',
    score: 10, comments: 2, thumbnail: null, flair: 'JavaScript',
  },
  ...Array.from({ length: 4 }, (_, i) => filler(i + 4)),
];

async function centerOn(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  // The observer reacts to a scroll/resize event via rAF, not synchronously —
  // give the same settle margin useFeedFocus's own effect uses (see its
  // header) before reading activeIndex-driven UI back out.
  await new Promise((r) => { setTimeout(r, 500); });
}

const ctx = await testContext(browser);
await ctx.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/social/feed') {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        query: '', results: POSTS,
        // roundRobin() interleaves per-platform lanes in the order given here,
        // shuffled within each round — bucketing by real platform keeps that
        // shuffle from silently reordering the youtube/GitHub pair the rest
        // of this suite depends on being distinguishable from filler.
        platforms: {
          community: POSTS.filter((p) => p.platform === 'Community'),
          github: POSTS.filter((p) => p.platform === 'GitHub'),
        },
        nextCursor: {}, errors: {},
      }),
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
const page = await ctx.newPage();
// Feed now defaults the player to popped-out on a browser's FIRST-EVER visit
// (see FeedPage.jsx) — a real onboarding default, covered by feedpage:test.
// This suite is about a different thing: the centered-card / pop-out
// MECHANICS themselves (Stage 3), which only engage while docked in-page.
// Seeding the marker up front simulates a returning visitor whose
// preference is already "docked" — the state most of a session is actually
// in — so the assertions below test the mechanism, not the onboarding
// default that would otherwise short-circuit every one of them.
await page.addInitScript(() => {
  localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');
});
const errs = [];
// The YouTube URL below is real — this suite stubs the app's own API
// (**/api/**) but has no way to intercept an <iframe> embed's own
// navigation, so once a card goes live the frame does try to reach
// youtube-nocookie.com for real. This sandbox has no outbound network, and
// separately Chromium throws "Access is denied for this document" from a
// blocked cross-origin document reading its OWN localStorage under
// third-party storage partitioning — neither has anything to do with this
// app's code, so it is the one page error filtered out here rather than
// silencing pageerror entirely.
page.on('pageerror', (e) => {
  if (/Access is denied for this document/i.test(e.message)) return;
  // Also YouTube's own embed script (not ours — the name appears nowhere in
  // src or our dependencies): when the sandbox half-loads the real embed it
  // sometimes throws "this.api.isExternalMethodAvailable is not a function".
  if (/isExternalMethodAvailable/.test(e.message)) return;
  errs.push(e.message);
});

await openApp(page, `${BASE}/feed`);
await until(() => page.locator('[data-feed-card-wrap]').count().then((n) => n > 0),
  { what: 'a playable card to render' });

// ── the badge, and the untouched non-playable card ──────────────────────────
check(await page.locator('[data-feed-card-wrap="youtube"]').count() === 1,
  'the playable post gets the wrapper chrome, keyed by its detected kind');
const wrapCount = await page.locator('[data-feed-card-wrap]').count();
check(wrapCount === 1, 'the GitHub post does NOT — one wrapper, not two', `${wrapCount} wrappers`);
check(await page.locator('a[href="https://github.com/example/repo"]').count() === 1,
  'the GitHub card is still a plain outbound link');

// ── zero iframes, ever, in a feed card — the core invariant ─────────────────
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  'a playable card renders no iframe merely by being on screen');

// ── centering the playable card gives it the center play button ────────────
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the centered playable card to show its play button' });
check(true, 'centering a playable card reveals its center play button');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…and STILL no iframe — focus alone is a static overlay, nothing has played yet');

// The GitHub card, centered instead, must never grow a play button — it has
// none to show, focused or not.
await centerOn(page.locator('a[href="https://github.com/example/repo"]'));
await page.waitForTimeout(400);
check(await page.locator('[data-feed-action="play-center"]').count() === 0,
  'the non-playable card never grows a play button, even while it holds focus');

// ── the inline action row (replaced the tap-to-open sheet) ──────────────────
// Play now / Add to queue / Open link sit on the card itself, always visible —
// no modal in the way. Open link warns before leaving Truegle's network.
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the play button to return once re-centered' });
check(await page.locator('[data-feed-card-actions]').count() === 0, 'there is no action sheet any more');
check(await page.locator('[data-feed-card-wrap="youtube"] [data-feed-action="play"]').count() === 1, 'the card shows Play now inline');
check(await page.locator('[data-feed-card-wrap="youtube"] [data-feed-action="queue"]').count() === 1, '…Add to queue inline');
check(await page.locator('[data-feed-card-wrap="youtube"] [data-feed-action="open-link"]').count() === 1, '…and Open link inline');
await page.click('[data-feed-card-wrap="youtube"] [data-feed-action="open-link"]');
await until(() => page.locator('[data-leaving-privacy-overlay]').count().then((n) => n === 1),
  { what: 'the leaving-Truegle overlay to open' });
check(true, 'Open link shows the leaving-Truegle overlay first');
await page.keyboard.press('Escape');
await until(() => page.locator('[data-leaving-privacy-overlay]').count().then((n) => n === 0),
  { what: 'Escape to close the overlay' });
check(true, 'Escape closes the overlay without leaving');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…and nothing has started playing yet');

// ── clicking the center button plays, no sheet, and the card BECOMES the
//    slot — the one shared iframe docks directly inside it ────────────────
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the play button still present after the overlay interactions' });
await page.click('[data-feed-action="play-center"]');
await until(() => page.locator('[data-feed-card-wrap="youtube"][data-feed-live="yes"]').count().then((n) => n === 1),
  { what: 'the played card to become the live slot' });
await until(() => page.locator('iframe').count().then((n) => n === 1),
  { what: 'the one shared iframe to mount' });
check(await page.locator('iframe').count() === 1,
  'exactly one iframe exists anywhere on the page — never a second decoder');
// A Play press also asks for full screen (the old "Open in app"). Headless
// Chromium may grant it; step back out so the inline checks below read the
// inline player.
await page.waitForTimeout(400);
if (await page.evaluate(() => !!document.fullscreenElement)) {
  await page.evaluate(() => document.exitFullscreen?.());
  await page.waitForTimeout(300);
}
const rectOf = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}, sel);

// ── ONE PLAYER: the feed plays in the Tube player ─────────────────────────
// "Use the tube player for the feed player as well." No separate feed deck,
// no fixed lens, no portrait-only frame — the same frame, search bar and
// transport every other page gets.
check(await page.locator('[data-player-deck="tube"]').count() > 0,
  'the feed plays on the one (Tube) player, not a separate feed deck',
  await page.locator('[data-player-root]').getAttribute('data-player-deck').catch(() => 'none'));
check(await page.locator('[data-player-lens]').count() === 0, 'there is no feed-only lens any more');
check(await page.locator('[data-mini] input[aria-label="Search the player"]').count() === 1,
  '…and it carries the Tube player\'s own search bar');
check(await page.locator('[data-mini] iframe').count() === 1,
  'the one iframe lives in the player frame');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…never inside a card');
check(await page.locator('[data-feed-save]').count() === 1,
  'the feed\'s one-press save is still offered on the feed page');

// ── scrolling the playing card out of focus HOLDS it ───────────────────────
await centerOn(page.locator('a[href="https://github.com/example/repo"]'));
await page.waitForTimeout(400);
check(await page.locator('[data-feed-card-wrap="youtube"][data-feed-live="yes"]').count() === 1,
  'scrolling the playing card out of focus keeps it playing');
check(await page.locator('iframe').count() === 1,
  '…still exactly one iframe on the page, the same one, not torn down');

// ── the live card offers no play button of its own ──────────────────────────
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await page.waitForTimeout(400);
check(await page.locator('[data-feed-action="play-center"]').count() === 0,
  'the live card offers no centre play button, being already played');

// ── full screen still shows a picture ───────────────────────────────────────
await page.evaluate(() => document.querySelector('[data-player-root]')?.requestFullscreen?.());
await page.waitForTimeout(800);
check(await page.evaluate(() => !!document.fullscreenElement), 'the player goes full screen on request');
const fsPic = await rectOf('iframe');
check(!!fsPic && fsPic.height > 300,
  'FULL SCREEN SHOWS A PICTURE — not audio over a black screen',
  `${fsPic?.height}px tall`);
await page.evaluate(() => document.exitFullscreen?.());
await page.waitForTimeout(300);

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
