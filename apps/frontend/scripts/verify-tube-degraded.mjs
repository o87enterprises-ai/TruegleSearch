// Regression (2026-10-27): when the backend reports degraded providers, Tube
// search must still show its results. A shadowed `trace` threw on every
// degraded answer and every search ended "Nothing playable".
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const ids = ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk', 'JGwWNGJdvx8'];
await p.route('**/api/**', (r) => {
  const u = r.request().url();
  const body = { success: true, results: [], degraded: ['brave', 'youtube'] };
  if (u.includes('/api/search') && JSON.parse(r.request().postData() || '{}').filters?.category === 'videos') {
    body.results = ids.map((id, i) => ({ title: `Test clip ${i}`, url: `https://www.youtube.com/watch?v=${id}`, iframeSrc: `https://www.youtube-nocookie.com/embed/${id}`, image: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, category: 'videos' }));
  }
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
});
await p.goto(`${BASE}/tube?q=test+clip`, { waitUntil: 'load' });
await p.waitForTimeout(6000);
const nothing = await p.getByText(/Nothing playable/).count();
const hits = await p.getByText(/Test clip \d/).count();
console.log(JSON.stringify({ nothing, hits }));
await b.close();
process.exit(nothing || !hits ? 1 : 0);
