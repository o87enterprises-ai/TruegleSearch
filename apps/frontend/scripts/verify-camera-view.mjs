/* CameraView in a real browser.
 *
 * verify-cameras.mjs (backend) proves the DATA: 7,024 cameras, 2,921 of them
 * HLS video. This proves the UI does the right thing with both kinds, which is
 * the half that was broken — every camera was rendered as an <img>, so a video
 * camera got a null src, tripped the error handler and displayed "Camera
 * Offline". They were never offline.
 *
 * It also checks the cost. hls.js is 185KB gzipped and must be fetched only
 * when somebody actually opens a video camera. Two earlier attempts failed that
 * quietly: the manualChunks catch-all bundled it into the eager vendor chunk,
 * and naming it as its own chunk got it listed in index.html as a modulepreload
 * — a separate file that every visitor still downloads.
 *
 * The camera endpoints themselves are stubbed; this is about which element is
 * rendered and what is fetched, not about whether a Californian freeway camera
 * is up.
 *
 * ONE LIMIT, STATED PLAINLY: the Chromium in this sandbox is built without an
 * H.264 decoder (MediaSource.isTypeSupported('avc1…') is false), so hls.js
 * cannot actually decode anything here regardless of how valid the manifest is.
 * These assertions prove the video PATH is taken and that hls.js is fetched
 * lazily. Whether a real traffic camera plays needs a browser with the codec.
 *
 * Run it:  npm run cameraview:test
 */
import { createServer } from 'vite';
import { launchChromium, until } from './lib/browser.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// A harness page inside the Vite root, so the dev server transforms it and the
// component is exercised as the app loads it rather than as a copy.
mkdirSync('dev/.build', { recursive: true });
const HARNESS = 'dev/.build/camera-harness.html';
writeFileSync(HARNESS, `<!doctype html><html><body><div id="root"></div>
<script type="module">
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import CameraView from '/src/components/map/CameraView.jsx';

  const still = { id: 'a', name: 'Still cam', imageUrl: 'https://example.test/cam.jpg', streamUrl: null };
  const video = { id: 'b', name: 'Video cam', imageUrl: null, streamUrl: 'https://example.test/cam.m3u8' };
  const dead  = { id: 'c', name: 'Dead cam',  imageUrl: null, streamUrl: null };

  createRoot(document.getElementById('root')).render(
    React.createElement('div', null,
      React.createElement('div', { id: 'still' }, React.createElement(CameraView, { camera: still })),
      React.createElement('div', { id: 'dead' },  React.createElement(CameraView, { camera: dead })),
    ),
  );
  // Mounted on demand, so "was hls fetched" can be asked before and after.
  window.__mountVideo = () => createRoot(
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'video' })),
  ).render(React.createElement(CameraView, { camera: video }));
</script></body></html>`);

const server = await createServer({ server: { port: 5188, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5188';
const browser = await launchChromium();
const ctx = await browser.newContext();

// Never let the fake camera URLs actually leave. A REAL 1x1 GIF, not an empty
// body — an invalid image trips the same onError path a dead camera does, so
// an empty stub would have the test proving the failure state by accident.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
// A VALID playlist, not a stub one-liner. hls.js rejects a malformed manifest
// as fatal within a couple of hundred milliseconds, which would have this test
// measuring the failure path while claiming to measure the working one.
const PLAYLIST = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:10',
  '#EXT-X-MEDIA-SEQUENCE:0', '#EXTINF:10.0,', 'seg0.ts', '#EXT-X-ENDLIST', ''].join('\n');
await ctx.route('**/example.test/**', (route) => {
  const url = route.request().url();
  if (url.includes('.m3u8')) return route.fulfill({ status: 200, contentType: 'application/vnd.apple.mpegurl', body: PLAYLIST });
  // The segment is never decodable, which is fine: the manifest parsing is
  // what decides whether a <video> is put on screen.
  if (url.includes('.ts')) return route.fulfill({ status: 200, contentType: 'video/mp2t', body: Buffer.alloc(188) });
  return route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
});

const errs = [];
const requests = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message));
page.on('request', (r) => requests.push(r.url()));

await page.goto(`${BASE}/${HARNESS}`, { waitUntil: 'networkidle' });
// Wait for the first thing asserted on rather than for a second and a half.
await until(() => page.locator('#still img').count().then((n) => n === 1),
  { what: 'the still camera image' }).catch(() => { /* asserted below */ });

// ── 1. a still camera is an image ───────────────────────────────────────────
check(await page.locator('#still img').count() === 1, 'a still camera renders an image');
const src = await page.locator('#still img').getAttribute('src');
check(/[?&]t=/.test(src), '…with a cache-buster, so "live" is not a frame from ten minutes ago', src);

// ── 2. a video camera is a video, not a broken image ────────────────────────
const hlsBefore = requests.filter((u) => /hls/i.test(u)).length;
await page.evaluate(() => window.__mountVideo());
// Checked while it is still attaching. The stub playlist is one line of
// #EXTM3U with no segments, so hls.js quite correctly declares it fatal a
// moment later — asserting after that would be measuring the stub, not the
// component.
await page.waitForTimeout(600);

// The branch, not the pixels. This sandbox's Chromium is built without an
// H.264 decoder — MediaSource.isTypeSupported('avc1…') is false — so hls.js
// always ends fatal here no matter how valid the manifest is. What can be
// proven is that a video camera takes the video path instead of being handed
// to an <img> with a null src, which is the whole bug.
check(await page.locator('#video [data-camera-kind="video"]').count() === 1,
  'a video camera takes the video path rather than the image path',
  await page.locator('#video [data-camera-kind]').getAttribute('data-camera-kind'));
check(await page.locator('#video img').count() === 0, '…and renders no image at all');
check(await page.locator('#still [data-camera-kind="image"]').count() === 1,
  'a still camera takes the image path');

// ── 3. hls.js arrives only when a video camera does ─────────────────────────
check(hlsBefore === 0, 'hls.js is NOT fetched just for loading the page', `${hlsBefore} requests before`);
await page.waitForTimeout(2000);
const hlsAfter = requests.filter((u) => /hls/i.test(u)).length;
check(hlsAfter > 0, '…and IS fetched once a video camera is opened', `${hlsAfter} requests after`);

// ── 4. and it is never called "offline" ─────────────────────────────────────
// The exact regression: "Camera Offline" was displayed for 2,921 cameras that
// were working perfectly. Whatever else this says, it must never say that.
const videoText = (await page.locator('#video').innerText()).trim();
check(!/offline/i.test(videoText), 'a live stream is never described as an offline camera', videoText || '(playing, no text)');

// ── 5. a camera with no feed says so honestly ───────────────────────────────
const deadText = (await page.locator('#dead').innerText()).trim();
check(/not publishing|not responding/i.test(deadText),
  'a camera with nothing to show explains itself instead of showing a broken frame', deadText);

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
rmSync(HARNESS, { force: true });
process.exit(bad.length ? 1 : 0);
