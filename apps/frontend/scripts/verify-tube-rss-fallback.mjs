// Safety net: search/keys all empty -> typed words resolve as a channel, recent uploads show via RSS.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const ids = ['aaaaaaaaaa1', 'aaaaaaaaaa2', 'aaaaaaaaaa3', 'aaaaaaaaaa4'];
await p.route('**/api/**', (r) => {
  const u = r.request().url();
  let body = { success: true, results: [], videos: [] };
  if (u.includes('/api/creators/resolve')) body = { channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa' };
  else if (u.includes('/api/creators/UC')) body = { videos: ids.map((id, i) => ({ title: `Upload ${i}`, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, channel: 'Saviii3rd' })) };
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
});
await p.goto(`${BASE}/tube?q=saviii+3rd`, { waitUntil: 'load' });
await p.waitForTimeout(7000);
const nothing = await p.getByText(/Nothing playable/).count();
const hits = await p.getByText(/Upload \d/).count();
console.log(JSON.stringify({ nothing, hits }));
await b.close();
process.exit(nothing || !hits ? 1 : 0);
