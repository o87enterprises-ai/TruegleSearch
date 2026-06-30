#!/usr/bin/env node
// Records a short video + stills of the branch running in a real browser:
// landing (animated background) → search submit → results transition.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const URL = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const OUT = process.argv[3] || '/tmp/claude-0/-home-user-TruegleSearch/b5c2fb33-0e73-5567-9031-5a66fadea6a9/scratchpad';
const exe = `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium`;

const browser = await chromium.launch({
  headless: true,
  ...(existsSync(exe) ? { executablePath: exe } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1366, height: 900 } },
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('  [err]', m.text().slice(0, 120)); });

console.log('→ landing');
await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4500); // let the animated background run on camera
await page.screenshot({ path: `${OUT}/01-landing.png` });

console.log('→ search submit');
const input = page.locator('input[type="text"], input:not([type])').first();
await input.fill('privacy tools');
await page.waitForTimeout(600);
await input.press('Enter');
await page.waitForTimeout(6500);
await page.screenshot({ path: `${OUT}/02-results.png`, fullPage: false });
console.log('  final URL:', page.url());

await context.close(); // flush video
await browser.close();

// Print the saved video path
import('node:fs').then(({ readdirSync }) => {
  const vids = readdirSync(OUT).filter((f) => f.endsWith('.webm'));
  console.log('VIDEO:', vids.map((v) => `${OUT}/${v}`).join('\n'));
});
