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
 * playing card out of focus HOLDING it (the lens plays on), and popping out
 * moving the same live frame to the corner without a restart.
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
await until(() => page.locator('[data-feed-card-wrap="youtube"][data-feed-in-lens="yes"]').count().then((n) => n === 1),
  { what: 'the played card to become the live slot' });
await until(() => page.locator('iframe').count().then((n) => n === 1),
  { what: 'the one shared iframe to mount' });
check(await page.locator('iframe').count() === 1,
  'exactly one iframe exists anywhere on the page — never a second decoder');
// ── THE LENS IS FIXED; THE FEED MOVES ──────────────────────────────────────
// The viewfinder rule, and the reason the picture is no longer inside the
// card: "the centered card is like a lens fixed in place and immovable… it's
// the feed that moves". The old model docked the frame INTO the centred card
// and it travelled with it; this asserts the opposite.
//
// Rects come from getBoundingClientRect, not Playwright's boundingBox():
// that helper waits for its own idea of "visible", and a fixed frame is the
// case where it waits forever rather than answering.
//
// FIXEDNESS IS ASSERTED AGAINST THE VIEWPORT first, and then again below by
// actually scrolling: since the playing card now HOLDS rather than stopping,
// the lens survives a scroll and can be re-measured in place, which is the
// stronger version of this proof. It could not be done while scrolling away
// tore the lens down.
await page.waitForTimeout(400);
const rectOf = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}, sel);
const lensBox = await rectOf('[data-mini]');
const lensPos = await page.evaluate(() => {
  const el = document.querySelector('[data-mini]');
  return el ? getComputedStyle(el).position : null;
});
const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
check(lensPos === 'fixed',
  'the lens is fixed to the viewport — it is the feed that moves, not the lens',
  `position: ${lensPos}`);
const lensMid = lensBox ? lensBox.y + lensBox.height / 2 : -1;
check(!!lensBox && Math.abs(lensMid - viewport.h / 2) < viewport.h * 0.12,
  '…centred in it, where the next card scrolls into view',
  `lens middle ${lensMid.toFixed(0)} vs viewport middle ${(viewport.h / 2).toFixed(0)}`);
check(!!lensBox && lensBox.height > lensBox.width,
  '…and portrait, not a landscape frame',
  `${lensBox?.width?.toFixed(0)}×${lensBox?.height?.toFixed(0)}`);
// The card must NOT have grown into a player. A portrait picture inside a
// card made the card taller than the viewport, pushing its own controls
// under the page's fixed feedback bar and moving its own centre out of
// focus — the card chased itself out of focus. Cards stay card-sized.
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…and no card holds the picture itself — the lens does');

// ── the feed plays on its OWN deck, and offers its own one-press save ──────
// "The player from feed should NOT carry state from Tube player." The deck
// swap itself is covered exhaustively against the pure reducer in
// verify-player-engine.mjs; what this pins is the wiring — that the feed's
// play path actually asks for the feed deck rather than defaulting into
// Tube's.
check(await page.locator('[data-player-deck="feed"]').count() > 0,
  'playing from the feed puts the player on the FEED deck, not Tube\'s',
  await page.locator('[data-player-root]').getAttribute('data-player-deck').catch(() => 'none'));
check(await page.locator('[data-feed-save]').count() === 1,
  '…and offers the feed\'s single save — one press, one list, no picker');

// Saving twice is honest about the second press rather than showing a tick
// that lied: addToPlaylist refuses a duplicate and the button says so.
await page.click('[data-feed-save]');
await until(() => page.locator('[data-feed-save][data-saved="saved"]').count().then((n) => n === 1),
  { what: 'the save to confirm' });
check(true, 'pressing save adds the clip to the feed playlist');
check(await page.evaluate(() => {
  const raw = localStorage.getItem('truegle_playlists_v1') || localStorage.getItem('truegle_playlists') || '[]';
  try { return JSON.parse(raw).some((p) => p.name === 'Feed saves' && p.items.length === 1); } catch { return false; }
}), '…into a "Feed saves" list built from feed content');

// ── scrolling the playing card out of focus HOLDS it ───────────────────────
// SUPERSEDES "scrolling away stops it" (the original ask, and what this
// section used to assert). The rule now: what is on plays through, and
// whatever is queued behind it plays after, whatever the feed does
// underneath. Stopping on scroll meant a queue could never be heard — you
// queue something and then scroll to find the next thing, which is one
// gesture, and the first half of it killed the second. Only an exhausted
// player gets out of the way, by minimizing to the corner; see advance() in
// TrueglePlayer.jsx and the stop-effect's grave in FeedPage.jsx.
await centerOn(page.locator('a[href="https://github.com/example/repo"]'));
await page.waitForTimeout(400);
check(await page.locator('[data-feed-card-wrap="youtube"][data-feed-in-lens="yes"]').count() === 1,
  'scrolling the playing card out of focus HOLDS it — the lens plays on');
