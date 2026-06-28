#!/usr/bin/env node
/**
 * Revive Adserver browser automation
 * Usage: node scripts/revive-admin.mjs <command>
 *
 * Commands:
 *   configure-zones    Set zone 4 (interstitial 640x480) and zone 5 (banner 720x405)
 *   list-zones         Print all zones with their edit URLs
 *
 * Env: REVIVE_URL, REVIVE_USER, REVIVE_PASS (or set in .env.local)
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const BASE  = process.env.REVIVE_URL  || 'https://ads.truegle.info';
const USER  = process.env.REVIVE_USER || 'trueroot';
const PASS  = process.env.REVIVE_PASS;
const ADMIN = `${BASE}/www/admin`;

if (!PASS) { console.error('Set REVIVE_PASS'); process.exit(1); }

async function login(page) {
  await page.goto(`${ADMIN}/index.php`);
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await page.click('input[type="submit"]');
  await page.waitForLoadState('networkidle');

  // If still on login page, credentials failed
  const stillOnLogin = await page.$('input[name="password"]');
  if (stillOnLogin) {
    throw new Error('Login failed — check REVIVE_USER / REVIVE_PASS');
  }
  console.log('Logged in. URL:', page.url());
}

// Find the edit URL for a zone by its numeric ID by scanning the zone list
async function findZoneEditUrl(page, targetZoneId) {
  // Navigate to publisher/affiliate list first to find affiliates
  await page.goto(`${ADMIN}/affiliate-index.php`);
  await page.waitForLoadState('networkidle');

  const affiliateLinks = await page.$$eval('a[href*="affiliate-index.php"]', els =>
    els.map(a => a.href)
  );

  // Also try direct zone search via zone-index with different affiliateids
  for (let affId = 1; affId <= 10; affId++) {
    await page.goto(`${ADMIN}/zone-index.php?affiliateid=${affId}`);
    await page.waitForLoadState('networkidle');

    // Look for edit links that contain our zone ID
    const editLink = await page.$(`a[href*="zoneid=${targetZoneId}"][href*="zone-edit"]`);
    if (editLink) {
      const href = await editLink.getAttribute('href');
      console.log(`Found zone ${targetZoneId} edit link: ${href}`);
      return href;
    }
  }

  // Fallback: try zone-edit directly with common param combos
  for (let cid = 1; cid <= 3; cid++) {
    for (let aid = 1; aid <= 5; aid++) {
      const url = `${ADMIN}/zone-edit.php?clientid=${cid}&affiliateid=${aid}&zoneid=${targetZoneId}`;
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const sel = await page.$('select[name="delivery"]');
      if (sel) {
        console.log(`Zone ${targetZoneId} found at clientid=${cid} affiliateid=${aid}`);
        return url;
      }
    }
  }

  return null;
}

async function configureZone(page, targetZoneId, { type, width, height }) {
  const url = await findZoneEditUrl(page, targetZoneId);
  if (!url) {
    console.error(`Could not locate zone ${targetZoneId} edit page`);
    // Take screenshot for debugging
    await page.screenshot({ path: `zone-${targetZoneId}-debug.png` });
    console.log(`Screenshot saved: zone-${targetZoneId}-debug.png`);
    return;
  }

  if (!url.startsWith('http')) await page.goto(`${ADMIN}/${url}`);
  else await page.goto(url);
  await page.waitForSelector('select[name="delivery"]');

  await page.selectOption('select[name="delivery"]', String(type));
  await page.waitForTimeout(400);

  await page.fill('input[name="width"]', String(width));
  await page.fill('input[name="height"]', String(height));

  await page.click('input[type="submit"]');
  await page.waitForLoadState('networkidle');
  console.log(`Zone ${targetZoneId} saved: type=${type} ${width}x${height}`);
}

async function listZones(page) {
  for (let aid = 1; aid <= 5; aid++) {
    await page.goto(`${ADMIN}/zone-index.php?affiliateid=${aid}`);
    await page.waitForLoadState('networkidle');
    const links = await page.$$eval('a[href*="zone-edit"]', els =>
      els.map(a => `${a.innerText.trim()} → ${a.href}`)
    );
    if (links.length) {
      console.log(`=== affiliateid=${aid} ===`);
      links.forEach(l => console.log(' ', l));
    }
  }
}

// Delivery type option values in Revive
// 0=Banner/Button/Rectangle  1=Interstitial/Floating  4=Inline Video  5=Overlay Video
const TYPES = { banner: 0, interstitial: 1 };

const [,, cmd] = process.argv;
const browser = await chromium.launch({ headless: false, slowMo: 80 });
const page = await browser.newPage();

try {
  await login(page);

  if (cmd === 'configure-zones') {
    await configureZone(page, 4, { type: TYPES.interstitial, width: 640, height: 480 });
    await configureZone(page, 5, { type: TYPES.banner,       width: 720, height: 405 });
    console.log('Done.');

  } else if (cmd === 'list-zones') {
    await listZones(page);

  } else {
    console.log('Commands: configure-zones | list-zones');
  }
} finally {
  await browser.close();
}
