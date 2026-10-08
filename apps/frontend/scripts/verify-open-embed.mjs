/* Universal embed: a video on ANY site that offers an embed plays in Truegle.
 *
 * Owner, 2026-10-08: "If there's a free embed code listed on a site I want
 * Truegle to be able to play it, period." The page is read by the backend
 * (EmbedDiscovery.js — tested there); this pins the browser side:
 *   - pasting a link from an unknown site asks Truegle's backend, not the site
 *   - the embed it found plays in the player
 *   - in the STRICTER sandbox (no popups) that unknown sites get
 *   - it is not offered for posting to everyone
 *   - a page with nothing playable says so
 *   - a search result whose engine supplied an embed (iframe_src) is playable
 *
 * Run it:  npm run openembed:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5298;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const STORY = 'https://news.example.org/story/42';
const EMPTY = 'https://blog.example.org/just-words';
const PLAYER = 'https://player.example.org/e/42';

const c = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
  + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');"
  + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
const resolveCalls = [];
const direct = [];
await c.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  const json = (status, b) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.pathname === '/api/media/resolve') {
    const asked = u.searchParams.get('url');
    resolveCalls.push(asked);
    if (asked === STORY) return json(200, { success: true, media: { kind: 'embed', src: PLAYER, pageUrl: STORY, title: 'Council meeting, full video', channel: 'news.example.org', via: 'oEmbed' } });
    return json(422, { success: false, error: 'No playable video or audio was found on that page.' });
  }
  return json(200, { query: '', results: [], platforms: {}, nextCursor: {}, errors: {} });
});
await c.route('**/news.example.org/**', (r) => { direct.push(r.request().url()); return r.abort(); });
await c.route('**/player.example.org/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="background:#123">the site\'s own player</body></html>' }));
const page = await c.newPage();
await openApp(page, `${BASE}/feed`);
const bar = page.locator('textarea:visible, input[aria-label="Search input"]:visible').first();
await until(() => bar.count(), { what: 'the Feed bar' });
await bar.click();
await bar.fill(STORY);
await until(() => page.locator('[data-feed-play-link]').count(), { what: 'the Play button', timeout: 6000 }).catch(() => {});
check(resolveCalls.includes(STORY), 'a link from an unknown site is sent to Truegle\'s backend to find its embed');
check(!direct.length, '…the browser never contacts that site itself to look', direct.join(' ') || 'none');
check(await page.locator('[data-feed-play-link]').count() === 1, 'the embed it found can be played');
check(/news\.example\.org/.test(await page.locator('[data-feed-submit]').innerText().catch(() => '')), '…and says which site it is from');
check(!(await page.locator('[data-feed-submit-go]').count()), '…but is not offered for posting to everyone');
await page.locator('[data-feed-play-link]').dispatchEvent('click');
const frame = page.locator(`iframe[src^="${PLAYER}"]`);
await until(() => frame.count(), { what: 'the player', timeout: 6000 }).catch(() => {});
check(await frame.count() > 0, 'Play puts the site\'s own player in Truegle\'s player');
const sandbox = await frame.first().getAttribute('sandbox').catch(() => '');
check(!!sandbox && !/allow-popups/.test(sandbox) && /allow-scripts/.test(sandbox), '…in the stricter sandbox: it can play, it cannot open popups', sandbox);

await bar.fill('');
await bar.fill(EMPTY);
await until(() => page.locator('[data-feed-submit="unresolved"]').count(), { what: 'the no-video note', timeout: 6000 }).catch(() => {});
check(await page.locator('[data-feed-submit="unresolved"]').count() === 1, 'a page with nothing playable says so');
// ── a pasted EMBED CODE plays with no request at all ──────────────────────
// For sites that refuse to let any server read them (C-SPAN 403s us).
const before = resolveCalls.length;
await bar.fill('');
await bar.fill('<iframe width="512" height="330" src="https://player.example.org/standalone/?533535-1" allowfullscreen></iframe>');
await until(() => page.locator('[data-feed-play-link]').count(), { what: 'Play for the code', timeout: 6000 }).catch(() => {});
check(await page.locator('[data-feed-play-link]').count() === 1, 'pasting a site\'s embed CODE (<iframe src=…>) offers Play');
check(resolveCalls.length === before, '…read in the browser, with no request to anyone');
await page.locator('[data-feed-play-link]').dispatchEvent('click');
await until(() => page.locator('iframe[src^="https://player.example.org/standalone/"]').count(), { what: 'the coded player', timeout: 6000 }).catch(() => {});
check(await page.locator('iframe[src^="https://player.example.org/standalone/"]').count() > 0, '…and plays that player');
await c.close();

// ── a search result the engine already gave an embed for ────────────────────
const { embedFromIframeSrc } = await server.ssrLoadModule('/src/utils/videoEmbed.js');
check(embedFromIframeSrc('https://vid.example.com/embed/9')?.kind === 'embed', 'a search result with an engine-supplied embed (iframe_src) is playable');
check(embedFromIframeSrc('https://www.youtube.com/embed/dQw4w9WgXcQ')?.kind === 'youtube', '…and a known platform keeps its own controllable player');
check(embedFromIframeSrc('http://insecure.example.com/embed/1') === null, '…but never an insecure http frame');
const { embedFromCode } = await server.ssrLoadModule('/src/utils/videoEmbed.js');
check(embedFromCode('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=x"></iframe>')?.kind === 'youtube', 'a YouTube embed code plays as YouTube');
check(embedFromCode('<iframe src="javascript:alert(1)"></iframe>') === null, 'a code whose src is not https is refused');
check(embedFromCode('<script src="https://evil.example/x.js"></script>') === null, 'anything that is not an iframe is ignored');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
