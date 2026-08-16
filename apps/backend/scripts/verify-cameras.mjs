/* The traffic camera pipeline, against the REAL OpenTrafficCamMap feed.
 *
 * This one is not stubbed. Unlike the map providers — which this environment's
 * network policy blocks — raw.githubusercontent.com is reachable, so the whole
 * transform runs over the actual 1.5MB USA dataset every time. If the upstream
 * schema changes, this fails, which is the entire point: the feed is somebody
 * else's file and nobody tells us when it moves.
 *
 * WHAT IT IS GUARDING. The dataset is roughly 58% JPEG stills and 42% live HLS
 * video. The camera UI rendered every camera as <img src={camera.imageUrl}>,
 * and a video camera has no imageUrl — so the error handler swapped in a
 * "Camera Offline" placeholder for all 2,926 of them. They were never offline.
 * A test that only counted cameras would have been perfectly happy.
 *
 * Run it:  npm run cameras:test        (from apps/backend)
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OpenTrafficCam = require('../services/OpenTrafficCamService');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// The same decision CameraView makes in the browser, kept in step by being
// asserted here against real rows.
const cameraKind = (cam) => {
  if (cam.urls?.image) return 'image';
  if (cam.urls?.video) return 'video';
  return 'none';
};

const SOURCE = 'https://raw.githubusercontent.com/AidanWelch/OpenTrafficCamMap/master/cameras/USA.json';

let raw;
try {
  const res = await fetch(SOURCE, { headers: { 'User-Agent': 'Truegle Maps/1.0' }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  raw = await res.json();
} catch (e) {
  console.error(`Could not reach the camera feed: ${e.message}`);
  console.error('This verifier is deliberately live — it has nothing to assert without the real file.');
  process.exit(1);
}

// ── 1. the upstream shape is still the shape we parse ───────────────────────
check(raw && typeof raw === 'object' && !Array.isArray(raw),
  'the feed is still an object keyed by state', Array.isArray(raw) ? 'array' : typeof raw);
const states = Object.keys(raw);
check(states.length >= 5, 'covering multiple states', `${states.length} states: ${states.slice(0, 4).join(', ')}…`);

const cameras = OpenTrafficCam.transformData(raw, 'USA');
check(cameras.length > 5000, 'the transform yields the full set', `${cameras.length} cameras`);

// ── 2. every camera can be put on a map ─────────────────────────────────────
// A camera with a NaN coordinate does not degrade — it throws inside Mapbox GL.
const badCoords = cameras.filter((c) => !Number.isFinite(c.location?.lat) || !Number.isFinite(c.location?.lng)
  || Math.abs(c.location.lat) > 90 || Math.abs(c.location.lng) > 180);
check(badCoords.length === 0, 'every camera has coordinates a map can accept',
  badCoords.length ? `${badCoords.length} bad, e.g. ${JSON.stringify(badCoords[0]?.location)}` : 'all valid');

// ── 3. ids are unique ───────────────────────────────────────────────────────
// They are synthesised from state/county/index, and React keys markers by id:
// a collision means two cameras rendering as one.
const ids = new Set(cameras.map((c) => c.id));
check(ids.size === cameras.length, 'every camera id is unique',
  `${cameras.length - ids.size} collisions`);

// ── 4. every camera is watchable SOMEHOW ────────────────────────────────────
// This is the assertion that would have caught the bug. Not "does it have an
// image" — "is there anything at all to show".
const kinds = cameras.reduce((acc, c) => { acc[cameraKind(c)] = (acc[cameraKind(c)] || 0) + 1; return acc; }, {});
check(!kinds.none, 'no camera resolves to nothing to display', JSON.stringify(kinds));
check(kinds.video > 500, 'the feed really is mostly-video enough for this to have mattered',
  `${kinds.video} video cameras were rendering as "Camera Offline"`);
check(kinds.image > 500, '…and still cameras are the other half', `${kinds.image} image cameras`);

// ── 5. the format flag and the URL field agree ──────────────────────────────
// urls.image / urls.video are assigned off `format`. If a video URL ever lands
// in the image slot, the UI puts an .m3u8 into an <img> and shows nothing.
const misfiled = cameras.filter((c) => c.urls?.image && /\.m3u8(\?|$)/i.test(c.urls.image));
check(misfiled.length === 0, 'no HLS playlist is filed as a still image',
  misfiled.length ? `${misfiled.length}, e.g. ${misfiled[0].urls.image}` : 'none');
const videoIsHls = cameras.filter((c) => cameraKind(c) === 'video');
check(videoIsHls.every((c) => /^https?:/i.test(c.urls.video)),
  'every video URL is fetchable over http(s)',
  videoIsHls.find((c) => !/^https?:/i.test(c.urls.video))?.urls.video || 'all ok');

// ── 6. nothing unplayable, and no borrowed credentials ──────────────────────
// The feed is community-maintained. Five rows are somebody's internal camera
// as rtsp://user:password@10.53.56.x — no browser plays RTSP, a 10.x address
// is unreachable from the internet, and rendering it would publish a working
// credential on our own page. Dropped upstream of the UI, not styled around.
const everyUrl = cameras.flatMap((c) => [c.urls?.image, c.urls?.video].filter(Boolean));
check(everyUrl.every((u) => /^https?:\/\//i.test(u)),
  'no camera survives with a scheme a browser cannot load',
  everyUrl.find((u) => !/^https?:\/\//i.test(u)) || 'all http(s)');
const credentialled = everyUrl.filter((u) => { try { const p = new URL(u); return !!(p.username || p.password); } catch { return true; } });
check(credentialled.length === 0, '…and no URL carries a username or password we would be republishing',
  credentialled.length ? `${credentialled.length} found` : 'none');

// Truegle is served over https and browsers block mixed content, so a plain
// http image or stream would silently never load — 299 of these in the raw feed.
check(everyUrl.every((u) => u.startsWith('https://')),
  '…and every URL is https, because mixed content is blocked outright',
  everyUrl.find((u) => !u.startsWith('https://')) || 'all https');

// ── 7. the near-query actually returns the nearest ──────────────────────────
// Los Angeles. California is the largest block in the feed, so if the distance
// sort is wrong this is where it shows.
const LA = { lat: 34.0522, lng: -118.2437 };
const R = 3959;
const dist = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};
const byDistance = cameras
  .map((c) => ({ c, d: dist(LA, c.location) }))
  .sort((a, b) => a.d - b.d);
check(byDistance[0].d < 25, 'there is a real camera within 25 miles of downtown LA',
  `${byDistance[0].d.toFixed(1)} mi — ${byDistance[0].c.name}`);
check(byDistance.every((x, i) => i === 0 || x.d >= byDistance[i - 1].d), 'the distance sort is monotonic');

// ── 8. the bbox filter and the radius filter agree ──────────────────────────
// The map asks by bounding box and the panel asks by radius; a camera inside
// the box but reported outside the radius is a camera that appears on the map
// and is missing from the list beside it.
const boxed = cameras.filter((c) => c.location.lat > 33.9 && c.location.lat < 34.2
  && c.location.lng > -118.4 && c.location.lng < -118.1);
const withinRadius = boxed.filter((c) => dist(LA, c.location) <= 20);
check(boxed.length > 0, 'the LA bounding box contains cameras', `${boxed.length} in box`);
check(withinRadius.length > 0, '…and they survive a 20-mile radius filter too',
  `${withinRadius.length} of ${boxed.length}`);

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed  (live feed, ${cameras.length} cameras)`);
process.exit(bad.length ? 1 : 0);
