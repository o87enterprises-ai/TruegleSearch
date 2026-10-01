import { launchChromium } from './lib/browser.mjs';
const base = process.env.BASE || 'https://truegle.info';
const browser = await launchChromium();
const phone = process.env.DESKTOP ? {} : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const pages = (process.env.PAGES || '/').split(',');
for (const path of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...phone });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now())); localStorage.setItem('truegle_swipe_hint_seen','1');");
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS });
  if (process.env.KILL) await page.addStyleTag({ content: process.env.KILL === 'all' ? '*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important} canvas{display:none!important}' : process.env.KILL === 'canvas' ? 'canvas{display:none!important}' : process.env.KILL === 'blur' ? '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important}' : '*,*::before,*::after{animation:none!important}' });
  const box = page.locator('textarea:visible, input[aria-label="Search input"]:visible, input[type="text"]:visible, input[type="search"]:visible').first();
  if (!(await box.count())) { console.log(path.padEnd(16), 'no input found'); await ctx.close(); continue; }
  await box.focus().catch(() => {});
  await box.fill('');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU || 4) });
  await page.evaluate(`window.__long = 0; window.__longMs = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__long++; window.__longMs += e.duration; } }).observe({ entryTypes: ['longtask'] }); } catch (e) {}`);
  const text = 'the quick brown fox jumps over';
  const lat = [];
  for (const ch of text) {
    const t0 = Date.now();
    await page.keyboard.type(ch, { delay: 0 });
    await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
    lat.push(Date.now() - t0);
  }
  const sorted = [...lat].sort((a, b) => a - b);
  const avg = Math.round(lat.reduce((a, b) => a + b, 0) / lat.length);
  const long = await page.evaluate('({ n: window.__long, ms: Math.round(window.__longMs) })');
  const value = await box.inputValue().catch(() => '?');
  console.log(path.padEnd(16), `avg ${String(avg).padStart(4)}ms  p90 ${String(sorted[Math.floor(sorted.length * 0.9)]).padStart(4)}ms  max ${String(sorted[sorted.length - 1]).padStart(4)}ms  longtasks ${long.n} (${long.ms}ms)  typed ${value.length}/${text.length}`);
  await ctx.close();
}
await browser.close();
