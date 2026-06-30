import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const URL = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const OUT = '/tmp/claude-0/-home-user-TruegleSearch/b5c2fb33-0e73-5567-9031-5a66fadea6a9/scratchpad';
const exe = `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium`;
const browser = await chromium.launch({ headless: true, ...(existsSync(exe) ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message.slice(0, 120)));

console.log('\n=== A) Direct nav to /search?q=privacy tools ===');
await page.goto(URL + '/search?q=privacy%20tools', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(7000);
let info = await page.evaluate(() => ({
  url: location.href,
  h1: [...document.querySelectorAll('h1,h2')].slice(0, 4).map((e) => e.innerText.slice(0, 40)),
  hasLandingHero: !!document.querySelector('input') && document.body.innerText.includes('Pick your lens'),
  bodyHas: {
    searching: /Searching/i.test(document.body.innerText),
    results: /result/i.test(document.body.innerText),
    noResults: /No results/i.test(document.body.innerText),
    errorBoundary: /something went wrong|try again|reload/i.test(document.body.innerText),
  },
  routeMarker: document.body.getAttribute('data-route') || null,
}));
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: `${OUT}/03-direct-search.png` });

console.log('\n=== B) Landing → fill → Enter ===');
await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2500);
const input = page.locator('input[type="text"], input:not([type])').first();
await input.fill('privacy tools');
await input.press('Enter');
await page.waitForTimeout(6000);
info = await page.evaluate(() => ({
  url: location.href,
  stillLanding: document.body.innerText.includes('Pick your lens'),
  headings: [...document.querySelectorAll('h1,h2')].slice(0, 3).map((e) => e.innerText.slice(0, 40)),
}));
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: `${OUT}/04-after-enter.png` });

console.log('\n=== console/page errors (first 8) ===');
console.log(errs.slice(0, 8).join('\n') || '(none)');
await browser.close();
