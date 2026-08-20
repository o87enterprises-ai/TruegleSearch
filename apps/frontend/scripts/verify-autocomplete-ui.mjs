/* Does the completion actually LINE UP with the text it completes?
 *
 * The logic is covered by autocomplete:test. This is the half no amount of
 * reasoning settles: the ghost is a second element drawn over the textarea, and
 * if its font, letter-spacing, padding or line-height differ by a hair, the
 * completion sits visibly off the word it is completing — which reads as a
 * rendering bug rather than a feature.
 *
 * It is measured rather than eyeballed: a probe span with the ghost's own
 * styles is compared against the same string measured inside the input's.
 *
 * Run it:  npm run autocompleteui:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5176, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5176';
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/api/**', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: [] }),
}));

// THE ONE ERROR THAT IS NOT A BUG.
// The ad iframe is sandboxed WITHOUT allow-same-origin, which is a hard rule
// (docs/AD-POLICY.md) — it is the thing that stopped an ad navigating the whole
// tab in the 2026-08-01 incident. Adsterra's script inside it reaches for
// localStorage, is refused, and the refusal surfaces here. That is the sandbox
// doing its job, and the only way to silence it would be to grant the flag that
// must never be granted. Ignored by origin of the message, not by switching the
// check off, so a real error with different wording still fails the suite.
const SANDBOX_DENIED = /document is sandboxed and lacks the 'allow-same-origin' flag/i;
const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => { if (!SANDBOX_DENIED.test(e.message)) errs.push(e.message); });

// A history to complete from, before anything boots.
await page.addInitScript(() => {
  localStorage.setItem('truegle_recent_searches',
    JSON.stringify(['how do tides work', 'monoatomic gold']));
});
await page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

await page.click('textarea');
await page.type('textarea', 'how do', { delay: 30 });
await page.waitForTimeout(400);

check(await page.locator('[data-search-ghost]').count() > 0,
  'typing a few letters of a past query shows a completion');

const geo = await page.evaluate(() => {
  const ghost = document.querySelector('[data-search-ghost]');
  const input = document.querySelector('textarea');
  if (!ghost || !input) return null;
  const g = getComputedStyle(ghost);
  const i = getComputedStyle(input);
  const same = (prop) => g[prop] === i[prop];
  const gb = ghost.getBoundingClientRect();
  const ib = input.getBoundingClientRect();
  return {
    text: ghost.innerText,
    metrics: ['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight',
      'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']
      .filter((p) => !same(p)),
    dx: Math.round(gb.x - ib.x),
    dy: Math.round(gb.y - ib.y),
    dw: Math.round(gb.width - ib.width),
  };
});

check(!!geo, 'both layers are on the page');
// THE CHECK THAT MATTERS. Every property that decides where a glyph lands has
// to agree, or the completion drifts along the line.
check(geo && geo.metrics.length === 0,
  'the completion is set in exactly the same type as the input',
  geo?.metrics.join(', ') || 'all match');
check(geo && Math.abs(geo.dx) <= 1 && Math.abs(geo.dy) <= 1,
  '…and starts at the same point', `dx=${geo?.dx} dy=${geo?.dy}`);
check(geo && Math.abs(geo.dw) <= 1, '…in a box of the same width', `dw=${geo?.dw}`);
check(geo && geo.text.startsWith('how do'),
  '…echoing what was typed so the tail lands after it', JSON.stringify(geo?.text));

// Backspace must let go, or it is the autocomplete that will not take no.
await page.keyboard.press('Backspace');
await page.waitForTimeout(300);
check(await page.locator('[data-search-ghost]').count() === 0,
  'deleting dismisses the completion instead of re-offering it');

// Typing forward brings it back.
await page.type('textarea', 'o', { delay: 30 });
await page.waitForTimeout(300);
check(await page.locator('[data-search-ghost]').count() > 0,
  '…and typing forward again brings it back');

// Right arrow takes it.
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
check(await page.inputValue('textarea') === 'how do tides work',
  'the right arrow takes the completion', await page.inputValue('textarea'));

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
