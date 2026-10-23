/* The shared-link door's safety net.
 *
 * Tester, 2026-10-22 (iPhone, Chrome): tapped Play on a shared /tube?p= link
 * and was left on the bare Tube page — no player, no message. Not reproducible
 * here, so the door now checks its own work: if no player is on screen a few
 * seconds after the tap, it says so and offers Try again and Report.
 *
 * Pinned here:
 *   1. a normal tap opens the player and the safety net stays out of the way;
 *   2. a player that never shows (sabotaged with CSS) brings up the help card,
 *      whose Report is a mailto: carrying the page URL — nothing is sent;
 *   3. Try again, once the cause is gone, opens the player;
 *   4. Close dismisses the card.
 *
 * Run it:  npm run sharegate:test
 */
import { createServer } from 'vite';
import { launchChromium, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5297;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();
const ctx = await testContext(browser, {
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript(`
  delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen;
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  localStorage.setItem('truegle_swipe_hint_seen', '1');
  localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const LINK = `http://localhost:${PORT}/tube?p=1s9XhWZr9BtHI.yJWtC87gdsgo.y6tynWSAesAo`;
const SABOTAGE = '[data-mini]{display:none!important}';
const failedCard = (p) => p.locator('[data-share-gate-failed]');
const playerShown = (p) => p.evaluate(() => {
  const el = document.querySelector('[data-mini] [data-player-root]');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 40 && r.height > 40;
});

// 1. Normal tap.
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await playerShown(page), '1 a normal tap opens the player');
  check(await failedCard(page).count() === 0, '1 the safety net stays out of the way');
  check(await page.locator('[data-share-gate]').count() === 0, '1 the door is gone');
  await page.close();
}

// 2-4. A player that never shows.
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  const style = await page.addStyleTag({ content: SABOTAGE });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await failedCard(page).isVisible().catch(() => false), '2 a player that never shows brings up the help card');
  const href = await page.locator('[data-share-report]').getAttribute('href').catch(() => '');
  check(href?.startsWith('mailto:truegleai@proton.me?'), '2 Report is a mailto: (nothing sent by us)', href?.slice(0, 40));
  check(decodeURIComponent(href || '').includes('/tube?p=1s9XhWZr9BtHI'), '2 the report carries the page URL');
  check(await page.locator('[data-share-retry]').isVisible().catch(() => false), '2 Try again is offered');

  await style.evaluate((n) => n.remove());
  await page.tap('[data-share-retry]');
  await page.waitForTimeout(4500);
  check(await failedCard(page).count() === 0, '3 Try again clears the card once the player shows');
  check(await playerShown(page), '3 Try again opens the player');
  await page.close();
}
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.addStyleTag({ content: SABOTAGE });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  await page.tap('[data-share-dismiss]').catch(() => {});
  await page.waitForTimeout(400);
  check(await failedCard(page).count() === 0, '4 Close dismisses the card');
  await page.close();
}

await browser.close();
await server.close();
for (const l of [...ok, ...bad]) console.log(l);
console.log(`${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
