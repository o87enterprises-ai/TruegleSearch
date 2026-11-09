/* Feed/Tube language: Local (this device's language only) / Global (yours first).
 * Owner, 2026-11-09. The device language is the browser's language setting; the
 * browser locale stands in for it here. Pins:
 *   Feed: every feed request carries the device language and the mode; Local is
 *         the default; the switch changes it, re-asks, and is remembered.
 *   Tube: results go through /api/lang/classify; Local hides other languages,
 *         Global puts yours first; a classifier that does not answer never
 *         withholds results; Local also asks the search index for your language.
 * Run it:  npm run langmode:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const PORT = 5307;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const errs = [];
const init = "localStorage.setItem('truegle_install_dismissed_at', String(Date.now())); localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');";

// ── FEED ─────────────────────────────────────────────────────────────────────
{
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  await ctx.addInitScript(init);
  const bodies = [];
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/social/feed', (r) => {
    try { bodies.push(JSON.parse(r.request().postData() || '{}')); } catch { /* none */ }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], platforms: {}, nextCursor: {}, errors: {} }) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/feed`);
  await until(() => bodies.length > 0, { what: 'a feed request' });
  check(bodies[0].lang === 'es', 'the feed asks in the device language (es-ES -> es)', JSON.stringify({ lang: bodies[0].lang }));
  check(bodies[0].langMode === 'local', '…and Local is the default', bodies[0].langMode);
  check(await page.locator('[data-lang-toggle]').count() >= 1, 'the Feed shows the Local/Global switch');
  check((await page.locator('[data-lang-mode="local"]').first().innerText()).includes('ES'), '…labelled with the device language', await page.locator('[data-lang-mode="local"]').first().innerText());

  bodies.length = 0;
  await page.locator('[data-lang-mode="global"]').first().click();
  await until(() => bodies.some((b) => b.langMode === 'global'), { what: 'a Global request' });
  check(true, 'switching to Global re-asks the feed in Global');
  check(await page.locator('[data-lang-mode="global"][aria-pressed="true"]').count() >= 1, '…and the switch shows Global');

  bodies.length = 0;
  await page.reload();
  await until(() => bodies.length > 0, { what: 'the feed after reload' });
  check(bodies[0].langMode === 'global', 'the choice is remembered on this device', bodies[0].langMode);

  // The landing page's Feed card shares the same setting.
  await openApp(page, `${BASE}/`);
  const bar = page.locator('[data-feed-frame-toggle]');
  await bar.waitFor({ timeout: 20000 });
  if (await bar.getAttribute('aria-expanded') !== 'true') await bar.dispatchEvent('click');
  await until(() => page.locator('[data-landing-feed] [data-lang-toggle]').count(), { what: 'the switch on the landing Feed card' });
  check(await page.locator('[data-landing-feed] [data-lang-mode="global"][aria-pressed="true"]').count() === 1, 'the landing Feed card shows the same switch, in the same state');
  await ctx.close();
}


// The site's ONE language setting (the globe dropdown / Settings) wins over the
// browser's: someone who picked Français gets French in Local.
{
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(init + "localStorage.setItem('truegle_settings', JSON.stringify({ language: 'fr', safeSearch: 'safe' }));");
  const bodies = [];
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/social/feed', (r) => { try { bodies.push(JSON.parse(r.request().postData() || '{}')); } catch { /* none */ } return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], platforms: {}, nextCursor: {}, errors: {} }) }); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/feed`);
  await until(() => bodies.length > 0, { what: 'a feed request' });
  check(bodies[0].lang === 'fr', 'the chosen site language (Français) is used over the browser\'s (en-US)', bodies[0].lang);
  check((await page.locator('[data-lang-mode="local"]').first().innerText()).includes('FR'), '…and the switch says FR');
  await ctx.close();
}

// ── TUBE ─────────────────────────────────────────────────────────────────────
const verdictOf = (t) => (t.startsWith('EN') ? 'match' : t.startsWith('ES') ? 'other' : 'unknown');
async function tube({ mode, classify = 'answer' }) {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(init + (mode ? `localStorage.setItem('truegle_lang_mode', '${mode}');` : ''));
  const searches = []; const classified = [];
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url();
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    if (u.includes('/api/lang/classify')) {
      classified.push(b);
      if (classify === 'hang') return; // never answers
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: (b.items || []).map((x) => ({ verdict: verdictOf(x.title) })) }) });
    }
    if (u.includes('/api/search')) {
      searches.push(b);
      const titles = ['ES uno de los mejores', 'EN the best one', 'clip ?? two', 'EN another good one'];
      const rows = String(b.query || '').trim() ? titles.map((t, i) => ({ title: t, url: `https://www.youtube.com/watch?v=langtest00${i}`, image: `https://i.ytimg.com/vi/langtest00${i}/hqdefault.jpg`, snippet: t, date: new Date().toISOString() })) : [];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: rows, data: [] }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const box = page.locator('[aria-label="Search input"]').first();
  await box.click(); await box.fill('best clips'); await box.press('Enter');
  const titles = () => page.locator('[data-tube-card] h3').allInnerTexts();
  await until(async () => (await titles()).length > 0, { what: 'Tube results', timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(classify === 'hang' ? 4500 : 800);
  return { ctx, page, titles: await titles(), searches, classified };
}

{
  const t = await tube({ mode: null });
  check(t.classified.length > 0, 'Tube results are classified by language', String(t.classified.length));
  check(t.titles.length === 3 && !t.titles.some((x) => x.startsWith('ES')), 'Tube LOCAL (default): other languages are hidden, unknown kept', JSON.stringify(t.titles));
  check(t.searches.some((s) => s.filters?.language === 'en'), 'Tube LOCAL asks the search index for the device language too');
  check(await t.page.locator('[data-tube-scope-bar] [data-lang-toggle]').count() === 1, 'the switch sits in Tube\'s chip row');
  // Switch to Global on the page: the search re-runs and nothing is hidden.
  await t.page.locator('[data-tube-scope-bar] [data-lang-mode="global"]').click();
  await until(async () => (await t.page.locator('[data-tube-card] h3').allInnerTexts()).length === 4, { what: 'all four results', timeout: 10000 }).catch(() => {});
  const g = await t.page.locator('[data-tube-card] h3').allInnerTexts();
  check(g.length === 4 && g[g.length - 1].startsWith('ES') && g[0].startsWith('EN'), 'Tube GLOBAL: everything, your language first, others last', JSON.stringify(g));
  await t.ctx.close();
}
{
  const t = await tube({ mode: 'local', classify: 'hang' });
  check(t.titles.length === 4, 'a classifier that does not answer never withholds results (shown as they are)', JSON.stringify(t.titles));
  await t.ctx.close();
}

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
