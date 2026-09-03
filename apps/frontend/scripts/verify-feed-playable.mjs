/* Playable media in feed cards, in a real browser.
 *
 * The core invariant this whole feature rests on: a feed card NEVER decodes
 * its own video. Enlarging on focus is a CSS transform; the play badge and
 * the center play button are static overlays; every actual play/queue action
 * hands off to the ONE global player. If a card ever mounts a live <iframe>
 * of its own, scrolling past a hundred playable posts would spend a hundred
 * decoders on nothing anybody asked to watch — which is exactly the failure
 * this suite is built to catch before it ships.
 *
 * Also covers: the play badge on a playable card, the center play button
 * appearing only on the focused card, the tap-to-open action sheet's three
 * options, and that a non-playable card is completely untouched.
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
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

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
  '…and STILL no iframe — the button is a static overlay, not a mounted preview');

// The GitHub card, centered instead, must never grow a play button — it has
// none to show, focused or not.
await centerOn(page.locator('a[href="https://github.com/example/repo"]'));
await page.waitForTimeout(400);
check(await page.locator('[data-feed-action="play-center"]').count() === 0,
  'the non-playable card never grows a play button, even while it holds focus');

// ── clicking the center button plays immediately, no sheet ─────────────────
await centerOn(page.locator('[data-feed-card-wrap="youtube"]'));
await until(() => page.locator('[data-feed-action="play-center"]').count().then((n) => n === 1),
  { what: 'the play button to return once re-centered' });
await page.click('[data-feed-action="play-center"]');
await until(() => page.locator('[data-mini]').count().then((n) => n > 0),
  { what: 'the global player to pick up the click' });
check(await page.locator('[data-feed-card-actions]').count() === 0,
  'the center button skips the action sheet entirely');
check(true, 'and something actually starts in the global player frame');
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  '…and the card itself still holds no iframe — playback lives in the player, not the card');

// ── tapping the card body (not the center button) opens the sheet ──────────
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

// ── add to queue works, and closes the sheet ────────────────────────────────
await page.click('[data-feed-action="queue"]');
await until(() => page.locator('[data-feed-card-actions]').count().then((n) => n === 0),
  { what: 'the sheet to close after queueing' });
check(true, 'add to queue closes the sheet');

// ── zero iframes, checked one last time after every interaction above ──────
check(await page.locator('[data-feed-card-wrap] iframe').count() === 0,
  'still zero iframes inside a feed card after playing, queueing and opening the sheet');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
