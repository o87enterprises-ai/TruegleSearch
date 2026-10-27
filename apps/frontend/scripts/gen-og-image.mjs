// Generates apps/frontend/public/og-image-v2.png (1200x630) from the brand logo.
// Run: node apps/frontend/scripts/gen-og-image.mjs   (requires `sharp`)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const W = 1200;
const H = 630;

const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0f1e"/>
      <stop offset="55%" stop-color="#111a35"/>
      <stop offset="100%" stop-color="#0d1430"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="55%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="600" y="370" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="44" font-weight="500" fill="#9fb3d1">Surf Without</text>
  <text x="600" y="470" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="#ffffff">Bias <tspan fill="#22d3ee">·</tspan> Tracking <tspan fill="#22d3ee">·</tspan> Censorship</text>
  <text x="600" y="560" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#6f86a8" letter-spacing="3">TRUEGLE.INFO</text>
  <rect width="${W}" height="${H}" fill="none" stroke="#22d3ee" stroke-opacity="0.25" stroke-width="2"/>
</svg>`);

// The source PNG has wide transparent margins; trim them so the wordmark can
// be shown large.
const logo = await sharp(join(root, 'public/truegle.png'))
  .trim()
  .resize(560, 220, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
const lm = await sharp(logo).metadata();

// v2 (2026-10-27): logo centred, tagline below. A new filename so social
// platforms that cached the old card fetch this one.
await sharp(bg)
  .composite([{ input: logo, left: Math.round((W - lm.width) / 2), top: Math.round(40 + (220 - lm.height) / 2) }])
  .png()
  .toFile(join(root, 'public/og-image-v2.png'));

console.log('Wrote public/og-image-v2.png (1200x630)');
