/* Remember me on sign-in.
 *
 * Owner, 2026-10-08: "add a remember me for the email sign-in so users don't
 * have to sign in every time." Pinned:
 *   - the sign-in form has "Keep me signed in", ticked by default
 *   - signing in sends that choice to the server
 *   - a renewed sign-in from the server is kept
 *   - a server hiccup (500) on the next visit does NOT sign anyone out
 *   - a server that says the sign-in is invalid (401) does
 *
 * Run it:  npm run rememberme:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5297;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const USER = { id: 7, email: 'a@b.co', name: 'a', role: 'user' };

async function ctxWith(validate) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  const sent = [];
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const json = (status, b) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/api/auth/verify-access-code') {
      sent.push(JSON.parse(r.request().postData() || '{}'));
      return json(200, { success: true, token: 'tok-first', user: USER, accountCode: null });
    }
    if (u.pathname === '/api/auth/validate') return validate(json);
    return json(200, {});
  });
  return { ctx, sent };
}

// ── the form ────────────────────────────────────────────────────────────────
{
  const { ctx, sent } = await ctxWith((json) => json(200, { valid: true, user: USER }));
  const page = await ctx.newPage();
  await openApp(page, `${BASE}/auth/login`);
  await until(() => page.locator('[data-age-agree]').count(), { what: 'the age gate' });
  await page.locator('[data-age-agree]').check();
  await page.locator('[data-age-yes]').click();
  const box = page.locator('[data-remember-me]');
  await until(() => box.count(), { what: 'the remember-me box' });
  check(await box.isChecked(), '"Keep me signed in on this device" is on the sign-in form, ticked');
  await page.locator('input[type="email"]').fill('a@b.co');
  await page.locator('input[placeholder="Your code"]').fill('ABC123');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await until(() => sent.length, { what: 'the sign-in request' }).catch(() => {});
  check(sent[0]?.remember === true, 'signing in asks the server to remember', JSON.stringify(sent[0] || {}));
  await until(async () => (await page.evaluate(() => localStorage.getItem('truegle_token')).catch(() => null)) === 'tok-first', { what: 'the stored sign-in' }).catch(() => {});
  check(await page.evaluate(() => localStorage.getItem('truegle_token')) === 'tok-first', '…and the sign-in is stored on this device');
  await ctx.close();
}
{
  const { ctx, sent } = await ctxWith((json) => json(200, { valid: true, user: USER }));
  const page = await ctx.newPage();
  await openApp(page, `${BASE}/auth/login`);
  await until(() => page.locator('[data-age-agree]').count(), { what: 'the age gate' });
  await page.locator('[data-age-agree]').check();
  await page.locator('[data-age-yes]').click();
  await until(() => page.locator('[data-remember-me]').count(), { what: 'the box' });
  await page.locator('[data-remember-me]').uncheck();
  await page.locator('input[type="email"]').fill('a@b.co');
  await page.locator('input[placeholder="Your code"]').fill('ABC123');
  await page.getByRole('button', { name: /^Sign In/ }).click();
  await until(() => sent.length, { what: 'the sign-in request' }).catch(() => {});
  check(sent[0]?.remember === false, 'unticked, the server is told not to remember');
  await ctx.close();
}

// ── the next visit ──────────────────────────────────────────────────────────
const signedIn = "localStorage.setItem('truegle_token','tok-old');"
  + `localStorage.setItem('truegle_user', ${JSON.stringify(JSON.stringify(USER))});`
  + "localStorage.setItem('truegle_remember_me','true');";
for (const [label, validate, expect] of [
  ['the server renews it', (json) => json(200, { valid: true, user: USER, token: 'tok-renewed' }), 'tok-renewed'],
  ['the server hiccups (500)', (json) => json(500, { error: 'Validation failed' }), 'tok-old'],
  ['the server says it is invalid (401)', (json) => json(401, { error: 'Unauthorized', message: 'Invalid or expired token' }), null],
]) {
  const { ctx } = await ctxWith(validate);
  await ctx.addInitScript(`if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded','1'); ${signedIn} }`);
  const page = await ctx.newPage();
  let validated = false;
  page.on('response', (r) => { if (r.url().includes('/api/auth/validate')) validated = true; });
  await openApp(page, `${BASE}/search`);
  await until(() => validated, { what: 'the session check' }).catch(() => {});
  await page.waitForTimeout(800);
  const tok = await page.evaluate(() => localStorage.getItem('truegle_token'));
  check(tok === expect,
    expect === null ? `next visit, ${label}: signed out` : expect === 'tok-old' ? `next visit, ${label}: STILL signed in` : `next visit, ${label}: the renewed sign-in is kept`,
    String(tok));
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
