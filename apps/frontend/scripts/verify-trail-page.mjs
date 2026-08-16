/* TRAIL, on a Truegle page.
 *
 * WHAT WAS WRONG. Opening the game replaced the entire window: black to every
 * edge, a lone "TRAIL" wordmark in the top-left, and the only way back a small
 * ✕. Nothing on screen said Truegle — no logo, no background, no card
 * language. A visitor who landed there could not tell whose site they were on,
 * and could not get home without closing the game first.
 *
 * WHAT IT MUST BE, and every clause here is a requirement rather than a
 * preference:
 *   the Truegle logo, and pressing it goes to the landing page
 *   the mode background behind it
 *   the game inside a container built like a results card
 *   NO SEARCH BAR — there is nothing to search for on this page
 *   NO PILL ROW — there is no mode to switch to either
 *
 * The shell renders a search bar and a pill row only when it is handed one of
 * each, so "no search bar" is enforced by not passing them. These checks are
 * what stop that being quietly undone later.
 *
 * Run it:  npm run trailpage:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5198';
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.route('**/api/**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ success: true, data: [], results: [] }),
}));

const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(`${BASE}/definitely-not-a-real-page`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// The numerals are the door — no button, no badge.
await page.locator('button[aria-label*="Press to play"]').click();
await page.waitForSelector('[data-trail-embedded] canvas', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);

const layout = await page.evaluate(() => {
  const card = document.querySelector('[data-trail-embedded]');
  const logo = [...document.querySelectorAll('img')].find((i) => /truegle/i.test(`${i.src} ${i.alt}`));
  return {
    card: !!card,
    canvas: !!card?.querySelector('canvas'),
    // The results card's own treatment, not a lookalike: same gradient
    // endpoints, same radius, same border weight as ResultCard.
    cardClass: card?.className || '',
    // The game must not be portalled out to the body when embedded — the
    // whole point is that it sits inside the page's layout.
    insidePage: !!card && card.closest('.max-w-7xl') !== null,
    logo: !!logo,
    // Anything typeable is a search bar this page should not have.
    inputs: document.querySelectorAll('input, textarea').length,
    // The pill row names the modes; none of them belong here.
    pills: [...document.querySelectorAll('button')]
      .filter((b) => /^(Search|Tube|Feed|Chat|Shop|Local)$/i.test(b.innerText.trim())).length,
    fullScreenTakeover: !!document.querySelector('body > div.fixed.inset-0.z-\\[100000\\]'),
    scrollLocked: getComputedStyle(document.body).overflow === 'hidden',
  };
});

check(layout.card, 'the game opens in a card');
check(layout.canvas, '…with the game actually running in it');
check(layout.insidePage, '…inside the page layout, not portalled over the top of it');
check(!layout.fullScreenTakeover, '…and it is not a full-screen takeover any more');
check(/from-\[#1a1a2e\]/.test(layout.cardClass) && /to-\[#16213e\]/.test(layout.cardClass),
  '…in the results card\'s own gradient, not a lookalike', layout.cardClass.slice(0, 80));
check(/rounded-lg/.test(layout.cardClass) && /border/.test(layout.cardClass),
  '…with the same radius and border treatment');
check(layout.logo, 'the Truegle logo is on the page');
check(layout.inputs === 0, 'there is NO search bar', `${layout.inputs} inputs`);
check(layout.pills === 0, 'there is NO pill row', `${layout.pills} mode pills`);
check(!layout.scrollLocked,
  'the page scroll is not locked — the game is a card, not a viewport');

// The logo is the way home. It was the one thing the takeover had no room for.
await page.locator('img[alt*="Truegle" i], img[src*="truegle" i]').first().click();
await page.waitForTimeout(1500);
const landed = new URL(page.url()).pathname;
check(landed === '/', 'pressing the logo goes back to the landing page', landed);

check(errs.length === 0, 'nothing threw', errs.slice(0, 2).join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
