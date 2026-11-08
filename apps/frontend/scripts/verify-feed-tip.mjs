/* The note on the Feed page that says why the Feed is useful.
 *
 * Owner, 2026-11-08: "a note or modal on the feed page that says 'type the name
 * of your favorite creator, see their posts across all platforms' so users know
 * why Truegle is useful for social feeds."
 *
 * It is a NOTE, not a modal — it never covers the page — and it is only there
 * while it is useful:
 *   - shown to a first-time visitor, on Home, under the search bar, with the
 *     owner's exact words
 *   - gone the moment they start typing (they have found what it points at),
 *     and back if the box is emptied again
 *   - gone on Browse, where there is no search to point at
 *   - dismissed with its close button, and STAYS dismissed after a reload
 *   - not on any other page, and it fits a phone with a thumb-sized close button
 *
 * The API is stubbed at the browser. Run it:  npm run feedtip:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const guarded = async (label, fn) => { try { await fn(); } catch (e) { bad.push(`FAIL ${label} — ${String(e.message).split('\n')[0]}`); } };

const PORT = 5330;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const TEXT = 'Type the name of your favorite creator, see their posts across all platforms';
const POST = {
  id: 'a1', platform: 'Bluesky', title: 'A post', url: 'https://bsky.app/profile/x/post/1', permalink: 'https://bsky.app/profile/x/post/1',
  snippet: null, author: 'someone', subreddit: null, date: '2026-11-01T00:00:00Z', score: null, comments: null, thumbnail: null, flair: null,
};

async function open(opts, path = '/feed') {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/api/social/feed', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ results: [POST], platforms: { bluesky: [POST] }, errors: {}, nextCursor: {} }),
  }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied|isExternalMethodAvailable/.test(e.message)) errs.push(e.message); });
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errs };
}
const tip = (page) => page.locator('[data-feed-creator-tip]');
const ready = (page) => until(() => page.locator('[data-feed-state]').count(), { what: 'the feed page', timeout: 20000 });

await guarded('desktop', async () => {
  const { ctx, page, errs } = await open({ viewport: { width: 1280, height: 900 } });
  await ready(page);
  await until(() => tip(page).count(), { what: 'the note', timeout: 8000 }).catch(() => {});
  check(await tip(page).count() === 1, 'a first-time visitor sees the note on the feed page');
  check((await tip(page).innerText()).trim() === TEXT, 'it says exactly: "Type the name of your favorite creator, see their posts across all platforms"', (await tip(page).innerText()).trim());
  check(await tip(page).getAttribute('role') === 'note', 'it is a note, not a dialog — nothing blocks the page');
  check(await page.locator('[role="dialog"], [aria-modal="true"]').count() === 0, 'no modal is on the page');

  // Directly under the search bar and above the feed.
  const geo = await page.evaluate(() => {
    const t = document.querySelector('[data-feed-creator-tip]').getBoundingClientRect();
    const bar = document.querySelector('textarea')?.getBoundingClientRect();
    const list = document.querySelector('[data-feed-card], [data-feed-card-wrap]')?.getBoundingClientRect();
    return { tipTop: t.top, tipBottom: t.bottom, barBottom: bar ? bar.bottom : null, listTop: list ? list.top : null, w: t.width, vw: innerWidth };
  });
  check(geo.barBottom !== null && geo.tipTop >= geo.barBottom - 1, 'it sits under the search bar', `bar bottom ${Math.round(geo.barBottom)}, note top ${Math.round(geo.tipTop)}`);
  check(geo.listTop === null || geo.tipBottom <= geo.listTop + 1, 'and above the feed, covering nothing', `note bottom ${Math.round(geo.tipBottom)}, feed top ${geo.listTop === null ? 'n/a' : Math.round(geo.listTop)}`);

  // Typing makes it go away; emptying the box brings it back.
  const box = page.locator('textarea').first();
  await box.fill('mkbhd');
  await until(() => tip(page).count().then((n) => n === 0), { what: 'the note to leave while typing', timeout: 5000 }).catch(() => {});
  check(await tip(page).count() === 0, 'it goes away as soon as they start typing');
  await box.fill('');
  await until(() => tip(page).count(), { what: 'the note to return', timeout: 5000 }).catch(() => {});
  check(await tip(page).count() === 1, '…and comes back if the box is emptied (they have not dismissed it)');

  // Browse has no search to point at.
  await page.locator('[data-feed-view="browse"]').dispatchEvent('click');
  await until(() => tip(page).count().then((n) => n === 0), { what: 'the note to leave Browse', timeout: 5000 }).catch(() => {});
  check(await tip(page).count() === 0, 'it is not shown on Browse');
  await page.locator('[data-feed-view="home"]').dispatchEvent('click');
  await until(() => tip(page).count(), { what: 'the note on Home again', timeout: 5000 }).catch(() => {});
  check(await tip(page).count() === 1, '…and is back on Home');

  // Dismiss, and it stays dismissed across a reload. (Clicking away from the
  // box first, as a person would: while it has focus its suggestion dropdown
  // opens over this area, which is how every dropdown behaves.)
  await page.keyboard.press('Escape');
  await page.mouse.click(30, 700); // empty page margin: a click away closes the dropdown
  await page.waitForTimeout(500);
  await page.locator('[data-feed-creator-tip-close]').click();
  await until(() => tip(page).count().then((n) => n === 0), { what: 'the note to close', timeout: 5000 }).catch(() => {});
  check(await tip(page).count() === 0, 'the close button dismisses it');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForTimeout(800);
  check(await tip(page).count() === 0, 'and it stays dismissed after a reload');
  check(await page.evaluate(() => localStorage.getItem('truegle_feed_creator_tip_v1')) === '1', 'the choice is remembered on this device only (localStorage)');
  check(errs.length === 0, 'desktop: nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
});

await guarded('phone', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ready(page);
  await until(() => tip(page).count(), { what: 'the note', timeout: 8000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const t = document.querySelector('[data-feed-creator-tip]');
    const c = document.querySelector('[data-feed-creator-tip-close]');
    if (!t || !c) return null;
    const tr = t.getBoundingClientRect(); const cr = c.getBoundingClientRect();
    return { tipW: tr.width, tipRight: tr.right, vw: innerWidth, closeW: cr.width, closeH: cr.height, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  check(!!m && m.tipRight <= m.vw && !m.overflowX, 'phone: the note fits the screen with no sideways scroll', m ? `${Math.round(m.tipW)}px of ${m.vw}` : 'missing');
  check(!!m && m.closeW >= 36 && m.closeH >= 36, 'phone: the close button is thumb-sized', m ? `${Math.round(m.closeW)}x${Math.round(m.closeH)}` : 'missing');
  await page.locator('[data-feed-creator-tip-close]').tap();
  await until(() => tip(page).count().then((n) => n === 0), { what: 'the note to close on a tap', timeout: 5000 }).catch(() => {});
  check(await tip(page).count() === 0, 'phone: a tap on the close button dismisses it');
  await ctx.close();
});

await guarded('other pages', async () => {
  for (const path of ['/', '/tube', '/chat']) {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 900 } }, path);
    await page.waitForTimeout(2500);
    check(await tip(page).count() === 0, `the note is only on the feed page — not on ${path}`);
    await ctx.close();
  }
});

await browser.close();
await server.close();
for (const l of [...ok, ...bad]) console.log(l);
console.log(`${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
