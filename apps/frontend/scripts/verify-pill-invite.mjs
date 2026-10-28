/* The landing mode pill invites a first press.
 *
 * Owner, 2026-10-28: "add a periodic click, sparkle around the edges of the pill,
 * and glow animation to the mode pill so first time users know it does
 * something. Even add a quick … 'click me' to the animation."
 *
 *   1. a first-time visitor on the landing page sees it: sparkles around the
 *      edge, the glow/ripple/dip animations running, and a "Click me" label that
 *      actually becomes visible
 *   2. it is decoration only: hidden from assistive tech, and no layer takes the
 *      pointer — pressing the pill WHILE it plays still switches the mode
 *   3. the first press ends it, for good (remembered; a reload does not bring it
 *      back); a returning visitor never sees it
 *   4. it is finite — six cycles a visit — so it never nags
 *   5. reduced motion: the invitation is not rendered at all
 *   6. only the landing page: the chat page's pill does not animate
 *   7. the pill's own markup is unchanged where other code relies on it (the
 *      word above it is still its previous sibling)
 *
 * Run it:  npm run pillinvite:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5318;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const SHOT = process.argv[2] || '/tmp/pill-invite';

// NOT openApp: that stylesheet zeroes every animation duration and delay so other
// suites need not wait out motion — which is exactly what is under test here. The
// context is also given normal motion settings (testContext defaults to reduced).
async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await until(
    async () => page.evaluate('(() => { const r = document.getElementById("root") || document.body; return !!r && r.childElementCount > 0 && r.innerText.trim().length > 0; })()'),
    { what: `${url} to render` },
  );
}

async function visit(opts, { done = false, path = '/' } = {}) {
  const ctx = await testContext(browser, { reducedMotion: 'no-preference', ...opts });
  await ctx.addInitScript(`localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    sessionStorage.setItem('truegle_maint_seen_v1', '1');
    ${done ? "localStorage.setItem('truegle_pill_invite_done_v1', '1');" : ''}
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"videos":[]}' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await open(page, `${BASE}${path}`);
  const pill = page.locator('button[title^="Click to switch mode"]').first();
  await until(() => pill.count(), { what: 'the mode pill' });
  return { ctx, page, pill, errs };
}
// Move every invitation animation to `sec` seconds into its cycle (after the 2s
// start delay) and hold it there — the label is only visible for ~1.3s of a 7s
// cycle, which a busy page can easily poll straight past.
const seek = (page, sec) => page.evaluate((t) => document.getAnimations()
  .filter((a) => /^pill-invite/.test(a.animationName)).forEach((a) => { a.pause(); a.currentTime = (2 + t) * 1000; }), sec);
const opacityOf = (page, sel) => page.locator(sel).first().evaluate((e) => Number(getComputedStyle(e).opacity)).catch(() => 0);
const labelOpacity = (page) => page.locator('[data-pill-invite-label]').evaluate((e) => Number(getComputedStyle(e).opacity)).catch(() => 0);

// ── 1 + 2 + 7: a first-time visitor, on a phone ─────────────────────────────
{
  const { ctx, page, pill, errs } = await visit({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  check(await pill.getAttribute('data-pill-invite') !== null, '1. a first-time visitor gets the invitation on the pill');
  check(await page.locator('[data-pill-spark]').count() === 8, '1. eight sparkles sit around its edge');
  const names = await page.evaluate(() => [...new Set(document.getAnimations().map((a) => a.animationName))].filter((n) => /^pill-invite/.test(n)).sort());
  check(['pill-invite-glow', 'pill-invite-label', 'pill-invite-ripple', 'pill-invite-spark', 'pill-invite-tap'].every((n) => names.includes(n)),
    '1. the dip, glow, ripple, sparkle and label animations are all running', names.join(', '));
  await seek(page, 1.6);
  check((await labelOpacity(page)) > 0.8, '1. the "Click me" label becomes visible', String((await labelOpacity(page)).toFixed(2)));
  check((await page.locator('[data-pill-invite-label]').innerText()).trim() === 'Click me', '1. and says "Click me"');
  check((await opacityOf(page, '[data-pill-spark]')) > 0.8, '1. the sparkles are lit at the peak', String((await opacityOf(page, '[data-pill-spark]')).toFixed(2)));
  check((await opacityOf(page, '.pill-invite-ripple')) > 0.05 || (await opacityOf(page, '.pill-invite-glow')) >= 0, '1. the ripple and glow are part of the cycle');
  await seek(page, 5.5);
  check((await labelOpacity(page)) === 0 && (await opacityOf(page, '[data-pill-spark]')) === 0, '1. and it rests between cycles (label and sparkles gone)');
  await seek(page, 1.6);
  await page.screenshot({ path: `${SHOT}-phone.png` });

  const layers = await page.evaluate(() => [...document.querySelectorAll('.pill-invite-glow, .pill-invite-ripple, .pill-invite-spark, .pill-invite-label')]
    .map((e) => [getComputedStyle(e).pointerEvents, e.getAttribute('aria-hidden')]));
  check(layers.length >= 11 && layers.every(([pe, ah]) => pe === 'none' && ah === 'true'), '2. every layer ignores the pointer and is hidden from assistive tech', `${layers.length} layers`);
  check(await pill.evaluate((b) => (b.previousElementSibling?.textContent || '').trim().length > 0), '7. the word above the pill is still its previous sibling');

  const before = (await pill.innerText()).trim();
  await pill.dispatchEvent('click');
  await page.waitForTimeout(150);
  const after = (await pill.innerText()).trim();
  check(before !== after, '2. pressing the pill while it plays still switches the mode', `${before} → ${after}`);
  check(await pill.getAttribute('data-pill-invite') === null && await page.locator('[data-pill-spark]').count() === 0, '3. the first press ends the invitation');
  check(await page.evaluate("localStorage.getItem('truegle_pill_invite_done_v1')") === '1', '3. …and it is remembered');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await until(() => page.locator('button[title^="Click to switch mode"]').count(), { what: 'the pill again' });
  check(await page.locator('[data-pill-invite]').count() === 0, '3. a reload does not bring it back');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── 3 + 4: a returning visitor; and the cycle count ─────────────────────────
{
  const { ctx, pill } = await visit({ viewport: { width: 1280, height: 800 } }, { done: true });
  check(await pill.getAttribute('data-pill-invite') === null, '3. a returning visitor never sees it');
  await ctx.close();
}
{
  const { ctx, page } = await visit({ viewport: { width: 1280, height: 800 } });
  await seek(page, 1.6);
  check((await labelOpacity(page)) > 0.8, '1. desktop: the "Click me" label shows at the peak');
  await page.screenshot({ path: `${SHOT}-desktop.png` });
  const iterations = await page.evaluate(() => document.getAnimations().filter((a) => /^pill-invite/.test(a.animationName)).map((a) => a.effect.getTiming().iterations));
  check(iterations.length > 0 && iterations.every((n) => n === 6), '4. it is finite: six cycles, then it rests', [...new Set(iterations)].join(','));
  await ctx.close();
}

// ── 5: reduced motion ───────────────────────────────────────────────────────
{
  const { ctx, page, pill } = await visit({ viewport: { width: 360, height: 740 }, reducedMotion: 'reduce' });
  check(await pill.getAttribute('data-pill-invite') === null && await page.locator('[data-pill-spark], [data-pill-invite-label]').count() === 0,
    '5. reduced motion: the invitation is not rendered at all');
  const names = await page.evaluate(() => document.getAnimations().map((a) => a.animationName).filter((n) => /^pill-invite/.test(n)));
  check(names.length === 0, '5. …and no invitation animation runs', names.join(', ') || 'none');
  const before = (await pill.innerText()).trim();
  await pill.dispatchEvent('click');
  await page.waitForTimeout(150);
  check((await pill.innerText()).trim() !== before, '5. …and the pill works as ever');
  await ctx.close();
}

// ── 6: only the landing page ────────────────────────────────────────────────
{
  const { ctx, pill } = await visit({ viewport: { width: 1280, height: 800 } }, { path: '/chat' });
  check(await pill.getAttribute('data-pill-invite') === null, '6. the chat page\'s pill does not animate');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
