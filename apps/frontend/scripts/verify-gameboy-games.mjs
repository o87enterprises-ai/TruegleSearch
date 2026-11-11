/* Every Game Boy game in the Games category: does it actually run?
 *
 * Owner, 2026-11-11: "astro attack doesn't seem to be working on desktop" and "please
 * run a test on all of the games and ensure they are all in working order".
 *
 * For EVERY game in src/data/gameboyLibrary.js, in the real Games panel, in a real
 * browser, with the real emulator (WasmBoy) and the real ROM:
 *   1. the ROM file is a valid cartridge the emulator supports (Nintendo logo, header
 *      checksum, a memory controller WasmBoy implements, a size that fits the header)
 *   2. opening it boots: no error panel, the core reports running, a non-zero frame rate
 *   3. it DRAWS: more than one colour on the 160x144 screen (not a blank or flat frame)
 *   4. input reaches it: a held key reaches the emulator and STAYS held — the emulator's
 *      own built-in joypad used to overwrite every on-screen/keyboard press a frame later
 *      (that was Astro Attack, which needs buttons held) — and lets go when released
 *   5. it reacts: after Start / A / B / arrows the screen differs from before, or it
 *      animates by itself (a frozen frame that ignores every key is broken)
 *   6. closing it stops the core
 * Plus the library data: every entry complete, unique, attributed (the licences require it).
 *
 * Run it:  npm run gameboygames:test      (about 3 minutes: it plays every game)
 */
import { createServer } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5322;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const { GAMEBOY_LIBRARY, PLAYABLE_GAMES } = await server.ssrLoadModule('/src/data/gameboyLibrary.js');

// ── 0. the library data ─────────────────────────────────────────────────────
check(GAMEBOY_LIBRARY.length >= 16, `[data] the library lists ${GAMEBOY_LIBRARY.length} games`);
check(new Set(GAMEBOY_LIBRARY.map((g) => g.id)).size === GAMEBOY_LIBRARY.length, '[data] every game has a unique id');
check(new Set(GAMEBOY_LIBRARY.map((g) => g.romPath)).size === GAMEBOY_LIBRARY.length, '[data] every game has its own ROM file');
for (const g of GAMEBOY_LIBRARY) {
  const missing = ['id', 'name', 'developer', 'license', 'sourceUrl', 'romPath', 'tagline', 'icon'].filter((k) => !g[k]);
  check(missing.length === 0, `[data] ${g.name}: complete and attributed`, missing.join(', '));
}

const OFF = GAMEBOY_LIBRARY.filter((g) => g.unavailable);
check(PLAYABLE_GAMES.length + OFF.length === GAMEBOY_LIBRARY.length, `[data] ${PLAYABLE_GAMES.length} games offered, ${OFF.length} held back`);
for (const g of OFF) check(typeof g.unavailable === 'string' && g.unavailable.length > 20, `[data] ${g.name}: held back, with its reason written down`, g.unavailable);
for (const g of GAMEBOY_LIBRARY.filter((x) => x.compat)) {
  check(!!g.compat.short && !!g.compat.note && g.compat.patches?.length > 0, `[data] ${g.name}: its compatibility tweak is described and shown to the player`);
  const rom = readFileSync(`public${g.romPath}`);
  for (const p of g.compat.patches) {
    const present = [[p.at, p.expect], ...(p.context || [])].every(([at, v]) => rom[at] === v);
    check(present, `[data] ${g.name}: the bytes its tweak expects are in the shipped ROM (so it will apply)`);
  }
}

// ── 1. the ROM files ────────────────────────────────────────────────────────
// Memory controllers WasmBoy implements (MBC1/2/3/5; ROM only; ROM+RAM). Not MBC6, MBC7,
// HuC1/3, Pocket Camera or TAMA5.
const SUPPORTED = new Set([0x00, 0x01, 0x02, 0x03, 0x05, 0x06, 0x08, 0x09, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e]);
for (const g of GAMEBOY_LIBRARY) {
  const file = `public${g.romPath}`;
  if (!existsSync(file)) { check(false, `[rom] ${g.name}: ${g.romPath} exists`); continue; }
  const b = readFileSync(file);
  let sum = 0; for (let i = 0x134; i < 0x14d; i += 1) sum = (sum - b[i] - 1) & 0xff;
  const headerSize = b[0x148] <= 8 ? 32768 << b[0x148] : 0;
  check(b.length >= 32768 && b.subarray(0x104, 0x108).equals(Buffer.from([0xce, 0xed, 0x66, 0x66])), `[rom] ${g.name}: a Game Boy cartridge (Nintendo logo present)`);
  check(sum === b[0x14d], `[rom] ${g.name}: header checksum is valid`);
  check(SUPPORTED.has(b[0x147]), `[rom] ${g.name}: memory controller 0x${b[0x147].toString(16)} is supported by the emulator`);
  check(b.length >= headerSize, `[rom] ${g.name}: the file holds at least the ${headerSize / 1024} KB its header promises`, `${b.length / 1024} KB`);
}

