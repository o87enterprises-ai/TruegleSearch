import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const URL = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const N = parseInt(process.argv[3] || '5', 10);
const exe = `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium`;
const browser = await chromium.launch({ headless: true, ...(existsSync(exe) ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });

let pass = 0;
for (let i = 1; i <= N; i++) {
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1800 + Math.floor(Math.random() * 2500)); // jitter to catch the race
  const input = page.locator('input[type="text"], input:not([type])').first();
  await input.fill('privacy tools');
  await input.press('Enter');
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => ({
    url: location.href,
    onSearch: location.pathname === '/search',
    stillLanding: document.body.innerText.includes('Pick your lens'),
    searchingUI: /Searching/i.test(document.body.innerText),
  }));
  // Success = route actually switched to UniversalSearch (not the landing page).
  const ok = r.onSearch && !r.stillLanding;
  if (ok) pass++;
  console.log(`  run ${i}: ${ok ? '✅ reached results page' : '❌ stuck on landing'}  (${r.url})`);
  await page.context().close();
}
console.log(`\n${pass}/${N} reached the results page`);
await browser.close();
process.exit(pass === N ? 0 : 1);
