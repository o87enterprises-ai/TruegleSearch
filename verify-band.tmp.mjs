import { chromium, devices } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const ok = [];
const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('truegle_mode_pref_asked', 'true');
    // Seed a queue so the player has something playing — the gesture sheet
    // only renders with a `current`.
    localStorage.setItem('truegle_player_queue_v2', JSON.stringify({
      current: { src: 'https://www.youtube.com/embed/dQw4w9WgXcQ', pageUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Test', kind: 'youtube' },
      queue: [{ src: 'https://www.youtube.com/embed/aaaaaaaaaaa', pageUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', title: 'Next', kind: 'youtube' }],
      history: [],
    }));
  } catch { /* sandboxed ad frame */ }
});
const page = await ctx.newPage();
page.on('pageerror', (e) => bad.push(`FAIL pageerror — ${e.message}`));
await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"results":[]}' }));

await page.goto(`${BASE}/tube`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Enter full screen via the player's own control.
const fs = page.locator('button[title*="Full screen"], button[aria-label*="Full screen"], button[title*="fullscreen"], button[aria-label*="fullscreen"]').first();
const found = await fs.count();
check(found > 0, 'full-screen control present', `count=${found}`);
if (found) { await fs.click(); await page.waitForTimeout(700); }

const geo = await page.evaluate(() => {
  const sheet = document.querySelector('div[aria-hidden="true"][style*="pan-x"]');
  if (!sheet) return null;
  const r = sheet.getBoundingClientRect();
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height),
    vh: window.innerHeight, vw: window.innerWidth, width: Math.round(r.width),
  };
});

check(!!geo, 'gesture sheet is mounted in full screen');
if (geo) {
  check(geo.top >= 60, 'top gutter left open for the status bar / notch', `top=${geo.top}px`);
  check(geo.vh - geo.bottom >= 80, 'bottom gutter left open for the home indicator', `gap=${geo.vh - geo.bottom}px`);
  check(geo.height > geo.vh * 0.35, 'band is still most of the screen', `${geo.height}/${geo.vh}px`);
  check(geo.width === geo.vw, 'band still spans the full width', `${geo.width}/${geo.vw}`);
}

await browser.close();
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
