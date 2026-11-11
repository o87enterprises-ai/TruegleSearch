/* "Open in app" on a search result: what goes into the frame.
 *
 * Owner, 2026-11-11 ("rabbit hole view in app error", a search for "ebk jaaybo"):
 * a result opened "in app" as a blank white page. Two causes, both checked
 * against the live sites:
 *   - the result's address was http://last.fm/... — Truegle is https, and a
 *     browser will not show an http frame inside an https page (mixed content),
 *     so the frame stayed blank. Last.fm itself allows framing.
 *   - genius.com, pitchfork.com and passionweiss.com forbid framing outright
 *     (X-Frame-Options / frame-ancestors), and were not on the known-refusals list.
 * Pinned here, in Rabbit Hole (/red), on a phone and a desktop:
 *   - an http result is framed over https, inline AND full screen
 *   - a site that forbids framing shows "Opens on <site>" and no Open in app
 *   - a quiet hint under the frame says what to do if a page stays blank
 *
 * Run it:  npm run viewerframe:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5313;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();

const ROWS = [
  { title: 'Out On Bail — EBK Jaaybo | Last.fm', url: 'http://last.fm/music/EBK+Jaaybo/_/Out+On+Bail', snippet: 'A rapper from Stockton, CA.' },
  { title: 'EBK Jaaybo Lyrics, Songs, and Albums | Genius', url: 'https://genius.com/artists/Ebk-jaaybo', snippet: 'About EBK Jaaybo.' },
  { title: 'EBK Jaaybo - Albums, Songs, and News | Pitchfork', url: 'https://pitchfork.com/artists/ebk-jaaybo/', snippet: 'Articles and media.' },
  { title: 'A page that allows framing', url: 'https://example.org/page', snippet: 'Fine.' },
];

for (const [label, vp, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1366, height: 950 }, false]]) {
  const ctx = await testContext(browser, { viewport: vp, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
  await ctx.route('**/api/**', (r) => {
    const hit = /\/api\/search/.test(r.request().url());
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hit ? { success: true, results: ROWS, data: ROWS, query: 'ebk jaaybo' } : { success: true, results: [], data: [] }) });
  });
  const asked = [];
  for (const host of ['**/last.fm/**', '**/example.org/**']) {
    await ctx.route(host, (r) => { asked.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>framed</body></html>' }); });
  }
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = `[${label}]`;
  await page.goto(`http://localhost:${PORT}/red?q=ebk+jaaybo`, { waitUntil: 'load' });
  await until(() => page.getByText('Open in app', { exact: true }).count(), { what: 'the results', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500); // the results page re-renders once as its URL settles
  // A press can land on a node that has just been replaced; try again.
  const press = async (loc) => { for (let i = 0; i < 4; i += 1) { try { await loc.click({ timeout: 4000 }); return; } catch { await page.waitForTimeout(800); } } };

  check(await page.getByText('Open in app', { exact: true }).count() === 2, `${tag} Last.fm and the page that allows framing offer Open in app`, String(await page.getByText('Open in app', { exact: true }).count()));
  check(await page.getByText('Opens on genius.com', { exact: true }).count() === 1, `${tag} Genius says "Opens on genius.com" instead (it forbids framing)`);
  check(await page.getByText('Opens on pitchfork.com', { exact: true }).count() === 1, `${tag} Pitchfork says "Opens on pitchfork.com" instead`);

  // Open the Last.fm one (the first result).
  await press(page.getByText('Open in app', { exact: true }).first());
  await until(() => page.locator('iframe[title="Result preview"]').count(), { what: 'the preview frame', timeout: 6000 }).catch(() => {});
  const inline = await page.locator('iframe[title="Result preview"]').first().getAttribute('src', { timeout: 5000 }).catch(() => null);
  check(inline === 'https://last.fm/music/EBK+Jaaybo/_/Out+On+Bail', `${tag} the http result is framed over https`, inline);
  check(await page.locator('[data-viewer-hint]').count() === 1, `${tag} a hint under the frame says what to do if it stays blank`);
  check((await page.locator('[data-viewer-hint]').innerText()).includes('Open link'), `${tag} …and points at Open link`);

  // Full screen is the same frame.
  await press(page.locator('[data-viewer-fullscreen]').first());
  await until(() => page.locator('[data-viewer-fullscreen-open]').count(), { what: 'full screen', timeout: 5000 }).catch(() => {});
  const full = await page.locator('[data-viewer-fullscreen-open] iframe').first().getAttribute('src').catch(() => null);
  check(full === 'https://last.fm/music/EBK+Jaaybo/_/Out+On+Bail', `${tag} full screen frames it over https too`, full);
  await page.waitForTimeout(500);
  check(asked.every((u) => u.startsWith('https://')), `${tag} the page never asked for an http address`, asked.join(' ') || 'no requests');
  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
