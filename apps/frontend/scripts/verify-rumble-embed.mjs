/* Rumble plays its REAL embed, not a guess from the page link.
 *
 * Owner, 2026-11-10: Rumble cards on the Feed opened a player that said
 * "Video not found". A watch page's id (rumble.com/v7hhvy2-…) is not its embed
 * id (rumble.com/embed/v7fbj0k/); the player now asks the backend
 * (GET /api/embed/rumble), which asks Rumble's oEmbed. This pins:
 *   - Play now on a Rumble card mounts the embed the backend returned
 *   - if the backend cannot answer, the old guess is still mounted
 *
 * Run it:  npm run rumble:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5243;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();
const PAGE = 'https://rumble.com/v7hhvy2-ceasefire-mike-baker.html';
const POST = {
  id: PAGE, url: PAGE, platform: 'rumble', title: 'Rumble ceasefire clip', author: 'galacticstorm',
  thumbnail: 'https://hugh.cdn.rumble.cloud/x.jpg', createdAt: new Date().toISOString(),
};

for (const resolverWorks of [true, false]) {
  const tag = resolverWorks ? '[resolver up]' : '[resolver down]';
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  let asked = 0;
  await ctx.route('**/api/**', (r) => {
    const url = r.request().url();
    if (url.includes('/api/embed/rumble')) {
      asked++;
      return resolverWorks
        ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ src: 'https://rumble.com/embed/v7fbj0k/' }) })
        : r.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
    }
    const body = url.includes('/api/social/feed')
      ? { success: true, results: [POST], platforms: { rumble: [POST] }, errors: {}, nextCursor: {} }
      : { success: true, results: [], data: [] };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route('**/*rumble.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' @@ ' + String(e.stack).split('\n').slice(1,6).join(' < ')));

  await openApp(page, `http://localhost:${PORT}/feed`);
  const play = page.getByRole('button', { name: /play now/i }).first();
  await until(() => play.count(), { what: 'the Rumble card', timeout: 15000 }).catch(() => {});
  if (!(await play.count())) { check(false, `${tag} the Rumble card shows Play now`); await ctx.close(); continue; }
  await play.click();
  const frame = page.locator('iframe[src*="rumble.com/embed/"]');
  await until(() => frame.count(), { what: 'the Rumble embed', timeout: 8000 }).catch(() => {});
  const src = (await frame.count()) ? await frame.first().getAttribute('src') : '(none)';
  check(asked > 0, `${tag} the player asked the backend for the real embed`, `${asked} requests`);
  check(resolverWorks ? src.includes('/embed/v7fbj0k/') : src.includes('/embed/v7hhvy2/'),
    `${tag} ${resolverWorks ? 'mounts the embed Rumble returned' : 'falls back to the old guess'}`, src);
  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
