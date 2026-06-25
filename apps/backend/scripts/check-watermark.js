#!/usr/bin/env node
/**
 * Truegle Watermark Checker
 *
 * Scans text for the invisible zero-width canary embedded by utils/watermark.js
 * and reports whether it originated from Truegle, plus the request traceId.
 *
 * Usage:
 *   node scripts/check-watermark.js "<text to check>"
 *   node scripts/check-watermark.js < some-file.txt
 *   cat suspected-scrape.json | node scripts/check-watermark.js
 *
 * Exit code 0 if a Truegle watermark is found, 1 otherwise.
 */

const watermark = require('../utils/watermark');

function report(text) {
  const found = [];
  // A scraped document may contain many watermarked snippets; pull them all.
  // A watermark is one contiguous run of zero-width characters. Walk through
  // the text removing the first such run each pass so multiple embedded
  // markers are each counted individually.
  const FIRST_RUN = /[⁠​‌]+/;
  let haystack = text;
  let guard = 0;
  while (guard++ < 10000) {
    const hit = watermark.extract(haystack);
    if (!hit) break;
    found.push(hit);
    const next = haystack.replace(FIRST_RUN, '');
    if (next === haystack) break;
    haystack = next;
  }

  if (found.length === 0) {
    console.log('No Truegle watermark found.');
    process.exit(1);
  }

  const traceIds = [...new Set(found.map((f) => f.traceId).filter(Boolean))];
  console.log('✓ Truegle watermark detected.');
  console.log(`  markers found: ${found.length}`);
  console.log(`  trace IDs:     ${traceIds.join(', ') || '(none)'}`);
  process.exit(0);
}

function fromStdin() {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => report(data));
}

const arg = process.argv.slice(2).join(' ');
if (arg) {
  report(arg);
} else if (!process.stdin.isTTY) {
  fromStdin();
} else {
  console.error('Usage: node scripts/check-watermark.js "<text>"  (or pipe text via stdin)');
  process.exit(2);
}
