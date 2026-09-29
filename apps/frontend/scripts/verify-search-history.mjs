/* Search history on the Tube page and in the player, in a real phone browser.
 *
 * Owner, 2026-09-29: "the tube player search history fix broke". What was
 * actually wrong: SearchBar only remembered a search when a SUGGESTION was
 * picked — a typed search followed by Enter reached neither the page bar's
 * history nor the player's, so the dropdown on the next visit had nothing of
 * yours in it. This pins the whole round trip:
 *
 *   - a typed search on /tube is remembered by BOTH lists, once (the bar fires
 *     two submit callbacks, which used to be able to count it twice)
 *   - reload, focus the empty bar, and it is offered under "Recent"
 *   - the floating player's own bar offers the same search
 *   - a pasted link is not a search
 *   - "Save search history: off" remembers nothing at all
 *
 * Run it:  npm run searchhistory:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5200;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

async function fresh({ saveHistory = true } = {}) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');"
    + (saveHistory ? '' : "localStorage.setItem('truegle_settings', JSON.stringify({ saveHistory: false }));"));
  for (const h of ['**/*youtube*.com/**', '**/*ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied|isExternalMethodAvailable/.test(e.message)) errs.push(e.message); });
  return { ctx, page, errs };
}
// Strings, not functions: this file is linted as node, where the browser
// globals below do not exist — the code runs in the page.
const store = (page) => page.evaluate("({"
  + " page: JSON.parse(localStorage.getItem('truegle_recent_searches') || 'null'),"
  + " player: JSON.parse(localStorage.getItem('truegle_player_search_v1') || 'null') })");
const search = async (page, text) => {
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill(text); await bar.press('Enter');
  await page.waitForTimeout(700);
};

// ── the round trip ──────────────────────────────────────────────────────────
{
  const { ctx, page, errs } = await fresh();
  await openApp(page, `${BASE}/tube`);
  await until(() => page.locator('[aria-label="Search input"]').count(), { what: 'the Tube search bar' });
  await search(page, 'lofi beats');
  let s = await store(page);
  check(s.page?.[0] === 'lofi beats', 'a typed Tube search reaches the search bar\'s history', JSON.stringify(s.page));
  check(s.player?.recent?.[0] === 'lofi beats', '…and the player\'s memory', JSON.stringify(s.player?.recent));
  check(s.player?.counts?.['lofi beats']?.n === 1, '…counted once, not twice', `n=${s.player?.counts?.['lofi beats']?.n}`);

  await search(page, 'trailer park boys');
  s = await store(page);
  check(s.page?.[0] === 'trailer park boys' && s.page?.[1] === 'lofi beats', 'the second search goes on top of the first', JSON.stringify(s.page));

  // A link is not a search.
  await search(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  s = await store(page);
  check(!JSON.stringify(s).includes('youtube.com'), 'a pasted link is not remembered as a search');

  // Come back cold: the empty bar offers what was searched.
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click();
  await until(() => page.getByText('trailer park boys').count(), { what: 'the history to be offered' }).catch(() => {});
  const text = await page.evaluate('document.body.innerText');
  check(/trailer park boys/.test(text) && /lofi beats/.test(text) && /Recent/.test(text), 'a fresh visit offers your searches under "Recent"');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── the floating player shares it ───────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  await openApp(page, `${BASE}/tube`);
  await search(page, 'chippass');
  // Start something so the floating player exists, then go somewhere else.
  await page.goto(`${BASE}/tube?u=${encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the share gate' });
  await page.locator('[data-share-gate]').click();
  // The gate starts it full screen; step back out to the ordinary floating bar.
  await page.waitForTimeout(800);
  await page.evaluate("if (document.fullscreenElement) document.exitFullscreen()");
  await page.waitForTimeout(500);
  // In-app navigation, not a reload: a reload would throw away what is playing.
  await page.evaluate("window.history.pushState({}, '', '/about'); window.dispatchEvent(new PopStateEvent('popstate'));");
  await until(() => page.locator('input[aria-label="Search the player"]').count(), { what: 'the floating player bar' }).catch(() => {});
  const inp = page.locator('input[aria-label="Search the player"]');
  if (await inp.count()) {
    await inp.first().click();
    await until(() => page.locator('[data-player-search-memory]').count(), { what: 'the player history' }).catch(() => {});
    const t = await page.locator('[data-player-search-memory]').innerText().catch(() => '');
    check(/chippass/.test(t), 'the floating player offers a search made on the Tube page', t.replace(/\n/g, ' | ').slice(0, 80));
  } else {
    check(false, 'the floating player\'s search bar appeared');
  }
  await ctx.close();
}

// ── the privacy switch ──────────────────────────────────────────────────────
{
  const { ctx, page } = await fresh({ saveHistory: false });
  await openApp(page, `${BASE}/tube`);
  await search(page, 'private thing');
  const s = await store(page);
  check(s.page === null && (s.player === null || (s.player.recent || []).length === 0),
    '"Save search history: off" remembers nothing', JSON.stringify(s));
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
