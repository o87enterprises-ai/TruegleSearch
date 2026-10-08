/* Owner, 2026-10-08:
 *   - sign-in opens on an 18+ agreement that must be accepted to continue
 *   - after the activation code, straight to Settings → search storage
 *   - a Nuclear Option button in every footer, in the "Surf without tracking"
 *     card, and an asterisk explained at the bottom of the landing page
 *   - "Safe search on. For 18+ search click here" when a search was plainly
 *     for adult material, or a site: search came back empty
 *
 * Run it:  npm run agegate:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5299;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const USER = { id: 7, email: 'a@b.co', name: 'a', role: 'user' };

async function ctx({ signedIn = false, results = [] } = {}) {
  const c = await testContext(browser, { viewport: { width: 1280, height: 900 } });
  await c.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));"
    + (signedIn ? `if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s','1'); localStorage.setItem('truegle_token','tok'); localStorage.setItem('truegle_user', ${JSON.stringify(JSON.stringify(USER))}); }` : ''));
  const sent = [];
  await c.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/api/auth/verify-access-code') { sent.push(JSON.parse(r.request().postData() || '{}')); return json({ success: true, token: 'tok', user: USER, accountCode: null }); }
    if (u.pathname === '/api/auth/validate') return json({ valid: true, user: USER });
    if (u.pathname === '/api/search') return json({ success: true, results, resultCount: results.length });
    if (u.pathname === '/api/session/wipe') return json({ success: true });
    return json({ success: true, data: [], results: [] });
  });
  const page = await c.newPage();
  return { c, page, sent };
}

// ── the sign-in age gate ────────────────────────────────────────────────────
{
  const { c, page, sent } = await ctx();
  await openApp(page, `${BASE}/auth/login`);
  await until(() => page.locator('[data-age-gate]').count(), { what: 'the age gate' });
  const text = await page.locator('[data-age-gate]').innerText();
  check(/Are you 18 or older\?/.test(text), 'sign-in opens on "Are you 18 or older?"');
  check(/protects children/i.test(text) && /Parental guidance is suggested/i.test(text), '…protects children; parental guidance suggested');
  check(/accept all liability/i.test(text), '…turning Safe Search off: the user accepts all liability');
  check(/one-time activation code/i.test(text) && /email address of your choice/i.test(text), '…a one-time activation code to the email of their choice');
  check(/on this device/i.test(text) && /Your settings/.test(text) && /recent searches/i.test(text), '…what is stored on their device, listed');
  check(/taken to Settings/i.test(text), '…and that the code takes them to Settings');
  check(!(await page.locator('input[placeholder="Your code"]').count()), 'the sign-in form is not reachable before agreeing');
  check(await page.locator('[data-age-yes]').isDisabled(), '"Yes" stays disabled until they tick the agreement');
  await page.locator('[data-age-agree]').check();
  await page.locator('[data-age-yes]').click();
  await until(() => page.locator('input[placeholder="Your code"]').count(), { what: 'the form' }).catch(() => {});
  check(await page.locator('input[placeholder="Your code"]').count() === 1, 'agreeing shows the sign-in form');
  await page.locator('input[type="email"]').fill('a@b.co');
  await page.locator('input[placeholder="Your code"]').fill('ABC123');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await until(() => /\/settings/.test(page.url()), { what: 'settings', timeout: 8000 }).catch(() => {});
  check(sent[0]?.adult === true, 'the sign-in tells the server the 18+ agreement was made');
  check(/\/settings\?welcome=1/.test(page.url()) && /#search-storage/.test(page.url()), 'entering the code goes straight to Settings → search storage', page.url());
  await until(() => page.locator('[data-welcome-storage]').count(), { what: 'the welcome note' }).catch(() => {});
  check(await page.locator('[data-welcome-storage]').count() === 1, '…which says to choose how searches are stored, with a way on');
  check(await page.locator('[data-nuclear-option]').count() >= 1, 'Settings has the Nuclear Option at its foot');
  await c.close();
}
{
  const { c, page } = await ctx();
  await openApp(page, `${BASE}/auth/login`);
  await until(() => page.locator('[data-age-no]').count(), { what: 'the gate' });
  await page.locator('[data-age-no]').click();
  await until(() => /\/search/.test(page.url()), { what: 'search' }).catch(() => {});
  check(/\/search/.test(page.url()), '"No, I\'m under 18" goes back to searching (Safe Search stays on)');
  await c.close();
}

// ── the Nuclear Option, everywhere ──────────────────────────────────────────
{
  const { c, page } = await ctx();
  for (const path of ['/search?q=hello', '/feed', '/privacy', '/developers', '/auth/login', '/creators']) {
    await openApp(page, `${BASE}${path}`);
    await until(() => page.locator('[data-nuclear-option]').count(), { what: `nuclear on ${path}`, timeout: 10000 }).catch(() => {});
    const btn = page.locator('[data-nuclear-option]').last();
    const t = await btn.innerText().catch(() => '');
    check(/Nuclear Option\*/.test(t), `${path}: the Nuclear Option* is at the foot of the page`, t);
  }
  await openApp(page, `${BASE}/`);
  await until(() => page.locator('#nuclear-option').count(), { what: 'the explanation' });
  const ex = await page.locator('#nuclear-option').innerText();
  check(/^\* The Nuclear Option/m.test(ex) && /every Truegle page/i.test(ex) && /cannot be undone/i.test(ex), 'the landing page explains the * at the bottom');
  check(await page.locator('footer [data-nuclear-option]').count() >= 1, 'the landing footer has the button');
  await page.locator('[data-tile="why"]').first().dispatchEvent('click');
  await until(() => page.locator('[data-why-body] [data-nuclear-option]').count(), { what: 'the Why card button' }).catch(() => {});
  check(await page.locator('[data-why-body] [data-nuclear-option]').count() === 1, 'the "Surf Without… Tracking" card has the button');
  // the menu, for the full-screen pages with no footer
  await page.locator('button[aria-label*="menu" i]').first().click().catch(() => {});
  await until(() => page.locator('nav [data-nuclear-option]').count(), { what: 'menu', timeout: 4000 }).catch(() => {});
  check(await page.locator('nav [data-nuclear-option]').count() === 1, 'the ☰ menu has it too (for Tube, Chat and Map)');
  await page.keyboard.press('Escape').catch(() => {});
  await c.close();
}
{
  // pressing it, for real
  const { c, page } = await ctx({ signedIn: true });
  await openApp(page, `${BASE}/privacy`);
  await page.evaluate(() => { localStorage.setItem('truegle_settings', '{"x":1}'); localStorage.setItem('theme', 'dark'); });
  await page.locator('[data-nuclear-option]').last().click();
  await page.getByRole('button', { name: /Wipe Everything/ }).click();
  await until(() => page.getByText('Wipe Complete').count(), { what: 'the wipe' }).catch(() => {});
  const left = await page.evaluate(() => Object.keys(localStorage));
  check(!left.includes('truegle_token') && !left.includes('truegle_settings') && left.includes('theme'), 'pressing it erases this device\'s Truegle data (theme kept)', left.join(','));
  await page.getByRole('button', { name: /^Close$/ }).click();
  await until(() => new URL(page.url()).pathname === '/', { what: 'home' }).catch(() => {});
  check(new URL(page.url()).pathname === '/', '…and starts over on a fresh home page');
  await c.close();
}

