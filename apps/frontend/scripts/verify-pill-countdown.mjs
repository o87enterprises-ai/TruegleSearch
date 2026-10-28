/* The pill's countdown: ✕ keeps your pick, and a busy person is never switched.
 *
 * Owner, 2026-10-01:
 *   1. "when the user clicks the button to prevent the pill auto nav after
 *      click, the pill needs to remain on the user's selection, NOT return to
 *      the previous pill mode."
 *   2. "when the user is actively interacting when the timer runs out, I want
 *      the page switch to standby until the user's input is idle. I typed a
 *      long query and it switched before I was finished."
 *
 * Pinned here:
 *   - click the pill, press ✕ → still on the page, pill still on the pick
 *   - a suggestion the APP made (a video link → Tube), ✕ → the pill goes back
 *     (the person never chose Tube)
 *   - the countdown still goes when nobody is doing anything
 *   - typing straight through the end of the countdown: no switch while keys
 *     keep coming, the status says it is waiting, and once typing stops it
 *     goes — with the WHOLE query, not what was typed when the clock ran out
 *   - "Go now" goes immediately even mid-typing
 *
 * Takes about 40 seconds: the countdown and idle window are real.
 * Run it:  npm run pill:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5262;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

async function landing() {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // The landing notice (components/landing/MaintenanceNotice) covers the page until a visitor presses Continue; this run is past it.
  await ctx.addInitScript("sessionStorage.setItem('truegle_maint_seen_v1', '1'); localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_pill_mode_pref', 'black');"
    // Declined, so the hover-hint popover does not open over the search box when the pill is tapped.
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"videos":[]}' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/`);
  const pill = page.locator('button[title^="Click to switch mode"]').first();
  await until(() => pill.count(), { what: 'the mode pill' });
  const input = page.locator('textarea:visible, input[type="text"]:visible').first();
  return { ctx, page, errs, pill, input };
}
const pillLabel = (pill) => pill.innerText().then((t) => t.trim());
const status = (page) => page.locator('[role="status"]').filter({ hasText: 'Going to' }).first();
const press = (loc) => loc.dispatchEvent('click');

// ── ✕ after a click keeps the pick ──────────────────────────────────────────
{
  const { ctx, page, pill, errs } = await landing();
  const before = await pillLabel(pill);
  await press(pill);
  await until(() => status(page).count(), { what: 'the countdown' });
  const picked = await pillLabel(pill);
  check(picked !== before, 'clicking the pill changes it', `${before} → ${picked}`);
  await page.locator('[aria-label="Cancel switching mode"]').dispatchEvent('click');
  // The bubble fades out (AnimatePresence), so give it a moment to leave.
  const gone = await until(async () => (await status(page).count()) === 0, { what: 'the countdown to leave', timeout: 3000 }).then(() => true, () => false);
  check(gone, '✕ stops the countdown');
  check(new URL(page.url()).pathname === '/', '…and you are still on the page');
  check(await pillLabel(pill) === picked, '…and the pill STAYS on your pick (it used to snap back)', `${picked} → ${await pillLabel(pill)}`);
  await page.waitForTimeout(6000);
  check(new URL(page.url()).pathname === '/', 'nothing goes later either', page.url());
  check(errs.length === 0, 'nothing threw (✕ keeps the pick)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a typed suggestion ASKS; it never moves anything by itself ──────────────
// (owner, 2026-10-27: the auto-switch looped and changed pages mid-search)
const ask = (page) => page.locator('[data-smart-ask]').first();
// Something that suggests a page OTHER than the one the pill is on.
const triggerFor = (label) => (label === 'Chat' ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : 'why is the sky blue at noon');
{
  const { ctx, page, pill, input, errs } = await landing();
  const before = await pillLabel(pill);
  await input.click();
  await input.fill(triggerFor(before));
  await until(() => ask(page).count(), { what: 'the "It looks like…" question', timeout: 6000 });
  check(/It looks like/.test(await ask(page).innerText()), 'typing something with an obvious home asks "It looks like… Go to …?"');
  check(await pillLabel(pill) === before, '…and the pill has NOT moved', `${before} → ${await pillLabel(pill)}`);
  await page.waitForTimeout(6500);
  check(new URL(page.url()).pathname === '/', '…and nothing navigates by itself, however long you wait', page.url());
  await page.locator('[data-smart-no]').dispatchEvent('click');
  await until(async () => (await ask(page).count()) === 0, { what: 'the question to close', timeout: 3000 });
  await page.waitForTimeout(1500);
  check(await ask(page).count() === 0, 'No closes it and it does not come back for the same text');
  check(new URL(page.url()).pathname === '/', '…and you are still on the page');
  check(errs.length === 0, 'nothing threw (suggestion No)', errs.join(' | ') || 'clean');
  await ctx.close();
}
{
  const { ctx, page, pill, input } = await landing();
  const before = await pillLabel(pill);
  await input.click();
  await input.fill(triggerFor(before));
  await until(() => ask(page).count(), { what: 'the question', timeout: 6000 });
  await page.locator('[data-smart-yes]').dispatchEvent('click');
  await until(() => new URL(page.url()).pathname !== '/', { what: 'Yes to navigate', timeout: 4000 }).catch(() => {});
  check(new URL(page.url()).pathname !== '/', 'Yes takes you there', page.url());
  await ctx.close();
}
{
  // "Stop suggesting" is remembered.
  const { ctx, page, pill, input } = await landing();
  const before = await pillLabel(pill);
  await input.click();
  await input.fill(triggerFor(before));
  await until(() => ask(page).count(), { what: 'the question', timeout: 6000 });
  await page.getByLabel(/Stop suggesting/).check();
  await page.locator('[data-smart-no]').dispatchEvent('click');
  await input.fill('');
  await input.fill(triggerFor(before) + ' again');
  await page.waitForTimeout(2000);
  check(await ask(page).count() === 0, '"Stop suggesting" silences the question for good');
  await ctx.close();
}
{
  // Clicking a pill mode by hand ends suggestions for the session.
  const { ctx, page, pill, input } = await landing();
  await press(pill);
  await until(() => status(page).count(), { what: 'the countdown' });
  await page.locator('[aria-label="Cancel switching mode"]').dispatchEvent('click');
  await until(async () => (await status(page).count()) === 0, { what: 'the countdown to leave', timeout: 3000 });
  const now = await pillLabel(pill);
  await input.click();
  await input.fill(triggerFor(now));
  await page.waitForTimeout(2500);
  check(await ask(page).count() === 0, 'after you pick a pill mode yourself, no suggestion cuts in');
  check(new URL(page.url()).pathname === '/', '…and the page does not change mid-search', page.url());
  await ctx.close();
}

// ── an idle person still gets switched ──────────────────────────────────────
{
  const { ctx, page, pill } = await landing();
  await press(pill);
  await until(() => status(page).count(), { what: 'the countdown' });
  const t0 = Date.now();
  await until(() => new URL(page.url()).pathname !== '/', { what: 'the switch', timeout: 12000 }).catch(() => {});
  const took = (Date.now() - t0) / 1000;
  check(new URL(page.url()).pathname !== '/', 'with nobody doing anything the countdown still takes you there', `${took.toFixed(1)}s → ${new URL(page.url()).pathname}`);
  check(took >= 4 && took <= 9, '…after roughly the five seconds', `${took.toFixed(1)}s`);
  await ctx.close();
}

// ── typing through the end of the countdown ─────────────────────────────────
{
  const { ctx, page, pill, input, errs } = await landing();
  await press(pill);                                   // the clock starts…
  await until(() => status(page).count(), { what: 'the countdown' });
  await input.click();
  const text = 'a long question that takes me a good while to type out';
  let typed = '';
  const started = Date.now();
  for (const ch of text) {                             // …and the keys keep coming for ~9s
    await page.keyboard.type(ch, { delay: 0 });
    typed += ch;
    await page.waitForTimeout(170);
  }
  const typingMs = Date.now() - started;
  check(typingMs > 6000, 'typing ran well past the 5s countdown', `${(typingMs / 1000).toFixed(1)}s`);
  check(new URL(page.url()).pathname === '/', 'no switch while keys kept coming', page.url());
  const waiting = await status(page).innerText().catch(() => '');
  check(/finish/i.test(waiting), 'the status says it is waiting for you to finish', waiting.trim());
  // Stop typing: it should now go, with everything typed.
  const stopped = Date.now();
  await until(() => new URL(page.url()).pathname !== '/', { what: 'the switch after typing stops', timeout: 8000 }).catch(() => {});
  const lag = (Date.now() - stopped) / 1000;
  check(new URL(page.url()).pathname !== '/', 'once typing stops it goes', `${lag.toFixed(1)}s after the last key`);
  check(lag >= 1.5, '…not before a couple of idle seconds', `${lag.toFixed(1)}s`);
  const arrived = new URL(page.url()).searchParams.get('q') || '';
  check(arrived === text, 'the whole query arrives on the next page, not what was typed when the clock ran out', `"${arrived}"`);
  check(errs.length === 0, 'nothing threw (typing through)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── Go now does not wait ────────────────────────────────────────────────────
{
  const { ctx, page, pill, input } = await landing();
  await press(pill);
  await until(() => status(page).count(), { what: 'the countdown' });
  await input.click();
  await page.keyboard.type('hurry up', { delay: 0 });
  await page.getByRole('button', { name: 'Go now' }).dispatchEvent('click');
  await until(() => new URL(page.url()).pathname !== '/', { what: 'Go now', timeout: 3000 }).catch(() => {});
  check(new URL(page.url()).pathname !== '/', '"Go now" goes immediately, even mid-typing', page.url());
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
