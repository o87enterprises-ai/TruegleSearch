/* Feed posts wear the shape of the original (owner, 2026-11-07).
 *
 * "Adopt the original post card ratio and size to the feed, so if it's an insta
 * reel it's 9x16 — the same as the native card."
 *
 *   - Instagram / Facebook Reels, TikToks, YouTube Shorts → a 9:16 card,
 *     phone-shaped (≤ 340px wide) and never taller than the screen
 *   - a playable landscape video (YouTube, …)            → a 16:9 card
 *   - text, links, Reddit/HN/GitHub (hand-built cards)   → the row they always were
 *   - no post is dropped; a shaped card needs a picture, so a reel with none stays a row
 *     (YouTube derives its picture from the video id)
 *   - Play now / Add to queue / Open link still sit under a playable shaped card
 *
 * Measured from real boxes in a real browser, on the landing frame and /feed,
 * desktop and phone. The API is stubbed; no backend or network.
 *
 * Run it:  npm run feedshapes:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const guarded = async (label, fn) => { try { await fn(); } catch (e) { bad.push(`FAIL ${label} — ${String(e.message).split('\n')[0]}`); } };

const PORT = 5301;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

// A 1x1 PNG, so a thumbnail really loads (and one that fails is tested apart).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const post = (id, platform, title, url, extra = {}) => ({
  id, platform, title, url, permalink: url, snippet: null, author: 'someone', subreddit: null,
  date: '2026-11-01T00:00:00Z', score: null, comments: null, thumbnail: PNG, flair: null, ...extra,
});
const POSTS = [
  post('ig', 'Instagram', 'An Instagram reel', 'https://www.instagram.com/reel/CxAbCdEfGhI/'),
  post('tt', 'TikTok', 'A TikTok', 'https://www.tiktok.com/@someone/video/7123456789012345678'),
  post('sh', 'Bluesky', 'A YouTube Short', 'https://www.youtube.com/shorts/abcdefghijk'),
  post('yt', 'Rumble', 'A YouTube video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  post('fb', 'Facebook', 'A Facebook reel with NO picture', 'https://www.facebook.com/reel/1234567890123', { thumbnail: null }),
  post('y2', 'Rumble', 'A YouTube video with no thumbnail given', 'https://www.youtube.com/watch?v=9bZkp7q19f0', { thumbnail: null }),
  post('rd', 'Reddit', 'A Reddit post', 'https://www.reddit.com/r/test/comments/abc123/a_post/', { subreddit: 'r/test' }),
  post('tx', 'Bluesky', 'A plain text post', 'https://bsky.app/profile/someone/post/3kabc', { thumbnail: null }),
  post('gh', 'GitHub', 'A repo', 'https://github.com/example/repo', { thumbnail: null }),
];
// fb: a reel with nothing to show stays the compact row, not a 600px blank box.
// y2: a YouTube post with no thumbnail still gets one, derived from its id.
const TALL = ['ig', 'tt', 'sh'];
const WIDE = ['yt', 'y2'];
const ROW = ['fb', 'rd', 'tx', 'gh'];

async function open(viewport, mobile, path) {
  const ctx = await testContext(browser, { viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  await ctx.route('**/api/social/feed', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ results: POSTS, errors: {}, nextCursor: {} }),
  }));
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied|isExternalMethodAvailable/.test(e.message)) errs.push(e.message); });
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errs };
}

// Every post's real box, found by its own link, so the hand-built cards (which
// carry no marker of their own) are measured exactly like the rest.
const boxes = (page) => page.evaluate((urls) => urls.map(([id, url]) => {
  const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') === url && x.closest('[data-landing-feed-frame], main, body'));
  if (!a) return { id, missing: true };
  const r = a.getBoundingClientRect();
  return { id, shape: a.dataset.feedShape || 'row', w: r.width, h: r.height, action: !!a.closest('[data-feed-card-wrap]')?.querySelector('[data-feed-action="play"]') };
}), POSTS.map((p) => [p.id, p.permalink]));

async function run(label, viewport, mobile, path, prep) {
  await guarded(label, async () => {
    const { ctx, page, errs } = await open(viewport, mobile, path);
    if (prep) await prep(page);
    await until(() => boxes(page).then((l) => l.every((x) => !x.missing)), { what: `${label}: all ${POSTS.length} posts`, timeout: 20000 });
    await page.waitForTimeout(600);
    const list = await boxes(page);
    const t = Object.fromEntries(list.map((x) => [x.id, x]));
    const vh = viewport.height;
    check(list.length === POSTS.length && list.every((x) => !x.missing), `${label}: every post renders — none dropped`, `${list.filter((x) => !x.missing).length}/${POSTS.length}`);
    for (const id of TALL) {
      const x = t[id];
      check(x.shape === 'tall' && Math.abs(x.w / x.h - 9 / 16) < 0.02, `${label}: ${id} is a 9:16 card`, `${Math.round(x.w)}x${Math.round(x.h)} ${x.shape}`);
      // ×1.03: the card nearest screen centre is drawn 2% larger (useFeedFocus), and that is measured too.
      check(x.w <= 340 * 1.03 && x.h <= vh * 0.8, `${label}: ${id} is phone-sized, not taller than the screen`, `${Math.round(x.w)}x${Math.round(x.h)} in ${vh}px`);
    }
    for (const id of WIDE) {
      const x = t[id];
      check(x.shape === 'wide' && Math.abs(x.w / x.h - 16 / 9) < 0.03, `${label}: ${id} is a 16:9 card`, `${Math.round(x.w)}x${Math.round(x.h)} ${x.shape}`);
    }
    for (const id of ROW) {
      const x = t[id];
      check(x.shape === 'row' && x.h < 220, `${label}: ${id} keeps its compact row`, `${Math.round(x.w)}x${Math.round(x.h)} ${x.shape}`);
    }
    check(t.tt.action && t.sh.action && t.yt.action, `${label}: a playable shaped card still has Play now / Add to queue / Open link`);
    check(await page.locator('[data-feed-shape="tall"] img').first().evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false), `${label}: the picture fills the card`);
    check(errs.length === 0, `${label}: nothing threw`, errs.join(' | ') || 'clean');
    await ctx.close();
  });
}

const landing = async (page) => {
  // The Feed frame sits in a card that is retracted at load: open it first.
  await page.locator('[data-feed-frame-toggle]').waitFor({ timeout: 20000 });
  if (await page.locator('[data-feed-frame-toggle]').getAttribute('aria-expanded') !== 'true') await page.locator('[data-feed-frame-toggle]').dispatchEvent('click');
  await page.locator('[data-landing-feed-frame]').waitFor({ timeout: 20000 });
};
await run('desktop /feed', { width: 1280, height: 900 }, false, '/feed');
await run('phone /feed', { width: 390, height: 844 }, true, '/feed');
await run('desktop landing', { width: 1280, height: 900 }, false, '/', landing);
await run('phone landing', { width: 390, height: 844 }, true, '/', landing);

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
