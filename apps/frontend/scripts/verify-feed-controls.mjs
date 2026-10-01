/* The Feed's own player (not full screen): every on-screen control must be
 * PRESSABLE, not just present.
 *
 * Owner, 2026-10-01: "in the native feed player (not full screen) the on-screen
 * share / controls aren't working." On the Feed's ~210px-tall picture the
 * four-button rail (like, dislike, play mode, share) filled the whole height
 * and its last button — Share — sat under the progress strip, so a press hit
 * the strip. The player suite had no Feed layout and its press-everything sweep
 * skipped Share, so nothing saw it.
 *
 * A control counts only if the element at its centre IS that control
 * (elementFromPoint); it is then pressed and must do its job. Phone portrait,
 * phone landscape, tablet and desktop.
 *
 * Run it:  npm run feedcontrols:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5251;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const DEVICES = {
  'phone-portrait': { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  'phone-landscape': { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 820 } },
};

const yt = (n) => ({
  id: `yt${n}`, platform: 'Community', title: `Playable video ${n}`,
  url: `https://www.youtube.com/watch?v=feedvid000${n}`, permalink: `https://www.youtube.com/watch?v=feedvid000${n}`,
  snippet: null, author: 'someone', subreddit: null, date: '2026-01-01T00:00:00Z', score: null, comments: null, thumbnail: null, flair: null,
});
const POSTS = [1, 2, 3, 4].map(yt);

// What is at the centre of a control? 'ok' when it is the control itself.
const reach = (page, label) => page.evaluate(`(() => {
  const e = [...document.querySelectorAll('[aria-label="${label}"]')].find((x) => x.offsetParent !== null);
  if (!e) return 'absent';
  const r = e.getBoundingClientRect();
  if (r.x < 0 || r.y < 0 || r.x + r.width > innerWidth || r.y + r.height > innerHeight) return 'OFF SCREEN';
  const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return (t === e || e.contains(t)) ? 'ok' : 'COVERED by ' + (t ? t.tagName + ' ' + (t.getAttribute('aria-label') || String(t.className).slice(0, 50)) : 'nothing');
})()`);

for (const [name, opts] of Object.entries(DEVICES)) {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');");
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/social/feed') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: '', results: POSTS, platforms: { community: POSTS }, nextCursor: {}, errors: {} }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="background:#223"></body></html>' }));
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = `[${name}]`;

  await openApp(page, `${BASE}/feed`);
  await until(() => page.locator('[data-feed-action="play"]').count(), { what: 'a feed card' });
  await page.locator('[data-feed-action="play"]').first().dispatchEvent('click');
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'the player' });
  await page.waitForTimeout(1200);

  // Reveal the controls the way a person does: tap the picture.
  const pic = await page.locator('iframe[src*="youtube"]').first().boundingBox();
  const tap = async () => {
    if (opts.hasTouch) await page.touchscreen.tap(pic.x + pic.width / 2, pic.y + pic.height / 2);
    else await page.mouse.click(pic.x + pic.width / 2, pic.y + pic.height / 2);
  };
  await tap();
  await page.waitForTimeout(500);

  const rail = ['Share', 'Like — more like this', 'Dislike — less like this'];
  for (const label of [...rail, 'Pause', 'Next', 'Previous']) {
    const r = await reach(page, label);
    check(r === 'ok' || (label === 'Previous' && r === 'absent'), `${tag} "${label}" can be reached after a tap on the picture`, r);
  }
  const mode = await page.evaluate(`(() => { const e = [...document.querySelectorAll('[aria-label^="Auto"], [aria-label^="Repeat"], [aria-label^="Shuffle the"], [aria-label^="Loop"]')].find((x) => x.offsetParent !== null && x.closest('[class*="z-30"]')); return e ? e.getAttribute('aria-label') : null; })()`);
  if (mode) {
    const r = await reach(page, mode);
    check(r === 'ok', `${tag} the play-mode button can be reached`, r);
  }

  // Pressing Share does its job: the button reports it (copied, or blocked).
  const share = page.locator('[aria-label="Share"]:visible').first();
  const before = await share.getAttribute('title');
  const bb = await share.boundingBox();
  if (opts.hasTouch) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  else await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(500);
  const after = await page.locator('[aria-label="Share"]:visible').first().getAttribute('title').catch(() => null);
  const state = await page.evaluate(`(() => { const e = [...document.querySelectorAll('[aria-label="Share"]')].find((x) => x.offsetParent !== null); return e ? e.className : ''; })()`);
  check(/text-green-400|text-amber-400/.test(state) || after !== before, `${tag} pressing Share acts (copied, or says the browser blocked it)`, `class=${state.slice(0, 80)}`);

  // Like toggles.
  const like = page.locator('[aria-label="Like — more like this"]:visible').first();
  if (await like.count()) {
    const lb = await like.boundingBox();
    if (opts.hasTouch) await page.touchscreen.tap(lb.x + lb.width / 2, lb.y + lb.height / 2);
    else await page.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await page.waitForTimeout(400);
    check(await page.locator('[aria-label="Remove like"]').count() > 0, `${tag} pressing Like registers`);
  }

  // The rail stays up while you use it: pressing a button restarts the hide
  // timer (it used to vanish five seconds after the tap, mid-reach).
  await page.waitForTimeout(3000);
  const stillShown = await reach(page, 'Share');
  check(stillShown === 'ok', `${tag} the rail is still there 3s after a press (a press keeps it up)`, stillShown);

  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
