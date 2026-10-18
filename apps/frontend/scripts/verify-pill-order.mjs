/* The pill modes in the owner's order, with the words that go with them.
 *
 * Owner, 2026-10-18: "rearrange the pill modes — make Tube the default on the
 * landing page, then Feed, Green, Mainstream, Rabbit Hole, OSINT, Chat; and
 * rearrange the copy on the landing cards to match." Then: "adjust the
 * (search / chat) tab to match" — the small word above the pill:
 *
 *   Tube → Play · Feed → Socials · Green → AI Free · Mainstream → Search ·
 *   Rabbit Hole → Deep Dive · OSINT → Investigate · Chat → Chat / Search
 *
 * Pinned here:
 *   - the landing page opens on Tube, whatever was saved from an earlier visit
 *   - one click at a time walks Tube, Feed, Green, Mainstream, Rabbit Hole,
 *     Privacy / OSINT, Chat — and then round to Tube again
 *   - each stop's word above the pill is the one above
 *   - the cards follow: Tube, Feed, Search, Chat; the Search card's lenses run
 *     Green, Mainstream, Rabbit Hole (Wonderland, its fold), OSINT; the Chat
 *     card's chips run Green, Mainstream, Rabbit Hole, Privacy/OSINT, Unhinged
 *
 * Run it:  npm run pillorder:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5341;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

// A visitor who last used the OLD default (Mainstream) and Chat: the landing
// page must still open on Tube.
const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
  + "localStorage.setItem('truegle_pill_mode_pref', 'blue'); localStorage.setItem('truegle_last_search_pill', 'blue');"
  + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"videos":[]}' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await openApp(page, `${BASE}/`);

const pill = page.locator('button[title^="Click to switch mode"]').first();
await until(() => pill.count(), { what: 'the mode pill' });
// The word above the pill is the span just before it, inside the same column.
const word = () => pill.evaluate((b) => (b.previousElementSibling?.textContent || '').trim());
const toggleWord = () => page.locator('[data-toggle-to="search"]').innerText().then((t) => t.trim());
const pillText = () => pill.innerText().then((t) => t.trim());
const norm = (s) => s.replace(/\s+/g, ' ').toLowerCase();

const WANT = [
  ['Tube', 'Play'],
  ['Feed', 'Socials'],
  ['Green', 'AI Free'],
  ['Mainstream', 'Search'],
  ['Rabbit Hole', 'Deep Dive'],
  ['Privacy / OSINT', 'Investigate'],
  ['Chat', 'Chat / Search'],
];

const first = [await pillText(), await word()];
const toggles = [await toggleWord()];
check(norm(first[0]) === 'tube', 'the landing page opens on Tube, even for a visitor last on Mainstream', first[0]);
check(norm(first[1]) === 'play', '…and the word above it says Play', first[1]);

// Walk the whole cycle with clicks only (each restarts the five-second countdown).
const seen = [first];
for (let i = 0; i < WANT.length; i += 1) {
  await pill.dispatchEvent('click');
  await page.waitForTimeout(120);
  seen.push([await pillText(), await word()]);
  toggles.push(await toggleWord());
}
const order = seen.slice(0, WANT.length);
check(JSON.stringify(order.map((x) => norm(x[0]))) === JSON.stringify(WANT.map((x) => norm(x[0]))),
  'one click at a time: Tube → Feed → Green → Mainstream → Rabbit Hole → Privacy / OSINT → Chat',
  order.map((x) => x[0]).join(' → '));
check(JSON.stringify(order.map((x) => norm(x[1]))) === JSON.stringify(WANT.map((x) => norm(x[1]))),
  'each stop has its own word above the pill',
  order.map((x) => x[1]).join(' · '));
check(norm(seen[WANT.length][0]) === 'tube', 'and after Chat it comes round to Tube again', seen[WANT.length][0]);

// The Search/Chat toggle beside the bar says the same words; in Chat its
// left segment is plain Search (where it takes you back to).
check(JSON.stringify(toggles.slice(0, 7).map(norm)) === JSON.stringify(['play', 'socials', 'ai free', 'search', 'deep dive', 'investigate', 'search']),
  'the toggle beside the bar: Play · Socials · AI Free · Search · Deep Dive · Investigate · (Chat) Search', toggles.slice(0, 7).join(' · '));

// The cards follow the pill.
const tileIds = await page.evaluate("[...document.querySelectorAll('[data-tile]')].map((e) => e.dataset.tile)");
check(JSON.stringify(tileIds) === JSON.stringify(['why', 'tube', 'feed', 'search', 'chat', 'news', 'markets']),
  'the landing cards run Tube, Feed, Search, Chat', tileIds.join(' · '));

await page.locator('[data-tile="search"]').dispatchEvent('click');
await until(() => page.locator('[data-mode-card]').count().then((n) => n === 5), { what: 'the five lenses' });
const lenses = await page.evaluate("[...document.querySelectorAll('[data-mode-card]')].map((e) => e.dataset.modeCard)");
check(JSON.stringify(lenses) === JSON.stringify(['green', 'blue', 'red', 'wonderland', 'ocean']),
  'the Search card lists Green, Mainstream, Rabbit Hole (then its fold, Wonderland), OSINT', lenses.join(' · '));

await page.locator('[data-tile="chat"]').dispatchEvent('click');
await until(() => page.locator('[data-chat-body]').count(), { what: 'the Chat card body' });
const chips = await page.evaluate("[...document.querySelectorAll('[data-chat-body] span')].map((e) => e.textContent.trim())");
check(JSON.stringify(chips) === JSON.stringify(['Green', 'Mainstream', 'Rabbit Hole', 'Privacy/OSINT', 'Unhinged']),
  'the Chat card\'s lens chips run Green, Mainstream, Rabbit Hole, Privacy/OSINT, Unhinged', chips.join(' · '));
check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
await ctx.close();

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
