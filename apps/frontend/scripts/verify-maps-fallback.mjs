// Regression: Maps/Local mode asks the shopping index; when that is empty the
// page must fall back to web results instead of "No results" (weather near X, aws).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, geolocation: { latitude: 38.58, longitude: -121.49 }, permissions: ['geolocation'] });
const p = await ctx.newPage();
const cats = [];
await p.route('**/api/search', (r) => {
  const body = JSON.parse(r.request().postData() || '{}');
  cats.push(body.filters?.category);
  const empty = body.filters?.category === 'shopping';
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ success: true, results: empty ? [] : [{ title: 'Sacramento weather today', url: 'https://example.org/w', snippet: 'Sunny', source: 'web' }], instantAnswer: null }) });
});
await p.goto(`${BASE}/search?q=weather+near+sacramento&mode=blue`, { waitUntil: 'load' });
await p.waitForTimeout(2000);
const maps = p.getByRole('button', { name: 'Maps', exact: true }).first();
if (await maps.count()) await maps.click();
await p.waitForTimeout(500);
await p.keyboard.press('Enter').catch(() => {});
await p.waitForTimeout(3500);
const none = await p.getByText(/No results for/).count();
const hit = await p.getByText('Sacramento weather today').count();
console.log(JSON.stringify({ cats, none, hit }));
await b.close();
process.exit(none || !hit || !cats.includes('shopping') || !cats.includes('all') ? 1 : 0);
