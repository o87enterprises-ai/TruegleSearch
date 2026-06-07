// Generates apps/frontend/public/og-image.png (1200x630) from the brand logo.
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
    <radialGradient id="glow" cx="78%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="470" y="290" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="800" fill="#ffffff">Truegle</text>
  <text x="473" y="352" font-family="Inter, Arial, sans-serif" font-size="33" font-weight="500" fill="#9fb3d1">Unbiased · Transparent · Secure Search</text>
  <rect x="473" y="384" width="62" height="6" rx="3" fill="#22d3ee"/>
  <rect width="${W}" height="${H}" fill="none" stroke="#22d3ee" stroke-opacity="0.25" stroke-width="2"/>
</svg>`);

const logo = await sharp(join(root, 'src/assets/images/truegle.png'))
  .resize(300, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await sharp(bg)
  .composite([{ input: logo, left: 140, top: 165 }])
  .png()
  .toFile(join(root, 'public/og-image.png'));

console.log('Wrote public/og-image.png (1200x630)');
