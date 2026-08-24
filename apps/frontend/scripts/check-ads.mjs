#!/usr/bin/env node
/**
 * No-ad-network guard — fails the build if third-party advertising returns.
 *
 * Truegle carried Adsterra until 2026-08-24, when the ad model was dropped
 * entirely: the project is no longer run on a profit/loss basis, so there is no
 * longer a reason to accept the costs that came with a network. Those costs
 * were not hypothetical:
 *
 *   2026-07-05  an ungated zone served adult creative
 *   2026-07-20  it happened again — zones pulled
 *   2026-08-01  a landing-page tag hijacked the top window (redirect to
 *               bulsis.net/go/...) and the site was unusable until it was cut
 *
 * This script used to *contain* those risks (sandbox the iframes, keep the
 * landing page clean). Now it removes them: no ad network may be reintroduced
 * without deliberately editing this file, which makes the decision explicit and
 * reviewable instead of a quiet one-line import.
 *
 * Run: npm run check:ads   (also runs automatically as part of `npm run build`)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p);
const errors = [];

/* ------------------------------------------------------------------ *
 * 1 — ad-network domains and tag plumbing must not appear anywhere.
 * ------------------------------------------------------------------ */

const BANNED = [
  [/millionairelucidlytransmitted|highperformanceformat|adsterratech|effectivecpmnetwork/i,
   'an Adsterra serving domain'],
  [/\badsterra\b/i, 'an Adsterra reference'],
  [/\b(propellerads|hilltopads|popads|adcash|monetag|exoclick|juicyads|trafficstars)\b/i,
   'a third-party ad network'],
  [/googlesyndication|pagead2\.googlesyndication|adsbygoogle/i, 'Google AdSense'],
  [/window\.atOptions/, 'an Adsterra ad-tag options object'],
  [/\/invoke\.js/, 'an ad-network invoke.js tag'],
  [/\bsmartlink\b/i, 'an Adsterra Smartlink'],
  [/\bpopunder\b/i, 'a popunder'],
  [/\bsocialBar\b/, 'a social-bar ad zone'],
  [/VITE_(AD_DOMAIN|SMARTLINK_URL|ADSTERRA\w*|\w*_ENABLED\s*\)?\s*&&\s*\w*AD)/,
   'an ad-network build variable'],
];

const SCAN_DIRS = ['src', 'public'];
const SCAN_FILES = ['index.html', '.env.example'];
const SCAN_EXT = /\.(jsx?|tsx?|html|mjs)$|^\.env\.example$/;

const filesToScan = [];
const collect = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full);
    else if (SCAN_EXT.test(name)) filesToScan.push(full);
  }
};
for (const d of SCAN_DIRS) if (existsSync(resolve(ROOT, d))) collect(resolve(ROOT, d));
for (const f of SCAN_FILES) if (existsSync(resolve(ROOT, f))) filesToScan.push(resolve(ROOT, f));

// This guard names the very things it bans, so it must not scan itself.
const SELF = resolve(ROOT, 'scripts/check-ads.mjs');

for (const file of filesToScan) {
  if (file === SELF) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, n) => {
    // Strip comments — history is documented in prose all over this repo, and
    // describing what was removed is not the same as shipping it.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/^\s*[*#]/.test(line) || /^\s*(\/\/|\{\/\*)/.test(line.trim())) return;
    for (const [re, what] of BANNED) {
      if (re.test(code)) errors.push(`${rel(file)}:${n + 1} looks like ${what}: ${line.trim()}`);
    }
  });
}

/* ------------------------------------------------------------------ *
 * 2 — the deleted ad modules must not come back.
 * ------------------------------------------------------------------ */

const GONE = [
  'src/config/ads.js',
  'src/config/adNetworks.js',
  'src/components/ads/AdsterraBanner.jsx',
  'src/components/ads/SponsoredAd.jsx',
  'src/components/AdSlot.jsx',
  'src/components/RewardAdSlot.jsx',
  'src/context/AdGeoContext.jsx',
  'public/adframe.html',
];

for (const f of GONE) {
  if (existsSync(resolve(ROOT, f))) {
    errors.push(
      `${f} exists again. It was deleted with the ad model on 2026-08-24.\n` +
        `    Reintroducing an ad network is a deliberate decision — if that is what you\n` +
        `    want, remove this check explicitly rather than letting the file slip back in.`
    );
  }
}

/* ------------------------------------------------------------------ */

if (errors.length) {
  console.error('\n\x1b[31m✗ AD-NETWORK GUARD\x1b[0m — third-party advertising was removed from Truegle\n');
  errors.forEach((e) => console.error(`  • ${e}`));
  console.error('');
  process.exit(1);
}

console.log('✓ no third-party ad networks — Truegle serves no ads, sets no ad cookies');
