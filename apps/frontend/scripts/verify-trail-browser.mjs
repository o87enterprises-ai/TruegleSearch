/* TRAIL's two browser-only behaviours, checked in a browser.
 *
 * verify-trail.mjs proves the RULES; it imports state.js and never opens a
 * canvas. Neither of the things below can be reached that way, and both are
 * bugs that shipped:
 *
 *   1. W AND S DID NOTHING. The key handler acted on them and then let them
 *      through, so a browser with find-as-you-type on opened its quick-find
 *      bar on every press and swallowed the key. The accelerator was dead and
 *      the cause was one missing preventDefault. A unit test cannot see this;
 *      only a real key event carries `defaultPrevented`.
 *   2. THE HALF-TIME WARNING. The decision window is forty seconds now, which
 *      is long enough to stop watching the clock, so the countdown flashes
 *      once half of it is gone. Whether it actually flashes is a question
 *      about pixels.
 *
 * It serves the dev harness itself, so there is nothing to start first.
 *
 * Run it:  npm run trail:browser
 */
import { context } from 'esbuild';
import { chromium } from 'playwright';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5179;
const ctx = await context({
  entryPoints: ['dev/trail.entry.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dev/.build/trail.js',
  logLevel: 'error',
});
await ctx.rebuild();
await ctx.serve({ servedir: 'dev', port: PORT, host: '127.0.0.1' });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => bad.push(`FAIL the game threw — ${e.message}`));
await page.goto(`http://127.0.0.1:${PORT}/trail.html`, { waitUntil: 'load' });
await page.waitForTimeout(600);

// Record every key and whether the game consumed it. Listening on the window
// in the bubble phase puts this AFTER the game's own handler, so what it sees
// is the state the browser would act on.
await page.evaluate(() => {
  window.__seen = [];
  window.addEventListener('keydown', (e) => window.__seen.push([e.key, e.defaultPrevented]));
});

await page.keyboard.press('Enter');            // off the title screen
await page.waitForTimeout(300);

// ── 1. the throttle ────────────────────────────────────────────────────────
// Read the speed gauge off the CANVAS rather than asking the game — 60 world
// pixels wide at (6, H-16), the lit part being the speed. Reaching into the
// module would prove the module agrees with itself.
const gauge = () => page.evaluate(() => {
  const c = document.getElementById('c');
  const g = c.getContext('2d');
  const scale = Math.max(1, Math.floor(Math.min(c.width / 320, c.height / 180)));
  const ox = Math.floor((c.width - 320 * scale) / 2);
  const oy = Math.floor((c.height - 180 * scale) / 2);
  const y = oy + (180 - 14) * scale;
  let lit = 0;
  for (let i = 0; i < 60; i += 1) {
    const d = g.getImageData(ox + (6 + i) * scale + 1, y, 1, 1).data;
    // the empty track is PAL[1] #1d2b53; anything else is lit
    if (!(d[0] === 0x1d && d[1] === 0x2b && d[2] === 0x53)) lit += 1;
  }
  return lit;
});

await page.keyboard.down('s');
await page.waitForTimeout(1200);
await page.keyboard.up('s');
const low = await gauge();

await page.keyboard.down('w');
await page.waitForTimeout(1500);
await page.keyboard.up('w');
const high = await gauge();

check(high > low + 4, 'W opens the throttle and S closes it', `gauge ${low} -> ${high}`);

const seen = await page.evaluate(() => window.__seen);
const drive = seen.filter(([k]) => k === 'w' || k === 's');
check(drive.length > 0 && drive.every(([, prevented]) => prevented),
  'the game CONSUMES w and s, so no browser can claim them for quick-find',
  `${drive.filter(([, p]) => p).length}/${drive.length} prevented`);
check(seen.filter(([k]) => k === 'Tab').every(([, p]) => !p),
  'Tab is left alone, so a keyboard user is never trapped on the 404 page');

// ── 2. the half-time warning ───────────────────────────────────────────────
// Count warm-red pixels in the band just above where the encounter panel sits.
// The flashing countdown bar and the "DECIDING FOR YOU IN n" line are the only
// things up there that are red: the highway sky is #29adff, the horizon band
// #c2c3c7 and the un-warned bar #ffec27 all fail the test below. So the count
// going from nothing to something and back IS the flash.
const warm = () => page.evaluate(() => {
  const c = document.getElementById('c');
  const g = c.getContext('2d');
  const scale = Math.max(1, Math.floor(Math.min(c.width / 320, c.height / 180)));
  const ox = Math.floor((c.width - 320 * scale) / 2);
  const oy = Math.floor((c.height - 180 * scale) / 2);
  const px = g.getImageData(ox, oy + 66 * scale, 320 * scale, 46 * scale).data;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, bl] = [px[i], px[i + 1], px[i + 2]];
    if (r > 180 && gr < 200 && bl < 140 && r - bl > 90) n += 1;
  }
  return n;
});

// Poll rather than predict: the first encounter lands somewhere between 18 and
// 31 miles depending on the seed, and the warning starts twenty seconds into
// the window after that.
//
// Only samples taken AFTER the first lit one count as evidence of a flash.
// Everything before it is the open road, where there is no countdown to be
// dark — counting those would let a warning that came on and simply stayed on
// pass as flashing.
const trace = [];
let firstLit = -1;
for (let i = 0; i < 400; i += 1) {
  const n = await warm();
  trace.push(n);
  if (n > 30 && firstLit < 0) firstLit = i;
  if (firstLit >= 0) {
    const after = trace.slice(firstLit);
    if (after.filter((v) => v > 30).length >= 6 && after.filter((v) => v === 0).length >= 6) break;
  }
  await page.waitForTimeout(120);
}
const after = firstLit >= 0 ? trace.slice(firstLit) : [];
const lit = after.filter((n) => n > 30).length;
const dark = after.filter((n) => n === 0).length;
check(firstLit >= 0, 'the countdown warning appears', `after ${firstLit} samples`);
check(lit >= 6 && dark >= 6, 'and it FLASHES rather than just turning red and staying red',
  `${lit} on / ${dark} off across ${after.length} samples once it started`);

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await ctx.dispose();
process.exit(bad.length ? 1 : 0);
