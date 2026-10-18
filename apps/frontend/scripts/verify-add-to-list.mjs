/* One way to put a song in a list, everywhere.
 *
 * Owner, 2026-10-18: "I'm having trouble figuring out how to add a song to a
 * playlist — create a universal solution that allows for adding to preexisting
 * lists as well as new lists and a way of easily editing these lists."
 *
 * Pinned here:
 *   - every Tube result card has an "Add to a list" button
 *   - it opens ONE sheet: a name box to make a new list (song already in it),
 *     plus every existing list with a tick; tapping a row toggles the song
 *     in/out; the sheet sits above the page (nothing covers Done)
 *   - the library's Lists tab edits them: a visible rename pencil, delete that
 *     asks twice, a named New list, and a song's row can be removed
 *
 * Run it:  npm run addtolist:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5342;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
  + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
await ctx.route('**/api/**', (r) => {
  let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
  const q = String(b.query || '').trim();
  const rows = q ? [0, 1, 2, 3].map((i) => ({
    title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=abcdefg000${i}`,
    image: `https://i.ytimg.com/vi/abcdefg000${i}/hqdefault.jpg`, snippet: `d${i}`,
    date: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  })) : [];
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: rows, data: [] }) });
});
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await openApp(page, `${BASE}/tube`);
const bar = page.locator('[aria-label="Search input"]').first();
await bar.click(); await bar.fill('duck'); await bar.press('Enter');
const cards = page.locator('[data-tube-card]');
await until(async () => (await cards.count()) >= 4, { what: 'the Tube grid' });

const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('truegle_playlists_v1') || '[]'));
const sheet = page.locator('[data-add-to-list]');

check(await cards.first().locator('[data-save-to-list-btn]').count() === 1, 'a Tube card has an "Add to a list" button');

// New list, named, with the song already in it.
await cards.first().locator('[data-save-to-list-btn]').dispatchEvent('click');
await until(() => sheet.count(), { what: 'the add sheet' });
check(await sheet.getByText('duck result 0').count() === 1, 'the sheet names the song being saved');
await sheet.locator('input[aria-label="New list name"]').fill('Road trip');
await sheet.getByRole('button', { name: /create/i }).click();
await until(async () => (await stored()).length === 1, { what: 'the list to exist' });
let l = await stored();
check(l[0].name === 'Road trip' && l[0].items.length === 1, 'Create makes the named list with the song in it', JSON.stringify(l.map((x) => [x.name, x.items.length])));
check(await sheet.locator('[data-list-id]').first().getAttribute('aria-pressed') === 'true', '…and the sheet shows it ticked');

// A second list, then a different song into the PRE-EXISTING one.
await sheet.locator('input[aria-label="New list name"]').fill('Gym');
await sheet.getByRole('button', { name: /create/i }).click();
await until(async () => (await stored()).length === 2, { what: 'a second list' });
await sheet.getByRole('button', { name: 'Done' }).click();
await until(async () => (await sheet.count()) === 0, { what: 'the sheet to close' });

await cards.nth(1).locator('[data-save-to-list-btn]').dispatchEvent('click');
await until(() => sheet.count(), { what: 'the sheet again' });
check(await sheet.locator('[data-list-id]').count() === 2, 'the sheet lists the existing lists');
await sheet.locator('[data-list-id]').first().click();   // Road trip
await until(async () => (await stored())[0].items.length === 2, { what: 'the add to an existing list' });
check((await stored())[0].items.length === 2, 'tapping an existing list adds the song to it');
await sheet.locator('[data-list-id]').first().click();   // toggle back off
await until(async () => (await stored())[0].items.length === 1, { what: 'the toggle off' });
check((await stored())[0].items.length === 1, 'tapping it again takes the song back out');
await sheet.getByRole('button', { name: 'Done' }).click();

// Editing lives in the library's Lists tab.
// Start something playing so the player (and its list panel) exists.
await cards.first().locator('button').first().dispatchEvent('click');
const listBtn = page.locator('[aria-label="Queue and results"]').first();
await until(() => listBtn.count(), { what: 'the player transport' });
check(await page.locator('[data-save-to-list-btn]').count() > 4, 'the now-playing bar has its own Add to a list button too');
await listBtn.dispatchEvent('click');
await page.getByRole('button', { name: /^lists$/i }).first().dispatchEvent('click');
await until(() => page.locator('[data-list-rename]').count(), { what: 'the Lists tab' });
await page.locator('[data-list-rename]').first().dispatchEvent('click');
const rename = page.locator('input.border-b').first();
await rename.fill('Long drive'); await rename.press('Enter');
await until(async () => (await stored())[0].name === 'Long drive', { what: 'the rename' });
check((await stored())[0].name === 'Long drive', 'the pencil renames a list');

await page.getByRole('button', { name: /^delete /i }).first().dispatchEvent('click');
check((await stored()).length === 2, 'the first press on delete only asks');
await page.locator('[data-list-delete-confirm]').dispatchEvent('click');
await until(async () => (await stored()).length === 1, { what: 'the delete' });
check((await stored()).length === 1, 'the second press deletes it');
check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
await ctx.close();

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
