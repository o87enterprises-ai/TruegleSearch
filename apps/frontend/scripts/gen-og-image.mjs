// Generates apps/frontend/public/og-image-v3.png (1200x630) from the brand logo.
// Run: node apps/frontend/scripts/gen-og-image.mjs   (requires `sharp`)
//
// v3 (2026-10-27): background matches the landing page (near-black violet with an
// indigo glow top-left and a magenta-violet glow bottom-right); copy set in small,
// widely spaced capitals. New filename so social platforms that cached v2 refetch.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const W = 1200;
const H = 630;
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

const centred = (text, { y, size, track, weight, fill, opacity = 1 }) =>
  `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${track}" fill="${fill}" fill-opacity="${opacity}">${text}</text>`;

// A few faint stars, deterministic so the image is reproducible.
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const stars = Array.from({ length: 46 }, () => {
  const x = Math.round(rnd() * W);
  const y = Math.round(rnd() * H);
  const r = (0.6 + rnd() * 1.1).toFixed(1);
  const o = (0.15 + rnd() * 0.45).toFixed(2);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#e9e4ff" fill-opacity="${o}"/>`;
}).join('');

const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="indigo" cx="14%" cy="8%" r="62%">
      <stop offset="0%" stop-color="#5b4bd6" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#5b4bd6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="violet" cx="50%" cy="34%" r="38%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="magenta" cx="92%" cy="104%" r="58%">
      <stop offset="0%" stop-color="#b0359c" stop-opacity="0.50"/>
      <stop offset="100%" stop-color="#b0359c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0"/>
      <stop offset="50%" stop-color="#c4b5fd" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0818"/>
  <rect width="${W}" height="${H}" fill="url(#indigo)"/>
  <rect width="${W}" height="${H}" fill="url(#magenta)"/>
  <rect width="${W}" height="${H}" fill="url(#violet)"/>
  ${stars}
  <rect x="300" y="352" width="600" height="1" fill="url(#rule)"/>
  ${centred('SURF WITHOUT', { y: 410, size: 17, track: 9, weight: 400, fill: '#b9b0e6', opacity: 0.85 })}
  ${centred('BIAS  ·  TRACKING  ·  CENSORSHIP', { y: 462, size: 27, track: 8, weight: 500, fill: '#f3f0ff' })}
  <rect x="520" y="520" width="160" height="1" fill="url(#rule)"/>
  ${centred('TRUEGLE.INFO', { y: 570, size: 15, track: 10, weight: 400, fill: '#9d93d6', opacity: 0.9 })}
</svg>`);

// The source PNG has wide transparent margins; trim them so the wordmark can
// be shown large.
const logo = await sharp(join(root, 'public/truegle.png'))
  .trim()
  .resize(560, 220, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
const lm = await sharp(logo).metadata();

await sharp(bg)
  .composite([{ input: logo, left: Math.round((W - lm.width) / 2), top: Math.round(70 + (220 - lm.height) / 2) }])
  .png()
  .toFile(join(root, 'public/og-image-v3.png'));

console.log('Wrote public/og-image-v3.png (1200x630)');
