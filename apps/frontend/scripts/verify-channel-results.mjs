/* Pressing a channel name in the results shows THAT channel's videos and starts
 * nothing (owner, 2026-10-15: "clicking the channel in the results should just
 * display results from that channel upon click and not autolaunch the next most
 * relevant video"). The name used to sit inside the card's play button, so the
 * press played the video and queued the rest of the results behind it.
 *
 *   npm run channelresults:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5243;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const DAY = 86400000;
const SHOTS = process.env.SHOTS_DIR || '';



for (const phone of [true, false]) {
  const ctx = await testContext(browser, phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => {
    const url = r.request().url();
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (url.includes('/api/creators/resolve')) return json({ channelId: 'UCduck000000000000000001' });
    if (url.includes('/videos')) {
      return json({ videos: [1, 2, 3, 4].map((i) => ({
        url: `https://www.youtube.com/watch?v=chan000000${i}`, title: `Channel upload ${i}`,
        thumbnail: `https://i.ytimg.com/vi/chan000000${i}/hqdefault.jpg`, published: new Date(Date.now() - i * DAY).toISOString(),
      })) });
    }
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').replace(/#shorts/, '').trim();
    const id = (i) => `${(q.replace(/\W/g, '') + 'xxxxxx').slice(0, 6)}0000${i}`;
    return json({ success: true, data: [], results: q ? [0, 1, 2, 3, 4, 5].map((i) => ({
      title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=${id(i)}`, channel: 'Duck Channel',
      image: `https://i.ytimg.com/vi/${id(i)}/hqdefault.jpg`, snippet: `Description ${i}`,
      date: new Date(Date.now() - (i + 1) * DAY).toISOString(),
    })) : [] });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = phone ? '[phone]' : '[desktop]';
  const iframes = () => page.locator('iframe[src*="youtube"]').count();

  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('duck sauce'); await bar.press('Enter');
  const cards = page.locator('[data-tube-card]');
  await until(async () => (await cards.count()) >= 6, { what: 'the Tube grid' });
  check(await iframes() === 0, `${tag} nothing is playing before the press`);

  // ── the grid ────────────────────────────────────────────────────────────
  const link = page.locator('[data-tube-card] [data-open-channel]').first();
  check(await link.count() === 1, `${tag} a result's channel name is a button`);
  await link.click();
  await until(async () => (await page.locator('[data-tube-grid] [data-channel-bar]').count()) === 1, { timeout: 6000, what: 'the channel view' }).catch(() => {});
  await until(async () => /Channel upload/.test(await cards.first().innerText().catch(() => '')), { timeout: 6000, what: 'the channel videos' }).catch(() => {});
  check(/Channel upload/.test(await cards.first().innerText()), `${tag} the grid shows that channel's videos`, (await cards.first().innerText()).split('\n')[0]);
  check(await page.locator('[data-tube-grid] [data-channel-bar]').count() === 1, `${tag} …under a bar naming the channel with a way back`);
  check(await iframes() === 0, `${tag} NOTHING was launched by pressing the channel`);

  await page.locator('[data-channel-back]').first().click();
  await until(async () => /duck sauce result/.test(await cards.first().innerText().catch(() => '')), { timeout: 5000, what: 'the results back' }).catch(() => {});
  check(/duck sauce result/.test(await cards.first().innerText()), `${tag} "Results" brings the search back`);

  // A card still plays when it is the card that is pressed.
  await cards.first().locator('button').first().click();
  await until(() => iframes(), { timeout: 8000, what: 'playback' }).catch(() => {});
  check(await iframes() >= 1, `${tag} pressing the card itself still plays it`);

  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── the browse deck (nothing playing) ───────────────────────────────────────
{
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => {
    const url = r.request().url();
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (url.includes('/api/creators/resolve')) return json({ channelId: 'UCduck000000000000000001' });
    if (url.includes('/videos')) return json({ videos: [1, 2].map((i) => ({ url: `https://www.youtube.com/watch?v=chan000000${i}`, title: `Channel upload ${i}`, thumbnail: '', published: new Date().toISOString() })) });
    return json({ success: true, data: [], results: [0, 1, 2].map((i) => ({ title: `deck result ${i}`, url: `https://www.youtube.com/watch?v=deck00000${i}`, channel: 'Duck Channel', image: '', snippet: '' })) });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('duck'); await bar.press('Enter');
  const link = page.locator('[data-player-root] [data-open-channel]').first();
  await until(() => link.count(), { timeout: 10000, what: 'a channel name in the deck' }).catch(() => {});
  check(await link.count() >= 1, '[deck] the deck card\'s channel name is a button');
  await link.click();
  await until(() => page.locator('[data-player-root] [data-channel-bar]').count(), { timeout: 6000, what: 'the channel bar in the deck' }).catch(() => {});
  check(await page.locator('[data-player-root] [data-channel-bar]').count() === 1, '[deck] pressing it opens the channel in the deck');
  check(await page.locator('iframe[src*="youtube"]').count() === 0, '[deck] …and launches nothing');
  await page.locator('[data-player-root] [data-channel-back]').click();
  await until(async () => (await page.locator('[data-player-root] [data-channel-bar]').count()) === 0, { timeout: 4000, what: 'the way back' }).catch(() => {});
  check(await page.locator('[data-player-root] [data-channel-bar]').count() === 0, '[deck] "Results" returns to the search');
  check(errs.length === 0, '[deck] nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