// ── "Safe search on. For 18+ search click here" ─────────────────────────────
async function searchFor(q, opts) {
  const { c, page } = await ctx(opts);
  await openApp(page, `${BASE}/search?q=${encodeURIComponent(q)}`);
  await page.waitForTimeout(2500);
  const shown = await page.locator('[data-safesearch-notice]').count();
  const text = shown ? await page.locator('[data-safesearch-notice]').innerText() : '';
  const href = shown ? await page.locator('[data-safesearch-notice-link]').getAttribute('href') : null;
  await c.close();
  return { shown, text, href };
}
const ROW = { url: 'https://example.com/a', title: 'A', snippet: 's', domain: 'example.com', category: 'web' };
{
  const r = await searchFor('porn videos', { results: [ROW] });
  check(r.shown === 1 && /Safe search on\. For 18\+ search click here/.test(r.text.replace(/\s+/g, ' ')), 'an adult search shows "Safe search on. For 18+ search click here"', r.text);
  check(r.href === '/auth/login', '…signed out, "click here" goes to the 18+ sign-in', r.href);
  const s = await searchFor('porn videos', { results: [ROW], signedIn: true });
  check(s.href === '/settings#safe-search', '…signed in, straight to the Safe Search setting', s.href);
  const site = await searchFor('site:4chan.org', { results: [] });
  check(site.shown === 1, 'an empty site: search shows it too (Safe Search can drop whole sites)');
  const plain = await searchFor('weather in eugene', { results: [ROW] });
  check(plain.shown === 0, 'an ordinary search does not');
  const essex = await searchFor('essex county news', { results: [ROW] });
  check(essex.shown === 0, '…nor a word that merely contains one ("essex")');
}

