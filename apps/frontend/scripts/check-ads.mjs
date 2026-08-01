#!/usr/bin/env node
/**
 * Ad-policy guard — fails the build if a banned ad pattern comes back.
 *
 * Why this exists: on 2026-08-01 the landing page's Adsterra tag hijacked the
 * top window (redirect to bulsis.net/go/...) and visitors could not use the
 * site at all. The tag could do that because the ad iframe was same-origin and
 * un-sandboxed. Both the landing-page slot and the missing sandbox were fixed;
 * this script exists so neither can silently come back.
 *
 * Rules enforced (see docs/AD-POLICY.md for the reasoning):
 *   1. AD-FREE PAGES render no ad component — checked through the whole local
 *      import tree, so a nested component can't sneak one in either.
 *   2. Every ad <iframe> carries the sandbox, and that sandbox never grants
 *      allow-same-origin or allow-top-navigation*.
 *   3. No popunder / social-bar / push plumbing anywhere in the frontend.
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
 * 1 — pages that must never contain an ad, verified through their
 *     entire local import tree.
 * ------------------------------------------------------------------ */

// Modules that render a third-party ad. Matched against import paths.
const AD_MODULES = /\/(AdSlot|RewardAdSlot|ads\/AdsterraBanner|ads\/SponsoredAd|ads\/AdColorWrapper|config\/ads|config\/adNetworks)$/;

const AD_FREE_PAGES = ['src/pages/LandingPage.jsx'];

const EXTS = ['', '.jsx', '.js', '.tsx', '.ts', '/index.jsx', '/index.js'];

const resolveLocal = (fromFile, spec) => {
  const base = resolve(dirname(fromFile), spec);
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

const importsOf = (src) =>
  [...src.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)].map((m) => m[1]);

function walkPage(entry) {
  const seen = new Set();
  const stack = [[resolve(ROOT, entry), [entry]]];

  while (stack.length) {
    const [file, trail] = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    const src = readFileSync(file, 'utf8');
    for (const spec of importsOf(src)) {
      if (AD_MODULES.test(spec.replace(/\.(jsx?|tsx?)$/, ''))) {
        errors.push(
          `${entry} must stay ad-free, but ${rel(file)} imports "${spec}".\n` +
            `    import chain: ${trail.join(' → ')}\n` +
            `    Remove the ad, or move it to a page that is not in AD_FREE_PAGES.`
        );
        continue;
      }
      const next = resolveLocal(file, spec);
      if (next) stack.push([next, [...trail, rel(next)]]);
    }
  }
}

for (const page of AD_FREE_PAGES) {
  if (!existsSync(resolve(ROOT, page))) {
    errors.push(`AD_FREE_PAGES lists ${page}, which no longer exists — update check-ads.mjs.`);
    continue;
  }
  walkPage(page);
}

/* ------------------------------------------------------------------ *
 * 2 — every ad iframe is sandboxed, and the sandbox stays strict.
 * ------------------------------------------------------------------ */

const BANNER = 'src/components/ads/AdsterraBanner.jsx';
const bannerPath = resolve(ROOT, BANNER);

if (!existsSync(bannerPath)) {
  errors.push(`${BANNER} is missing — check-ads.mjs needs updating.`);
} else {
  const src = readFileSync(bannerPath, 'utf8');

  const sandboxDecl = src.match(/const AD_SANDBOX\s*=\s*'([^']*)'/);
  if (!sandboxDecl) {
    errors.push(`${BANNER}: AD_SANDBOX constant is gone. Ad iframes MUST be sandboxed.`);
  } else {
    for (const banned of ['allow-same-origin', 'allow-top-navigation']) {
      if (sandboxDecl[1].includes(banned)) {
        errors.push(
          `${BANNER}: AD_SANDBOX grants "${banned}". That hands the page back to the ad ` +
            `network (parent-DOM injection / top-window redirect). Never grant it.`
        );
      }
    }
  }

  const iframes = src.match(/<iframe\b[\s\S]*?\/>/g) || [];
  if (iframes.length === 0) errors.push(`${BANNER}: no <iframe> found — did the ad markup move?`);
  iframes.forEach((tag, i) => {
    if (!/sandbox=\{AD_SANDBOX\}/.test(tag)) {
      errors.push(`${BANNER}: ad <iframe> #${i + 1} is missing sandbox={AD_SANDBOX}.`);
    }
  });
}

/* ------------------------------------------------------------------ *
 * 3 — no popunder / social-bar / push plumbing anywhere.
 * ------------------------------------------------------------------ */

// Real wiring only — the words may appear in comments explaining the ban.
const BANNED = [
  [/VITE_(\w*_)?(POP|POPUNDER|SOCIAL_BAR|PUSH)[\w]*\s*(=|\|\||\))/i, 'popunder / social-bar / push env var'],
  [/\bpopunder\s*:/i, 'a popunder ad zone'],
  [/\bsocialBar\b/, 'a social-bar ad zone'],
  [/window\.open\s*\([^)]*(?:adsterra|highperformanceformat|millionairelucid)/i, 'a popunder window.open'],
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

for (const file of filesToScan) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, n) => {
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/^\s*[*#]/.test(line)) return; // block-comment / .env comment line
    for (const [re, what] of BANNED) {
      if (re.test(code)) errors.push(`${rel(file)}:${n + 1} looks like ${what}: ${line.trim()}`);
    }
  });
}

/* ------------------------------------------------------------------ */

if (errors.length) {
  console.error('\n[31m✗ AD POLICY VIOLATION[0m — see docs/AD-POLICY.md\n');
  errors.forEach((e) => console.error(`  • ${e}`));
  console.error('');
  process.exit(1);
}

console.log('✓ ad policy OK — landing page ad-free, ad iframes sandboxed, no popunders/social bars');
