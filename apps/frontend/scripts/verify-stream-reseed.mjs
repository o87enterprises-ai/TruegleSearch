// Regression (2026-10-27): Stream seeds from the song chosen, and from liked artists with nothing playing.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const calls = [];
const vid = (q, i) => { const id = `${q.replace(/\W/g, '').slice(0, 6)}${i}`.padEnd(11, 'x').slice(0, 11); return { title: `${q} - Song ${i}`, url: `https://www.youtube.com/watch?v=${id}`, iframeSrc: `https://www.youtube-nocookie.com/embed/${id}`, image: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, channel: `${q} - Topic`, category: 'videos' }; };
await p.route('**/api/**', (r) => {
  const u = r.request().url();
  let body = { success: true, results: [] };
  if (u.includes('/api/search')) {
    const q = JSON.parse(r.request().postData() || '{}').query || '';
    calls.push(`search:${q}`);
    const name = q.replace(/ official audio$/, '');
    body.results = [1, 2, 3, 4].map((i) => vid(name, i));
  } else if (u.includes('/api/music/similar')) {
    calls.push('similar');
    body = { success: true, artist: 'Saviii 3rd', similar: ['Rema', 'Burna Boy', 'Tems'], source: 'lastfm' };
  }
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
});
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
  localStorage.setItem('truegle_taste_v1', JSON.stringify({ ratings: { k: 1 }, channels: {}, words: {}, artists: { 'Saviii 3rd': 4 } }));
  localStorage.setItem('truegle_radio', '0');
});
await p.goto(`${BASE}/tube`, { waitUntil: 'load' });
await p.waitForTimeout(2500);
const btn = p.locator('[data-player-radio]').first();
const visible = await btn.count();
if (visible) await btn.click({ force: true }); else console.log('no stream button on landing');
await p.waitForTimeout(5000);
const state = await p.evaluate(() => JSON.parse(localStorage.getItem('truegle_player_queue_v2') || '{}'));
const out = { visible, current: state.current?.title, queue: (state.queue || []).length, calls: [...new Set(calls)] };
console.log(JSON.stringify(out));
// Thumbs-down registers and skips.
const before = out.current;
await p.locator('[data-player-root]').first().hover().catch(() => {});
await p.locator('button[aria-label^="Dislike"]').first().evaluate((el) => el.click()).catch(() => {});
await p.waitForTimeout(2500);
const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('truegle_player_queue_v2') || '{}'));
const taste = await p.evaluate(() => JSON.parse(localStorage.getItem('truegle_taste_v1') || '{}'));
out.skipped = st2.current?.title !== before;
out.disliked = Object.values(taste.ratings || {}).includes(-1); out.taste = JSON.stringify(taste).slice(0,300);
console.log(JSON.stringify(out));
await b.close();
process.exit(out.current && out.queue >= 3 && out.calls.includes('similar') && out.skipped && out.disliked ? 0 : 1);