// ── searches carry the sign-in, so Safe Search "off" actually applies ──────
{
  const { c, page } = await ctx({ signedIn: true, results: [ROW] });
  await c.addInitScript("localStorage.setItem('truegle_settings', JSON.stringify({ safeSearch: 'off' }))");
  const seen = [];
  page.on('request', (r) => { if (r.url().includes('/api/search')) seen.push({ auth: r.headers().authorization, body: r.postData() }); });
  await openApp(page, `${BASE}/search?q=${encodeURIComponent('anything')}`);
  await until(() => seen.length, { what: 'the search request' }).catch(() => {});
  check(seen[0]?.auth === 'Bearer tok', 'a signed-in search sends the sign-in with it (it used to go out anonymous)', String(seen[0]?.auth));
  check(/"safeSearch":"off"/.test(seen[0]?.body || ''), '…with the Safe Search choice', (/"safeSearch":"[a-z]+"/.exec(seen[0]?.body || '') || [''])[0]);
  await c.close();
}

// ── the account code is remembered on this device ───────────────────────────
{
  const { c, page } = await ctx();
  await c.route('**/api/auth/verify-access-code', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'tok', user: USER, accountCode: null, codeKind: 'account' }) }));
  await openApp(page, `${BASE}/auth/login`);
  await page.locator('[data-age-agree]').check();
  await page.locator('[data-age-yes]').click();
  await page.locator('input[type="email"]').fill('a@b.co');
  await page.locator('input[placeholder="Your code"]').fill('TRU-ABCD');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await until(() => /\/settings/.test(page.url()), { what: 'settings' }).catch(() => {});
  const saved = await page.evaluate(() => localStorage.getItem('truegle_saved_codes'));
  check(/a@b\.co/.test(saved || '') && /TRU-ABCD/.test(saved || ''), 'signing in with the account code keeps it on this device', saved);
  // a later visit: type the email, the code fills itself in
  await page.evaluate(() => { localStorage.removeItem('truegle_token'); localStorage.removeItem('truegle_user'); });
  await openApp(page, `${BASE}/auth/login`);
  await page.locator('[data-age-agree]').check();
  await page.locator('[data-age-yes]').click();
  await page.locator('input[type="email"]').fill('A@B.co');
  const filled = await page.locator('input[placeholder="Your code"]').inputValue();
  check(filled === 'TRU-ABCD', 'typing that email again fills the code in — no new email needed', filled);
  await c.close();
}

// ── a Safe Search control on Tube and Feed ──────────────────────────────────
for (const path of ['/tube', '/feed']) {
  const { c, page } = await ctx({ signedIn: true });
  const feedBodies = [];
  page.on('request', (r) => { if (r.url().includes('/api/social/feed')) feedBodies.push(r.postData() || ''); });
  await openApp(page, `${BASE}${path}`);
  const t = page.locator('[data-safesearch-toggle]').first();
  await until(() => t.count(), { what: `toggle on ${path}`, timeout: 10000 }).catch(() => {});
  check(await t.count() === 1, `${path} has a Safe Search control`);
  const before = await t.getAttribute('data-safesearch-toggle').catch(() => null);
  await t.click().catch(() => {});
  await t.click().catch(() => {});
  const after = await page.locator('[data-safesearch-toggle]').first().getAttribute('data-safesearch-toggle').catch(() => null);
  check(before === 'safe' && after === 'off', `${path}: a signed-in adult can turn it Safe → Blur → Off`, `${before} → ${after}`);
  if (path === '/feed') {
    await page.waitForTimeout(800);
    check(feedBodies.some((b) => /"safeSearch":"off"/.test(b)), '…and the Feed asks again with Safe Search off');
  }
  await c.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
