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
 * options, a non-playable card being completely untouched, scrolling the
 * playing card out of focus stopping it (the card falls back to a poster),
 * and popping out moving the same live frame to the corner without a restart.
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

// ── tapping the card body (not the center button) opens the sheet ──────────
// Done BEFORE anything plays: once the youtube card is actually live it stops
// being a clickable poster (see below) and has no sheet-opening body to tap.
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the play button to return once re-centered' });
const box = await page.locator('[data-feed-card-wrap="youtube"]').boundingBox();
// Top-left corner: away from both the top-right badge and the dead-center
// play button, so this reliably hits the wrapper rather than an overlay.
await page.mouse.click(box.x + 6, box.y + 6);
await until(() => page.locator('[data-feed-card-actions]').count().then((n) => n > 0),
  { what: 'the action sheet to open' });
check(true, 'tapping the card body opens the action sheet');
check(await page.locator('[data-feed-action="play"]').count() === 1, '…offering Open in app');
check(await page.locator('[data-feed-action="queue"]').count() === 1, '…offering Add to queue');
check(await page.locator('[data-feed-action="open-link"]').count() === 1, '…and Open link');

// Closed via Escape rather than pressing an action: "Add to queue" on an
// IDLE player starts it playing too (queueing into nothing plays it instead
// — see verify-player-engine.mjs), which would make this card go live here
// instead of where the test below means to trigger that.
await page.keyboard.press('Escape');
await until(() => page.locator('[data-feed-card-actions]').count().then((n) => n === 0),
  { what: 'Escape to close the sheet' });
check(true, 'Escape closes the action sheet without acting on it');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…and nothing has started playing yet');

// ── clicking the center button plays, no sheet, and the card BECOMES the
//    slot — the one shared iframe docks directly inside it ────────────────
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the play button still present after the sheet interactions' });
await page.click('[data-feed-action="play-center"]');
await until(() => page.locator('[data-feed-card-wrap="youtube"][data-feed-live="yes"]').count().then((n) => n === 1),
  { what: 'the played card to become the live slot' });
check(await page.locator('[data-feed-card-actions]').count() === 0,
  'the center button skips the action sheet entirely');
await until(() => page.locator('iframe').count().then((n) => n === 1),
  { what: 'the one shared iframe to mount' });
check(await page.locator('iframe').count() === 1,
  'exactly one iframe exists anywhere on the page — never a second decoder');
// NOT a DOM-containment check: the shared frame is mounted once, above
// <Routes> (see MiniPlayer.jsx), and docks over the slot by CSS position
// alone — "one node, moved by geometry" is the whole point, so it is never a
// literal descendant of [data-player-slot]. What actually proves docking is
// the frame's rect matching the slot's rect.
//
// SETTLE FIRST. MiniPlayer's own slot geometry updates on scroll/resize and
// a 250ms poll (MiniPlayer.jsx) — a genuinely separate render pass from the
// slot div appearing in the DOM, which is all the two `until()`s above
// wait for. Reading the frame's rect in that gap caught the frame still at
// its PREVIOUS (footer/floating) position and size, not a docking failure —
// found by running this suite, not by reading the code.
await page.waitForTimeout(400);
const slotBox = await page.locator('[data-feed-card-wrap="youtube"][data-feed-live="yes"] [data-player-slot]').boundingBox();
const frameBox = await page.locator('[data-mini]').boundingBox();
check(!!slotBox && !!frameBox
  && Math.abs(slotBox.x - frameBox.x) < 2 && Math.abs(slotBox.y - frameBox.y) < 2,
  '…and it is positioned exactly over the playing card’s own slot, not floating separately',
  `slot=${JSON.stringify(slotBox)} frame=${JSON.stringify(frameBox)}`);

// ── scrolling the playing card out of focus stops it ────────────────────────
// "It stops and the next centered card then begins thumbnail preview and can
// be clicked to play" — the owner's own words for this behaviour.
await centerOn(page.locator('a[href="https://github.com/example/repo"]'));
await until(() => page.locator('[data-feed-live="yes"]').count().then((n) => n === 0),
  { what: 'scrolling away to stop the live card' });
check(true, 'scrolling the playing card out of focus stops it');
check(await page.locator('iframe').count() === 0,
  '…and the shared iframe is gone with it, not orphaned somewhere else');
check(await page.locator('[data-feed-card-wrap="youtube"]').count() === 1,
  '…the card itself is still there, just back to being a poster');

// ── popping out moves the SAME live frame to the corner, without a restart ──
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the play button to return once re-centered' });
await page.click('[data-feed-action="play-center"]');
await until(() => page.locator('[data-feed-card-wrap="youtube"][data-feed-live="yes"]').count().then((n) => n === 1),
  { what: 'the card to go live again' });
await page.click('button[aria-label="Pop out the player"]');
await until(() => page.locator('[data-feed-live="yes"]').count().then((n) => n === 0),
  { what: 'popping out to collapse the card back to a poster' });
check(true, 'popping out collapses the live card back to a poster');
check(await page.locator('iframe').count() === 1,
  '…the same one iframe is still mounted — moved, not torn down and restarted');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…no longer inside any card…');
check(await page.locator('[data-mini] iframe').count() === 1,
  '…it now sits in the floating corner window instead');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
