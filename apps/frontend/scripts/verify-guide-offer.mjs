/* The free Post-Apocalyptic / Pioneer guide offer (landing page) — owner, 2026-11-11.
 *
 *   The "add to home screen" popup is gone from the landing page; a modal offers the
 *   guide (The Survivor's Encyclopedia) instead, two ways: play Trail on the 404 page
 *   with no sign-in, or sign in and have it free. Pinned:
 *     - the install popup no longer opens by itself (it is still in the menu)
 *     - the offer appears once, can be dismissed, and is not shown to anyone who holds the guide
 *     - "Play Trail" lands on the 404 page with the game running
 *     - "Sign in" goes to the sign-in page and remembers to come back to the guide
 *     - ?guide=1 opens the guide only for somebody who holds it; ?play=1 starts the game
 *     - a guest session is not an account
 *
 * Run it:  npm run guideoffer:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5322;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const G = await server.ssrLoadModule('/src/utils/guideAccess.js');

// ── the rules, without a browser ────────────────────────────────────────────
check(G.isRealAccount({ id: 7, email: 'a@b.c', role: 'user' }, 'tok'), '[rules] a signed-in user is a real account');
check(!G.isRealAccount({ id: 'guest_1', isGuest: true, role: 'guest' }, 'guest_1'), '[rules] a guest session is not');
check(!G.isRealAccount({ id: 7, role: 'user' }, 'guest_99'), '[rules] a guest token is not, whatever the user says');
check(!G.isRealAccount({ id: 'guest_5' }, 'x') && !G.isRealAccount(null, 'x') && !G.isRealAccount(undefined), '[rules] no user, no account');
check(JSON.stringify(G.trailIntent('?play=1')) === '{"play":true,"guide":false}', '[rules] ?play=1 means play');
check(JSON.stringify(G.trailIntent('?guide=1')) === '{"play":false,"guide":true}', '[rules] ?guide=1 means the guide');
check(JSON.stringify(G.trailIntent('?play=2&guide=yes')) === '{"play":false,"guide":false}', '[rules] anything else means neither');
check(G.PLAY_URL.startsWith(G.TRAIL_PATH) && G.GUIDE_URL.startsWith(G.TRAIL_PATH), '[rules] both doors are on the 404 path');
check(G.OFFER_DISMISS_KEY === 'truegle_install_dismissed_at', '[rules] the dismiss key is the one the test scripts already set');

// ── in the real app ─────────────────────────────────────────────────────────
const URL = `http://localhost:${PORT}`;
const NO_TUTORIAL = "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));";
const browser = await launchChromium();
const fresh = async (init = '') => {
  const ctx = await testContext(browser);
  await ctx.addInitScript(NO_TUTORIAL + init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch|NetworkError|Load failed/i.test(e.message)) console.log('pageerror:', e.message); });
  return { ctx, page };
};
const settle = (page) => page.waitForLoadState('domcontentloaded');

try {
  // 1. A fresh visitor: the guide offer comes, the install popup does not.
  { const { ctx, page } = await fresh();
    await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
    const shown = await until(() => page.locator('[data-guide-offer]').count(), { what: 'the guide offer', timeout: 40000 }).then(() => true).catch(() => false);
    check(shown, '[app] a fresh visitor is offered the guide on the landing page');
    check((await page.locator('[data-install-truegle]').count()) === 0, '[app] the install popup does not open by itself any more');
    check(/Post-Apocalyptic/i.test(await page.locator('[data-guide-offer]').innerText().catch(() => '')), '[app] the offer names the Post-Apocalyptic / Pioneer guide');
    check((await page.locator('[data-guide-play]').count()) === 1 && (await page.locator('[data-guide-signin]').count()) === 1, '[app] both ways in are on the modal: play and sign in');

    // 2. Play Trail -> the 404 page, game running.
    await page.locator('[data-guide-play]').click();
    await until(() => /[?&]play=1/.test(page.url()), { what: 'the play address' });
    const trail = await until(() => page.locator('[aria-label="Close the game"]').count(), { what: 'Trail running', timeout: 20000 }).then(() => true).catch(() => false);
    check(trail, '[app] "Play Trail" lands on the 404 page with the game running', page.url());
    check((await page.evaluate("localStorage.getItem('truegle_install_dismissed_at')")) !== null, '[app] choosing a door counts as dismissing the offer');
    await ctx.close(); }

  // 3. Sign in -> the sign-in page, with the way back to the guide remembered.
  { const { ctx, page } = await fresh();
    await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
    await until(() => page.locator('[data-guide-signin]').count(), { what: 'the offer', timeout: 40000 });
    await page.locator('[data-guide-signin]').click();
    await until(() => page.url().includes('/auth/login'), { what: 'the sign-in page' });
    const st = await page.evaluate('history.state && history.state.usr');
    check(st && st.redirectTo === G.GUIDE_URL, '[app] "Sign in" goes to the sign-in page and remembers to return to the guide', JSON.stringify(st));
    await ctx.close(); }

  // 4. Dismissed: not shown again.
  { const { ctx, page } = await fresh("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
    await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 9000));
    check((await page.locator('[data-guide-offer]').count()) === 0, '[app] a dismissed offer stays away');
    await ctx.close(); }

  // 5. Already holds the guide: not offered.
  { const { ctx, page } = await fresh("localStorage.setItem('truegle_vault_v1', 'guide');");
    await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 9000));
    check((await page.locator('[data-guide-offer]').count()) === 0, '[app] somebody who already holds the guide is not offered it');
    await ctx.close(); }

  // 6. ?guide=1 without the guide: an ordinary 404, game NOT started, no reader.
  { const { ctx, page } = await fresh();
    await page.goto(URL + G.GUIDE_URL, { waitUntil: 'domcontentloaded' });
    await until(() => page.getByText('Page Not Found').count(), { what: 'the 404 page' });
    check((await page.locator('[aria-label="Close the encyclopedia"]').count()) === 0, '[app] ?guide=1 does not hand the guide to somebody who has not earned it');
    check((await page.locator('[aria-label="Close the game"]').count()) === 0, '[app] and does not start the game either');
    await ctx.close(); }

  // 7. ?guide=1 holding the guide: the reader opens.
  { const { ctx, page } = await fresh("localStorage.setItem('truegle_vault_v1', 'guide');");
    await page.goto(URL + G.GUIDE_URL, { waitUntil: 'domcontentloaded' });
    const reader = await until(() => page.locator('[aria-label="Close the encyclopedia"]').count(), { what: 'the reader', timeout: 20000 }).then(() => true).catch(() => false);
    check(reader, '[app] ?guide=1 opens the guide for somebody who holds it');
    await ctx.close(); }

  // 8. Install is still reachable from the menu event.
  { const { ctx, page } = await fresh("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
    await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
    await until(() => page.evaluate("document.body.innerText.length > 50"), { what: 'the page' });
    await page.evaluate("window.dispatchEvent(new Event('truegle:open-install'))");
    const inst = await until(() => page.locator('[data-install-truegle]').count(), { what: 'the install modal', timeout: 8000 }).then(() => true).catch(() => false);
    check(inst, '[app] the install steps still open from the menu');
    await ctx.close(); }
} finally {
  await browser.close();
  await server.close();
}

console.log(ok.join('\n')); console.log(bad.join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
