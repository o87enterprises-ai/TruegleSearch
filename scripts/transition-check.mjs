#!/usr/bin/env node
// Quick check: landing → search submit → /search results, with no leftover
// full-screen matrix overlay. Captures console + page errors so the search
// path is observable in logs.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const URL = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const exe = `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium`;
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(exe) ? { executablePath: exe } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
page.on('console', (m) => console.log(`  [console.${m.type()}] ${m.text().slice(0, 160)}`));
page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message.slice(0, 160)}`));

console.log(`\n→ landing ${URL}/`);
await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1500);

const input = page.locator('input[type="text"], input:not([type])').first();
await input.fill('privacy tools', { timeout: 8000 });
await input.press('Enter');
console.log('→ submitted "privacy tools"');
await page.waitForTimeout(7000);

const loc = page.url();
// A leftover matrix overlay would be a full-viewport black fixed layer of mono glyphs.
const overlay = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')];
  return els.some((el) => {
    const s = getComputedStyle(el);
    return s.position === 'fixed' && el.className?.toString?.().includes('font-mono') &&
      el.getBoundingClientRect().width >= window.innerWidth * 0.9;
  });
});
const hasResults = await page.evaluate(() =>
  /results|No results|Searching/i.test(document.body.innerText));

console.log('\n──────── RESULT ────────');
console.log('  final URL :', loc);
console.log('  on /search:', loc.includes('/search') ? '✓' : '✗');
console.log('  matrix overlay present:', overlay ? '❌ STILL THERE' : 'none ✓');
console.log('  results/loading UI rendered:', hasResults ? '✓' : '✗');
await browser.close();
process.exit(loc.includes('/search') && !overlay ? 0 : 1);
