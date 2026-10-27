// Regression: tapping "Show Map" must mount the map without a render crash
// (maplibre-gl 6 moved map.transform; react-map-gl 8.1 still reads it).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, geolocation: { latitude: 44.8, longitude: -123 }, permissions: ['geolocation'] });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && /Cannot read|ErrorBoundary/.test(m.text())) errs.push(m.text().split('\n')[0]); });
await p.goto(`${BASE}/search?q=pizza+near+me&mode=blue`, { waitUntil: 'load' });
await p.waitForTimeout(2500);
for (const label of ['Maps', 'Show Map']) {
  const el = p.getByRole('button', { name: label, exact: true }).or(p.getByText(label, { exact: true })).first();
  if (await el.count()) { await el.click().catch(() => {}); await p.waitForTimeout(2500); }
}
const box = await p.locator('canvas.maplibregl-canvas').first().boundingBox().catch(() => null);
if (box) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 60, cy + 40, { steps: 6 }); await p.mouse.up();
  await p.mouse.wheel(0, -300); await p.waitForTimeout(1200);
}
await p.goto(`${BASE}/maps`, { waitUntil: 'load' }); await p.waitForTimeout(3000);
const snag = await p.getByText('hit a snag').count();
const canvas = await p.locator('canvas.maplibregl-canvas').count();
console.log(JSON.stringify({ snag, canvas, errs }));
await b.close();
process.exit(snag || errs.length ? 1 : 0);