// ── 2-6. every game, for real ───────────────────────────────────────────────
const browser = await launchChromium();
const ctx = await testContext(browser, { viewport: { width: 1366, height: 900 } });
await ctx.addInitScript(`
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  // Record every joypad message the page sends to the emulator's worker.
  window.__joy = [];
  window.__workers = 0;
  const RealWorker = window.Worker;
  window.Worker = function (...a) { window.__workers += 1; return new RealWorker(...a); };
  window.Worker.prototype = RealWorker.prototype;
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (m, ...rest) {
    try { const a = m && m.message && m.message.setJoypadStateParamsAsArray; if (a) window.__joy.push(a.slice()); } catch (e) {}
    return post.call(this, m, ...rest);
  };
`);
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: [], data: [] }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${PORT}/search?q=gameboy&category=games`, { waitUntil: 'load' });
await until(() => page.getByText(GAMEBOY_LIBRARY[0].name, { exact: true }).count(), { what: 'the Games panel', timeout: 25000 }).catch(() => {});
await page.waitForTimeout(2000);

// The panel offers exactly the games that work.
{
  const offered = await page.evaluate((names) => names.map((n) => document.body.innerText.includes(n)), GAMEBOY_LIBRARY.map((g) => g.name));
  GAMEBOY_LIBRARY.forEach((g, i) => check(offered[i] === !g.unavailable, `[panel] ${g.name} is ${g.unavailable ? 'NOT offered (held back)' : 'offered'}`));
}

// The compatibility-tweak function itself.
{
  const r = await page.evaluate(async () => {
    const { applyCompatPatches } = await import('/src/utils/gameboyCore.js');
    const rom = new Uint8Array(16); rom[5] = 0x20; rom[2] = 0xfe;
    const patch = { at: 5, expect: 0x20, set: 0x38, context: [[2, 0xfe]] };
    const out = applyCompatPatches(rom, [patch]);
    const wrongBytes = new Uint8Array(16); wrongBytes[5] = 0x20;                        // context byte missing
    const wrongOut = applyCompatPatches(wrongBytes, [patch]);
    const already = new Uint8Array(16); already[5] = 0x38; already[2] = 0xfe;           // not the byte it expects
    return { patched: out[5], original: rom[5], copy: out !== rom, noContext: wrongOut[5], sameArray: wrongOut === wrongBytes, notExpected: applyCompatPatches(already, [patch])[5], none: applyCompatPatches(rom, [])[5] };
  });
  check(r.patched === 0x38 && r.copy, '[patch] a matching tweak is applied to a COPY');
  check(r.original === 0x20, '[patch] ...and the original bytes are never changed');
  check(r.noContext === 0x20 && r.sameArray, '[patch] a ROM missing the surrounding bytes is left exactly as it is');
  check(r.notExpected === 0x38, '[patch] a byte that is not the one expected is left alone');
  check(r.none === 0x20, '[patch] no tweaks, no change');
}

// The screen: a signature of every pixel, and how many different colours it holds.
const SCREEN = () => page.evaluate(() => {
  const c = document.querySelector('[role="dialog"] canvas');
  if (!c) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const px = new Uint32Array(d.buffer);
  const colours = new Set(px).size;
  let h = 2166136261;
  for (let i = 0; i < px.length; i += 1) { h ^= px[i]; h = Math.imul(h, 16777619); }
  return { sig: h >>> 0, colours };
});
const core = () => page.evaluate(async () => (await import('/src/utils/gameboyCore.js')).gameboyCore.status());
// Joypad messages are [UP, RIGHT, DOWN, LEFT, A, B, SELECT, START].
const IDX = { up: 0, right: 1, down: 2, left: 3, a: 4, b: 5, select: 6, start: 7 };

// GAMES="Petris,Astro Attack" npm run gameboygames:test  — only those, in that order (for debugging).
const ONLY = (process.env.GAMES || '').split(',').map((x) => x.trim()).filter(Boolean);
const PLAY = ONLY.length ? ONLY.map((n) => GAMEBOY_LIBRARY.find((g) => g.name === n)).filter(Boolean) : PLAYABLE_GAMES;
const FRESH = !!process.env.FRESH;   // FRESH=1: every game in its own page, so one game cannot affect the next
const report = [];
for (const g of PLAY) {
  if (FRESH && report.length) { await page.goto(`http://localhost:${PORT}/search?q=gameboy&category=games`, { waitUntil: 'load' }); await until(() => page.getByText(GAMEBOY_LIBRARY[0].name, { exact: true }).count(), { what: 'the Games panel', timeout: 25000 }).catch(() => {}); await page.waitForTimeout(1500); }
  const tag = `[${g.name}]`;
  const row = { name: g.name };
  const before = errs.length;
  const card = page.locator('button').filter({ has: page.getByText(g.name, { exact: true }) }).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.click().catch(() => {});
  await until(() => page.locator('[role="dialog"]').count(), { what: 'the player', timeout: 8000 }).catch(() => {});
  const dialog = page.locator('[role="dialog"]');
  check(await dialog.count() === 1, `${tag} opens its player`);
  if (!(await dialog.count())) continue;

  // 2. boots
  await until(async () => (await core()).running === true, { what: 'the core to run', timeout: 20000 }).catch(() => {});
  const st = await core();
  const failed = await dialog.getByText('Back', { exact: true }).count();
  check(!failed && st.running === true, `${tag} boots (no error panel, core running)`, failed ? (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 120) : JSON.stringify(st));
  // Some games open on a blank screen for a while (an intro, a fade-in): wait for the first
  // drawn frame instead of judging an early one.
  let s1 = await SCREEN();
  const drawStart = Date.now();
  while ((!s1 || s1.colours <= 1) && Date.now() - drawStart < 12000) { await page.waitForTimeout(400); s1 = await SCREEN(); }
  check(!!s1 && s1.colours > 1, `${tag} draws something (more than one colour on screen)`, s1 ? `${s1.colours} colours after ${((Date.now() - drawStart) / 1000).toFixed(1)}s` : 'no canvas');
  await page.waitForTimeout(2500);
  const s2 = await SCREEN();
  const fps = (await core()).fps;
  check(fps > 0, `${tag} runs at a real frame rate`, `${fps} fps`);
  row.workers = await page.evaluate(() => window.__workers);
  row.colours = s1?.colours; row.fps = fps; row.animates = !!(s1 && s2 && s1.sig !== s2.sig);

  // 4. a held key reaches the emulator, STAYS held, and lets go
  await page.evaluate(() => { window.__joy.length = 0; });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  const held = await page.evaluate(() => window.__joy.slice());
  const firstRight = held.findIndex((m) => m[IDX.right] === 1);
  const wiped = firstRight >= 0 && held.slice(firstRight).some((m) => m[IDX.right] === 0);
  check(firstRight >= 0, `${tag} a held key reaches the emulator`, `${held.length} joypad messages`);
  check(firstRight >= 0 && !wiped, `${tag} ...and STAYS held (nothing overwrites it a frame later)`, wiped ? `${held.slice(firstRight).filter((m) => m[IDX.right] === 0).length} all-clear messages while held` : 'steady');
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(150);
  const last = (await page.evaluate(() => window.__joy.slice(-1)[0])) || [];
  check(last[IDX.right] === 0, `${tag} ...and lets go when released`);

  // 5. it reacts
  const idle = await SCREEN();
  for (const key of ['e', 'Enter', ' ', 'ArrowUp', 'ArrowLeft']) {
    await page.keyboard.down(key); await page.waitForTimeout(160); await page.keyboard.up(key);
    await page.waitForTimeout(450);
  }
  // Give it up to 8 s to show a change (a title screen can take a moment to hand over).
  let after = await SCREEN();
  const reactStart = Date.now();
  while (idle && after && idle.sig === after.sig && Date.now() - reactStart < 8000) { await page.waitForTimeout(400); after = await SCREEN(); }
  row.reacts = !!(idle && after && idle.sig !== after.sig);
  row.colourAfter = after?.colours;
  // A game that DIES on Start (screen goes blank) must not pass: it has to still be drawing.
  check(!!after && after.colours > 1, `${tag} is still drawing after the keys (it did not go blank or freeze)`, `${after?.colours} colours`);
  // A game that has not moved off its very first screen after 20+ seconds and every key is stuck.
  check(row.reacts || row.animates, `${tag} gets past its first screen: it changes with input, or animates by itself`, `animates=${row.animates} reacts=${row.reacts}`);

  if (process.env.CLEAR_IDB) {   // experiment: does leftover saved data from this game break the next one?
    const dbs = await page.evaluate(async () => { const l = await indexedDB.databases(); await Promise.all(l.map((d) => new Promise((r) => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = () => r(); }))); return l.map((d) => d.name); });
    row.idb = dbs.join(',');
  }
  // 6. closing stops it
  await page.locator('[role="dialog"] button[title="Close"]').click().catch(() => {});
  await until(async () => (await page.locator('[role="dialog"]').count()) === 0, { what: 'the player to close', timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
  check(await page.locator('[role="dialog"]').count() === 0, `${tag} closes`);
  check((await core()).running === false, `${tag} ...and the core stops`);
  const newErrs = errs.slice(before);
  check(newErrs.length === 0, `${tag} no page errors`, newErrs.slice(0, 2).join(' | '));
  report.push(row);
}
await ctx.close();

console.log([...ok, ...bad].join('\n'));
console.log('\n--- per game (colours on screen / fps / animates by itself / reacts to keys) ---');
for (const r of report) console.log(`${r.name.padEnd(26)} ${String(r.colours).padStart(3)} colours  ${String(Math.round(r.fps)).padStart(3)} fps  animates:${r.animates ? 'yes' : 'no '}  reacts:${r.reacts ? 'yes' : 'no'}  workers so far:${r.workers}`);
for (const g of OFF) console.log(`${g.name.padEnd(26)} held back: ${g.unavailable}`);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
