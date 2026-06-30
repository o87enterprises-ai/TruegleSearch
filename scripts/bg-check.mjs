#!/usr/bin/env node
// Confirms the landing background is present and ANIMATED (not static).
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
await page.goto(URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);

const r = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const anim = (el) => (el ? getComputedStyle(el).animationName : 'none');
  return {
    base: !!q('.tg-bg'),
    auroraAnim: anim(q('.tg-bg__aurora')),
    starsAnim: anim(q('.tg-bg__stars')),
    sheenAnim: anim(q('.tg-bg__sheen')),
    richWebGLLayer: !!q('.background-animation-container'),
  };
});

console.log('\n──────── BACKGROUND ────────');
console.log('  CSS base layer present :', r.base ? '✓' : '✗');
console.log('  aurora animation       :', r.auroraAnim);
console.log('  stars  animation       :', r.starsAnim);
console.log('  sheen  animation       :', r.sheenAnim);
console.log('  rich WebGL layer mounted:', r.richWebGLLayer ? 'yes' : 'no (CSS-only on this device)');
await browser.close();
const animated = r.base && r.auroraAnim !== 'none' && r.starsAnim !== 'none';
console.log('  → animated background  :', animated ? '✅' : '❌');
process.exit(animated ? 0 : 1);