check(await page.locator('iframe').count() === 1,
  '…still exactly one iframe on the page, the same one, not torn down');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…and still no card holds it — it stayed in the lens, not in the card it came from');
const heldPos = await page.evaluate(() => {
  const el = document.querySelector('[data-mini]');
  return el ? getComputedStyle(el).position : null;
});
const heldBox = await rectOf('[data-mini]');
const heldMid = heldBox ? heldBox.y + heldBox.height / 2 : -1;
check(heldPos === 'fixed' && Math.abs(heldMid - viewport.h / 2) < viewport.h * 0.12,
  '…and the lens is still fixed and centred, having not travelled with the card',
  `position ${heldPos}, middle ${heldMid.toFixed(0)} vs ${(viewport.h / 2).toFixed(0)}`);

// ── the live card offers no play button of its own ──────────────────────────
// It is already playing, and the button would sit UNDER the lens — fixed
// across the middle of the viewport is exactly where a centred card's centre
// is. Pressing it could only ever do nothing.
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await page.waitForTimeout(400);
check(await page.locator('[data-feed-card-wrap="youtube"][data-feed-in-lens="yes"]').count() === 1,
  'scrolling back to the held card finds it still live', );
check(await page.locator('[data-feed-action="play-center"]').count() === 0,
  '…and offering no play button of its own, being already played');

// ── popping out moves the SAME live frame to the corner, without a restart ──
await page.click('button[aria-label="Pop out the player"]');
await until(() => page.locator('[data-feed-in-lens="yes"]').count().then((n) => n === 0),
  { what: 'popping out to collapse the card back to a poster' });
check(true, 'popping out collapses the live card back to a poster');
check(await page.locator('iframe').count() === 1,
  '…the same one iframe is still mounted — moved, not torn down and restarted');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…no longer inside any card…');
check(await page.locator('[data-mini] iframe').count() === 1,
  '…it now sits in the floating corner window instead');

// ── portrait-native, and ACTUALLY VISIBLE ──────────────────────────────────
// Two failures live here and neither announced itself:
//
//   · The feed player is 9:16 in EVERY state, letterboxing anything wider.
//     The corner window was landscape while only full screen was portrait —
//     the same frame at a different size rather than a different player.
//   · Full screen played AUDIO OVER A BLACK SCREEN: the picture box had
//     collapsed to zero height (see PlayerScreen's boxStyle note). A ratio
//     check alone passes happily on a 0×0 box, so the SIZE is asserted too —
//     that is the half that catches a black screen.
//
// The clip is a 16:9 YouTube video on purpose: a portrait player that is
// only portrait for portrait clips is not a portrait player.
await page.waitForTimeout(400);
const NINE_BY_SIXTEEN = 9 / 16;
const ratioOf = (b) => (b && b.height > 0 ? b.width / b.height : 0);
const cornerPic = await rectOf('[data-mini] iframe');
check(Math.abs(ratioOf(cornerPic) - NINE_BY_SIXTEEN) < 0.02,
  'the corner player is 9:16 even with a widescreen clip in it',
  `${JSON.stringify(cornerPic)} ratio ${ratioOf(cornerPic).toFixed(3)}`);
check(!!cornerPic && cornerPic.height > 150,
  '…at a usable size, not collapsed to a sliver by its own height cap',
  `${cornerPic?.height}px tall`);

await page.evaluate(() => document.querySelector('[data-player-root]')?.requestFullscreen?.());
await page.waitForTimeout(800);
check(await page.evaluate(() => !!document.fullscreenElement), 'the player goes full screen on request');
const fsPic = await rectOf('iframe');
check(!!fsPic && fsPic.height > 300,
  'FULL SCREEN SHOWS A PICTURE — not audio over a black screen',
  `${fsPic?.height}px tall`);
check(Math.abs(ratioOf(fsPic) - NINE_BY_SIXTEEN) < 0.02,
  '…still 9:16 against a landscape screen, the video letterboxed inside it',
  `${JSON.stringify(fsPic)} ratio ${ratioOf(fsPic).toFixed(3)}`);
await page.evaluate(() => document.exitFullscreen?.());
await page.waitForTimeout(300);

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
