/* The search box: what is typed travels with you, and your history is all there.
 *
 * Owner, 2026-10-01:
 *   "The search bar needs to carry state from one page to the next (it drops
 *    state upon page switch)." and "add a full search bar drop down history …
 *    I hate retyping over and over."
 *
 * CARRY — type on one page, move through the app, and the box on the next page
 * already holds it: Landing → Chat → Tube → Feed. ✕ empties it for every page
 * after. A reload starts clean (it is held in memory, never on disk), and a
 * page that arrives with its own ?q= keeps its own.
 *
 * HISTORY — the dropdown shows ALL of it (it showed five), newest first;
 * typing narrows it to what matches; ↓ opens it on purpose, even over text; a
 * tap on a box that already has text opens it too; each entry can be removed
 * and the whole list cleared. Chat has its own box and the same list, which
 * fills the box rather than sending.
 *
 * Run it:  npm run searchbar:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5263;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const TOPICS = Array.from({ length: 12 }, (_, i) => `topic ${String(i + 1).padStart(2, '0')}`);

async function open({ history = [], pill = 'blue', phone = true } = {}) {
  const ctx = await testContext(browser, phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(`localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_pill_mode_pref', '${pill}');
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
    if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); ${history.length ? `localStorage.setItem('truegle_recent_searches', ${JSON.stringify(JSON.stringify(history))});` : ''} }`);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"videos":[],"response":"ok","content":"ok"}' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, errs };
}
// Moving through the app the way a visitor does: a route change, not a reload.
const go = async (page, path) => {
  await page.evaluate(`history.pushState({}, '', ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate'))`);
  await page.waitForTimeout(700);
};
const box = (page) => page.locator('textarea:visible, input[aria-label="Search input"]:visible').first();
const val = (page) => box(page).inputValue().catch(() => '<none>');
const stored = (page) => page.evaluate("JSON.parse(localStorage.getItem('truegle_recent_searches') || '[]')");
const recents = (page) => page.locator('[data-suggestion="recent"]').count();

// ── CARRY ───────────────────────────────────────────────────────────────────
{
  const { ctx, page, errs } = await open();
  await openApp(page, `${BASE}/`);
  await until(() => box(page).count(), { what: 'the landing search box' });
  await box(page).click();
  await page.keyboard.type('tides and the moon', { delay: 0 });
  await go(page, '/chat');
  check(await val(page) === 'tides and the moon', 'Landing → Chat: the box already holds what you typed', `"${await val(page)}"`);
  await go(page, '/tube');
  await until(() => box(page).count(), { what: 'the Tube bar' });
  check(await val(page) === 'tides and the moon', '…→ Tube: still there', `"${await val(page)}"`);
  await go(page, '/feed');
  await until(() => box(page).count(), { what: 'the Feed bar' });
  check(await val(page) === 'tides and the moon', '…→ Feed: still there', `"${await val(page)}"`);
  await page.locator('[aria-label="Clear search"]:visible').first().dispatchEvent('click');
  await page.waitForTimeout(300);
  await go(page, '/chat');
  check(await val(page) === '', 'after ✕, the next page starts empty', `"${await val(page)}"`);
  check(errs.length === 0, 'nothing threw (carry)', errs.join(' | ') || 'clean');
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await openApp(page, `${BASE}/`);
  await until(() => box(page).count(), { what: 'the box' });
  await box(page).click();
  await page.keyboard.type('will not survive a reload', { delay: 0 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await until(() => box(page).count(), { what: 'the box after a reload' });
  check(await val(page) === '', 'a reload starts clean — nothing is kept on disk', `"${await val(page)}"`);
  await go(page, '/search?q=hello%20world');
  await until(() => box(page).count(), { what: 'the results bar' });
  check((await val(page)) === 'hello world', 'a page that arrives with its own ?q= keeps its own', `"${await val(page)}"`);
  await ctx.close();
}

// ── HISTORY ─────────────────────────────────────────────────────────────────
{
  const { ctx, page, errs } = await open({ history: TOPICS });
  await openApp(page, `${BASE}/`);
  await until(() => box(page).count(), { what: 'the box' });
  await box(page).click();
  await until(() => recents(page), { what: 'the history' }).catch(() => {});
  const n = await recents(page);
  check(n === 12, 'an empty box offers ALL twelve saved searches (it showed five)', `${n}`);
  const first = await page.locator('[data-suggestion="recent"]').first().innerText();
  check(first.includes('topic 01'), '…newest first', first.replace(/\s+/g, ' ').slice(0, 30));
  check(await page.locator('[data-search-history]').evaluate((e) => e.scrollHeight > e.clientHeight).catch(() => false),
    '…in a list that scrolls rather than running off the screen');

  // typing narrows it
  await page.keyboard.type('topic 0', { delay: 0 });
  await page.waitForTimeout(400);
  const narrowed = await recents(page);
  check(narrowed === 9, 'typing narrows the history to what matches', `${narrowed} of 12 match "topic 0"`);

  // remove one
  await box(page).fill('');
  await until(() => recents(page), { what: 'the full list again' }).catch(() => {});
  await page.locator('[data-history-remove]').nth(2).dispatchEvent('click'); // topic 03
  await page.waitForTimeout(300);
  const after = await stored(page);
  check(!after.includes('topic 03') && after.length === 11, '× removes one entry and only that one', `${after.length} left`);
  check(await recents(page) === 11, '…and the list updates at once');

  // ↓ opens it over text
  await box(page).fill('zzzz something else');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await box(page).click();           // a tap on text opens the history too…
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  check(await recents(page) === 11, '↓ opens the whole history, even with text in the box', `${await recents(page)}`);

  // tap on a box that already has text
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await box(page).click();
  await page.waitForTimeout(300);
  check(await recents(page) === 11, 'tapping a box that has text opens it too', `${await recents(page)}`);

  // clear all — offered from an empty box (with text in it the list is a filter, not a manager)
  await box(page).fill('');
  await until(() => page.locator('[data-history-clear]').count(), { what: 'the Clear history link' });
  await page.locator('[data-history-clear]').dispatchEvent('click');
  await page.waitForTimeout(300);
  check((await stored(page)).length === 0, '"Clear search history" empties it', `${(await stored(page)).length} left`);
  check(await recents(page) === 0, '…and the list with it');
  check(errs.length === 0, 'nothing threw (history)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// a submitted search is saved
{
  const { ctx, page } = await open();
  await openApp(page, `${BASE}/`);
  await until(() => box(page).count(), { what: 'the box' });
  await box(page).click();
  await page.keyboard.type('brand new search', { delay: 0 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  check((await stored(page))[0] === 'brand new search', 'a submitted search goes to the top of the history', JSON.stringify((await stored(page)).slice(0, 2)));
  await ctx.close();
}

// ── CHAT'S OWN BOX ──────────────────────────────────────────────────────────
{
  const { ctx, page, errs } = await open({ history: TOPICS });
  await openApp(page, `${BASE}/chat`);
  const chat = page.locator('textarea[placeholder^="Ask Truegle"]').first();
  await until(() => chat.count(), { what: 'the Chat box' });
  // Visible page text only — Playwright's text= selector also reads a textarea's value, i.e. the box itself.
  const bubbles = () => page.evaluate("(document.body.innerText.match(/topic \\d\\d/g) || []).length");
  await chat.click();
  await until(() => page.locator('[data-search-history]').count(), { what: "Chat's history" }).catch(() => {});
  check(await page.locator('[data-search-history] [data-suggestion="recent"]').count() === 12, "Chat's empty box offers the whole history too");
  const box0 = await chat.boundingBox();
  const list0 = await page.locator('[data-search-history]').boundingBox();
  check(list0 && box0 && list0.y + list0.height <= box0.y + 4, '…opening upward, clear of the box', `list bottom ${Math.round((list0?.y || 0) + (list0?.height || 0))} vs box top ${Math.round(box0?.y || 0)}`);
  check(await bubbles() >= 12, 'sanity: the counter below really sees text on the page', `${await bubbles()} matches while the list is open`);
  await page.locator('[data-search-history] [data-suggestion="recent"]').nth(4).dispatchEvent('click');
  await page.waitForTimeout(300);
  check(await chat.inputValue() === 'topic 05', 'picking one fills the box…', `"${await chat.inputValue()}"`);
  check(await bubbles() === 0, '…without sending it');
  await chat.fill('');
  await chat.click();
  await until(() => page.locator('[data-search-history]').count(), { what: 'the list again' }).catch(() => {});
  await page.locator('[data-search-history] [data-history-remove]').first().dispatchEvent('click');
  await page.waitForTimeout(300);
  check((await stored(page)).length === 11, "× removes an entry from Chat's list too", `${(await stored(page)).length}`);
  await page.locator('[data-search-history] [data-history-clear]').dispatchEvent('click');
  await page.waitForTimeout(300);
  check((await stored(page)).length === 0, '"Clear search history" works there', `${(await stored(page)).length}`);
  check(errs.length === 0, 'nothing threw (Chat)', errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
