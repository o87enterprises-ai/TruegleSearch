/* Radar is OPTIONAL, and an absent key must not look like an outage.
 *
 * WHY THIS EXISTS. Every handler in routes/radar.js turns an upstream failure
 * into a 500. With no Radar key configured the upstream failure is a 401 on
 * every single call, so an unconfigured Radar reported itself as a broken
 * server. On the map that surfaced as:
 *
 *   radar: Request failed with status code 500
 *
 * which reads as "Radar is down" and cost a round of API-key replacement to
 * rule out — the keys were never the problem, and Radar was never configured.
 *
 * This boots the REAL router with the key removed and asserts the answer is
 * 503 with a reason, spending no upstream request to say it.
 *
 * Run it:  npm run radar:test
 */
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.ENCRYPTION_KEY = 'y'.repeat(32);
process.env.NODE_ENV = 'production';
delete process.env.RADAR_LIVE_SECRET_KEY;
delete process.env.RADAR_TEST_SECRET_KEY;

const { default: express } = await import('express');
const { default: radarRouter } = await import('../routes/radar.js');

const app = express();
app.use(express.json());
app.use('/api/radar', radarRouter);

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/api/radar`;

// Every route, not just the one that was reported: they all share the fault.
for (const [path, body] of [
  ['/search-places', { near: { lat: 43.797, lng: -123.059 }, options: { query: 'coffee' } }],
  ['/geocode', { query: 'cottage grove oregon' }],
  ['/directions', { origin: { latitude: 43.79, longitude: -123.05 }, destination: { latitude: 44.05, longitude: -123.09 } }],
]) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  check(res.status === 503, `${path} answers 503, not 500`, `got ${res.status}`);
  check(/secret key is not set/.test(payload.message || ''),
    `${path} says WHY it declined`, JSON.stringify(payload).slice(0, 120));
}

server.close();
for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
